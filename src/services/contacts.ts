import db from '../db/supabase';
import gpt4Service from '../ai/gpt4';
import googleSheetsService from './googleSheets';
import logger from '../utils/logger';

class ContactService {
  async addFromTranscript(userId: string, transcript: string): Promise<any> {
    try {
      // Extract contact information from transcript
      const contactInfo = await gpt4Service.extractContactInfo(transcript);
      
      if (!contactInfo.name) {
        throw new Error('Could not extract contact name from transcript');
      }

      // Check if contact already exists
      const existingContacts = await db.contacts.findByUserId(userId);
      const existing = existingContacts.find(
        (c: any) => 
          contactInfo.name && c.name.toLowerCase() === (contactInfo.name || '').toLowerCase() ||
          (contactInfo.email && c.email === contactInfo.email) ||
          (contactInfo.phone && c.phone === contactInfo.phone)
      );

      let contact;
      if (existing) {
        // Update existing contact
        const updates: any = {
          voice_notes: [...(existing.voice_notes || []), transcript],
        };
        
        // Update fields if they're more complete
        if (contactInfo.company && !existing.company) updates.company = contactInfo.company;
        if (contactInfo.title && !existing.title) updates.title = contactInfo.title;
        if (contactInfo.location && !existing.location) updates.location = contactInfo.location;
        if (contactInfo.notes) {
          updates.notes = existing.notes 
            ? `${existing.notes}\n\n${contactInfo.notes}`
            : contactInfo.notes;
        }

        contact = await db.contacts.update(existing.id, updates);
      } else {
        // Create new contact
        contact = await db.contacts.create({
          user_id: userId,
          ...contactInfo,
          voice_notes: [transcript],
        });

        // Calculate initial relationship score
        await this.updateRelationshipScore(contact.id);
      }

      // Enrich contact with additional data
      await this.enrichAndSyncContact(contact, userId);

      return contact;
    } catch (error) {
      logger.error('Error adding contact from transcript:', error);
      throw error;
    }
  }

  /**
   * Enrich contact with additional data and sync to Google Sheets
   */
  async enrichAndSyncContact(contact: any, userId: string): Promise<void> {
    try {
      // Get user's Google Sheets configuration
      const user = await db.users.findById(userId);
      if (!user) {
        logger.warn(`User ${userId} not found for Google Sheets sync`);
        return;
      }

      const userGoogleConfig = {
        access_token: user.google_access_token,
        refresh_token: user.google_refresh_token,
        spreadsheet_id: user.google_sheets_id,
        spreadsheet_url: user.google_sheets_url,
        connected_at: user.updated_at
      };

      // Enrich contact with external data
      const enrichment = await googleSheetsService.enrichContact(contact);
      
      // Update contact with enriched data
      const enrichedUpdates: any = {};
      
      if (enrichment.company_info) {
        enrichedUpdates.industry = enrichment.company_info.industry;
        enrichedUpdates.website = enrichment.company_info.website;
        enrichedUpdates.linkedin_url = enrichment.company_info.linkedin;
      }
      
      if (enrichment.person_info) {
        enrichedUpdates.linkedin_url = enrichment.person_info.linkedin_profile;
        enrichedUpdates.twitter_url = enrichment.person_info.twitter_profile;
      }
      
      if (enrichment.relationship_insights) {
        enrichedUpdates.ai_insights = {
          ...contact.ai_insights,
          mutual_connections: enrichment.relationship_insights.mutual_connections,
          common_interests: enrichment.relationship_insights.common_interests,
          potential_collaborations: enrichment.relationship_insights.potential_collaborations,
          enriched_at: new Date().toISOString()
        };
      }

      // Update contact in database
      if (Object.keys(enrichedUpdates).length > 0) {
        await db.contacts.update(contact.id, enrichedUpdates);
        logger.info(`Enriched contact ${contact.name} with additional data`);
      }

      // Sync all contacts to user's Google Sheets if connected
      if (userGoogleConfig.access_token && userGoogleConfig.spreadsheet_id) {
        await this.syncContactsToGoogleSheets(userId, userGoogleConfig);
      }
      
    } catch (error) {
      logger.error('Error enriching and syncing contact:', error);
      // Don't throw error to avoid breaking the main flow
    }
  }

  /**
   * Sync all contacts to user's Google Sheets
   */
  async syncContactsToGoogleSheets(userId: string, userGoogleConfig?: any): Promise<void> {
    try {
      const contacts = await db.contacts.findByUserId(userId);
      
      // If no user config provided, get it from database
      if (!userGoogleConfig) {
        const user = await db.users.findById(userId);
        if (!user || !user.google_access_token || !user.google_sheets_id) {
          logger.warn(`User ${userId} not connected to Google Sheets`);
          return;
        }
        
        userGoogleConfig = {
          access_token: user.google_access_token,
          refresh_token: user.google_refresh_token,
          spreadsheet_id: user.google_sheets_id,
          spreadsheet_url: user.google_sheets_url,
          connected_at: user.updated_at
        };
      }

      await googleSheetsService.syncContactsToSheet(contacts, userId, userGoogleConfig);
      logger.info(`Synced ${contacts.length} contacts to user's Google Sheets`);
    } catch (error) {
      logger.error('Error syncing contacts to Google Sheets:', error);
    }
  }

