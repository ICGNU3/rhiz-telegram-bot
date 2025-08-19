import logger from '../utils/logger';
import db from '../db/supabase';
import gpt4Service from '../ai/gpt4';
import elevenLabsService from './elevenlabs';

interface ConversationContext {
  userId: string;
  sessionId: string;
  topic: string;
  mood: 'casual' | 'professional' | 'urgent';
  lastInteraction: Date;
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>;
  activeContacts: string[];
  currentGoal?: string;
}

export class ConversationManager {
  private activeConversations: Map<string, ConversationContext> = new Map();
  private sessionTimeout = 30 * 60 * 1000; // 30 minutes

  async startConversation(userId: string): Promise<string> {
    const sessionId = `session_${userId}_${Date.now()}`;
    
    const context: ConversationContext = {
      userId,
      sessionId,
      topic: 'general',
      mood: 'casual',
      lastInteraction: new Date(),
      conversationHistory: [],
      activeContacts: [],
    };

    this.activeConversations.set(sessionId, context);
    
    // Clean up old sessions
    this.cleanupOldSessions();
    
    logger.info(`Started conversation session: ${sessionId}`);
    return sessionId;
  }

  async processVoiceInput(
    userId: string,
    transcript: string,
    sessionId?: string
  ): Promise<{
    response: string;
    audioResponse: Buffer;
    sessionId: string;
    shouldContinue: boolean;
    suggestedActions: string[];
  }> {
    // Get or create session
    let context = sessionId ? this.activeConversations.get(sessionId) : null;
    if (!context) {
      sessionId = await this.startConversation(userId);
      context = this.activeConversations.get(sessionId)!;
    }

    // Update context
    context.lastInteraction = new Date();
    context.conversationHistory.push({
      role: 'user',
      content: transcript,
      timestamp: new Date(),
    });

    // Analyze conversation mood and topic
    const analysis = await this.analyzeConversation(transcript, context);
    context.mood = analysis.mood;
    context.topic = analysis.topic;

    // Generate contextual response
    const response = await this.generateContextualResponse(transcript, context);
    
    // Update context with response
    context.conversationHistory.push({
      role: 'assistant',
      content: response.text,
      timestamp: new Date(),
    });

    // Generate voice response
    const audioResponse = await elevenLabsService.synthesize(response.text, {
      voice: this.getVoiceForMood(context.mood),
      speed: context.mood === 'urgent' ? 1.2 : 1.0,
    });

    // Determine if conversation should continue
    const shouldContinue = this.shouldContinueConversation(context, response);

    // Generate suggested actions
    const suggestedActions = await this.generateSuggestedActions(context, response);

    return {
      response: response.text,
      audioResponse,
      sessionId: sessionId!,
      shouldContinue,
      suggestedActions,
    };
  }

  private async analyzeConversation(
    transcript: string,
    context: ConversationContext
  ): Promise<{ mood: 'casual' | 'professional' | 'urgent'; topic: string }> {
    const analysis = await gpt4Service.analyzeConversation(transcript, context);
    return {
      mood: analysis.mood,
      topic: analysis.topic,
    };
  }

  private async generateContextualResponse(
    transcript: string,
    context: ConversationContext
  ): Promise<{ text: string; actions: string[] }> {
    // Build conversation context
    const recentHistory = context.conversationHistory
      .slice(-6) // Last 3 exchanges
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');

    const response = await gpt4Service.generateConversationalResponse(
      transcript,
      {
        mood: context.mood,
        topic: context.topic,
        recentHistory,
        activeContacts: context.activeContacts,
        currentGoal: context.currentGoal,
      }
    );

    return response;
  }

  private shouldContinueConversation(
    context: ConversationContext,
    response: { text: string; actions: string[] }
  ): boolean {
    // Continue if:
    // 1. User seems to want to continue (no clear ending)
    // 2. There are suggested actions
    // 3. Conversation is less than 5 minutes old
    const timeSinceStart = Date.now() - context.lastInteraction.getTime();
    const hasActions = response.actions.length > 0;
    const wantsToContinue = !response.text.toLowerCase().includes('goodbye') &&
                           !response.text.toLowerCase().includes('see you') &&
                           !response.text.toLowerCase().includes('talk later');

    return wantsToContinue && (hasActions || timeSinceStart < 5 * 60 * 1000);
  }

  private async generateSuggestedActions(
    context: ConversationContext,
    response: { text: string; actions: string[] }
  ): Promise<string[]> {
    // Generate contextual quick actions
    const actions = [];
    
    if (context.topic === 'contact') {
      actions.push('📝 Save contact details');
      actions.push('⏰ Set follow-up reminder');
      actions.push('💡 Get introduction suggestions');
    }
    
    if (context.topic === 'goal') {
      actions.push('🎯 Track goal progress');
      actions.push('👥 Find relevant contacts');
      actions.push('📊 Get insights');
    }

    return actions;
  }

  private getVoiceForMood(mood: string): string {
    switch (mood) {
      case 'urgent':
        return 'fast'; // More urgent tone
      case 'professional':
        return 'professional'; // Formal tone
      default:
        return 'friendly'; // Casual, friendly tone
    }
  }

  private cleanupOldSessions(): void {
    const now = Date.now();
    for (const [sessionId, context] of this.activeConversations.entries()) {
      if (now - context.lastInteraction.getTime() > this.sessionTimeout) {
        this.activeConversations.delete(sessionId);
        logger.info(`Cleaned up expired session: ${sessionId}`);
      }
    }
  }

  async endConversation(sessionId: string): Promise<void> {
    const context = this.activeConversations.get(sessionId);
    if (context) {
      // Save conversation summary
      await this.saveConversationSummary(context);
      this.activeConversations.delete(sessionId);
      logger.info(`Ended conversation session: ${sessionId}`);
    }
  }

  private async saveConversationSummary(context: ConversationContext): Promise<void> {
    try {
      const summary = await gpt4Service.generateConversationSummary(context.conversationHistory);
      
      // Save to database for future reference
      await db.conversations.create({
        user_id: context.userId,
        session_id: context.sessionId,
        topic: context.topic,
        mood: context.mood,
        summary: summary,
        duration: Date.now() - context.lastInteraction.getTime(),
      });
    } catch (error) {
      logger.error('Error saving conversation summary:', error);
    }
  }

  getActiveSession(userId: string): ConversationContext | null {
    for (const [sessionId, context] of this.activeConversations.entries()) {
      if (context.userId === userId) {
        return context;
      }
    }
    return null;
  }
}

export default new ConversationManager();
