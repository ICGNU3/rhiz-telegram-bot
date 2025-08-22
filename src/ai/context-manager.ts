import logger from '../utils/logger';
import gpt4Service from './gpt4';

interface ConversationContext {
  userId: string;
  sessionId: string;
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    intent?: string;
    entities?: any;
  }>;
  activeTopics: string[];
  currentFocus: string;
  relationshipContext: {
    recentContacts: any[];
    activeGoals: any[];
    pendingIntroductions: any[];
  };
  userProfile: {
    industry?: string;
    role?: string;
    preferences?: any;
    communication_style?: string;
  };
}

export class ContextManager {
  private contexts = new Map<string, ConversationContext>();
  private readonly MAX_CONTEXT_HISTORY = 20;
  private readonly CONTEXT_TTL = 2 * 60 * 60 * 1000; // 2 hours

  // Initialize or retrieve conversation context
  getContext(userId: string, sessionId?: string): ConversationContext {
    const contextKey = `${userId}:${sessionId || 'default'}`;
    
    if (!this.contexts.has(contextKey)) {
      this.contexts.set(contextKey, {
        userId,
        sessionId: sessionId || 'default',
        messages: [],
        activeTopics: [],
        currentFocus: '',
        relationshipContext: {
          recentContacts: [],
          activeGoals: [],
          pendingIntroductions: []
        },
        userProfile: {}
      });
    }
    
    return this.contexts.get(contextKey)!;
  }

  // Add message to conversation context
  addMessage(
    userId: string, 
    role: 'user' | 'assistant' | 'system',
    content: string,
    metadata?: any
  ): void {
    const context = this.getContext(userId);
    
    context.messages.push({
      role,
      content,
      timestamp: new Date(),
      intent: metadata?.intent,
      entities: metadata?.entities
    });
    
    // Maintain context window size
    if (context.messages.length > this.MAX_CONTEXT_HISTORY) {
      context.messages = context.messages.slice(-this.MAX_CONTEXT_HISTORY);
    }
    
    // Update active topics based on message content
    this.updateActiveTopics(context, content, metadata?.intent);
  }

  // Generate context-aware prompt
  async generateContextualPrompt(
    userId: string,
    currentMessage: string,
    basePrompt: string
  ): Promise<string> {
    const context = this.getContext(userId);
    
    // Build conversation history summary
    const recentMessages = context.messages.slice(-5);
    const conversationSummary = recentMessages.map(msg => 
      `${msg.role}: ${msg.content}`
    ).join('\n');
    
    // Build relationship context
    const relationshipContext = this.buildRelationshipContext(context);
    
    // Build user profile context
    const userProfileContext = this.buildUserProfileContext(context);
    
    // Combine all context elements
    const contextualPrompt = `
${basePrompt}

CONVERSATION CONTEXT:
Recent conversation:
${conversationSummary}

Active topics: ${context.activeTopics.join(', ')}
Current focus: ${context.currentFocus}

RELATIONSHIP CONTEXT:
${relationshipContext}

USER PROFILE:
${userProfileContext}

Current message: ${currentMessage}

Respond in a way that:
1. Acknowledges conversation history
2. Maintains topic continuity
3. Uses appropriate tone for the user
4. Leverages relationship insights
5. Provides personalized recommendations
`;

    return contextualPrompt;
  }

  // Update user profile based on interactions
  async updateUserProfile(userId: string, newData: any): Promise<void> {
    const context = this.getContext(userId);
    
    // Merge new profile data
    context.userProfile = {
      ...context.userProfile,
      ...newData
    };
    
    // Infer additional profile attributes from conversation
    await this.inferProfileAttributes(context);
  }

