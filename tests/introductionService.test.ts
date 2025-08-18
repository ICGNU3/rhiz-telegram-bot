import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import introductionService from '../src/services/introductions';
import db from '../src/db/supabase';
import gpt4Service from '../src/ai/gpt4';

// Mock dependencies
jest.mock('../src/db/supabase');
jest.mock('../src/ai/gpt4');

const mockDb = db as jest.Mocked<typeof db>;
const mockGpt4Service = gpt4Service as jest.Mocked<typeof gpt4Service>;

describe('IntroductionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('suggestFromGoals', () => {
    it('should suggest introductions based on goals', async () => {
      const userId = 'user123';
      
      const mockGoals = [
        { id: 'goal1', description: 'Raise funding' }
      ];

      const mockContacts = [
        { id: 'contact1', name: 'John Doe', company: 'TechCorp' },
        { id: 'contact2', name: 'Jane Smith', company: 'InvestCorp' }
      ];

      const mockSuggestions = [
        {
          from_contact: mockContacts[0],
          to_contact: mockContacts[1],
          reason: 'Both interested in funding'
        }
      ];

      const mockIntroduction = {
        id: 'intro123',
        user_id: userId,
        from_contact_id: mockContacts[0].id,
        to_contact_id: mockContacts[1].id,
        reason: 'Both interested in funding',
        suggested_message: 'Hi John, I think you should meet Jane...',
        status: 'suggested',
        created_at: new Date().toISOString()
      };

      mockDb.goals.findByUserId.mockResolvedValue(mockGoals);
      mockDb.contacts.findByUserId.mockResolvedValue(mockContacts);
      mockGpt4Service.suggestIntroductions.mockResolvedValue(mockSuggestions);
      mockGpt4Service.generateIntroduction.mockResolvedValue('Hi John, I think you should meet Jane...');
      mockDb.introductions.create.mockResolvedValue(mockIntroduction);

      const result = await introductionService.suggestFromGoals(userId);

      expect(mockDb.goals.findByUserId).toHaveBeenCalledWith(userId, 'active');
      expect(mockDb.contacts.findByUserId).toHaveBeenCalledWith(userId);
      expect(mockGpt4Service.suggestIntroductions).toHaveBeenCalledWith(mockGoals, mockContacts);
      expect(result).toEqual([mockIntroduction]);
    });

    it('should return empty array if no goals or contacts', async () => {
      const userId = 'user123';
      
      mockDb.goals.findByUserId.mockResolvedValue([]);
      mockDb.contacts.findByUserId.mockResolvedValue([]);

      const result = await introductionService.suggestFromGoals(userId);

      expect(result).toEqual([]);
    });
  });

  describe('generateMessage', () => {
    it('should generate introduction message', async () => {
      const fromId = 'contact1';
      const toId = 'contact2';
      
      const mockFromContact = {
        id: fromId,
        name: 'John Doe',
        company: 'TechCorp',
        title: 'CTO'
      };

      const mockToContact = {
        id: toId,
        name: 'Jane Smith',
        company: 'InvestCorp',
        title: 'Partner'
      };

      const mockMessage = 'Hi John, I think you should meet Jane from InvestCorp...';

      mockDb.contacts.findById
        .mockResolvedValueOnce(mockFromContact)
        .mockResolvedValueOnce(mockToContact);
      mockGpt4Service.generateIntroduction.mockResolvedValue(mockMessage);

      const result = await introductionService.generateMessage(fromId, toId);

      expect(mockDb.contacts.findById).toHaveBeenCalledWith(fromId);
      expect(mockDb.contacts.findById).toHaveBeenCalledWith(toId);
      expect(mockGpt4Service.generateIntroduction).toHaveBeenCalledWith(mockFromContact, mockToContact, '');
      expect(result).toBe(mockMessage);
    });

    it('should return default message on error', async () => {
      const fromId = 'contact1';
      const toId = 'contact2';
      
      mockDb.contacts.findById.mockResolvedValue(null);

      const result = await introductionService.generateMessage(fromId, toId);

      expect(result).toBe('I think you two should connect!');
    });
  });

  describe('markSent', () => {
    it('should mark introduction as sent', async () => {
      const introId = 'intro123';
      
      mockDb.introductions.update.mockResolvedValue({
        id: introId,
        status: 'sent',
        sent_at: new Date().toISOString()
      });

      await introductionService.markSent(introId);

      expect(mockDb.introductions.update).toHaveBeenCalledWith(introId, {
        status: 'sent',
        sent_at: expect.any(String)
      });
    });
  });

  describe('markAccepted', () => {
    it('should mark introduction as accepted', async () => {
      const introId = 'intro123';
      const response = 'Great! I would love to connect.';
      
      mockDb.introductions.update.mockResolvedValue({
        id: introId,
        status: 'accepted',
        response
      });

      await introductionService.markAccepted(introId, response);

      expect(mockDb.introductions.update).toHaveBeenCalledWith(introId, {
        status: 'accepted',
        response
      });
    });
  });

  describe('markDeclined', () => {
    it('should mark introduction as declined', async () => {
      const introId = 'intro123';
      const response = 'Not interested at this time.';
      
      mockDb.introductions.update.mockResolvedValue({
        id: introId,
        status: 'declined',
        response
      });

      await introductionService.markDeclined(introId, response);

      expect(mockDb.introductions.update).toHaveBeenCalledWith(introId, {
        status: 'declined',
        response
      });
    });
  });

  describe('getPendingIntroductions', () => {
    it('should return pending introductions', async () => {
      const userId = 'user123';
      
      const mockIntroductions = [
        { id: 'intro1', status: 'suggested' },
        { id: 'intro2', status: 'suggested' }
      ];

      mockDb.introductions.findByUserId.mockResolvedValue(mockIntroductions);

      const result = await introductionService.getPendingIntroductions(userId);

      expect(mockDb.introductions.findByUserId).toHaveBeenCalledWith(userId, 'suggested');
      expect(result).toEqual(mockIntroductions);
    });
  });

  describe('getSentIntroductions', () => {
    it('should return sent introductions', async () => {
      const userId = 'user123';
      
      const mockIntroductions = [
        { id: 'intro1', status: 'sent' },
        { id: 'intro2', status: 'sent' }
      ];

      mockDb.introductions.findByUserId.mockResolvedValue(mockIntroductions);

      const result = await introductionService.getSentIntroductions(userId);

      expect(mockDb.introductions.findByUserId).toHaveBeenCalledWith(userId, 'sent');
      expect(result).toEqual(mockIntroductions);
    });
  });

  describe('suggestBasedOnInterests', () => {
    it('should suggest introductions based on interests', async () => {
      const userId = 'user123';
      
      const mockContacts = [
        { id: 'contact1', name: 'John Doe', interests: ['AI', 'ML'] },
        { id: 'contact2', name: 'Jane Smith', interests: ['AI', 'Data Science'] }
      ];

      const mockSuggestions = [
        {
          from_contact: mockContacts[0],
          to_contact: mockContacts[1],
          reason: 'Both interested in AI',
          confidence: 0.9,
          mutual_interests: ['AI']
        }
      ];

      mockDb.contacts.findByUserId.mockResolvedValue(mockContacts);
      mockGpt4Service.suggestIntroductionsByInterests.mockResolvedValue(mockSuggestions);

      const result = await introductionService.suggestBasedOnInterests(userId);

      expect(mockDb.contacts.findByUserId).toHaveBeenCalledWith(userId);
      expect(mockGpt4Service.suggestIntroductionsByInterests).toHaveBeenCalledWith(mockContacts);
      expect(result).toEqual(mockSuggestions);
    });
  });

  describe('suggestBasedOnCompany', () => {
    it('should suggest introductions for contacts at same company', async () => {
      const userId = 'user123';
      
      const mockContacts = [
        { id: 'contact1', name: 'John Doe', company: 'TechCorp' },
        { id: 'contact2', name: 'Jane Smith', company: 'TechCorp' },
        { id: 'contact3', name: 'Bob Wilson', company: 'OtherCorp' }
      ];

      mockDb.contacts.findByUserId.mockResolvedValue(mockContacts);
      mockDb.introductions.findByContacts.mockResolvedValue(null);

      const result = await introductionService.suggestBasedOnCompany(userId);

      expect(mockDb.contacts.findByUserId).toHaveBeenCalledWith(userId);
      expect(result).toHaveLength(1);
      expect(result[0].from_contact.company).toBe('TechCorp');
      expect(result[0].to_contact.company).toBe('TechCorp');
      expect(result[0].reason).toBe('Both work at techcorp');
    });
  });

  describe('createIntroduction', () => {
    it('should create new introduction', async () => {
      const userId = 'user123';
      const fromContactId = 'contact1';
      const toContactId = 'contact2';
      const reason = 'Both interested in AI';
      
      const mockIntroduction = {
        id: 'intro123',
        user_id: userId,
        from_contact_id: fromContactId,
        to_contact_id: toContactId,
        reason,
        suggested_message: 'Hi John, I think you should meet Jane...',
        status: 'suggested',
        created_at: new Date().toISOString()
      };

      mockDb.introductions.findByContacts.mockResolvedValue(null);
      mockDb.contacts.findById
        .mockResolvedValueOnce({ id: fromContactId, name: 'John Doe', company: 'TechCorp' })
        .mockResolvedValueOnce({ id: toContactId, name: 'Jane Smith', company: 'Startup' });
      mockGpt4Service.generateIntroduction.mockResolvedValue('Hi John, I think you should meet Jane...');
      mockDb.introductions.create.mockResolvedValue(mockIntroduction);

      const result = await introductionService.createIntroduction(userId, fromContactId, toContactId, reason);

      expect(mockDb.introductions.findByContacts).toHaveBeenCalledWith(fromContactId, toContactId);
      expect(mockGpt4Service.generateIntroduction).toHaveBeenCalled();
      expect(mockDb.introductions.create).toHaveBeenCalledWith({
        user_id: userId,
        from_contact_id: fromContactId,
        to_contact_id: toContactId,
        reason,
        suggested_message: 'Hi John, I think you should meet Jane...',
        status: 'suggested'
      });
      expect(result).toEqual(mockIntroduction);
    });

    it('should throw error if introduction already exists', async () => {
      const userId = 'user123';
      const fromContactId = 'contact1';
      const toContactId = 'contact2';
      const reason = 'Both interested in AI';
      
      mockDb.introductions.findByContacts.mockResolvedValue({ id: 'existing' });

      await expect(introductionService.createIntroduction(userId, fromContactId, toContactId, reason))
        .rejects.toThrow('Introduction already exists between these contacts');
    });
  });

  describe('getIntroductionStats', () => {
    it('should return introduction statistics', async () => {
      const userId = 'user123';
      
      const mockIntroductions = [
        { status: 'suggested' },
        { status: 'suggested' },
        { status: 'sent' },
        { status: 'sent' },
        { status: 'accepted' },
        { status: 'accepted' },
        { status: 'declined' }
      ];

      mockDb.introductions.findByUserId.mockResolvedValue(mockIntroductions);

      const result = await introductionService.getIntroductionStats(userId);

      expect(mockDb.introductions.findByUserId).toHaveBeenCalledWith(userId);
      expect(result).toEqual({
        total_suggested: 2,
        total_sent: 2,
        total_accepted: 2,
        total_declined: 1,
        acceptance_rate: 67
      });
    });
  });

  describe('getRecentIntroductions', () => {
    it('should return recent introductions', async () => {
      const userId = 'user123';
      const limit = 5;
      
      const mockIntroductions = [
        { id: 'intro1', created_at: new Date().toISOString() },
        { id: 'intro2', created_at: new Date().toISOString() }
      ];

      mockDb.introductions.findRecentByUserId.mockResolvedValue(mockIntroductions);

      const result = await introductionService.getRecentIntroductions(userId, limit);

      expect(mockDb.introductions.findRecentByUserId).toHaveBeenCalledWith(userId, limit);
      expect(result).toEqual(mockIntroductions);
    });
  });

  describe('deleteIntroduction', () => {
    it('should delete introduction', async () => {
      const introId = 'intro123';
      
      mockDb.introductions.delete.mockResolvedValue(undefined);

      await introductionService.deleteIntroduction(introId);

      expect(mockDb.introductions.delete).toHaveBeenCalledWith(introId);
    });
  });

  describe('updateIntroductionMessage', () => {
    it('should update introduction message', async () => {
      const introId = 'intro123';
      const newMessage = 'Updated introduction message';
      
      const mockUpdatedIntro = {
        id: introId,
        suggested_message: newMessage
      };

      mockDb.introductions.update.mockResolvedValue(mockUpdatedIntro);

      const result = await introductionService.updateIntroductionMessage(introId, newMessage);

      expect(mockDb.introductions.update).toHaveBeenCalledWith(introId, {
        suggested_message: newMessage
      });
      expect(result).toEqual(mockUpdatedIntro);
    });
  });

  describe('getContactIntroductionHistory', () => {
    it('should return contact introduction history', async () => {
      const contactId = 'contact123';
      
      const mockIntroductions = [
        { id: 'intro1', from_contact_id: contactId },
        { id: 'intro2', to_contact_id: contactId }
      ];

      mockDb.introductions.findByContact.mockResolvedValue(mockIntroductions);

      const result = await introductionService.getContactIntroductionHistory(contactId);

      expect(mockDb.introductions.findByContact).toHaveBeenCalledWith(contactId);
      expect(result).toEqual(mockIntroductions);
    });
  });

  describe('suggestFollowUpActions', () => {
    it('should suggest follow-up actions for introduction', async () => {
      const introId = 'intro123';
      
      const mockIntroduction = {
        id: introId,
        from_contact_id: 'contact1',
        to_contact_id: 'contact2'
      };

      const mockFromContact = {
        id: 'contact1',
        name: 'John Doe'
      };

      const mockToContact = {
        id: 'contact2',
        name: 'Jane Smith'
      };

      const mockSuggestions = [
        'Schedule a meeting between John and Jane',
        'Send calendar invite',
        'Follow up in a week'
      ];

      mockDb.introductions.findById.mockResolvedValue(mockIntroduction);
      mockDb.contacts.findById
        .mockResolvedValueOnce(mockFromContact)
        .mockResolvedValueOnce(mockToContact);
      mockGpt4Service.suggestIntroductionFollowUps.mockResolvedValue(mockSuggestions);

      const result = await introductionService.suggestFollowUpActions(introId);

      expect(mockDb.introductions.findById).toHaveBeenCalledWith(introId);
      expect(mockDb.contacts.findById).toHaveBeenCalledWith('contact1');
      expect(mockDb.contacts.findById).toHaveBeenCalledWith('contact2');
      expect(mockGpt4Service.suggestIntroductionFollowUps).toHaveBeenCalledWith(
        mockIntroduction,
        mockFromContact,
        mockToContact
      );
      expect(result).toEqual(mockSuggestions);
    });
  });
});
