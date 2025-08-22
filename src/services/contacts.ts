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
          c.name.toLowerCase() === contactInfo.name.toLowerCase() ||
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
      // Extract search query from transcript
      const searchTerms = transcript
        .toLowerCase()
        .replace(/who is|tell me about|find|search for|do i know/g, '')
        .trim();

      return await db.contacts.search(userId, searchTerms);
    } catch (error) {
      logger.error('Error searching contacts:', error);
      return [];
    }
  }

  async updateRelationshipScore(contactId: string): Promise<void> {
    try {
      const contact = await db.contacts.findById(contactId);
      const interactions = await db.interactions.findByContact(contactId);
      
      const scoreData = await gpt4Service.scoreRelationship(contact, interactions);
      
      await db.contacts.update(contactId, {
        relationship_score: scoreData.score,
        trust_level: scoreData.trust_level,
      });
    } catch (error) {
      logger.error('Error updating relationship score:', error);
    }
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
