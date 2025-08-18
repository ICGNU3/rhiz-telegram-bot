import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import contactService from '../src/services/contacts';
import db from '../src/db/supabase';
import gpt4Service from '../src/ai/gpt4';

// Mock dependencies
jest.mock('../src/db/supabase');
jest.mock('../src/ai/gpt4');

const mockDb = db as jest.Mocked<typeof db>;
const mockGpt4Service = gpt4Service as jest.Mocked<typeof gpt4Service>;

describe('ContactService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('addFromTranscript', () => {
    it('should extract contact from transcript and create new contact', async () => {
      const transcript = "I just met John Doe at TechCorp, he's the CTO and we discussed potential partnership opportunities";
      const userId = 'user123';
      
      const mockContactInfo = {
        name: 'John Doe',
        company: 'TechCorp',
        title: 'CTO',
        email: undefined,
        phone: undefined,
        notes: 'Discussed potential partnership opportunities'
      };

      const mockNewContact = {
        id: 'contact123',
        user_id: userId,
        ...mockContactInfo,
        voice_notes: [transcript],
        relationship_score: 75,
        trust_level: 'professional'
      };

      mockGpt4Service.extractContactInfo.mockResolvedValue(mockContactInfo);
      mockDb.contacts.findByUserId.mockResolvedValue([]);
      mockDb.contacts.create.mockResolvedValue(mockNewContact);
      mockGpt4Service.scoreRelationship.mockResolvedValue({
        score: 75,
        trust_level: 'professional'
      });

      const result = await contactService.addFromTranscript(userId, transcript);

      expect(mockGpt4Service.extractContactInfo).toHaveBeenCalledWith(transcript);
      expect(mockDb.contacts.findByUserId).toHaveBeenCalledWith(userId);
      expect(mockDb.contacts.create).toHaveBeenCalledWith({
        user_id: userId,
        ...mockContactInfo,
        voice_notes: [transcript]
      });
      expect(result).toEqual(mockNewContact);
    });

    it('should update existing contact if found', async () => {
      const transcript = "I met Sarah Chen again, she's now the CEO at TechStart";
      const userId = 'user123';
      
      const existingContact = {
        id: 'contact456',
        user_id: userId,
        name: 'Sarah Chen',
        company: 'TechStart',
        title: 'CTO',
        voice_notes: ['Previous note'],
        notes: 'Previous notes'
      };

      const mockContactInfo = {
        name: 'Sarah Chen',
        company: 'TechStart',
        title: 'CEO',
        notes: 'She is now the CEO'
      };

      const updatedContact = {
        ...existingContact,
        title: 'CEO',
        voice_notes: [...existingContact.voice_notes, transcript],
        notes: `${existingContact.notes}\n\n${mockContactInfo.notes}`
      };

      mockGpt4Service.extractContactInfo.mockResolvedValue(mockContactInfo);
      mockDb.contacts.findByUserId.mockResolvedValue([existingContact]);
      mockDb.contacts.update.mockResolvedValue(updatedContact);

      const result = await contactService.addFromTranscript(userId, transcript);

      expect(mockDb.contacts.update).toHaveBeenCalledWith(existingContact.id, {
        voice_notes: [...existingContact.voice_notes, transcript],
        title: 'CEO',
        notes: `${existingContact.notes}\n\n${mockContactInfo.notes}`
      });
      expect(result).toEqual(updatedContact);
    });

    it('should throw error if contact name cannot be extracted', async () => {
      const transcript = "I had a great conversation about the weather";
      const userId = 'user123';
      
      mockGpt4Service.extractContactInfo.mockResolvedValue({});

      await expect(contactService.addFromTranscript(userId, transcript))
        .rejects.toThrow('Could not extract contact name from transcript');
    });
  });

  describe('searchFromTranscript', () => {
    it('should search contacts based on transcript', async () => {
      const transcript = "Tell me about David from the conference";
      const userId = 'user123';
      
      const mockContacts = [
        {
          id: 'contact123',
          name: 'David Smith',
          company: 'TechCorp',
          title: 'VP Engineering'
        }
      ];

      mockDb.contacts.search.mockResolvedValue(mockContacts);

      const result = await contactService.searchFromTranscript(userId, transcript);

      expect(mockDb.contacts.search).toHaveBeenCalledWith(userId, 'david from the conference');
      expect(result).toEqual(mockContacts);
    });

    it('should return empty array on error', async () => {
      const transcript = "Who is John?";
      const userId = 'user123';
      
      mockDb.contacts.search.mockRejectedValue(new Error('Database error'));

      const result = await contactService.searchFromTranscript(userId, transcript);

      expect(result).toEqual([]);
    });
  });

  describe('updateRelationshipScore', () => {
    it('should update relationship score for contact', async () => {
      const contactId = 'contact123';
      
      const mockContact = {
        id: contactId,
        name: 'John Doe',
        company: 'TechCorp',
        title: 'CTO'
      };

      const mockInteractions = [
        { id: 'int1', type: 'meeting', content: 'Had coffee' },
        { id: 'int2', type: 'email', content: 'Follow up' }
      ];

      const mockScoreData = {
        score: 85,
        trust_level: 'trusted'
      };

      mockDb.contacts.findById.mockResolvedValue(mockContact);
      mockDb.interactions.findByContact.mockResolvedValue(mockInteractions);
      mockGpt4Service.scoreRelationship.mockResolvedValue(mockScoreData);
      mockDb.contacts.update.mockResolvedValue({ ...mockContact, ...mockScoreData });

      await contactService.updateRelationshipScore(contactId);

      expect(mockDb.contacts.findById).toHaveBeenCalledWith(contactId);
      expect(mockDb.interactions.findByContact).toHaveBeenCalledWith(contactId);
      expect(mockGpt4Service.scoreRelationship).toHaveBeenCalledWith(mockContact, mockInteractions);
      expect(mockDb.contacts.update).toHaveBeenCalledWith(contactId, {
        relationship_score: mockScoreData.score,
        trust_level: mockScoreData.trust_level
      });
    });
  });

  describe('findSimilar', () => {
    it('should find similar contacts using embeddings', async () => {
      const contactId = 'contact123';
      const limit = 3;
      
      const mockContact = {
        id: contactId,
        name: 'John Doe',
        company: 'TechCorp',
        title: 'CTO',
        notes: 'AI expert'
      };

      const mockAllContacts = [
        { id: 'contact456', name: 'Jane Smith', company: 'TechCorp', title: 'VP Engineering' },
        { id: 'contact789', name: 'Bob Wilson', company: 'Startup', title: 'CTO' }
      ];

      const mockEmbedding = [0.1, 0.2, 0.3];
      const mockSimilarContacts = [
        { id: 'contact789', name: 'Bob Wilson', company: 'Startup', title: 'CTO' }
      ];

      mockDb.contacts.findById.mockResolvedValue(mockContact);
      mockDb.contacts.findByUserId.mockResolvedValue(mockAllContacts);
      mockGpt4Service.createEmbedding.mockResolvedValue(mockEmbedding);
      mockGpt4Service.findSimilarContacts.mockResolvedValue(mockSimilarContacts);

      const result = await contactService.findSimilar(contactId, limit);

      expect(mockDb.contacts.findById).toHaveBeenCalledWith(contactId);
      expect(mockDb.contacts.findByUserId).toHaveBeenCalledWith(mockContact.user_id);
      expect(mockGpt4Service.createEmbedding).toHaveBeenCalledWith(
        `${mockContact.name} ${mockContact.company} ${mockContact.title} ${mockContact.notes}`
      );
      expect(mockGpt4Service.findSimilarContacts).toHaveBeenCalledWith(
        mockEmbedding,
        mockAllContacts.filter(c => c.id !== contactId),
        0.7
      );
      expect(result).toEqual(mockSimilarContacts.slice(0, limit));
    });
  });

  describe('addInteraction', () => {
    it('should add interaction and update contact metrics', async () => {
      const contactId = 'contact123';
      const interactionData = {
        type: 'meeting',
        content: 'Had coffee to discuss collaboration',
        date: new Date(),
        duration: 60
      };
      
      const mockContact = {
        id: contactId,
        user_id: 'user123',
        interaction_count: 5
      };

      const mockInteraction = {
        id: 'int123',
        user_id: 'user123',
        contact_id: contactId,
        ...interactionData
      };

      mockDb.contacts.findById.mockResolvedValue(mockContact);
      mockDb.interactions.create.mockResolvedValue(mockInteraction);
      mockDb.contacts.update.mockResolvedValue({ ...mockContact, interaction_count: 6 });

      const result = await contactService.addInteraction(contactId, interactionData);

      expect(mockDb.interactions.create).toHaveBeenCalledWith({
        user_id: mockContact.user_id,
        contact_id: contactId,
        ...interactionData
      });
      expect(mockDb.contacts.update).toHaveBeenCalledWith(contactId, {
        last_interaction: expect.any(String),
        interaction_count: 6
      });
      expect(result).toEqual(mockInteraction);
    });
  });

  describe('getContactSummary', () => {
    it('should return contact summary with recent interactions', async () => {
      const contactId = 'contact123';
      
      const mockContact = {
        id: contactId,
        name: 'John Doe',
        company: 'TechCorp',
        title: 'CTO'
      };

      const mockInteractions = [
        { id: 'int1', type: 'meeting', content: 'Had coffee' },
        { id: 'int2', type: 'email', content: 'Follow up' }
      ];

      mockDb.contacts.findById.mockResolvedValue(mockContact);
      mockDb.interactions.findByContact.mockResolvedValue(mockInteractions);

      const result = await contactService.getContactSummary(contactId);

      expect(mockDb.contacts.findById).toHaveBeenCalledWith(contactId);
      expect(mockDb.interactions.findByContact).toHaveBeenCalledWith(contactId, 10);
      expect(result).toEqual({
        ...mockContact,
        recent_interactions: mockInteractions,
        interaction_count: mockInteractions.length
      });
    });
  });

  describe('updateContact', () => {
    it('should update contact and recalculate score if relevant fields change', async () => {
      const contactId = 'contact123';
      const updates = {
        notes: 'Updated notes',
        company: 'New Company'
      };
      
      const updatedContact = {
        id: contactId,
        ...updates
      };

      mockDb.contacts.update.mockResolvedValue(updatedContact);

      const result = await contactService.updateContact(contactId, updates);

      expect(mockDb.contacts.update).toHaveBeenCalledWith(contactId, updates);
      expect(result).toEqual(updatedContact);
    });
  });

  describe('deleteContact', () => {
    it('should delete contact and cascade delete interactions', async () => {
      const contactId = 'contact123';
      
      mockDb.contacts.delete.mockResolvedValue(undefined);

      await contactService.deleteContact(contactId);

      expect(mockDb.contacts.delete).toHaveBeenCalledWith(contactId);
    });
  });
});
