import OpenAI from 'openai';
import config from '../utils/config';
import logger from '../utils/logger';
import rateLimiter from '../utils/rateLimiter';
import { SYSTEM_PROMPTS, INTENT_PATTERNS } from './prompts';

// Response caching for frequently used queries
const responseCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Rate limiting and retry logic
const API_RETRY_ATTEMPTS = 3;
const API_RETRY_DELAY = 1000;

const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

export class GPT4Service {
  private embeddingCache = new Map<string, number[]>();
  private requestQueue: Array<() => Promise<any>> = [];
  private isProcessingQueue = false;

  // Cached embedding lookup
  private async getCachedEmbedding(text: string): Promise<number[]> {
    const cacheKey = text.trim().toLowerCase();
    if (this.embeddingCache.has(cacheKey)) {
      return this.embeddingCache.get(cacheKey)!;
    }
    
    const embedding = await this.createEmbedding(text);
    this.embeddingCache.set(cacheKey, embedding);
    return embedding;
  }

  // Queue management for API calls
  private async queueRequest<T>(requestFn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const result = await requestFn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.requestQueue.length === 0) return;
    
    this.isProcessingQueue = true;
    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift()!;
      try {
        await request();
        // Add small delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        logger.error('Queue request failed:', error);
      }
    }
    this.isProcessingQueue = false;
  }

  // Retry mechanism with exponential backoff
  private async retryRequest<T>(requestFn: () => Promise<T>, attempts = API_RETRY_ATTEMPTS): Promise<T> {
    for (let i = 0; i < attempts; i++) {
      try {
        return await requestFn();
      } catch (error: any) {
        if (i === attempts - 1) throw error;
        
        // Only retry on rate limit or temporary errors
        if (error.status === 429 || error.status >= 500) {
          const delay = API_RETRY_DELAY * Math.pow(2, i);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }
    }
    throw new Error('Max retry attempts reached');
  }
  async extractContactInfo(transcript: string): Promise<any> {
    try {
      const response = await openai.chat.completions.create({
        model: config.openai.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPTS.contactExtraction },
          { role: 'user', content: transcript }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('No response from GPT-4');

      return JSON.parse(content);
    } catch (error) {
      logger.error('Error extracting contact info:', error);
      throw error;
    }
  }

  async analyzeGoal(goalDescription: string): Promise<any> {
    try {
      const response = await openai.chat.completions.create({
        model: config.openai.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPTS.goalAnalysis },
          { role: 'user', content: goalDescription }
        ],
        temperature: 0.5,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('No response from GPT-4');

      return JSON.parse(content);
    } catch (error) {
      logger.error('Error analyzing goal:', error);
      throw error;
    }
  }

  async scoreRelationship(contactInfo: any, interactions: any[]): Promise<any> {
    try {
      const context = `
Contact: ${contactInfo.name}
Company: ${contactInfo.company || 'Unknown'}
Title: ${contactInfo.title || 'Unknown'}
Last Interaction: ${contactInfo.last_interaction || 'Never'}
Total Interactions: ${interactions.length}
Recent Interactions: ${JSON.stringify(interactions.slice(0, 5))}
      `;

      const response = await openai.chat.completions.create({
        model: config.openai.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPTS.relationshipScoring },
          { role: 'user', content: context }
        ],
        temperature: 0.4,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('No response from GPT-4');

      return JSON.parse(content);
    } catch (error) {
      logger.error('Error scoring relationship:', error);
      throw error;
    }
  }

  async generateIntroduction(fromContact: any, toContact: any, reason: string): Promise<string> {
    try {
      const context = `
From: ${fromContact.name} (${fromContact.title} at ${fromContact.company})
To: ${toContact.name} (${toContact.title} at ${toContact.company})
Reason: ${reason}
      `;

      const response = await openai.chat.completions.create({
        model: config.openai.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPTS.introductionSuggestion },
          { role: 'user', content: context }
        ],
        temperature: 0.7,
        max_tokens: 300,
      });

      return response.choices[0]?.message?.content || '';
    } catch (error) {
      logger.error('Error generating introduction:', error);
      throw error;
    }
  }

  async detectIntent(transcript: string): Promise<string> {
    const lowerTranscript = transcript.toLowerCase();
    
    for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
      if (patterns.some(pattern => lowerTranscript.includes(pattern))) {
        return intent;
      }
    }
    
    return 'GENERAL';
  }

  async generateVoiceResponse(context: string, userMessage: string, userId?: string): Promise<string> {
    try {
      // Check OpenAI rate limits if userId is provided
      if (userId) {
        const openAICheck = rateLimiter.canMakeOpenAIRequest(userId);
        if (!openAICheck.allowed) {
          logger.warn(`OpenAI rate limit exceeded for user ${userId}`);
          return `I'm a bit busy right now. Please wait ${openAICheck.retryAfter} seconds and try again.`;
        }
        rateLimiter.recordOpenAIRequest(userId);
      }

      const response = await openai.chat.completions.create({
        model: config.openai.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPTS.voicePersonality },
          { role: 'user', content: `Context: ${context}\n\nUser said: ${userMessage}` }
        ],
        temperature: 0.7,
        max_tokens: 150,
      });

      return response.choices[0]?.message?.content || 'I understand. How else can I help you?';
    } catch (error) {
      logger.error('Error generating voice response:', error);
      return 'I had trouble processing that. Could you try again?';
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

  async findSimilarContacts(
    embedding: number[],
    allContacts: any[],
    threshold: number = 0.7
  ): Promise<any[]> {
    // Batch process contacts for better performance
    const batchSize = 10;
    const similarities: Array<{ contact: any; similarity: number }> = [];
    
    for (let i = 0; i < allContacts.length; i += batchSize) {
      const batch = allContacts.slice(i, i + batchSize);
      
      const batchSimilarities = await Promise.all(
        batch.map(async (contact) => {
          const contactText = `${contact.name} ${contact.company} ${contact.title} ${contact.notes}`;
          const contactEmbedding = await this.getCachedEmbedding(contactText);
          
          const similarity = this.cosineSimilarity(embedding, contactEmbedding);
          return { contact, similarity };
        })
      );
      
      similarities.push(...batchSimilarities);
    }

    return similarities
      .filter(s => s.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .map(s => s.contact);
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

  // Additional methods for relationship and introduction services
  async suggestIntroductions(goals: any[], contacts: any[]): Promise<any[]> {
    try {
      // Simple implementation - in production, this would use AI to suggest introductions
      const suggestions = [];
      if (contacts.length >= 2) {
        suggestions.push({
          from_contact: contacts[0],
          to_contact: contacts[1],
          reason: 'Potential collaboration based on goals'
        });
      }
      return suggestions;
    } catch (error) {
      logger.error('Error suggesting introductions:', error);
      return [];
    }
  }

  async suggestIntroductionsByInterests(contacts: any[]): Promise<any[]> {
    try {
      // Simple implementation - in production, this would analyze interests
      const suggestions = [];
      if (contacts.length >= 2) {
        suggestions.push({
          from_contact: contacts[0],
          to_contact: contacts[1],
          reason: 'Shared interests',
          confidence: 0.8,
          mutual_interests: ['Technology']
        });
      }
      return suggestions;
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
}

export default new GPT4Service();