  async importTelegramContact(userId: string, telegramContact: any): Promise<any> {
    try {
      const contactData = {
        user_id: userId,
        name: `${telegramContact.first_name} ${telegramContact.last_name || ''}`.trim(),
        phone: telegramContact.phone_number,
        telegram_username: telegramContact.user_id ? `user_${telegramContact.user_id}` : undefined,
      };

      return await db.contacts.create(contactData);
    } catch (error) {
      logger.error('Error importing Telegram contact:', error);
      throw error;
    }
  }

  async searchFromTranscript(userId: string, transcript: string): Promise<any[]> {
    try {
      // Extract search terms from transcript
      const searchTerms = await gpt4Service.extractSearchTerms(transcript);
      
      // Search contacts based on extracted terms
      const contacts = await db.contacts.findByUserId(userId);
      
      return contacts.filter((contact: any) => {
        const searchText = `${contact.name} ${contact.company} ${contact.title} ${contact.notes}`.toLowerCase();
        return searchTerms.some((term: string) => searchText.includes(term.toLowerCase()));
      });
    } catch (error) {
      logger.error('Error searching contacts from transcript:', error);
      return [];
    }
  }

  async findByCompany(userId: string, company: string): Promise<any[]> {
    try {
      const contacts = await db.contacts.findByUserId(userId);
      return contacts.filter((contact: any) => 
        contact.company && contact.company.toLowerCase().includes(company.toLowerCase())
      );
    } catch (error) {
      logger.error('Error finding contacts by company:', error);
      return [];
    }
  }

  async findByRole(userId: string, role: string): Promise<any[]> {
    try {
      const contacts = await db.contacts.findByUserId(userId);
      return contacts.filter((contact: any) => 
        contact.title && contact.title.toLowerCase().includes(role.toLowerCase())
      );
    } catch (error) {
      logger.error('Error finding contacts by role:', error);
      return [];
    }
  }

  async findByType(userId: string, type: string): Promise<any[]> {
    try {
      const contacts = await db.contacts.findByUserId(userId);
      
      // Map type keywords to contact attributes
      const typeMappings: { [key: string]: string[] } = {
        'investor': ['investor', 'vc', 'angel', 'fund'],
        'founder': ['founder', 'ceo', 'co-founder', 'startup'],
        'technical': ['engineer', 'developer', 'cto', 'technical'],
        'marketing': ['marketing', 'growth', 'brand'],
        'sales': ['sales', 'business development', 'bd'],
        'design': ['design', 'ux', 'ui', 'creative']
      };
      
      const searchTerms = typeMappings[type.toLowerCase()] || [type];
      
      return contacts.filter((contact: any) => {
        const contactText = `${contact.title} ${contact.company} ${contact.notes}`.toLowerCase();
        return searchTerms.some(term => contactText.includes(term));
      });
    } catch (error) {
      logger.error('Error finding contacts by type:', error);
      return [];
    }
  }

  async findNeedingFollowUp(userId: string): Promise<any[]> {
    try {
      const contacts = await db.contacts.findByUserId(userId);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      return contacts.filter((contact: any) => {
        if (!contact.last_interaction_date) return true;
        return new Date(contact.last_interaction_date) < thirtyDaysAgo;
      }).slice(0, 10); // Limit to top 10
    } catch (error) {
      logger.error('Error finding contacts needing follow-up:', error);
      return [];
    }
  }

  async findStrongestConnections(userId: string): Promise<any[]> {
    try {
      const contacts = await db.contacts.findByUserId(userId);
      return contacts
        .filter((contact: any) => contact.relationship_strength)
        .sort((a: any, b: any) => (b.relationship_strength || 0) - (a.relationship_strength || 0))
        .slice(0, 10);
    } catch (error) {
      logger.error('Error finding strongest connections:', error);
      return [];
    }
  }

