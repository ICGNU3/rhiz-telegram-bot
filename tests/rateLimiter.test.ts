import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import rateLimiter from '../src/utils/rateLimiter';

describe('RateLimiter', () => {
  beforeEach(() => {
    // Reset rate limiter state before each test
    (rateLimiter as any).reset();
    rateLimiter.updateConfig({
      maxRequestsPerMinute: 5,
      maxRequestsPerHour: 20,
      maxVoiceMessageSize: 10 * 1024 * 1024, // 10MB
      maxConcurrentRequests: 2,
      openAIMaxRequestsPerMinute: 10
    });
  });

  describe('Basic Rate Limiting', () => {
    it('should allow requests within limits', () => {
      const userId = 'user123';
      
      // Make 5 requests (within minute limit)
      for (let i = 0; i < 5; i++) {
        const result = rateLimiter.canMakeRequest(userId);
        expect(result.allowed).toBe(true);
        rateLimiter.recordRequest(userId);
      }
      
      // 6th request should be blocked
      const result = rateLimiter.canMakeRequest(userId);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Rate limit exceeded (per minute)');
    });

    it('should block requests when minute limit exceeded', () => {
      const userId = 'user123';
      
      // Make 5 requests (at the limit)
      for (let i = 0; i < 5; i++) {
        const canMake = rateLimiter.canMakeRequest(userId);
        expect(canMake.allowed).toBe(true);
        rateLimiter.recordRequest(userId);
      }
      
      // 6th request should be blocked
      const result = rateLimiter.canMakeRequest(userId);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Rate limit exceeded (per minute)');
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('should block requests when concurrent limit exceeded', () => {
      const userId = 'user123';
      
      // Make 2 concurrent requests (at the limit)
      for (let i = 0; i < 2; i++) {
        rateLimiter.recordRequest(userId);
      }
      
      // 3rd concurrent request should be blocked
      const result = rateLimiter.canMakeRequest(userId);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Too many concurrent requests');
      expect(result.retryAfter).toBe(30);
      
      // Release one slot
      rateLimiter.releaseRequest(userId);
      
      // Should be able to make another request
      const result2 = rateLimiter.canMakeRequest(userId);
      expect(result2.allowed).toBe(true);
    });

    it('should release concurrent request slots', () => {
      const userId = 'user123';
      
      // Make 2 concurrent requests
      for (let i = 0; i < 2; i++) {
        rateLimiter.recordRequest(userId);
      }
      
      // Release one slot
      rateLimiter.releaseRequest(userId);
      
      // Should be able to make another request
      const result = rateLimiter.canMakeRequest(userId);
      expect(result.allowed).toBe(true);
    });
  });

  describe('OpenAI Rate Limiting', () => {
    it('should allow OpenAI requests within limits', () => {
      const userId = 'user123';
      
      // Make 10 OpenAI requests (within limit)
      for (let i = 0; i < 10; i++) {
        const result = rateLimiter.canMakeOpenAIRequest(userId);
        expect(result.allowed).toBe(true);
        rateLimiter.recordOpenAIRequest(userId);
      }
    });

    it('should block OpenAI requests when limit exceeded', () => {
      const userId = 'user123';
      
      // Make 10 OpenAI requests (at the limit)
      for (let i = 0; i < 10; i++) {
        rateLimiter.recordOpenAIRequest(userId);
      }
      
      // 11th request should be blocked
      const result = rateLimiter.canMakeOpenAIRequest(userId);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('OpenAI API rate limit exceeded');
      expect(result.retryAfter).toBeGreaterThan(0);
    });
  });

  describe('Voice Message Size Validation', () => {
    it('should allow voice messages within size limit', () => {
      const smallFile = 5 * 1024 * 1024; // 5MB
      const result = rateLimiter.canProcessVoiceMessage(smallFile);
      expect(result.allowed).toBe(true);
    });

    it('should block voice messages exceeding size limit', () => {
      const largeFile = 15 * 1024 * 1024; // 15MB
      const result = rateLimiter.canProcessVoiceMessage(largeFile);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Voice message too large');
      expect(result.reason).toContain('15MB');
      expect(result.reason).toContain('10MB');
    });
  });

  describe('User Statistics', () => {
    it('should track user statistics correctly', () => {
      const userId = 'user123';
      
      // Make some requests
      for (let i = 0; i < 3; i++) {
        rateLimiter.recordRequest(userId);
      }
      
      // Make some OpenAI requests
      for (let i = 0; i < 2; i++) {
        rateLimiter.recordOpenAIRequest(userId);
      }
      
      const stats = rateLimiter.getUserStats(userId);
      expect(stats.requestsLastMinute).toBe(3);
      expect(stats.requestsLastHour).toBe(3);
      expect(stats.concurrentRequests).toBe(3);
      expect(stats.openAIRequestsLastMinute).toBe(2);
    });

    it('should return zero stats for unknown users', () => {
      const stats = rateLimiter.getUserStats('unknown');
      expect(stats.requestsLastMinute).toBe(0);
      expect(stats.requestsLastHour).toBe(0);
      expect(stats.concurrentRequests).toBe(0);
      expect(stats.openAIRequestsLastMinute).toBe(0);
    });
  });

  describe('Configuration', () => {
    it('should update configuration correctly', () => {
      const newConfig = {
        maxRequestsPerMinute: 10,
        maxVoiceMessageSize: 20 * 1024 * 1024
      };
      
      rateLimiter.updateConfig(newConfig);
      const config = rateLimiter.getConfig();
      
      expect(config.maxRequestsPerMinute).toBe(10);
      expect(config.maxVoiceMessageSize).toBe(20 * 1024 * 1024);
      expect(config.maxRequestsPerHour).toBe(20); // Should remain unchanged
    });

    it('should use default configuration', () => {
      const config = rateLimiter.getConfig();
      expect(config.maxRequestsPerMinute).toBe(5); // From beforeEach
      expect(config.maxRequestsPerHour).toBe(20);
      expect(config.maxConcurrentRequests).toBe(2);
      expect(config.openAIMaxRequestsPerMinute).toBe(10);
    });
  });

  describe('Time-based Limits', () => {
    it('should reset limits after time passes', () => {
      const userId = 'user123';
      
      // Make requests up to the limit
      for (let i = 0; i < 5; i++) {
        rateLimiter.recordRequest(userId);
      }
      
      // Should be blocked
      expect(rateLimiter.canMakeRequest(userId).allowed).toBe(false);
      
      // Simulate time passing by manually cleaning old requests
      const userLimit = (rateLimiter as any).userLimits.get(userId);
      if (userLimit) {
        userLimit.requests = []; // Clear all requests
        userLimit.concurrentRequests = 0; // Reset concurrent requests
      }
      
      // Should be allowed again
      expect(rateLimiter.canMakeRequest(userId).allowed).toBe(true);
    });
  });

  describe('Multiple Users', () => {
    it('should track limits separately for different users', () => {
      const user1 = 'user1';
      const user2 = 'user2';
      
      // User 1 makes 5 requests (at limit)
      for (let i = 0; i < 5; i++) {
        rateLimiter.recordRequest(user1);
      }
      
      // User 2 should still be able to make requests
      expect(rateLimiter.canMakeRequest(user2).allowed).toBe(true);
      
      // User 1 should be blocked
      expect(rateLimiter.canMakeRequest(user1).allowed).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid user IDs gracefully', () => {
      const result = rateLimiter.canMakeRequest('');
      expect(result.allowed).toBe(true); // Should still work
      
      const stats = rateLimiter.getUserStats('');
      expect(stats.requestsLastMinute).toBe(0);
    });

    it('should handle negative file sizes', () => {
      const result = rateLimiter.canProcessVoiceMessage(-1000);
      expect(result.allowed).toBe(true); // Should allow negative sizes
    });
  });
});
