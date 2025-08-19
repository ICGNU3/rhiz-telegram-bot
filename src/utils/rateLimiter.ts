import logger from './logger';

interface RateLimitConfig {
  maxRequestsPerMinute: number;
  maxRequestsPerHour: number;
  maxVoiceMessageSize: number; // in bytes
  maxConcurrentRequests: number;
  openAIMaxRequestsPerMinute: number;
}

interface UserRateLimit {
  requests: number[];
  lastReset: number;
  concurrentRequests: number;
  openAIRequests: number[];
  lastOpenAIReset: number;
}

class RateLimiter {
  private userLimits: Map<string, UserRateLimit> = new Map();
  private config: RateLimitConfig;

  constructor(config?: Partial<RateLimitConfig>) {
    this.config = {
      maxRequestsPerMinute: 20,
      maxRequestsPerHour: 100,
      maxVoiceMessageSize: 50 * 1024 * 1024, // 50MB
      maxConcurrentRequests: 3,
      openAIMaxRequestsPerMinute: 60,
      ...config
    };
  }

  /**
   * Check if a user can make a request
   */
  canMakeRequest(userId: string): { allowed: boolean; reason?: string; retryAfter?: number } {
    const now = Date.now();
    const userLimit = this.getOrCreateUserLimit(userId);

    // Check per-minute limit first
    const minuteAgo = now - 60000;
    const recentRequests = userLimit.requests.filter(time => time > minuteAgo);
    
    if (recentRequests.length >= this.config.maxRequestsPerMinute) {
      const oldestRequest = Math.min(...recentRequests);
      const retryAfter = Math.ceil((oldestRequest + 60000 - now) / 1000);
      return {
        allowed: false,
        reason: 'Rate limit exceeded (per minute)',
        retryAfter
      };
    }

    // Check per-hour limit
    const hourAgo = now - 3600000;
    const hourlyRequests = userLimit.requests.filter(time => time > hourAgo);
    
    if (hourlyRequests.length >= this.config.maxRequestsPerHour) {
      const oldestRequest = Math.min(...hourlyRequests);
      const retryAfter = Math.ceil((oldestRequest + 3600000 - now) / 1000);
      return {
        allowed: false,
        reason: 'Rate limit exceeded (per hour)',
        retryAfter
      };
    }

    // Check concurrent requests last
    if (userLimit.concurrentRequests >= this.config.maxConcurrentRequests) {
      return {
        allowed: false,
        reason: 'Too many concurrent requests',
        retryAfter: 30 // 30 seconds
      };
    }

    return { allowed: true };
  }

  /**
   * Check if OpenAI API request is allowed
   */
  canMakeOpenAIRequest(userId: string): { allowed: boolean; reason?: string; retryAfter?: number } {
    const now = Date.now();
    const userLimit = this.getOrCreateUserLimit(userId);

    // Check OpenAI per-minute limit
    const minuteAgo = now - 60000;
    const recentOpenAIRequests = userLimit.openAIRequests.filter(time => time > minuteAgo);
    
    if (recentOpenAIRequests.length >= this.config.openAIMaxRequestsPerMinute) {
      const oldestRequest = Math.min(...recentOpenAIRequests);
      const retryAfter = Math.ceil((oldestRequest + 60000 - now) / 1000);
      return {
        allowed: false,
        reason: 'OpenAI API rate limit exceeded',
        retryAfter
      };
    }

    return { allowed: true };
  }

  /**
   * Check if voice message size is acceptable
   */
  canProcessVoiceMessage(fileSize: number): { allowed: boolean; reason?: string } {
    if (fileSize > this.config.maxVoiceMessageSize) {
      return {
        allowed: false,
        reason: `Voice message too large (${Math.round(fileSize / 1024 / 1024)}MB). Maximum size is ${Math.round(this.config.maxVoiceMessageSize / 1024 / 1024)}MB.`
      };
    }

    return { allowed: true };
  }