  async findRecentContacts(userId: string): Promise<any[]> {
    try {
      const contacts = await db.contacts.findByUserId(userId);
      return contacts
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 10);
    } catch (error) {
      logger.error('Error finding recent contacts:', error);
      return [];
    }
  }

  async findByExpertise(userId: string, topic: string): Promise<any[]> {
    try {
      const contacts = await db.contacts.findByUserId(userId);
      
      // Simple keyword matching for expertise
      const expertiseKeywords = topic.toLowerCase().split(' ');
      
      return contacts.filter((contact: any) => {
        const contactText = `${contact.title} ${contact.company} ${contact.notes}`.toLowerCase();
        return expertiseKeywords.some(keyword => contactText.includes(keyword));
      });
    } catch (error) {
      logger.error('Error finding contacts by expertise:', error);
      return [];
    }
  }

  async updateRelationshipScore(contactId: string): Promise<void> {
    try {
      const contact = await db.contacts.findById(contactId);
      if (!contact) return;

      // Calculate relationship score based on various factors
      const score = await this.calculateRelationshipScore(contact);
      
      await db.contacts.update(contactId, {
        relationship_strength: score,
        updated_at: new Date()
      });

      logger.info(`Updated relationship score for ${contact.name}: ${score}/100`);
    } catch (error) {
      logger.error('Error updating relationship score:', error);
    }
  }

  private async calculateRelationshipScore(contact: any): Promise<number> {
    let score = 0;

    // Base score from having contact info
    if (contact.name) score += 10;
    if (contact.email) score += 5;
    if (contact.phone) score += 5;
    if (contact.company) score += 5;
    if (contact.title) score += 5;

    // Voice notes indicate interaction depth
    if (contact.voice_notes && contact.voice_notes.length > 0) {
      score += Math.min(contact.voice_notes.length * 5, 25); // Max 25 points for voice notes
    }

    // Recency bonus (recent interactions are worth more)
    if (contact.last_interaction_date) {
      const daysSinceLastInteraction = Math.floor(
        (Date.now() - new Date(contact.last_interaction_date).getTime()) / (1000 * 60 * 60 * 24)
      );
      
      if (daysSinceLastInteraction <= 7) score += 20;
      else if (daysSinceLastInteraction <= 30) score += 15;
      else if (daysSinceLastInteraction <= 90) score += 10;
      else if (daysSinceLastInteraction <= 365) score += 5;
    }

    // Company size/importance bonus
    if (contact.company) {
      const company = contact.company.toLowerCase();
      if (company.includes('google') || company.includes('microsoft') || company.includes('apple') || 
          company.includes('amazon') || company.includes('meta') || company.includes('netflix')) {
        score += 10; // Big tech bonus
      } else if (company.includes('startup') || company.includes('inc') || company.includes('llc')) {
        score += 5; // Startup bonus
      }
    }

    // Role importance bonus
    if (contact.title) {
      const title = contact.title.toLowerCase();
      if (title.includes('ceo') || title.includes('founder') || title.includes('cto') || 
          title.includes('coo') || title.includes('president')) {
        score += 10; // Leadership bonus
      } else if (title.includes('manager') || title.includes('director') || title.includes('head')) {
        score += 5; // Management bonus
      }
    }

    // Cap at 100
    return Math.min(score, 100);
  }

  async findSimilar(contactId: string, limit: number = 5): Promise<any[]> {
    try {
      const contact = await db.contacts.findById(contactId);
      const allContacts = await db.contacts.findByUserId(contact.user_id);
      
      const contactText = `${contact.name} ${contact.company} ${contact.title} ${contact.notes}`;
      const embedding = await gpt4Service.createEmbedding(contactText);
      
      const similar = await gpt4Service.findSimilarContacts(
        embedding,
        allContacts.filter((c: any) => c.id !== contactId),
        0.7
      );
      
      return similar.slice(0, limit);
    } catch (error) {
      logger.error('Error finding similar contacts:', error);
      return [];
    }
  }

  async addInteraction(contactId: string, interactionData: any): Promise<any> {
    try {
      const contact = await db.contacts.findById(contactId);
      
      const interaction = await db.interactions.create({
        user_id: contact.user_id,
        contact_id: contactId,
        ...interactionData,
      });

      // Update contact's last interaction
      await db.contacts.update(contactId, {
        last_interaction: new Date().toISOString(),
        interaction_count: (contact.interaction_count || 0) + 1,
      });

      // Update relationship score
      await this.updateRelationshipScore(contactId);

      return interaction;
    } catch (error) {
      logger.error('Error adding interaction:', error);
      throw error;
    }
  }

  async getContactSummary(contactId: string): Promise<any> {
    try {
      const contact = await db.contacts.findById(contactId);
      const interactions = await db.interactions.findByContact(contactId, 10);
      
      return {
        ...contact,
        recent_interactions: interactions,
        interaction_count: interactions.length,
      };
    } catch (error) {
      logger.error('Error getting contact summary:', error);
      throw error;
    }
  }

  async updateContact(contactId: string, updates: any): Promise<any> {
    try {
      const updated = await db.contacts.update(contactId, updates);
      
      // Update relationship score if relevant fields changed
      if (updates.notes || updates.company || updates.title) {
        await this.updateRelationshipScore(contactId);
      }
      
      return updated;
    } catch (error) {
      logger.error('Error updating contact:', error);
      throw error;
    }
  }

  async deleteContact(contactId: string): Promise<void> {
    try {
      // Note: This will cascade delete interactions due to foreign key constraints
      await db.contacts.delete(contactId);
    } catch (error) {
      logger.error('Error deleting contact:', error);
      throw error;
    }
  }
}

export default new ContactService();
