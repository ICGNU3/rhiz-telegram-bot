import db from '../db/supabase';
import gpt4Service from '../ai/gpt4';
import logger from '../utils/logger';

interface Introduction {
  id: string;
  user_id: string;
  from_contact_id: string;
  to_contact_id: string;
  reason: string;
  suggested_message: string;
  status: 'suggested' | 'sent' | 'accepted' | 'declined';
  sent_at?: string;
  response?: string;
  created_at: string;
}

interface IntroductionSuggestion {
  from_contact: any;
  to_contact: any;
  reason: string;
  confidence: number;
  mutual_interests: string[];
}

class IntroductionService {
  async suggestFromGoals(userId: string): Promise<Introduction[]> {
    try {
      const goals = await db.goals.findByUserId(userId, 'active');
      const contacts = await db.contacts.findByUserId(userId);
      
      if (goals.length === 0 || contacts.length < 2) {
        return [];
      }

      // Use AI to analyze goals and suggest introductions
      const suggestions = await gpt4Service.suggestIntroductions(goals, contacts);
      
      // Create introduction records
      const introductions = await Promise.all(
        suggestions.map(async (suggestion: any) => {
          const introMessage = await this.generateMessage(
            suggestion.from_contact.id,
            suggestion.to_contact.id
          );

          return await db.introductions.create({
            user_id: userId,
            from_contact_id: suggestion.from_contact.id,
            to_contact_id: suggestion.to_contact.id,
            reason: suggestion.reason,
            suggested_message: introMessage,
            status: 'suggested',
          });
        })
      );

      return introductions;
    } catch (error) {
      logger.error('Error suggesting introductions from goals:', error);
      return [];
    }
  }

  async suggestFromTranscript(userId: string, transcript: string): Promise<Introduction[]> {
    try {
      // For now, just return suggestions from goals
      // In production, this would analyze the transcript for introduction requests
      return await this.suggestFromGoals(userId);
    } catch (error) {
      logger.error('Error suggesting introductions from transcript:', error);
      return [];
    }
  }

  async generateMessage(fromId: string, toId: string): Promise<string> {
    try {
      const fromContact = await db.contacts.findById(fromId);
      const toContact = await db.contacts.findById(toId);
      
      if (!fromContact || !toContact) {
        throw new Error('Contact not found');
      }

      // Use AI to generate a personalized introduction message
      const message = await gpt4Service.generateIntroduction(fromContact, toContact, '');
      
      return message;
    } catch (error) {
      logger.error('Error generating introduction message:', error);
      return 'I think you two should connect!';
    }
  }