  // Smart topic tracking and transitions
  private updateActiveTopics(context: ConversationContext, content: string, intent?: string): void {
    const extractedTopics = this.extractTopics(content);
    
    // Add new topics
    extractedTopics.forEach(topic => {
      if (!context.activeTopics.includes(topic)) {
        context.activeTopics.push(topic);
      }
    });
    
    // Remove stale topics (older than 10 messages)
    if (context.messages.length > 10) {
      const recentMessages = context.messages.slice(-10);
      const recentTopics = new Set();
      
      recentMessages.forEach(msg => {
        this.extractTopics(msg.content).forEach(topic => 
          recentTopics.add(topic)
        );
      });
      
      context.activeTopics = context.activeTopics.filter(topic =>
        recentTopics.has(topic)
      );
    }
    
    // Update current focus based on intent
    if (intent) {
      context.currentFocus = this.mapIntentToFocus(intent);
    }
    
    // Limit active topics
    if (context.activeTopics.length > 5) {
      context.activeTopics = context.activeTopics.slice(-5);
    }
  }

  private extractTopics(content: string): string[] {
    const topics: string[] = [];
    const text = content.toLowerCase();
    
    // Company/organization names (capitalized words)
    const companyMatches = content.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g);
    if (companyMatches) {
      topics.push(...companyMatches.filter(match => 
        match.length > 3 && !['The', 'And', 'But', 'For'].includes(match)
      ));
    }
    
    // Professional keywords
    const professionalKeywords = [
      'networking', 'introduction', 'meeting', 'conference', 'startup',
      'funding', 'partnership', 'collaboration', 'hiring', 'recruitment',
      'investment', 'technology', 'ai', 'machine learning', 'blockchain',
      'fintech', 'healthcare', 'education'
    ];
    
    professionalKeywords.forEach(keyword => {
      if (text.includes(keyword)) {
        topics.push(keyword);
      }
    });
    
