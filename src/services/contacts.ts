import db from '../db/supabase';
import gpt4Service from '../ai/gpt4';
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

        return await db.contacts.update(existing.id, updates);
      } else {
        // Create new contact
        const newContact = await db.contacts.create({
          user_id: userId,
          ...contactInfo,
          voice_notes: [transcript],
        });

        // Calculate initial relationship score
        await this.updateRelationshipScore(newContact.id);

        return newContact;
      }
    } catch (error) {
      logger.error('Error adding contact from transcript:', error);
      throw error;
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