  async markSent(introId: string): Promise<void> {
    try {
      await db.introductions.update(introId, {
        status: 'sent',
        sent_at: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error marking introduction as sent:', error);
      throw error;
    }
  }

  async markAccepted(introId: string, response?: string): Promise<void> {
    try {
      await db.introductions.update(introId, {
        status: 'accepted',
        response,
      });
    } catch (error) {
      logger.error('Error marking introduction as accepted:', error);
      throw error;
    }
  }

  async markDeclined(introId: string, response?: string): Promise<void> {
    try {
      await db.introductions.update(introId, {
        status: 'declined',
        response,
      });
    } catch (error) {
      logger.error('Error marking introduction as declined:', error);
      throw error;
    }
  }

  async getPendingIntroductions(userId: string): Promise<Introduction[]> {
    try {
      return await db.introductions.findByUserId(userId, 'suggested');
    } catch (error) {
      logger.error('Error getting pending introductions:', error);
      return [];
    }
  }

  async getSentIntroductions(userId: string): Promise<Introduction[]> {
    try {
      return await db.introductions.findByUserId(userId, 'sent');
    } catch (error) {
      logger.error('Error getting sent introductions:', error);
      return [];
    }
  }

  async suggestBasedOnInterests(userId: string): Promise<IntroductionSuggestion[]> {
    try {
      const contacts = await db.contacts.findByUserId(userId);
      
      if (contacts.length < 2) {
        return [];
      }

      // Use AI to analyze interests and suggest connections
      const suggestions = await gpt4Service.suggestIntroductionsByInterests(contacts);
      
      return suggestions;
    } catch (error) {
      logger.error('Error suggesting introductions based on interests:', error);
      return [];
    }
  }

  async suggestBasedOnCompany(userId: string): Promise<IntroductionSuggestion[]> {
    try {
      const contacts = await db.contacts.findByUserId(userId);
      
      if (contacts.length < 2) {
        return [];
      }

      // Group contacts by company
      const companyGroups = contacts.reduce((groups: Record<string, any[]>, contact) => {
        if (contact.company) {
          const company = contact.company.toLowerCase();
          if (!groups[company]) {
            groups[company] = [];
          }
          groups[company].push(contact);
        }
        return groups;
      }, {} as Record<string, any[]>);

      // Find contacts from same company who might not know each other
      const suggestions: IntroductionSuggestion[] = [];
      
      for (const [company, companyContacts] of Object.entries(companyGroups)) {
        if (companyContacts.length >= 2) {
          for (let i = 0; i < companyContacts.length; i++) {
            for (let j = i + 1; j < companyContacts.length; j++) {
              const fromContact = companyContacts[i] as any;
              const toContact = companyContacts[j] as any;
              
              // Check if they already have an introduction
              const existingIntro = await db.introductions.findByContacts(
                fromContact.id,
                toContact.id
              );
              
              if (!existingIntro) {
                suggestions.push({
                  from_contact: fromContact,
                  to_contact: toContact,
                  reason: `Both work at ${company}`,
                  confidence: 0.8,
                  mutual_interests: ['Same company'],
                });
              }
            }
          }
        }
      }

      return suggestions;
    } catch (error) {
      logger.error('Error suggesting introductions based on company:', error);
      return [];
    }
  }

  async createIntroduction(
    userId: string,
    fromContactId: string,
    toContactId: string,
    reason: string
  ): Promise<Introduction> {
    try {
      // Check if introduction already exists
      const existingIntro = await db.introductions.findByContacts(fromContactId, toContactId);
      
      if (existingIntro) {
        throw new Error('Introduction already exists between these contacts');
      }

      // Generate introduction message
      const message = await this.generateMessage(fromContactId, toContactId);

      // Create introduction record
      const introduction = await db.introductions.create({
        user_id: userId,
        from_contact_id: fromContactId,
        to_contact_id: toContactId,
        reason,
        suggested_message: message,
        status: 'suggested',
      });

      return introduction;
    } catch (error) {
      logger.error('Error creating introduction:', error);
      throw error;
    }
  }

  async getIntroductionStats(userId: string): Promise<{
    total_suggested: number;
    total_sent: number;
    total_accepted: number;
    total_declined: number;
    acceptance_rate: number;
  }> {
    try {
      const introductions = await db.introductions.findByUserId(userId);
      
      const stats = {
        total_suggested: 0,
        total_sent: 0,
        total_accepted: 0,
        total_declined: 0,
        acceptance_rate: 0,
      };

      introductions.forEach(intro => {
        switch (intro.status) {
          case 'suggested':
            stats.total_suggested++;
            break;
          case 'sent':
            stats.total_sent++;
            break;
          case 'accepted':
            stats.total_accepted++;
            break;
          case 'declined':
            stats.total_declined++;
            break;
        }
      });

      const totalResponded = stats.total_accepted + stats.total_declined;
      stats.acceptance_rate = totalResponded > 0 
        ? Math.round((stats.total_accepted / totalResponded) * 100)
        : 0;

      return stats;
    } catch (error) {
      logger.error('Error getting introduction stats:', error);
      return {
        total_suggested: 0,
        total_sent: 0,
        total_accepted: 0,
        total_declined: 0,
        acceptance_rate: 0,
      };
    }
  }

  async getRecentIntroductions(userId: string, limit: number = 10): Promise<Introduction[]> {
    try {
      return await db.introductions.findRecentByUserId(userId, limit);
    } catch (error) {
      logger.error('Error getting recent introductions:', error);
      return [];
    }
  }

  async deleteIntroduction(introId: string): Promise<void> {
    try {
      await db.introductions.delete(introId);
    } catch (error) {
      logger.error('Error deleting introduction:', error);
      throw error;
    }
  }

  async updateIntroductionMessage(introId: string, newMessage: string): Promise<Introduction> {
    try {
      return await db.introductions.update(introId, {
        suggested_message: newMessage,
      });
    } catch (error) {
      logger.error('Error updating introduction message:', error);
      throw error;
    }
  }

  async getContactIntroductionHistory(contactId: string): Promise<Introduction[]> {
    try {
      return await db.introductions.findByContact(contactId);
    } catch (error) {
      logger.error('Error getting contact introduction history:', error);
      return [];
    }
  }

  async suggestFollowUpActions(introId: string): Promise<string[]> {
    try {
      const introduction = await db.introductions.findById(introId);
      
      if (!introduction) {
        throw new Error('Introduction not found');
      }

      const fromContact = await db.contacts.findById(introduction.from_contact_id);
      const toContact = await db.contacts.findById(introduction.to_contact_id);

      // Use AI to suggest follow-up actions based on the introduction
      const suggestions = await gpt4Service.suggestIntroductionFollowUps(
        introduction,
        fromContact,
        toContact
      );

      return suggestions;
    } catch (error) {
      logger.error('Error suggesting follow-up actions:', error);
      return [];
    }
  }
}

export default new IntroductionService();
