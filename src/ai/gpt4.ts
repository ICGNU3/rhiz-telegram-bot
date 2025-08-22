import OpenAI from 'openai';
import config from '../utils/config';
import logger from '../utils/logger';
import { modelSelector } from './model-registry';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

interface VoiceProcessingResult {
  sessionId: string;
  shouldContinue: boolean;
  suggestedActions: string[];
  transcript: string;
  intent: string;
  confidence: number;
  entities: Record<string, any>;
  response: string;
}

interface ContactExtractionResult {
  name?: string;
  company?: string;
  title?: string;
  email?: string;
  phone?: string;
  location?: string;
  notes?: string;
  confidence: number;
}

interface GoalExtractionResult {
  description: string;
  targetDate?: string;
  priority: 'low' | 'medium' | 'high';
  category: string;
  confidence: number;
}

class GPT4Service {
  /**
   * Generate a response using the optimal model for the task
   */
  async generateResponse(prompt: string): Promise<string> {
    try {
      const model = modelSelector.getOptimalModel('general_response', 'medium');
      
      const completion = await openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful AI assistant focused on relationship management and networking. Provide clear, actionable responses.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 500,
        temperature: 0.7,
      });

      const response = completion.choices[0]?.message?.content || 'I apologize, but I couldn\'t generate a response.';
      
      logger.info(`Generated response using ${model}`, {
        promptLength: prompt.length,
        responseLength: response.length,
        tokensUsed: completion.usage?.total_tokens
      });

