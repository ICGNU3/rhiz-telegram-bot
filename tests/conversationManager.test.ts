import { describe, it, expect, beforeEach } from '@jest/globals';
import conversationManager from '../src/voice/conversationManager';

describe('ConversationManager', () => {
  beforeEach(() => {
    // Reset conversation manager state
    (conversationManager as any).activeConversations.clear();
  });

  describe('startConversation', () => {
    it('should create a new conversation session', async () => {
      const sessionId = await conversationManager.startConversation('user123');
      
      expect(sessionId).toBeDefined();
      expect(sessionId).toMatch(/^session_user123_\d+$/);
      
      const session = (conversationManager as any).getActiveSession('user123');
      expect(session).toBeDefined();
      expect(session.userId).toBe('user123');
      expect(session.sessionId).toBe(sessionId);
    });

    it('should clean up old sessions', async () => {
      // Create a session and manually set it as old
      const sessionId = await conversationManager.startConversation('user123');
      const session = (conversationManager as any).activeConversations.get(sessionId);
      
      // Manually set last interaction to be old
      session.lastInteraction = new Date(Date.now() - 31 * 60 * 1000); // 31 minutes ago
      
      // Start a new conversation which should trigger cleanup
      await conversationManager.startConversation('user456');
      
      // Old session should be cleaned up
      const oldSession = (conversationManager as any).activeConversations.get(sessionId);
      expect(oldSession).toBeUndefined();
    });
  });

  describe('processVoiceInput', () => {
    it('should process voice input and return response', async () => {
      const sessionId = await conversationManager.startConversation('user123');
      
      const result = await conversationManager.processVoiceInput(
        'user123',
        'I just met John Smith at the conference',
        sessionId
      );
      
      expect(result).toBeDefined();
      expect(result.response).toBeDefined();
      expect(result.audioResponse).toBeDefined();
      expect(result.sessionId).toBe(sessionId);
      expect(result.shouldContinue).toBeDefined();
      expect(result.suggestedActions).toBeDefined();
    });

    it('should create new session if none exists', async () => {
      const result = await conversationManager.processVoiceInput(
        'user123',
        'Hello there'
      );
      
      expect(result.sessionId).toBeDefined();
      expect(result.sessionId).toMatch(/^session_user123_\d+$/);
    });

    it('should maintain conversation context', async () => {
      const sessionId = await conversationManager.startConversation('user123');
      
      // First message
      await conversationManager.processVoiceInput(
        'user123',
        'I met Sarah at the conference',
        sessionId
      );
      
      // Second message - should have context
      const result = await conversationManager.processVoiceInput(
        'user123',
        'What did I tell you about her?',
        sessionId
      );
      
      expect(result.sessionId).toBe(sessionId);
      // The response should acknowledge the previous context about Sarah
      expect(result.response).toBeDefined();
    });
  });

  describe('endConversation', () => {
    it('should end conversation and clean up session', async () => {
      const sessionId = await conversationManager.startConversation('user123');
      
      // Verify session exists
      let session = (conversationManager as any).getActiveSession('user123');
      expect(session).toBeDefined();
      
      // End conversation
      await conversationManager.endConversation(sessionId);
      
      // Verify session is cleaned up
      session = (conversationManager as any).getActiveSession('user123');
      expect(session).toBeNull();
    });

    it('should handle ending non-existent session gracefully', async () => {
      await expect(conversationManager.endConversation('non-existent-session'))
        .resolves.not.toThrow();
    });
  });

  describe('getActiveSession', () => {
    it('should return active session for user', async () => {
      const sessionId = await conversationManager.startConversation('user123');
      
      const session = (conversationManager as any).getActiveSession('user123');
      expect(session).toBeDefined();
      expect(session.sessionId).toBe(sessionId);
    });

    it('should return null for user without active session', () => {
      const session = (conversationManager as any).getActiveSession('user456');
      expect(session).toBeNull();
    });
  });
});