  /**
   * Record a request for a user
   */
  recordRequest(userId: string): void {
    const userLimit = this.getOrCreateUserLimit(userId);
    const now = Date.now();

    // Add current request
    userLimit.requests.push(now);
    userLimit.concurrentRequests++;

    // Clean up old requests (older than 1 hour)
    const hourAgo = now - 3600000;
    userLimit.requests = userLimit.requests.filter(time => time > hourAgo);

    logger.debug(`Recorded request for user ${userId}. Total requests in last hour: ${userLimit.requests.length}`);
  }

  /**
   * Record an OpenAI API request
   */
  recordOpenAIRequest(userId: string): void {
    const userLimit = this.getOrCreateUserLimit(userId);
    const now = Date.now();

    userLimit.openAIRequests.push(now);

    // Clean up old OpenAI requests (older than 1 minute)
    const minuteAgo = now - 60000;
    userLimit.openAIRequests = userLimit.openAIRequests.filter(time => time > minuteAgo);

    logger.debug(`Recorded OpenAI request for user ${userId}. Total OpenAI requests in last minute: ${userLimit.openAIRequests.length}`);
  }

  /**
   * Release a concurrent request slot
   */
  releaseRequest(userId: string): void {
    const userLimit = this.userLimits.get(userId);
    if (userLimit && userLimit.concurrentRequests > 0) {
      userLimit.concurrentRequests--;
      logger.debug(`Released request slot for user ${userId}. Concurrent requests: ${userLimit.concurrentRequests}`);
    }
  }

  /**
   * Get rate limit statistics for a user
   */
  getUserStats(userId: string): {
    requestsLastMinute: number;
    requestsLastHour: number;
    concurrentRequests: number;
    openAIRequestsLastMinute: number;
  } {
    const userLimit = this.userLimits.get(userId);
    if (!userLimit) {
      return {
        requestsLastMinute: 0,
        requestsLastHour: 0,
        concurrentRequests: 0,
        openAIRequestsLastMinute: 0
      };
    }

    const now = Date.now();
    const minuteAgo = now - 60000;
    const hourAgo = now - 3600000;

    return {
      requestsLastMinute: userLimit.requests.filter(time => time > minuteAgo).length,
      requestsLastHour: userLimit.requests.filter(time => time > hourAgo).length,
      concurrentRequests: userLimit.concurrentRequests,
      openAIRequestsLastMinute: userLimit.openAIRequests.filter(time => time > minuteAgo).length
    };
  }

  /**
   * Clean up old user data
   */
  cleanup(): void {
    const now = Date.now();
    const hourAgo = now - 3600000;

    for (const [userId, userLimit] of this.userLimits.entries()) {
      // Remove users with no recent activity
      const hasRecentActivity = userLimit.requests.some(time => time > hourAgo);
      if (!hasRecentActivity && userLimit.concurrentRequests === 0) {
        this.userLimits.delete(userId);
        logger.debug(`Cleaned up inactive user: ${userId}`);
      }
    }

    logger.info(`Rate limiter cleanup completed. Active users: ${this.userLimits.size}`);
  }

  /**
   * Get or create user rate limit data
   */
  private getOrCreateUserLimit(userId: string): UserRateLimit {
    if (!this.userLimits.has(userId)) {
      this.userLimits.set(userId, {
        requests: [],
        lastReset: Date.now(),
        concurrentRequests: 0,
        openAIRequests: [],
        lastOpenAIReset: Date.now()
      });
    }
    return this.userLimits.get(userId)!;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<RateLimitConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('Rate limiter configuration updated', this.config);
  }

  /**
   * Get current configuration
   */
  getConfig(): RateLimitConfig {
    return { ...this.config };
  }
}

// Create singleton instance
const rateLimiter = new RateLimiter();

// Cleanup every 5 minutes
setInterval(() => {
  rateLimiter.cleanup();
}, 5 * 60 * 1000);

// Add method to reset for testing
(rateLimiter as any).reset = function() {
  this.userLimits.clear();
  this.config = {
    maxRequestsPerMinute: 20,
    maxRequestsPerHour: 100,
    maxVoiceMessageSize: 50 * 1024 * 1024, // 50MB
    maxConcurrentRequests: 3,
    openAIMaxRequestsPerMinute: 60,
  };
};

export default rateLimiter;
