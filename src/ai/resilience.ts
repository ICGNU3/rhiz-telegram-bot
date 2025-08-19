import OpenAI from 'openai';
import logger from '../utils/logger';

export interface AIFallbackOptions {
  enableFallback: boolean;
  fallbackModel?: string;
  maxRetries: number;
  timeoutMs: number;
  gracefulDegradation: boolean;
}

export class AIResilienceManager {
  private defaultOptions: AIFallbackOptions = {
    enableFallback: true,
    fallbackModel: 'gpt-3.5-turbo',
    maxRetries: 3,
    timeoutMs: 30000,
    gracefulDegradation: true
  };

  private circuitBreaker = {
    failures: 0,
    lastFailure: 0,
    threshold: 5,
    timeout: 60000 // 1 minute
  };

  async executeWithResilience<T>(
    operation: () => Promise<T>,
    fallbackOperation?: () => Promise<T>,
    options: Partial<AIFallbackOptions> = {}
  ): Promise<T> {
    const opts = { ...this.defaultOptions, ...options };
    
    // Check circuit breaker
    if (this.isCircuitOpen()) {
      if (opts.gracefulDegradation && fallbackOperation) {
        logger.warn('Circuit breaker open, using fallback operation');
        return await fallbackOperation();
      }
      throw new Error('Service temporarily unavailable');
    }

    for (let attempt = 1; attempt <= opts.maxRetries; attempt++) {
      try {
        // Add timeout wrapper
        const result = await Promise.race([
          operation(),
          this.timeoutPromise<T>(opts.timeoutMs)
        ]);
        
        // Reset circuit breaker on success
        this.resetCircuitBreaker();
        return result;
        
      } catch (error: any) {
        logger.error(`AI operation attempt ${attempt} failed:`, error);
        
        // Record failure for circuit breaker
        this.recordFailure();
        
        // If this is the last attempt or error is not retryable
        if (attempt === opts.maxRetries || !this.isRetryableError(error)) {
          if (opts.gracefulDegradation && fallbackOperation) {
            logger.warn('Using fallback operation after max retries');
            return await fallbackOperation();
          }
          throw error;
        }
        
        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        await this.delay(delay);
      }
    }
    
    throw new Error('Max retries exceeded');
  }

  // Graceful degradation strategies
  async getFallbackContactExtraction(transcript: string): Promise<any> {
    // Simple pattern-based extraction as fallback
    const namePattern = /(?:I met|met with|spoke to|talked with)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i;
    const companyPattern = /(?:at|from|works at)\s+([A-Z][a-zA-Z\s&]+)(?:\s|$|,)/;
    const emailPattern = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
    const phonePattern = /(\+?\d{1,3}[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/;

    const name = transcript.match(namePattern)?.[1] || null;
    const company = transcript.match(companyPattern)?.[1]?.trim() || null;
    const email = transcript.match(emailPattern)?.[1] || null;
    const phone = transcript.match(phonePattern)?.[1] || null;

    if (!name) {
      throw new Error('Could not extract contact name');
    }

    return {
      name,
      company,
      email,
      phone,
      notes: transcript,
      fallback_extraction: true
    };
  }

  async getFallbackIntentDetection(transcript: string): Promise<string> {
    const text = transcript.toLowerCase();
    
    // Simple keyword-based intent detection
    if (text.includes('met') || text.includes('new contact')) return 'ADD_CONTACT';
    if (text.includes('find') || text.includes('who is')) return 'FIND_CONTACT';
    if (text.includes('goal') || text.includes('want to')) return 'SET_GOAL';
    if (text.includes('introduce') || text.includes('connect')) return 'REQUEST_INTRO';
    if (text.includes('remind') || text.includes('follow up')) return 'SET_REMINDER';
    
    return 'GENERAL';
  }

  async getFallbackVoiceResponse(context: string, userMessage: string): Promise<string> {
    // Template-based responses for common scenarios
    const intent = await this.getFallbackIntentDetection(userMessage);
    
    const responses: { [key: string]: string } = {
      'ADD_CONTACT': "I've noted your contact information. Is there anything specific you'd like me to remember about them?",
      'FIND_CONTACT': "I'll help you find that contact. Let me search through your connections.",
      'SET_GOAL': "I've recorded your goal. I'll help you track progress and suggest relevant connections.",
      'REQUEST_INTRO': "I'll look for potential introductions that could help with that.",
      'SET_REMINDER': "I'll set up that reminder for you.",
      'GENERAL': "I understand. How else can I help you with your relationships today?"
    };
    
    return responses[intent] || responses['GENERAL'];
  }

  // Health monitoring and metrics
  getHealthMetrics(): {
    circuitBreakerStatus: 'open' | 'closed';
    recentFailures: number;
    lastFailureTime: Date | null;
    averageResponseTime: number;
  } {
    return {
      circuitBreakerStatus: this.isCircuitOpen() ? 'open' : 'closed',
      recentFailures: this.circuitBreaker.failures,
      lastFailureTime: this.circuitBreaker.lastFailure 
        ? new Date(this.circuitBreaker.lastFailure) 
        : null,
      averageResponseTime: 0 // TODO: Implement response time tracking
    };
  }

  // Rate limiting
  private lastRequestTime = 0;
  private requestCount = 0;
  private readonly rateLimitWindow = 60000; // 1 minute
  private readonly rateLimitMax = 60; // 60 requests per minute

  async checkRateLimit(): Promise<void> {
    const now = Date.now();
    
    // Reset counter if window has passed
    if (now - this.lastRequestTime > this.rateLimitWindow) {
      this.requestCount = 0;
      this.lastRequestTime = now;
    }
    
    if (this.requestCount >= this.rateLimitMax) {
      const waitTime = this.rateLimitWindow - (now - this.lastRequestTime);
      throw new Error(`Rate limit exceeded. Please wait ${Math.ceil(waitTime / 1000)} seconds.`);
    }
    
    this.requestCount++;
  }

  private isCircuitOpen(): boolean {
    const now = Date.now();
    return this.circuitBreaker.failures >= this.circuitBreaker.threshold &&
           (now - this.circuitBreaker.lastFailure) < this.circuitBreaker.timeout;
  }

  private recordFailure(): void {
    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailure = Date.now();
  }

  private resetCircuitBreaker(): void {
    this.circuitBreaker.failures = 0;
    this.circuitBreaker.lastFailure = 0;
  }

  private isRetryableError(error: any): boolean {
    // Retry on rate limits, timeouts, and server errors
    return error.status === 429 || 
           error.status >= 500 || 
           error.code === 'TIMEOUT' ||
           error.message?.includes('timeout');
  }

  private timeoutPromise<T>(ms: number): Promise<T> {
    return new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Operation timeout')), ms)
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default new AIResilienceManager();