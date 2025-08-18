import db from '../db/supabase';
import gpt4Service from '../ai/gpt4';
import logger from '../utils/logger';

interface Goal {
  id: string;
  user_id: string;
  description: string;
  type: 'fundraising' | 'hiring' | 'partnership' | 'sales' | 'networking' | 'other';
  status: 'active' | 'completed' | 'paused' | 'cancelled';
  progress: number;
  target_date?: string;
  priority: 'low' | 'medium' | 'high';
  related_contacts?: string[];
  notes?: string;
  created_at: string;
  updated_at: string;
}

interface RelationshipInsight {
  id: string;
  contact_id: string;
  insight_type: 'strength' | 'opportunity' | 'risk' | 'recommendation';
  title: string;
  description: string;
  confidence: number;
  actionable: boolean;
  next_action?: string;
  created_at: string;
}

class RelationshipService {
  async createGoalFromTranscript(userId: string, transcript: string): Promise<Goal> {
    try {
      // Analyze transcript to extract goal information
      const goalData = await gpt4Service.analyzeGoal(transcript);
      
      if (!goalData.description) {
        throw new Error('Could not extract goal description from transcript');
      }

      // Create new goal
      const newGoal = await db.goals.create({
        user_id: userId,
        description: goalData.description,
        type: goalData.type || 'other',
        status: 'active',
        progress: 0,
        target_date: goalData.target_date,
        priority: goalData.priority || 'medium',
        notes: goalData.notes,
      });

      // Generate insights based on the goal
      await this.generateGoalInsights(newGoal.id, userId);

      return newGoal;
    } catch (error) {
      logger.error('Error creating goal from transcript:', error);
      throw error;
    }
  }

  async calculateScore(contact: any, interactions: any[]): Promise<number> {
    try {
      const scoreData = await gpt4Service.scoreRelationship(contact, interactions);
      return scoreData.score;
    } catch (error) {
      logger.error('Error calculating relationship score:', error);
      // Return a default score based on interaction count
      return Math.min(interactions.length * 10, 100);
    }
  }

  async getInsights(contactId: string): Promise<RelationshipInsight[]> {
    try {
      const contact = await db.contacts.findById(contactId);
      const interactions = await db.interactions.findByContact(contactId, 20);
      const goals = await db.goals.findByUserId(contact.user_id, 'active');

      // Generate insights using AI
      const insights = await this.generateContactInsights(contact, interactions, goals);
      
      // Save insights to database
      const savedInsights = await Promise.all(
        insights.map(insight => 
          db.insights.create({
            contact_id: contactId,
            insight_type: insight.insight_type,
            title: insight.title,
            description: insight.description,
            confidence: insight.confidence,
            actionable: insight.actionable,
            next_action: insight.next_action,
          })
        )
      );

      return savedInsights;
    } catch (error) {
      logger.error('Error getting relationship insights:', error);
      return [];
    }
  }

  async updateGoalProgress(goalId: string, progress: number): Promise<Goal> {
    try {
      const goal = await db.goals.findById(goalId);
      
      if (!goal) {
        throw new Error('Goal not found');
      }

      const updatedGoal = await db.goals.update(goalId, {
        progress: Math.min(progress, 100),
        status: progress >= 100 ? 'completed' : goal.status,
        updated_at: new Date().toISOString(),
      });

      // Generate new insights if progress changed significantly
      if (Math.abs(progress - goal.progress) >= 20) {
        await this.generateGoalInsights(goalId, goal.user_id);
      }

      return updatedGoal;
    } catch (error) {
      logger.error('Error updating goal progress:', error);
      throw error;
    }
  }

  async getActiveGoals(userId: string): Promise<Goal[]> {
    try {
      return await db.goals.findByUserId(userId, 'active');
    } catch (error) {
      logger.error('Error getting active goals:', error);
      return [];
    }
  }

  async addContactToGoal(goalId: string, contactId: string): Promise<void> {
    try {
      const goal = await db.goals.findById(goalId);
      
      if (!goal) {
        throw new Error('Goal not found');
      }

      const relatedContacts = goal.related_contacts || [];
      if (!relatedContacts.includes(contactId)) {
        await db.goals.update(goalId, {
          related_contacts: [...relatedContacts, contactId],
        });
      }
    } catch (error) {
      logger.error('Error adding contact to goal:', error);
      throw error;
    }
  }

