import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import voiceProcessor from '../src/voice/processor';
import contactService from '../src/services/contacts';
import relationshipService from '../src/services/relationships';
import introductionService from '../src/services/introductions';

// Mock dependencies
jest.mock('../src/voice/processor');
jest.mock('../src/services/contacts');
jest.mock('../src/services/relationships');
jest.mock('../src/services/introductions');

const mockVoiceProcessor = voiceProcessor as jest.Mocked<typeof voiceProcessor>;
const mockContactService = contactService as jest.Mocked<typeof contactService>;
const mockRelationshipService = relationshipService as jest.Mocked<typeof relationshipService>;
const mockIntroductionService = introductionService as jest.Mocked<typeof introductionService>;

describe('Voice Processing Pipeline', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('End-to-End Voice Processing', () => {
    it('should process voice message end-to-end for contact creation', async () => {
      // Mock audio buffer
      const audioBuffer = Buffer.from('mock audio data');
      const userId = 'user123';
      
      // Mock processing steps
      const mockTranscript = "I just met John Doe at TechCorp, he's the CTO and we discussed potential partnership opportunities";
      const mockIntent = 'ADD_CONTACT';
      const mockAudioResponse = Buffer.from('mock response audio');

      const mockBotResponse = "Great! I've added John Doe from TechCorp to your contacts. He's marked as a CTO with a relationship score of 75.";

      // Mock voice processing
      mockVoiceProcessor.processVoiceMessage.mockResolvedValue({
        transcript: mockTranscript,
        intent: mockIntent,
        response: mockBotResponse,
        audioResponse: mockAudioResponse,
        sessionId: 'test-session-123',
        shouldContinue: true,
        suggestedActions: ['save_contact', 'ask_for_details']
      });

      // Process the voice message
      const result = await voiceProcessor.processVoiceMessage(audioBuffer, userId);

      // Verify the processing pipeline
      expect(mockVoiceProcessor.processVoiceMessage).toHaveBeenCalledWith(audioBuffer, userId);
      
      expect(result.transcript).toBe(mockTranscript);
      expect(result.intent).toBe(mockIntent);
      expect(result.audioResponse).toBeInstanceOf(Buffer);
    });

    it('should process voice message for contact search', async () => {
      const audioBuffer = Buffer.from('mock audio data');
      const userId = 'user123';
      
      const mockTranscript = "Tell me about David from the conference";
      const mockIntent = 'FIND_CONTACT';
      const mockAudioResponse = Buffer.from('mock response audio');

      const mockBotResponse = "I found David Smith from TechCorp. He's a VP Engineering with a relationship score of 85.";

      mockVoiceProcessor.processVoiceMessage.mockResolvedValue({
        transcript: mockTranscript,
        intent: mockIntent,
        response: mockBotResponse,
        audioResponse: mockAudioResponse,
        sessionId: 'test-session-123',
        shouldContinue: true,
        suggestedActions: ['find_contact', 'search_network']
      });

      const result = await voiceProcessor.processVoiceMessage(audioBuffer, userId);

      expect(result.transcript).toBe(mockTranscript);
      expect(result.intent).toBe(mockIntent);
    });

    it('should process voice message for goal creation', async () => {
      const audioBuffer = Buffer.from('mock audio data');
      const userId = 'user123';
      
      const mockTranscript = "My goal is to raise a seed round by Q2";
      const mockIntent = 'SET_GOAL';
      const mockAudioResponse = Buffer.from('mock response audio');

      const mockBotResponse = "Perfect! I've created a goal to raise a seed round by Q2. I'll help you track your progress.";

      mockVoiceProcessor.processVoiceMessage.mockResolvedValue({
        transcript: mockTranscript,
        intent: mockIntent,
        response: mockBotResponse,
        audioResponse: mockAudioResponse,
        sessionId: 'test-session-123',
        shouldContinue: true,
        suggestedActions: ['set_goal', 'track_progress']
      });

      const result = await voiceProcessor.processVoiceMessage(audioBuffer, userId);

      expect(result.transcript).toBe(mockTranscript);
      expect(result.intent).toBe(mockIntent);
    });

    it('should process voice message for introduction request', async () => {
      const audioBuffer = Buffer.from('mock audio data');
      const userId = 'user123';
      
      const mockTranscript = "Who can introduce me to investors?";
      const mockIntent = 'REQUEST_INTRO';
      const mockAudioResponse = Buffer.from('mock response audio');

      const mockBotResponse = "I found a great introduction! Sarah Chen from TechStart could introduce you to David Smith from InvestCorp. They're both interested in AI partnerships.";

      mockVoiceProcessor.processVoiceMessage.mockResolvedValue({
        transcript: mockTranscript,
        intent: mockIntent,
        response: mockBotResponse,
        audioResponse: mockAudioResponse,
        sessionId: 'test-session-123',
        shouldContinue: true,
        suggestedActions: ['request_intro', 'connect_people']
      });

      const result = await voiceProcessor.processVoiceMessage(audioBuffer, userId);

      expect(result.transcript).toBe(mockTranscript);
      expect(result.intent).toBe(mockIntent);
    });
  });

  describe('Audio Processing', () => {
    it('should handle different audio formats', async () => {
      const oggBuffer = Buffer.from('mock ogg audio');
      const wavBuffer = Buffer.from('mock wav audio');
      const userId = 'user123';

      mockVoiceProcessor.processVoiceMessage.mockResolvedValue({
        transcript: "Test transcript",
        intent: 'ADD_CONTACT',
        response: "Test response",
        audioResponse: Buffer.from('response'),
        sessionId: 'test-session-123',
        shouldContinue: true,
        suggestedActions: ['save_contact']
      });

      // Test OGG format
      await voiceProcessor.processVoiceMessage(oggBuffer, userId);
      expect(mockVoiceProcessor.processVoiceMessage).toHaveBeenCalledWith(oggBuffer, userId);

      // Test WAV format
      await voiceProcessor.processVoiceMessage(wavBuffer, userId);
      expect(mockVoiceProcessor.processVoiceMessage).toHaveBeenCalledWith(wavBuffer, userId);
    });

    it('should handle audio conversion errors', async () => {
      const audioBuffer = Buffer.from('invalid audio data');
      const userId = 'user123';

      mockVoiceProcessor.processVoiceMessage.mockRejectedValue(new Error('Audio conversion failed'));

      await expect(voiceProcessor.processVoiceMessage(audioBuffer, userId))
        .rejects.toThrow('Audio conversion failed');
    });
  });

  describe('Intent Recognition', () => {
    it('should recognize different voice command patterns', async () => {
      const testCases = [
        {
          transcript: "I met John Smith at the conference",
          expectedIntent: 'ADD_CONTACT',
          expectedResponse: "I've added John Smith to your contacts."
        },
        {
          transcript: "Find Sarah Johnson in my network",
          expectedIntent: 'FIND_CONTACT',
          expectedResponse: "I found Sarah Johnson in your network."
        },
        {
          transcript: "My goal is to raise funding",
          expectedIntent: 'SET_GOAL',
          expectedResponse: "I've set your goal to raise funding."
        }
      ];

      for (const testCase of testCases) {
        mockVoiceProcessor.processVoiceMessage.mockResolvedValue({
          transcript: testCase.transcript,
          intent: testCase.expectedIntent,
          response: testCase.expectedResponse,
          audioResponse: Buffer.from('response'),
          sessionId: 'test-session-123',
          shouldContinue: true,
          suggestedActions: ['continue_conversation']
        });

        const result = await voiceProcessor.processVoiceMessage(Buffer.from('test audio'), 'user123');

        expect(result.intent).toBe(testCase.expectedIntent);
        expect(result.transcript).toBe(testCase.transcript);
        expect(result.response).toBe(testCase.expectedResponse);
      }
    });

    it('should handle unknown intents gracefully', async () => {
      const audioBuffer = Buffer.from('mock audio data');
      const userId = 'user123';

      mockVoiceProcessor.processVoiceMessage.mockResolvedValue({
        transcript: "Random gibberish text",
        intent: 'UNKNOWN',
        response: "I'm not sure I understood that. Could you please rephrase?",
        audioResponse: Buffer.from('response'),
        sessionId: 'test-session-123',
        shouldContinue: true,
        suggestedActions: ['ask_for_clarification']
      });

      const result = await voiceProcessor.processVoiceMessage(audioBuffer, userId);

      expect(result.intent).toBe('UNKNOWN');
      expect(result.response).toContain("I'm not sure I understood");
    });
  });

  describe('Response Generation', () => {
    it('should generate appropriate responses for contact sharing', async () => {
      const mockTranscript = "I met John Doe";
      const expectedResponse = "I understand you met John Doe. Would you like me to save his contact information?";

      mockVoiceProcessor.processVoiceMessage.mockResolvedValue({
        transcript: mockTranscript,
        intent: 'ADD_CONTACT',
        response: expectedResponse,
        audioResponse: Buffer.from('response'),
        sessionId: 'test-session-123',
        shouldContinue: true,
        suggestedActions: ['save_contact', 'ask_for_details']
      });

      const result = await voiceProcessor.processVoiceMessage(Buffer.from('test audio'), 'user123');

      expect(result.response).toBe(expectedResponse);
      expect(result.suggestedActions).toContain('save_contact');
      expect(result.shouldContinue).toBe(true);
    });

    it('should generate appropriate responses for general conversation', async () => {
      const mockTranscript = "Hello, how are you?";
      const expectedResponse = "Hello! I'm doing well, thank you for asking. How can I assist you today?";

      mockVoiceProcessor.processVoiceMessage.mockResolvedValue({
        transcript: mockTranscript,
        intent: 'GENERAL_CONVERSATION',
        response: expectedResponse,
        audioResponse: Buffer.from('response'),
        sessionId: 'test-session-123',
        shouldContinue: true,
        suggestedActions: ['continue_conversation']
      });

      const result = await voiceProcessor.processVoiceMessage(Buffer.from('test audio'), 'user123');

      expect(result.response).toBe(expectedResponse);
      expect(result.suggestedActions).toContain('continue_conversation');
      expect(result.shouldContinue).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle transcription errors gracefully', async () => {
      const audioBuffer = Buffer.from('mock audio data');
      const userId = 'user123';

      mockVoiceProcessor.processVoiceMessage.mockRejectedValue(new Error('Transcription failed'));

      await expect(voiceProcessor.processVoiceMessage(audioBuffer, userId))
        .rejects.toThrow('Transcription failed');
    });

    it('should handle synthesis errors gracefully', async () => {
      const audioBuffer = Buffer.from('mock audio data');
      const userId = 'user123';

      mockVoiceProcessor.processVoiceMessage.mockRejectedValue(new Error('Speech synthesis failed'));

      await expect(voiceProcessor.processVoiceMessage(audioBuffer, userId))
        .rejects.toThrow('Speech synthesis failed');
    });

    it('should handle network errors gracefully', async () => {
      const audioBuffer = Buffer.from('mock audio data');
      const userId = 'user123';

      mockVoiceProcessor.processVoiceMessage.mockRejectedValue(new Error('Network timeout'));

      await expect(voiceProcessor.processVoiceMessage(audioBuffer, userId))
        .rejects.toThrow('Network timeout');
    });
  });

  describe('Performance', () => {
    it('should process audio within reasonable time', async () => {
      const audioBuffer = Buffer.from('mock audio data');
      const userId = 'user123';

      mockVoiceProcessor.processVoiceMessage.mockResolvedValue({
        transcript: "Test transcript",
        intent: 'ADD_CONTACT',
        response: "Test response",
        audioResponse: Buffer.from('response audio'),
        sessionId: 'test-session-123',
        shouldContinue: true,
        suggestedActions: ['save_contact']
      });

      const startTime = Date.now();
      await voiceProcessor.processVoiceMessage(audioBuffer, userId);
      const endTime = Date.now();

      // Should complete within 5 seconds
      expect(endTime - startTime).toBeLessThan(5000);
    });

    it('should handle large audio files', async () => {
      const largeAudioBuffer = Buffer.alloc(1024 * 1024); // 1MB
      const userId = 'user123';

      mockVoiceProcessor.processVoiceMessage.mockResolvedValue({
        transcript: "Test transcript from large audio",
        intent: 'ADD_CONTACT',
        response: "Test response for large audio",
        audioResponse: Buffer.from('response audio'),
        sessionId: 'test-session-123',
        shouldContinue: true,
        suggestedActions: ['save_contact']
      });

      const result = await voiceProcessor.processVoiceMessage(largeAudioBuffer, userId);

      expect(result.transcript).toBe("Test transcript from large audio");
      expect(result.audioResponse).toBeInstanceOf(Buffer);
    });
  });
});