      return response;
    } catch (error) {
      logger.error('Error generating response:', error);
      return 'I apologize, but I encountered an error while processing your request. Please try again.';
    }
  }

  /**
   * Process voice input and extract information
   */
  async processVoiceInput(audioBuffer: Buffer, userId: string, context?: any): Promise<VoiceProcessingResult> {
    try {
      // Convert audio to text using Whisper
      const transcript = await this.transcribeAudio(audioBuffer);
      
      // Detect intent and extract entities
      const intentResult = await this.detectIntent(transcript);
      
      // Generate appropriate response
      const response = await this.generateContextualResponse(transcript, intentResult);
      
      return {
        sessionId: `session_${userId}_${Date.now()}`,
        shouldContinue: intentResult.confidence > 0.7,
        suggestedActions: this.getSuggestedActions(intentResult.intent),
        transcript,
        intent: intentResult.intent,
        confidence: intentResult.confidence,
        entities: intentResult.entities,
        response
      };
    } catch (error) {
      logger.error('Error processing voice input:', error);
      return {
        sessionId: `session_${userId}_${Date.now()}`,
        shouldContinue: false,
        suggestedActions: ['Try again', 'Use text input'],
        transcript: '',
        intent: 'error',
        confidence: 0,
        entities: {},
        response: 'I encountered an error processing your voice message. Please try again or use text input.'
      };
    }
  }

  /**
   * Transcribe audio using Whisper
   */
  private async transcribeAudio(audioBuffer: Buffer): Promise<string> {
    try {
      const transcription = await openai.audio.transcriptions.create({
        file: new File([audioBuffer], 'audio.wav', { type: 'audio/wav' }),
        model: config.openai.whisperModel,
        response_format: 'text'
      });

      return transcription;
    } catch (error) {
      logger.error('Error transcribing audio:', error);
      throw new Error('Failed to transcribe audio');
    }
  }

  /**
   * Detect intent from text
   */
  async detectIntent(text: string): Promise<{
    intent: string;
    confidence: number;
    entities: Record<string, any>;
  }> {
    try {
      const model = modelSelector.getOptimalModel('intent_detection', 'simple');
      
      const completion = await openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: 'Analyze the user\'s intent and extract key information. Return a JSON object with intent, confidence (0-1), and entities.'
          },
          {
            role: 'user',
            content: text
          }
        ],
        max_tokens: 200,
        temperature: 0.3,
      });

      const response = completion.choices[0]?.message?.content || '{}';
      
      try {
        const result = JSON.parse(response);
        return {
          intent: result.intent || 'unknown',
          confidence: result.confidence || 0.5,
          entities: result.entities || {}
        };
      } catch {
        // Fallback to pattern matching
        return this.fallbackIntentDetection(text);
      }
    } catch (error) {
      logger.error('Error detecting intent:', error);
      return this.fallbackIntentDetection(text);
    }
  }

  /**
   * Fallback intent detection using pattern matching
   */
  private fallbackIntentDetection(text: string): {
    intent: string;
    confidence: number;
    entities: Record<string, any>;
  } {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('met') || lowerText.includes('introduced') || lowerText.includes('contact')) {
      return {
        intent: 'add_contact',
        confidence: 0.8,
        entities: { action: 'add_contact' }
      };
    }
    
    if (lowerText.includes('find') || lowerText.includes('search') || lowerText.includes('who')) {
      return {
        intent: 'find_contact',
        confidence: 0.7,
        entities: { action: 'search' }
      };
    }
    
    if (lowerText.includes('goal') || lowerText.includes('objective') || lowerText.includes('target')) {
      return {
        intent: 'set_goal',
        confidence: 0.8,
        entities: { action: 'set_goal' }
      };
    }
    
    return {
      intent: 'general_conversation',
      confidence: 0.5,
      entities: {}
    };
  }

  /**
   * Generate contextual response based on intent
   */
  private async generateContextualResponse(
    transcript: string, 
    intentResult: { intent: string; confidence: number; entities: Record<string, any> }
  ): Promise<string> {
    const model = modelSelector.getOptimalModel('response_generation', 'medium');
    
    const prompt = `Based on the user's message: "${transcript}"
Intent: ${intentResult.intent}
Confidence: ${intentResult.confidence}

Generate a helpful, contextual response that:
1. Acknowledges what the user said
2. Provides relevant information or asks clarifying questions
3. Suggests next steps if appropriate

Keep the response conversational and under 200 words.`;

    const completion = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are a helpful AI assistant for relationship management. Provide clear, actionable responses.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 300,
      temperature: 0.7,
    });

    return completion.choices[0]?.message?.content || 'I understand. How can I help you further?';
  }

  /**
   * Extract contact information from text
   */
  async extractContactInfo(text: string): Promise<ContactExtractionResult> {
    try {
      const model = modelSelector.getOptimalModel('contact_extraction', 'medium');
      
      const completion = await openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: 'Extract contact information from the text. Return a JSON object with name, company, title, email, phone, location, notes, and confidence (0-1).'
          },
          {
            role: 'user',
            content: text
          }
        ],
        max_tokens: 200,
        temperature: 0.3,
      });

      const response = completion.choices[0]?.message?.content || '{}';
      
      try {
        const result = JSON.parse(response);
        return {
          name: result.name,
          company: result.company,
          title: result.title,
          email: result.email,
          phone: result.phone,
          location: result.location,
          notes: result.notes,
          confidence: result.confidence || 0.5
        };
      } catch {
        return {
          confidence: 0.3
        };
      }
    } catch (error) {
      logger.error('Error extracting contact info:', error);
      return {
        confidence: 0.3
      };
    }
  }

  /**
   * Extract goal information from text
   */
  async extractGoalInfo(text: string): Promise<GoalExtractionResult> {
    try {
      const model = modelSelector.getOptimalModel('goal_extraction', 'medium');
      
      const completion = await openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: 'Extract goal information from the text. Return a JSON object with description, targetDate, priority (low/medium/high), category, and confidence (0-1).'
          },
          {
            role: 'user',
            content: text
          }
        ],
        max_tokens: 200,
        temperature: 0.3,
      });

      const response = completion.choices[0]?.message?.content || '{}';
      
      try {
        const result = JSON.parse(response);
        return {
          description: result.description || 'General goal',
          targetDate: result.targetDate,
          priority: result.priority || 'medium',
          category: result.category || 'general',
          confidence: result.confidence || 0.5
        };
      } catch {
        return {
          description: 'General goal',
          priority: 'medium',
          category: 'general',
          confidence: 0.3
        };
      }
    } catch (error) {
      logger.error('Error extracting goal info:', error);
      return {
        description: 'General goal',
        priority: 'medium',
        category: 'general',
        confidence: 0.3
      };
    }
  }

  /**
   * Generate voice response using ElevenLabs
   */
  async generateVoiceResponse(prompt: string): Promise<string> {
    try {
      const model = modelSelector.getOptimalModel('voice_response', 'simple');
      
      const completion = await openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: 'Generate a natural, conversational response suitable for voice synthesis. Keep it under 100 words and make it sound natural when spoken.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 150,
        temperature: 0.7,
      });

      return completion.choices[0]?.message?.content || 'I understand. How can I help you?';
    } catch (error) {
      logger.error('Error generating voice response:', error);
      return 'I understand. How can I help you?';
    }
  }

  /**
   * Get suggested actions based on intent
   */
  private getSuggestedActions(intent: string): string[] {
    const actionMap: Record<string, string[]> = {
      'add_contact': ['Save contact', 'Add more details', 'Set reminder'],
      'find_contact': ['Search contacts', 'Filter by company', 'Recent contacts'],
      'set_goal': ['Create goal', 'Set timeline', 'Add milestones'],
      'general_conversation': ['Ask questions', 'Get help', 'Learn more']
    };

    return actionMap[intent] || ['Continue conversation', 'Ask for help'];
  }

  // Additional methods that other services depend on
  async analyzeGoal(goalDescription: string): Promise<any> {
    try {
      const model = modelSelector.getOptimalModel('goal_analysis', 'medium');
      
      const completion = await openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: 'Analyze the goal and return a JSON object with priority, timeline, milestones, and category.'
          },
          {
            role: 'user',
            content: goalDescription
          }
        ],
        max_tokens: 200,
        temperature: 0.3,
      });

      const response = completion.choices[0]?.message?.content || '{}';
      return JSON.parse(response);
    } catch (error) {
      logger.error('Error analyzing goal:', error);
      return { priority: 'medium', category: 'general' };
    }
  }

  async scoreRelationship(contactInfo: any, interactions: any[]): Promise<any> {
    try {
      const model = modelSelector.getOptimalModel('relationship_scoring', 'medium');
      
      const context = `
Contact: ${contactInfo.name}
Company: ${contactInfo.company || 'Unknown'}
Title: ${contactInfo.title || 'Unknown'}
Interactions: ${interactions.length}
      `;

      const completion = await openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: 'Score the relationship and return a JSON object with score (0-100), trust_level, and recommendations.'
          },
          {
            role: 'user',
            content: context
          }
        ],
        max_tokens: 200,
        temperature: 0.3,
      });

      const response = completion.choices[0]?.message?.content || '{}';
      return JSON.parse(response);
    } catch (error) {
      logger.error('Error scoring relationship:', error);
      return { score: 50, trust_level: 'medium' };
    }
  }

  async createEmbedding(text: string): Promise<number[]> {
    try {
      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
      });

      return response.data[0].embedding;
    } catch (error) {
      logger.error('Error creating embedding:', error);
      throw error;
    }
  }

  async findSimilarContacts(embedding: number[], allContacts: any[], threshold: number = 0.7): Promise<any[]> {
    try {
      const similarities: Array<{ contact: any; similarity: number }> = [];
      
      for (const contact of allContacts) {
        const contactText = `${contact.name} ${contact.company} ${contact.title} ${contact.notes}`;
        const contactEmbedding = await this.createEmbedding(contactText);
        
        const similarity = this.cosineSimilarity(embedding, contactEmbedding);
        similarities.push({ contact, similarity });
      }

      return similarities
        .filter(s => s.similarity >= threshold)
        .sort((a, b) => b.similarity - a.similarity)
        .map(s => s.contact);
    } catch (error) {
      logger.error('Error finding similar contacts:', error);
      return [];
    }
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  async suggestIntroductions(goals: any[], contacts: any[]): Promise<any[]> {
    try {
      const model = modelSelector.getOptimalModel('introduction_suggestions', 'medium');
      
      const context = `
Goals: ${JSON.stringify(goals)}
Contacts: ${contacts.length} available
      `;

      const completion = await openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: 'Suggest introductions based on goals and contacts. Return a JSON array of introduction suggestions.'
          },
          {
            role: 'user',
            content: context
          }
        ],
        max_tokens: 300,
        temperature: 0.5,
      });

      const response = completion.choices[0]?.message?.content || '[]';
      return JSON.parse(response);
    } catch (error) {
      logger.error('Error suggesting introductions:', error);
      return [];
    }
  }

  async generateIntroduction(fromContact: any, toContact: any, reason: string): Promise<string> {
    try {
      const model = modelSelector.getOptimalModel('introduction_generation', 'medium');
      
      const context = `
From: ${fromContact.name} (${fromContact.title} at ${fromContact.company})
To: ${toContact.name} (${toContact.title} at ${toContact.company})
Reason: ${reason}
      `;

      const completion = await openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: 'Generate a professional introduction message.'
          },
          {
            role: 'user',
            content: context
          }
        ],
        max_tokens: 200,
        temperature: 0.7,
      });

      return completion.choices[0]?.message?.content || '';
    } catch (error) {
      logger.error('Error generating introduction:', error);
      return '';
    }
  }

  async suggestIntroductionsByInterests(contacts: any[]): Promise<any[]> {
    try {
      return this.suggestIntroductions([], contacts);
    } catch (error) {
      logger.error('Error suggesting introductions by interests:', error);
      return [];
    }
  }

  async suggestIntroductionFollowUps(introduction: any, fromContact: any, toContact: any): Promise<string[]> {
    try {
      return [
        'Schedule a meeting between the contacts',
        'Send calendar invite',
        'Follow up in a week'
      ];
    } catch (error) {
      logger.error('Error suggesting introduction follow-ups:', error);
      return [];
    }
  }

  async generateGoalInsights(goal: any, contacts: any[]): Promise<any[]> {
    try {
      return [
        {
          type: 'opportunity',
          title: 'Goal Progress Opportunity',
          description: 'You have contacts that could help with this goal',
          confidence: 0.8,
          actionable: true,
          next_action: 'Reach out to relevant contacts'
        }
      ];
    } catch (error) {
      logger.error('Error generating goal insights:', error);
      return [];
    }
  }

  async generateContactInsights(contact: any, interactions: any[], goals: any[]): Promise<any[]> {
    try {
      return [
        {
          type: 'strength',
          title: 'Strong Relationship',
          description: 'This contact has been engaged regularly',
          confidence: 0.7,
          actionable: true,
          next_action: 'Consider for introductions'
        }
      ];
    } catch (error) {
      logger.error('Error generating contact insights:', error);
      return [];
    }
  }

  async suggestFollowUps(contact: any, interactions: any[]): Promise<string[]> {
    try {
      return [
        'Schedule follow-up meeting',
        'Send thank you email',
        'Connect on LinkedIn'
      ];
    } catch (error) {
      logger.error('Error suggesting follow-ups:', error);
      return [];
    }
  }

  async analyzeConversation(transcript: string, context: any): Promise<{ mood: 'casual' | 'professional' | 'urgent'; topic: string }> {
    try {
      const model = modelSelector.getOptimalModel('conversation_analysis', 'medium');
      
      const completion = await openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: 'Analyze the conversation mood and topic. Return JSON with mood (casual/professional/urgent) and topic.'
          },
          {
            role: 'user',
            content: `Transcript: "${transcript}"`
          }
        ],
        max_tokens: 100,
        temperature: 0.3,
      });

      const result = JSON.parse(completion.choices[0]?.message?.content || '{"mood": "casual", "topic": "general"}');
      return {
        mood: result.mood || 'casual',
        topic: result.topic || 'general'
      };
    } catch (error) {
      logger.error('Error analyzing conversation:', error);
      return { mood: 'casual', topic: 'general' };
    }
  }

  async generateConversationalResponse(transcript: string, context: any): Promise<{ text: string; actions: string[] }> {
    try {
      const model = modelSelector.getOptimalModel('conversational_response', 'medium');
      
      const completion = await openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: 'Generate a conversational response and suggest actions. Return JSON with text and actions array.'
          },
          {
            role: 'user',
            content: transcript
          }
        ],
        max_tokens: 200,
        temperature: 0.7,
      });

      const result = JSON.parse(completion.choices[0]?.message?.content || '{"text": "I understand", "actions": []}');
      return {
        text: result.text || 'I understand. How else can I help you?',
        actions: result.actions || []
      };
    } catch (error) {
      logger.error('Error generating conversational response:', error);
      return {
        text: 'I understand. How else can I help you?',
        actions: []
      };
    }
  }

  async generateConversationSummary(conversationHistory: Array<{ role: string; content: string; timestamp: Date }>): Promise<string> {
    try {
      const model = modelSelector.getOptimalModel('conversation_summary', 'medium');
      
      const conversationText = conversationHistory
        .map(msg => `${msg.role}: ${msg.content}`)
        .join('\n');

      const completion = await openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: 'Summarize this conversation in 2-3 sentences.'
          },
          {
            role: 'user',
            content: conversationText
          }
        ],
        max_tokens: 150,
        temperature: 0.5,
      });

      return completion.choices[0]?.message?.content || 'Conversation summary unavailable.';
    } catch (error) {
      logger.error('Error generating conversation summary:', error);
      return 'Conversation summary unavailable.';
    }
  }
}

export default new GPT4Service();