  async generateGoalInsights(goalId: string, userId: string): Promise<void> {
    try {
      const goal = await db.goals.findById(goalId);
      const contacts = await db.contacts.findByUserId(userId);
      
      // Use AI to generate insights about the goal
      const insights = await gpt4Service.generateGoalInsights(goal, contacts);
      
      // Save insights
      await Promise.all(
        insights.map(insight =>
          db.insights.create({
            goal_id: goalId,
            insight_type: insight.type,
            title: insight.title,
            description: insight.description,
            confidence: insight.confidence,
            actionable: insight.actionable,
            next_action: insight.next_action,
          })
        )
      );
    } catch (error) {
      logger.error('Error generating goal insights:', error);
    }
  }

  async generateContactInsights(contact: any, interactions: any[], goals: any[]): Promise<RelationshipInsight[]> {
    try {
      // Use AI to analyze the relationship and generate insights
      const insights = await gpt4Service.generateContactInsights(contact, interactions, goals);
      
      return insights.map(insight => ({
        id: '',
        contact_id: contact.id,
        insight_type: insight.type,
        title: insight.title,
        description: insight.description,
        confidence: insight.confidence,
        actionable: insight.actionable,
        next_action: insight.next_action,
        created_at: new Date().toISOString(),
      }));
    } catch (error) {
      logger.error('Error generating contact insights:', error);
      return [];
    }
  }

  async getRelationshipStrength(contactId: string): Promise<number> {
    try {
      const contact = await db.contacts.findById(contactId);
      const interactions = await db.interactions.findByContact(contactId);
      
      return await this.calculateScore(contact, interactions);
    } catch (error) {
      logger.error('Error getting relationship strength:', error);
      return 0;
    }
  }

  async suggestFollowUps(contactId: string): Promise<string[]> {
    try {
      const contact = await db.contacts.findById(contactId);
      const interactions = await db.interactions.findByContact(contactId, 5);
      
      // Use AI to suggest follow-up actions
      const suggestions = await gpt4Service.suggestFollowUps(contact, interactions);
      
      return suggestions;
    } catch (error) {
      logger.error('Error suggesting follow-ups:', error);
      return [];
    }
  }

  async trackInteraction(contactId: string, interactionData: any): Promise<void> {
    try {
      const contact = await db.contacts.findById(contactId);
      
      // Add interaction
      await db.interactions.create({
        user_id: contact.user_id,
        contact_id: contactId,
        ...interactionData,
      });

      // Update contact's last interaction
      await db.contacts.update(contactId, {
        last_interaction: new Date().toISOString(),
        interaction_count: (contact.interaction_count || 0) + 1,
      });

      // Recalculate relationship score
      const newScore = await this.getRelationshipStrength(contactId);
      await db.contacts.update(contactId, {
        relationship_score: newScore,
      });

      // Generate new insights if significant interaction
      if (interactionData.type === 'meeting' || interactionData.duration > 30) {
        await this.getInsights(contactId);
      }
    } catch (error) {
      logger.error('Error tracking interaction:', error);
      throw error;
    }
  }

  async getNetworkStrength(userId: string): Promise<{
    total_contacts: number;
    average_score: number;
    strong_relationships: number;
    recent_interactions: number;
  }> {
    try {
      const contacts = await db.contacts.findByUserId(userId);
      const totalContacts = contacts.length;
      
      const scores = contacts.map(c => c.relationship_score || 0);
      const averageScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      
      const strongRelationships = contacts.filter(c => (c.relationship_score || 0) >= 70).length;
      
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const recentInteractions = contacts.filter(c => 
        c.last_interaction && new Date(c.last_interaction) > thirtyDaysAgo
      ).length;

      return {
        total_contacts: totalContacts,
        average_score: Math.round(averageScore),
        strong_relationships: strongRelationships,
        recent_interactions: recentInteractions,
      };
    } catch (error) {
      logger.error('Error getting network strength:', error);
      return {
        total_contacts: 0,
        average_score: 0,
        strong_relationships: 0,
        recent_interactions: 0,
      };
    }
  }
}

export default new RelationshipService();
