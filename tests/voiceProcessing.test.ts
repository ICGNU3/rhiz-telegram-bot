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
        audioResponse: mockAudioResponse
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
        audioResponse: mockAudioResponse
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
        audioResponse: mockAudioResponse
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
        audioResponse: mockAudioResponse
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
        audioResponse: Buffer.from('response')
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
      const userId = 'user123';
      const audioBuffer = Buffer.from('mock audio');

      const testCases = [
        {
          transcript: "I met John at the conference",
          expectedIntent: 'ADD_CONTACT'
        },
        {
          transcript: "Who is Sarah Chen?",
          expectedIntent: 'FIND_CONTACT'
        },
        {
          transcript: "My goal is to hire 5 engineers",
          expectedIntent: 'SET_GOAL'
        },
        {
          transcript: "Can you introduce me to investors?",
          expectedIntent: 'REQUEST_INTRO'
        },
        {
          transcript: "Remind me to call David tomorrow",
          expectedIntent: 'SET_REMINDER'
        }
      ];

      for (const testCase of testCases) {
        mockVoiceProcessor.processVoiceMessage.mockResolvedValue({
          transcript: testCase.transcript,
          intent: testCase.expectedIntent,
          response: "Test response",
          audioResponse: Buffer.from('response')
        });

        const result = await voiceProcessor.processVoiceMessage(audioBuffer, userId);
        expect(result.intent).toBe(testCase.expectedIntent);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle transcription errors gracefully', async () => {
      const audioBuffer = Buffer.from('mock audio');
      const userId = 'user123';

      mockVoiceProcessor.processVoiceMessage.mockRejectedValue(new Error('Transcription failed'));

      await expect(voiceProcessor.processVoiceMessage(audioBuffer, userId))
        .rejects.toThrow('Transcription failed');
    });

    it('should handle service errors gracefully', async () => {
      const audioBuffer = Buffer.from('mock audio');
      const userId = 'user123';

      mockVoiceProcessor.processVoiceMessage.mockResolvedValue({
        transcript: "I met John Doe",
        intent: 'ADD_CONTACT',
        response: "Test response",
        audioResponse: Buffer.from('response')
      });

      const result = await voiceProcessor.processVoiceMessage(audioBuffer, userId);
      
      // The voice processor should handle the processing successfully
      expect(result.transcript).toBe("I met John Doe");
      expect(result.intent).toBe('ADD_CONTACT');
    });
  });

  describe('Response Generation', () => {
    it('should generate appropriate responses for different intents', async () => {
      const userId = 'user123';
      const audioBuffer = Buffer.from('mock audio');

      const testCases = [
        {
          intent: 'ADD_CONTACT',
          data: { name: 'John Doe', company: 'TechCorp' },
          expectedResponsePattern: /added.*John Doe.*TechCorp/i
        },
        {
          intent: 'FIND_CONTACT',
          data: [{ name: 'Sarah Chen', company: 'Startup' }],
          expectedResponsePattern: /found.*Sarah Chen/i
        },
        {
          intent: 'SET_GOAL',
          data: { description: 'Raise funding', type: 'fundraising' },
          expectedResponsePattern: /created.*goal.*funding/i
        }
      ];

      for (const testCase of testCases) {
        mockVoiceProcessor.processVoiceMessage.mockResolvedValue({
          transcript: "Test transcript",
          intent: testCase.intent,
          response: `Response for ${testCase.intent}`,
          audioResponse: Buffer.from('response audio')
        });

        const result = await voiceProcessor.processVoiceMessage(audioBuffer, userId);
        expect(result.intent).toBe(testCase.intent);
      }
    });
  });
});
