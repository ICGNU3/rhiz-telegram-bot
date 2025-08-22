import OpenAI from 'openai';
import config from '../utils/config';
import logger from '../utils/logger';

interface EnhancedFeature {
  name: string;
  description: string;
  enabled: boolean;
  priority: 'low' | 'medium' | 'high';
}

interface FeatureAnalysis {
  feature: string;
  confidence: number;
  reasoning: string;
  suggestedActions: string[];
}

class EnhancedFeatures {
  private features: Map<string, EnhancedFeature> = new Map();
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey,
    });

    this.initializeFeatures();
  }

  private initializeFeatures(): void {
    this.features.set('smart_contact_matching', {
      name: 'Smart Contact Matching',
      description: 'AI-powered contact matching and relationship scoring',
      enabled: true,
      priority: 'high'
    });

    this.features.set('goal_optimization', {
      name: 'Goal Optimization',
      description: 'Intelligent goal tracking and progress optimization',
      enabled: true,
      priority: 'medium'
    });

    this.features.set('conversation_analysis', {
      name: 'Conversation Analysis',
      description: 'Real-time conversation sentiment and intent analysis',
      enabled: true,
      priority: 'high'
    });

    this.features.set('introduction_suggestions', {
      name: 'Introduction Suggestions',
      description: 'AI-generated introduction recommendations',
      enabled: true,
      priority: 'medium'
    });
  }

  /**
   * Analyze user input and suggest relevant features
   */
  async analyzeUserInput(text: string): Promise<FeatureAnalysis[]> {
    try {
      const analysis: FeatureAnalysis[] = [];

      // Analyze for contact-related features
      if (this.isContactRelated(text)) {
        analysis.push({
          feature: 'smart_contact_matching',
          confidence: 0.9,
          reasoning: 'User input contains contact-related information',
          suggestedActions: ['Extract contact details', 'Update relationship score', 'Suggest follow-ups']
        });
      }

      // Analyze for goal-related features
      if (this.isGoalRelated(text)) {
        analysis.push({
          feature: 'goal_optimization',
          confidence: 0.8,
          reasoning: 'User input contains goal-related information',
          suggestedActions: ['Track goal progress', 'Update milestones', 'Suggest next steps']
        });
      }

      // Analyze for conversation features
      if (this.isConversationRelated(text)) {
        analysis.push({
          feature: 'conversation_analysis',
          confidence: 0.7,
          reasoning: 'User input appears to be conversational',
          suggestedActions: ['Analyze sentiment', 'Extract key topics', 'Generate response']
        });
      }

      return analysis;
    } catch (error) {
      logger.error('Error analyzing user input:', error);
      return [];
    }
  }

  /**
   * Generate intelligent introduction suggestions
   */
  async generateIntroductionSuggestions(
    fromContact: Record<string, any>,
    toContact: Record<string, any>,
    context: Record<string, any>
  ): Promise<string[]> {
    try {
      const suggestions: string[] = [];

      // Basic introduction template
      const basicIntro = `Hi ${toContact.name}, I'd like to introduce you to ${fromContact.name} who is ${fromContact.title} at ${fromContact.company}.`;
      suggestions.push(basicIntro);

      // Context-aware introduction
      if (context.sharedInterests && context.sharedInterests.length > 0) {
        const interestIntro = `${basicIntro} I thought you'd connect well since you both share an interest in ${context.sharedInterests.join(', ')}.`;
        suggestions.push(interestIntro);
      }

      // Goal-oriented introduction
      if (context.goal) {
        const goalIntro = `${basicIntro} Given your goal of ${context.goal}, I believe ${fromContact.name} could be a valuable connection.`;
        suggestions.push(goalIntro);
      }

      return suggestions;
    } catch (error) {
      logger.error('Error generating introduction suggestions:', error);
      return ['I\'d like to introduce you to someone who might be helpful.'];
    }
  }

  /**
   * Analyze conversation sentiment and extract insights
   */
  async analyzeConversation(
    messages: Array<{ role: string; content: string; timestamp: Date }>
  ): Promise<{
    sentiment: 'positive' | 'neutral' | 'negative';
    keyTopics: string[];
    actionItems: string[];
    relationshipStrength: number;
  }> {
    try {
      const conversationText = messages
        .map(msg => `${msg.role}: ${msg.content}`)
        .join('\n');

      // Simple sentiment analysis
      const sentiment = this.analyzeSentiment(conversationText);
      
      // Extract key topics
      const keyTopics = this.extractKeyTopics(conversationText);
      
      // Identify action items
      const actionItems = this.extractActionItems(conversationText);
      
      // Calculate relationship strength
      const relationshipStrength = this.calculateRelationshipStrength(messages);

      return {
        sentiment,
        keyTopics,
        actionItems,
        relationshipStrength
      };
    } catch (error) {
      logger.error('Error analyzing conversation:', error);
      return {
        sentiment: 'neutral',
        keyTopics: [],
        actionItems: [],
        relationshipStrength: 0.5
      };
    }
  }

  /**
   * Optimize goals based on user behavior and progress
   */
  async optimizeGoals(
    currentGoals: Array<Record<string, any>>,
    _userBehavior: Record<string, any>
  ): Promise<Array<Record<string, any>>> {
    try {
      const optimizedGoals = currentGoals.map(goal => {
        // Adjust priority based on user behavior
        const newPriority = this.calculateGoalPriority(goal);
        
        // Suggest timeline adjustments
        const suggestedTimeline = this.suggestTimelineAdjustment(goal);
        
        return {
          ...goal,
          priority: newPriority,
          suggestedTimeline,
          lastOptimized: new Date().toISOString()
        };
      });

      return optimizedGoals;
    } catch (error) {
      logger.error('Error optimizing goals:', error);
      return currentGoals;
    }
  }

  /**
   * Check if text is contact-related
   */
  private isContactRelated(text: string): boolean {
    const contactKeywords = ['contact', 'person', 'met', 'introduced', 'name', 'email', 'phone'];
    return contactKeywords.some(keyword => 
      text.toLowerCase().includes(keyword)
    );
  }

  /**
   * Check if text is goal-related
   */
  private isGoalRelated(text: string): boolean {
    const goalKeywords = ['goal', 'objective', 'target', 'aim', 'plan', 'strategy'];
    return goalKeywords.some(keyword => 
      text.toLowerCase().includes(keyword)
    );
  }

  /**
   * Check if text is conversation-related
   */
  private isConversationRelated(text: string): boolean {
    const conversationKeywords = ['talk', 'discuss', 'meeting', 'call', 'chat', 'conversation'];
    return conversationKeywords.some(keyword => 
      text.toLowerCase().includes(keyword)
    );
  }

  /**
   * Analyze sentiment of text
   */
  private analyzeSentiment(text: string): 'positive' | 'neutral' | 'negative' {
    const positiveWords = ['great', 'good', 'excellent', 'amazing', 'wonderful', 'successful'];
    const negativeWords = ['bad', 'terrible', 'awful', 'disappointing', 'failed', 'problem'];
    
    const lowerText = text.toLowerCase();
    const positiveCount = positiveWords.filter(word => lowerText.includes(word)).length;
    const negativeCount = negativeWords.filter(word => lowerText.includes(word)).length;
    
    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  /**
   * Extract key topics from text
   */
  private extractKeyTopics(text: string): string[] {
    const topics: string[] = [];
    const topicKeywords = {
      'business': ['business', 'company', 'startup', 'entrepreneur'],
      'technology': ['tech', 'software', 'programming', 'AI', 'machine learning'],
      'networking': ['network', 'connection', 'relationship', 'contact'],
      'career': ['job', 'career', 'position', 'role', 'work']
    };

    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      if (keywords.some(keyword => text.toLowerCase().includes(keyword))) {
        topics.push(topic);
      }
    }

    return topics;
  }

  /**
   * Extract action items from text
   */
  private extractActionItems(text: string): string[] {
    const actionItems: string[] = [];
    const actionPatterns = [
      /(?:need to|should|must|will)\s+([^.!?]+)/gi,
      /(?:follow up|call|email|meet|schedule)\s+([^.!?]+)/gi
    ];

    for (const pattern of actionPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        actionItems.push(...matches.map(match => match.trim()));
      }
    }

    return actionItems;
  }

  /**
   * Calculate relationship strength based on conversation history
   */
  private calculateRelationshipStrength(messages: Array<{ role: string; content: string; timestamp: Date }>): number {
    // Simple calculation based on message frequency and recency
    const recentMessages = messages.filter(msg => 
      new Date().getTime() - msg.timestamp.getTime() < 7 * 24 * 60 * 60 * 1000 // Last 7 days
    );

    const frequency = recentMessages.length / 7; // Messages per day
    const recency = Math.max(0, 1 - (new Date().getTime() - recentMessages[0]?.timestamp.getTime() || 0) / (7 * 24 * 60 * 60 * 1000));

    return Math.min(1, (frequency * 0.3 + recency * 0.7));
  }

  /**
   * Calculate goal priority based on user behavior
   */
  private calculateGoalPriority(goal: Record<string, any>): 'low' | 'medium' | 'high' {
    // Simple priority calculation
    const progress = goal.progress || 0;
    const deadline = goal.deadline ? new Date(goal.deadline) : null;
    const daysUntilDeadline = deadline ? (deadline.getTime() - new Date().getTime()) / (24 * 60 * 60 * 1000) : 30;

    if (progress < 0.3 && daysUntilDeadline < 7) return 'high';
    if (progress < 0.5 && daysUntilDeadline < 14) return 'medium';
    return 'low';
  }

  /**
   * Suggest timeline adjustment for goals
   */
  private suggestTimelineAdjustment(goal: Record<string, any>): string {
    const progress = goal.progress || 0;
    const deadline = goal.deadline ? new Date(goal.deadline) : null;
    const daysUntilDeadline = deadline ? (deadline.getTime() - new Date().getTime()) / (24 * 60 * 60 * 1000) : 30;

    if (progress < 0.3 && daysUntilDeadline < 7) {
      return 'Consider extending deadline or breaking down into smaller tasks';
    }
    if (progress > 0.7 && daysUntilDeadline > 14) {
      return 'You\'re ahead of schedule! Consider adding more ambitious targets';
    }
    return 'Timeline looks appropriate for current progress';
  }

  /**
   * Get all available features
   */
  getFeatures(): EnhancedFeature[] {
    return Array.from(this.features.values());
  }

  /**
   * Enable or disable a feature
   */
  setFeatureStatus(featureName: string, enabled: boolean): void {
    const feature = this.features.get(featureName);
    if (feature) {
      feature.enabled = enabled;
      logger.info(`Feature ${featureName} ${enabled ? 'enabled' : 'disabled'}`);
    }
  }
}

export default new EnhancedFeatures();