    return [...new Set(topics)]; // Remove duplicates
  }

  private mapIntentToFocus(intent: string): string {
    const focusMap: { [key: string]: string } = {
      'ADD_CONTACT': 'Contact Management',
      'FIND_CONTACT': 'Contact Discovery', 
      'SET_GOAL': 'Goal Planning',
      'REQUEST_INTRO': 'Network Expansion',
      'SET_REMINDER': 'Relationship Maintenance',
      'UPDATE_CONTACT': 'Contact Management'
    };
    
    return focusMap[intent] || 'General Conversation';
  }

  private buildRelationshipContext(context: ConversationContext): string {
    const { recentContacts, activeGoals, pendingIntroductions } = context.relationshipContext;
    
    let relationshipStr = '';
    
    if (recentContacts.length > 0) {
      relationshipStr += `Recent contacts: ${recentContacts.map(c => c.name).join(', ')}\n`;
    }
    
    if (activeGoals.length > 0) {
      relationshipStr += `Active goals: ${activeGoals.map(g => g.description).join(', ')}\n`;
    }
    
    if (pendingIntroductions.length > 0) {
      relationshipStr += `Pending introductions: ${pendingIntroductions.length} suggestions available\n`;
    }
    
    return relationshipStr || 'No recent relationship activity';
  }

  private buildUserProfileContext(context: ConversationContext): string {
    const { industry, role, communication_style } = context.userProfile;
    
    let profileStr = '';
    
    if (industry) profileStr += `Industry: ${industry}\n`;
    if (role) profileStr += `Role: ${role}\n`;
    if (communication_style) profileStr += `Communication style: ${communication_style}\n`;
    
    return profileStr || 'Limited profile information';
  }

  private async inferProfileAttributes(context: ConversationContext): Promise<void> {
    try {
      // Analyze conversation patterns to infer user attributes
      const recentMessages = context.messages.slice(-10);
      const conversationText = recentMessages
        .filter(msg => msg.role === 'user')
        .map(msg => msg.content)
        .join(' ');
      
      if (conversationText.length < 50) return; // Not enough data
      
      // Use AI to infer profile attributes
      const prompt = `
Analyze this conversation to infer user characteristics:
${conversationText}

Extract:
- Industry/field (if mentioned or implied)
- Professional role/seniority
- Communication style (formal/casual/technical)
- Professional interests
- Networking preferences

Respond in JSON format.
`;
      
      const response = await gpt4Service.generateVoiceResponse(prompt);
      
      try {
        const inferred = JSON.parse(response);
        
        // Update profile with inferred attributes
        if (inferred.industry && !context.userProfile.industry) {
          context.userProfile.industry = inferred.industry;
        }
        
        if (inferred.role && !context.userProfile.role) {
          context.userProfile.role = inferred.role;
        }
        
        if (inferred.communication_style) {
          context.userProfile.communication_style = inferred.communication_style;
        }
        
      } catch (parseError) {
        logger.warn('Could not parse profile inference response');
      }
      
    } catch (error) {
      logger.error('Error inferring profile attributes:', error);
    }
  }

  // Context-aware entity recognition
  extractEntitiesWithContext(userId: string, text: string): {
    people: string[];
    companies: string[];
    locations: string[];
    topics: string[];
    actions: string[];
  } {
    const context = this.getContext(userId);
    const entities: {
      people: string[];
      companies: string[];
      locations: string[];
      topics: string[];
      actions: string[];
    } = {
      people: [],
      companies: [],
      locations: [],
      topics: [],
      actions: []
    };
    
    // Enhanced entity extraction using conversation context
    const knownContacts = context.relationshipContext.recentContacts.map(c => c.name);
    const activeTopics = context.activeTopics;
    
    // Extract people names (prioritize known contacts)
    const namePattern = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g;
    const nameMatches = text.match(namePattern) || [];
    
    nameMatches.forEach(name => {
      if (knownContacts.includes(name) || this.isProbablePersonName(name)) {
        entities.people.push(name);
      }
    });
    
    // Extract companies
    const companyIndicators = ['Inc', 'LLC', 'Corp', 'Co', 'Ltd', 'Group', 'Solutions'];
    nameMatches.forEach(match => {
      if (companyIndicators.some(indicator => match.includes(indicator))) {
        entities.companies.push(match);
      }
    });
    
    // Extract locations
    const locationPattern = /\b(?:in|at|from)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g;
    let locationMatch;
    while ((locationMatch = locationPattern.exec(text)) !== null) {
      entities.locations.push(locationMatch[1]);
    }
    
    // Extract relevant topics from active context
    entities.topics = activeTopics.filter(topic => 
      text.toLowerCase().includes(topic.toLowerCase())
    );
    
    // Extract action items
    const actionPatterns = [
      /(?:remind|schedule|follow up|call|email|meet with)/gi,
      /(?:introduce|connect|reach out)/gi
    ];
    
    actionPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        entities.actions.push(...matches);
      }
    });
    
    return entities;
  }

  private isProbablePersonName(name: string): boolean {
    // Simple heuristics for person name detection
    const commonPersonWords = ['John', 'Jane', 'Michael', 'Sarah', 'David', 'Lisa'];
    const businessWords = ['Solutions', 'Technologies', 'Systems', 'Group', 'Corp'];
    
    return !businessWords.some(word => name.includes(word)) &&
           (commonPersonWords.includes(name.split(' ')[0]) || name.split(' ').length >= 2);
  }

  // Cleanup expired contexts
  cleanupExpiredContexts(): void {
    const now = Date.now();
    
    for (const [key, context] of this.contexts.entries()) {
      const lastMessage = context.messages[context.messages.length - 1];
      const lastActivity = lastMessage ? lastMessage.timestamp.getTime() : 0;
      
      if (now - lastActivity > this.CONTEXT_TTL) {
        this.contexts.delete(key);
        logger.info(`Cleaned up expired context for ${key}`);
      }
    }
  }

  // Get context statistics
  getContextStats(): {
    activeContexts: number;
    totalMessages: number;
    averageContextSize: number;
  } {
    const contexts = Array.from(this.contexts.values());
    const totalMessages = contexts.reduce((sum, ctx) => sum + ctx.messages.length, 0);
    
    return {
      activeContexts: contexts.length,
      totalMessages,
      averageContextSize: contexts.length > 0 ? totalMessages / contexts.length : 0
    };
  }
}

export default new ContextManager();