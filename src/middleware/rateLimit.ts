import { Request, Response, NextFunction } from 'express';
import rateLimiter from '../utils/rateLimiter';
import logger from '../utils/logger';

interface RateLimitRequest extends Request {
  userId?: string;
}

/**
 * Rate limiting middleware for webhook endpoints
 */
export function webhookRateLimit(req: RateLimitRequest, res: Response, next: NextFunction): void {
  try {
    // Extract user ID from Telegram message
    const userId = req.body?.message?.from?.id?.toString() || 
                   req.body?.callback_query?.from?.id?.toString() ||
                   'unknown';

    req.userId = userId;

    // Check rate limits
    const rateLimitCheck = rateLimiter.canMakeRequest(userId);
    
    if (!rateLimitCheck.allowed) {
      logger.warn(`Rate limit exceeded for user ${userId}: ${rateLimitCheck.reason}`);
      
      res.status(429).json({
        error: 'Rate limit exceeded',
        reason: rateLimitCheck.reason,
        retryAfter: rateLimitCheck.retryAfter,
        message: `Please wait ${rateLimitCheck.retryAfter} seconds before trying again.`
      });
      return;
    }

    // Record the request
    rateLimiter.recordRequest(userId);

    // Add rate limit headers
    const stats = rateLimiter.getUserStats(userId);
    res.set({
      'X-RateLimit-Limit-Minute': '20',
      'X-RateLimit-Remaining-Minute': Math.max(0, 20 - stats.requestsLastMinute),
      'X-RateLimit-Limit-Hour': '100',
      'X-RateLimit-Remaining-Hour': Math.max(0, 100 - stats.requestsLastHour),
      'X-RateLimit-Reset': new Date(Date.now() + 60000).toISOString()
    });

    next();
  } catch (error) {
    logger.error('Error in rate limiting middleware:', error);
    next(); // Continue processing even if rate limiting fails
  }
}

/**
 * Rate limiting middleware for API endpoints
 */
export function apiRateLimit(req: RateLimitRequest, res: Response, next: NextFunction): void {
  try {
    // Extract user ID from headers or query params
    const userId = req.headers['x-user-id'] as string || 
                   req.query.userId as string ||
                   req.ip || // Fallback to IP address
                   'unknown';

    req.userId = userId;

    // Check rate limits
    const rateLimitCheck = rateLimiter.canMakeRequest(userId);
    
    if (!rateLimitCheck.allowed) {
      logger.warn(`API rate limit exceeded for user ${userId}: ${rateLimitCheck.reason}`);
      
      res.status(429).json({
        error: 'Rate limit exceeded',
        reason: rateLimitCheck.reason,
        retryAfter: rateLimitCheck.retryAfter,
        message: `Please wait ${rateLimitCheck.retryAfter} seconds before trying again.`
      });
      return;
    }

    // Record the request
    rateLimiter.recordRequest(userId);

    // Add rate limit headers
    const stats = rateLimiter.getUserStats(userId);
    res.set({
      'X-RateLimit-Limit-Minute': '20',
      'X-RateLimit-Remaining-Minute': Math.max(0, 20 - stats.requestsLastMinute),
      'X-RateLimit-Limit-Hour': '100',
      'X-RateLimit-Remaining-Hour': Math.max(0, 100 - stats.requestsLastHour),
      'X-RateLimit-Reset': new Date(Date.now() + 60000).toISOString()
    });

    next();
  } catch (error) {
    logger.error('Error in API rate limiting middleware:', error);
    next(); // Continue processing even if rate limiting fails
  }
}

/**
 * OpenAI API rate limiting middleware
 */
export function openAIRateLimit(req: RateLimitRequest, res: Response, next: NextFunction): void {
  try {
    const userId = req.userId || 'unknown';

    // Check OpenAI rate limits
    const openAICheck = rateLimiter.canMakeOpenAIRequest(userId);
    
    if (!openAICheck.allowed) {
      logger.warn(`OpenAI rate limit exceeded for user ${userId}: ${openAICheck.reason}`);
      
      res.status(429).json({
        error: 'OpenAI API rate limit exceeded',
        reason: openAICheck.reason,
        retryAfter: openAICheck.retryAfter,
        message: `OpenAI API is temporarily unavailable. Please wait ${openAICheck.retryAfter} seconds.`
      });
      return;
    }

    // Record the OpenAI request
    rateLimiter.recordOpenAIRequest(userId);

    next();
  } catch (error) {
    logger.error('Error in OpenAI rate limiting middleware:', error);
    next(); // Continue processing even if rate limiting fails
  }
}

/**
 * Voice message size validation middleware
 */
export function voiceMessageSizeLimit(req: Request, res: Response, next: NextFunction): void {
  try {
    const voiceMessage = req.body?.message?.voice;
    
    if (voiceMessage && voiceMessage.file_size) {
      const sizeCheck = rateLimiter.canProcessVoiceMessage(voiceMessage.file_size);
      
      if (!sizeCheck.allowed) {
        logger.warn(`Voice message too large: ${voiceMessage.file_size} bytes`);
        
        res.status(413).json({
          error: 'Voice message too large',
          reason: sizeCheck.reason,
          message: 'Please send a shorter voice message.'
        });
        return;
      }
    }

    next();
  } catch (error) {
    logger.error('Error in voice message size validation:', error);
    next(); // Continue processing even if validation fails
  }
}

/**
 * Cleanup middleware to release rate limit slots
 */
export function cleanupRateLimit(req: RateLimitRequest, res: Response, next: NextFunction): void {
  const userId = req.userId;
  
  // Release the request slot when the response is finished
  res.on('finish', () => {
    if (userId) {
      rateLimiter.releaseRequest(userId);
    }
  });

  next();
}

/**
 * Rate limit statistics endpoint
 */
export function getRateLimitStats(req: Request, res: Response): void {
  try {
    const userId = req.query.userId as string;
    
    if (!userId) {
      res.status(400).json({
        error: 'User ID required',
        message: 'Please provide a userId query parameter'
      });
      return;
    }

    const stats = rateLimiter.getUserStats(userId);
    const config = rateLimiter.getConfig();

    res.json({
      userId,
      stats,
      limits: {
        maxRequestsPerMinute: config.maxRequestsPerMinute,
        maxRequestsPerHour: config.maxRequestsPerHour,
        maxConcurrentRequests: config.maxConcurrentRequests,
        maxVoiceMessageSize: `${Math.round(config.maxVoiceMessageSize / 1024 / 1024)}MB`,
        openAIMaxRequestsPerMinute: config.openAIMaxRequestsPerMinute
      }
    });
  } catch (error) {
    logger.error('Error getting rate limit stats:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve rate limit statistics'
    });
  }
}
