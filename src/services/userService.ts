import db from '../db/supabase';
import logger from '../utils/logger';

export class UserService {
  async getOrCreateUser(telegramData: {
    telegram_id: number;
    username?: string;
    first_name?: string;
    last_name?: string;
  }) {
    try {
      // Try to find existing user
      let user = await db.users.findByTelegramId(telegramData.telegram_id);
      
      if (!user) {
        // Create new user
        user = await db.users.create({
          telegram_id: telegramData.telegram_id,
          username: telegramData.username,
          first_name: telegramData.first_name,
          last_name: telegramData.last_name,
          onboarding_completed: false,
          onboarding_step: 0,
          subscription_tier: 'root_alpha',
          goals: [],
          preferences: {},
          created_at: new Date(),
          updated_at: new Date(),
          last_active_at: new Date()
        });
        
        logger.info(`Created new user: ${telegramData.telegram_id}`);
      } else {
        // Update last active time
        await db.users.update(user.id, {
          last_active_at: new Date(),
          // Update profile info if changed
          username: telegramData.username || user.username,
          first_name: telegramData.first_name || user.first_name,
          last_name: telegramData.last_name || user.last_name
        });
      }
      
      return user;
    } catch (error) {
      logger.error('Error in getOrCreateUser:', error);
      throw error;
    }
  }

  async getUserContacts(userId: string) {
    try {
      return await db.contacts.findByUserId(userId);
    } catch (error) {
      logger.error('Error getting user contacts:', error);
      throw error;
    }
  }

  async saveContact(userId: string, contactData: {
    name: string;
    company?: string;
    title?: string;
    email?: string;
    phone?: string;
    source?: string;
    notes?: string;
    met_at?: string;
  }) {
    try {
      // Check for duplicates
      const existingContacts = await this.getUserContacts(userId);
      const duplicate = existingContacts?.find((contact: any) => 
        contact.name.toLowerCase() === contactData.name.toLowerCase() &&
        contact.company?.toLowerCase() === contactData.company?.toLowerCase()
      );

      if (duplicate) {
        // Update existing contact
        return await db.contacts.update(duplicate.id, {
          ...contactData,
          updated_at: new Date()
        });
      } else {
        // Create new contact
        return await db.contacts.create({
          user_id: userId,
          ...contactData,
          source: contactData.source || 'text_input',
          created_at: new Date(),
          updated_at: new Date()
        });
      }
    } catch (error) {
      logger.error('Error saving contact:', error);
      throw error;
    }
  }

  async searchContacts(userId: string, searchTerm: string) {
    try {
      const contacts = await this.getUserContacts(userId);
      
      if (!contacts) return [];
      
      return contacts.filter((contact: any) => 
        contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.email?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    } catch (error) {
      logger.error('Error searching contacts:', error);
      return [];
    }
  }

  async getNetworkStats(userId: string) {
    try {
      const contacts = await this.getUserContacts(userId);
      
      if (!contacts) {
        return {
          totalContacts: 0,
          companies: 0,
          recentContacts: []
        };
      }
      
      const companies = [...new Set(contacts.map((c: any) => c.company).filter(Boolean))];
      const recentContacts = contacts
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 3);
      
      return {
        totalContacts: contacts.length,
        companies: companies.length,
        recentContacts
      };
    } catch (error) {
      logger.error('Error getting network stats:', error);
      return {
        totalContacts: 0,
        companies: 0,
        recentContacts: []
      };
    }
  }

  async getMostRecentContact(userId: string) {
    try {
      const contacts = await this.getUserContacts(userId);
      
      if (!contacts || contacts.length === 0) return null;
      
      return contacts.sort((a: any, b: any) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0];
    } catch (error) {
      logger.error('Error getting most recent contact:', error);
      return null;
    }
  }
}

export default new UserService();