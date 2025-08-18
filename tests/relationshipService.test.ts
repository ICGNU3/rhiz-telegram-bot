import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import relationshipService from '../src/services/relationships';
import db from '../src/db/supabase';
import gpt4Service from '../src/ai/gpt4';

// Mock dependencies
jest.mock('../src/db/supabase');
jest.mock('../src/ai/gpt4');

const mockDb = db as jest.Mocked<typeof db>;
const mockGpt4Service = gpt4Service as jest.Mocked<typeof gpt4Service>;

describe('RelationshipService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createGoalFromTranscript', () => {
    it('should create goal from transcript', async () => {
      const transcript = "My goal is to raise a seed round by Q2";
      const userId = 'user123';
      
      const mockGoalData = {
        description: 'Raise seed round',
        type: 'fundraising',
        target_date: '2024-06-30',
        priority: 'high',
        notes: 'Need to raise seed round by Q2'
      };

      const mockNewGoal = {
        id: 'goal123',
        user_id: userId,
        ...mockGoalData,
        status: 'active',
        progress: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      mockGpt4Service.analyzeGoal.mockResolvedValue(mockGoalData);
      mockDb.goals.create.mockResolvedValue(mockNewGoal);
      mockGpt4Service.generateGoalInsights.mockResolvedValue([]);

      const result = await relationshipService.createGoalFromTranscript(userId, transcript);

      expect(mockGpt4Service.analyzeGoal).toHaveBeenCalledWith(transcript);
      expect(mockDb.goals.create).toHaveBeenCalledWith({
        user_id: userId,
        ...mockGoalData,
        status: 'active',
        progress: 0
      });
      expect(result).toEqual(mockNewGoal);
    });

    it('should throw error if goal description cannot be extracted', async () => {
      const transcript = "I had a great conversation about the weather";
      const userId = 'user123';
      
      mockGpt4Service.analyzeGoal.mockResolvedValue({});

      await expect(relationshipService.createGoalFromTranscript(userId, transcript))
        .rejects.toThrow('Could not extract goal description from transcript');
    });
  });

  describe('calculateScore', () => {
    it('should calculate relationship score using AI', async () => {
      const contact = { id: 'contact123', name: 'John Doe' };
      const interactions = [
        { id: 'int1', type: 'meeting', content: 'Had coffee' }
      ];

      const mockScoreData = {
        score: 85,
        trust_level: 'trusted'
      };

      mockGpt4Service.scoreRelationship.mockResolvedValue(mockScoreData);

      const result = await relationshipService.calculateScore(contact, interactions);

      expect(mockGpt4Service.scoreRelationship).toHaveBeenCalledWith(contact, interactions);
      expect(result).toBe(85);
    });

    it('should return default score on error', async () => {
      const contact = { id: 'contact123', name: 'John Doe' };
      const interactions = [
        { id: 'int1', type: 'meeting', content: 'Had coffee' },
        { id: 'int2', type: 'email', content: 'Follow up' }
      ];

      mockGpt4Service.scoreRelationship.mockRejectedValue(new Error('API error'));

      const result = await relationshipService.calculateScore(contact, interactions);

      expect(result).toBe(20); // 2 interactions * 10
    });
  });

  describe('getInsights', () => {
    it('should generate and save relationship insights', async () => {
      const contactId = 'contact123';
      
      const mockContact = {
        id: contactId,
        name: 'John Doe',
        user_id: 'user123'
      };

      const mockInteractions = [
        { id: 'int1', type: 'meeting', content: 'Had coffee' }
      ];

      const mockGoals = [
        { id: 'goal1', description: 'Raise funding' }
      ];

      const mockInsights = [
        {
          type: 'strength',
          title: 'Strong Communication',
          description: 'Regular meetings show good communication',
          confidence: 0.8,
          actionable: true,
          next_action: 'Schedule follow-up meeting'
        }
      ];

      const mockSavedInsights = [
        {
          id: 'insight1',
          contact_id: contactId,
          ...mockInsights[0],
          created_at: new Date().toISOString()
        }
      ];

      mockDb.contacts.findById.mockResolvedValue(mockContact);
      mockDb.interactions.findByContact.mockResolvedValue(mockInteractions);
      mockDb.goals.findByUserId.mockResolvedValue(mockGoals);
      mockGpt4Service.generateContactInsights.mockResolvedValue(mockInsights);
      mockDb.insights.create.mockResolvedValue(mockSavedInsights[0]);

      const result = await relationshipService.getInsights(contactId);

      expect(mockDb.contacts.findById).toHaveBeenCalledWith(contactId);
      expect(mockDb.interactions.findByContact).toHaveBeenCalledWith(contactId, 20);
      expect(mockDb.goals.findByUserId).toHaveBeenCalledWith(mockContact.user_id, 'active');
      expect(mockGpt4Service.generateContactInsights).toHaveBeenCalledWith(mockContact, mockInteractions, mockGoals);
      expect(result).toEqual(mockSavedInsights);
    });
  });

  describe('updateGoalProgress', () => {
    it('should update goal progress and status', async () => {
      const goalId = 'goal123';
      const progress = 75;
      
      const mockGoal = {
        id: goalId,
        user_id: 'user123',
        progress: 50,
        status: 'active'
      };

      const updatedGoal = {
        ...mockGoal,
        progress: 75,
        updated_at: new Date().toISOString()
      };

      mockDb.goals.findById.mockResolvedValue(mockGoal);
      mockDb.goals.update.mockResolvedValue(updatedGoal);
      mockGpt4Service.generateGoalInsights.mockResolvedValue([]);

      const result = await relationshipService.updateGoalProgress(goalId, progress);

      expect(mockDb.goals.findById).toHaveBeenCalledWith(goalId);
      expect(mockDb.goals.update).toHaveBeenCalledWith(goalId, {
        progress: 75,
        status: 'active',
        updated_at: expect.any(String)
      });
      expect(result).toEqual(updatedGoal);
    });

    it('should mark goal as completed when progress reaches 100', async () => {
      const goalId = 'goal123';
      const progress = 100;
      
      const mockGoal = {
        id: goalId,
        user_id: 'user123',
        progress: 50,
        status: 'active'
      };

      const updatedGoal = {
        ...mockGoal,
        progress: 100,
        status: 'completed',
        updated_at: new Date().toISOString()
      };

      mockDb.goals.findById.mockResolvedValue(mockGoal);
      mockDb.goals.update.mockResolvedValue(updatedGoal);

      const result = await relationshipService.updateGoalProgress(goalId, progress);

      expect(mockDb.goals.update).toHaveBeenCalledWith(goalId, {
        progress: 100,
        status: 'completed',
        updated_at: expect.any(String)
      });
      expect(result).toEqual(updatedGoal);
    });
  });

  describe('getActiveGoals', () => {
    it('should return active goals for user', async () => {
      const userId = 'user123';
      
      const mockGoals = [
        { id: 'goal1', description: 'Raise funding', status: 'active' },
        { id: 'goal2', description: 'Hire engineers', status: 'active' }
      ];

      mockDb.goals.findByUserId.mockResolvedValue(mockGoals);

      const result = await relationshipService.getActiveGoals(userId);

      expect(mockDb.goals.findByUserId).toHaveBeenCalledWith(userId, 'active');
      expect(result).toEqual(mockGoals);
    });
  });

  describe('addContactToGoal', () => {
    it('should add contact to goal related contacts', async () => {
      const goalId = 'goal123';
      const contactId = 'contact123';
      
      const mockGoal = {
        id: goalId,
        related_contacts: ['contact456']
      };

      mockDb.goals.findById.mockResolvedValue(mockGoal);
      mockDb.goals.update.mockResolvedValue({
        ...mockGoal,
        related_contacts: ['contact456', contactId]
      });

      await relationshipService.addContactToGoal(goalId, contactId);

      expect(mockDb.goals.update).toHaveBeenCalledWith(goalId, {
        related_contacts: ['contact456', contactId]
      });
    });

    it('should not add duplicate contact', async () => {
      const goalId = 'goal123';
      const contactId = 'contact123';
      
      const mockGoal = {
        id: goalId,
        related_contacts: ['contact123', 'contact456']
      };

      mockDb.goals.findById.mockResolvedValue(mockGoal);

      await relationshipService.addContactToGoal(goalId, contactId);

      expect(mockDb.goals.update).not.toHaveBeenCalled();
    });
  });

  describe('getRelationshipStrength', () => {
    it('should return relationship strength for contact', async () => {
      const contactId = 'contact123';
      
      const mockContact = {
        id: contactId,
        name: 'John Doe'
      };

      const mockInteractions = [
        { id: 'int1', type: 'meeting', content: 'Had coffee' }
      ];

      mockDb.contacts.findById.mockResolvedValue(mockContact);
      mockDb.interactions.findByContact.mockResolvedValue(mockInteractions);
      mockGpt4Service.scoreRelationship.mockResolvedValue({ score: 85 });

      const result = await relationshipService.getRelationshipStrength(contactId);

      expect(mockDb.contacts.findById).toHaveBeenCalledWith(contactId);
      expect(mockDb.interactions.findByContact).toHaveBeenCalledWith(contactId);
      expect(result).toBe(85);
    });
  });

  describe('suggestFollowUps', () => {
    it('should suggest follow-up actions for contact', async () => {
      const contactId = 'contact123';
      
      const mockContact = {
        id: contactId,
        name: 'John Doe'
      };

      const mockInteractions = [
        { id: 'int1', type: 'meeting', content: 'Had coffee' }
      ];

      const mockSuggestions = [
        'Schedule follow-up meeting',
        'Send thank you email',
        'Connect on LinkedIn'
      ];

      mockDb.contacts.findById.mockResolvedValue(mockContact);
      mockDb.interactions.findByContact.mockResolvedValue(mockInteractions);
      mockGpt4Service.suggestFollowUps.mockResolvedValue(mockSuggestions);

      const result = await relationshipService.suggestFollowUps(contactId);

      expect(mockDb.contacts.findById).toHaveBeenCalledWith(contactId);
      expect(mockDb.interactions.findByContact).toHaveBeenCalledWith(contactId, 5);
      expect(mockGpt4Service.suggestFollowUps).toHaveBeenCalledWith(mockContact, mockInteractions);
      expect(result).toEqual(mockSuggestions);
    });
  });

  describe('trackInteraction', () => {
    it('should track interaction and update contact metrics', async () => {
      const contactId = 'contact123';
      const interactionData = {
        type: 'meeting',
        content: 'Had coffee to discuss collaboration',
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
      mockGpt4Service.scoreRelationship.mockResolvedValue({ score: 85 });
      mockGpt4Service.generateContactInsights.mockResolvedValue([]);

      await relationshipService.trackInteraction(contactId, interactionData);

      expect(mockDb.interactions.create).toHaveBeenCalledWith({
        user_id: mockContact.user_id,
        contact_id: contactId,
        ...interactionData
      });
      expect(mockDb.contacts.update).toHaveBeenCalledWith(contactId, {
        last_interaction: expect.any(String),
        interaction_count: 6
      });
      expect(mockDb.contacts.update).toHaveBeenCalledWith(contactId, {
        relationship_score: 85
      });
    });
  });

  describe('getNetworkStrength', () => {
    it('should return network strength metrics', async () => {
      const userId = 'user123';
      
      const mockContacts = [
        { id: 'contact1', relationship_score: 80, last_interaction: new Date().toISOString() },
        { id: 'contact2', relationship_score: 60, last_interaction: new Date().toISOString() },
        { id: 'contact3', relationship_score: 90, last_interaction: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString() }
      ];

      mockDb.contacts.findByUserId.mockResolvedValue(mockContacts);

      const result = await relationshipService.getNetworkStrength(userId);

      expect(mockDb.contacts.findByUserId).toHaveBeenCalledWith(userId);
      expect(result).toEqual({
        total_contacts: 3,
        average_score: 77,
        strong_relationships: 2,
        recent_interactions: 2
      });
    });
  });
});
