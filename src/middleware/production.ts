import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import rateLimiter from '../utils/rateLimiter';
import logger from '../utils/logger';
import config from '../utils/config';

interface ProductionRequest extends Request {
  userId?: string;
  startTime?: number;
}

/**
 * Enhanced security headers middleware
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  // Enhanced helmet configuration
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https://api.telegram.org", "https://api.openai.com", "https://api.elevenlabs.io"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  })(req, res, next);
}

/**
 * Enhanced health check with dependency verification
 */
export async function enhancedHealthCheck(req: Request, res: Response): Promise<void> {
  try {
    const startTime = Date.now();
    const healthChecks = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      uptime: process.uptime(),
      environment: config.env,
      checks: {
        database: 'unknown',
        telegram: 'unknown',
        openai: 'unknown',
        elevenlabs: 'unknown',
        memory: 'unknown',
      },
      responseTime: 0,
    };

    // Check database connection
    try {
      const db = (await import('../db/supabase')).default;
      await db.users.findByTelegramId(1); // Simple query to test connection
      healthChecks.checks.database = 'ok';
    } catch (error) {
      healthChecks.checks.database = 'error';
      healthChecks.status = 'degraded';
      logger.error('Database health check failed:', error);
    }

    // Check Telegram API
    try {
      const response = await fetch(`https://api.telegram.org/bot${config.telegram.botToken}/getMe`);
      if (response.ok) {
        healthChecks.checks.telegram = 'ok';
      } else {
        healthChecks.checks.telegram = 'error';
        healthChecks.status = 'degraded';
      }
    } catch (error) {
      healthChecks.checks.telegram = 'error';
      healthChecks.status = 'degraded';
      logger.error('Telegram API health check failed:', error);
    }

    // Check OpenAI API
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: { 'Authorization': `Bearer ${config.openai.apiKey}` }
      });
      if (response.ok) {
        healthChecks.checks.openai = 'ok';
      } else {
        healthChecks.checks.openai = 'error';
        healthChecks.status = 'degraded';
      }
    } catch (error) {
      healthChecks.checks.openai = 'error';
      healthChecks.status = 'degraded';
      logger.error('OpenAI API health check failed:', error);
    }

    // Check ElevenLabs API
    try {
      const response = await fetch('https://api.elevenlabs.io/v1/voices', {
        headers: { 'xi-api-key': config.elevenlabs.apiKey }
      });
      if (response.ok) {
        healthChecks.checks.elevenlabs = 'ok';
      } else {
        healthChecks.checks.elevenlabs = 'error';
        healthChecks.status = 'degraded';
      }
    } catch (error) {
      healthChecks.checks.elevenlabs = 'error';
      healthChecks.status = 'degraded';
      logger.error('ElevenLabs API health check failed:', error);
    }

    // Check memory usage
    const memUsage = process.memoryUsage();
    const memUsageMB = {
      rss: Math.round(memUsage.rss / 1024 / 1024),
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
    };

    if (memUsageMB.heapUsed > 500) { // 500MB threshold
      healthChecks.checks.memory = 'warning';
      if (healthChecks.status === 'ok') healthChecks.status = 'degraded';
    } else {
      healthChecks.checks.memory = 'ok';
    }

    healthChecks.responseTime = Date.now() - startTime;

    // Set appropriate status code
    const statusCode = healthChecks.status === 'ok' ? 200 : 
                      healthChecks.status === 'degraded' ? 200 : 503;

    res.status(statusCode).json(healthChecks);
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      message: 'Service is temporarily unavailable'
    });
  }
}

/**
 * Input validation middleware
 */
export function inputValidation(req: ProductionRequest, res: Response, next: NextFunction): void {
  try {
    // Validate webhook payload
    if (req.path.startsWith('/webhook/')) {
      const update = req.body;
      
      if (!update || typeof update !== 'object') {
        res.status(400).json({
          error: 'Invalid webhook payload',
          message: 'Request body must be a valid JSON object'
        });
        return;
      }

      // Validate required fields for message updates
      if (update.message) {
        const message = update.message;
        
        if (!message.from || !message.from.id) {
          res.status(400).json({
            error: 'Invalid message format',
            message: 'Message must include sender information'
          });
          return;
        }

        // Validate voice message size
        if (message.voice && message.voice.file_size) {
          const maxSize = 50 * 1024 * 1024; // 50MB
          if (message.voice.file_size > maxSize) {
            res.status(413).json({
              error: 'Voice message too large',
              message: 'Voice message must be smaller than 50MB'
            });
            return;
          }
        }
      }
    }

    // Validate API endpoints
    if (req.path.startsWith('/api/')) {
      const userId = req.headers['x-user-id'] as string || req.query.userId as string;
      
      if (!userId) {
        res.status(400).json({
          error: 'Missing user ID',
          message: 'User ID is required for API requests'
        });
        return;
      }

      // Validate user ID format (should be a number for Telegram IDs)
      if (isNaN(Number(userId))) {
        res.status(400).json({
          error: 'Invalid user ID format',
          message: 'User ID must be a valid number'
        });
        return;
      }
    }

    next();
  } catch (error) {
    logger.error('Input validation error:', error);
    res.status(400).json({
      error: 'Validation failed',
      message: 'Request validation failed'
    });
  }
}

/**
 * Request logging middleware
 */
export function requestLogging(req: ProductionRequest, res: Response, next: NextFunction): void {
  req.startTime = Date.now();
  
  // Log request
  logger.info('Incoming request', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });

  // Log response
  res.on('finish', () => {
    const duration = Date.now() - (req.startTime || 0);
    
    logger.info('Request completed', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    });
  });

  next();
}

/**
 * Error handling middleware
 */
export function errorHandler(error: Error, req: Request, res: Response, next: NextFunction): void {
  logger.error('Unhandled error:', {
    error: error.message,
    stack: error.stack,
    method: req.method,
    path: req.path,
    timestamp: new Date().toISOString()
  });

  // Don't expose internal errors in production
  const isProduction = config.env === 'production';
  
  res.status(500).json({
    error: 'Internal server error',
    message: isProduction ? 'Something went wrong' : error.message,
    ...(isProduction ? {} : { stack: error.stack })
  });
}

/**
 * Graceful shutdown middleware
 */
export function gracefulShutdown(signal: string): void {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  // Close database connections
  // Close HTTP server
  // Clean up temporary files
  
  process.exit(0);
}

/**
 * Performance monitoring middleware
 */
export function performanceMonitoring(req: ProductionRequest, res: Response, next: NextFunction): void {
  const startTime = process.hrtime.bigint();
  
  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
    
    // Log slow requests
    if (duration > 5000) { // 5 seconds threshold
      logger.warn('Slow request detected', {
        method: req.method,
        path: req.path,
        duration: `${duration.toFixed(2)}ms`,
        userId: req.userId,
        timestamp: new Date().toISOString()
      });
    }
    
    // Log performance metrics
    logger.debug('Request performance', {
      method: req.method,
      path: req.path,
      duration: `${duration.toFixed(2)}ms`,
      statusCode: res.statusCode,
      timestamp: new Date().toISOString()
    });
  });
  
  next();
}

/**
 * Rate limiting for Telegram webhooks
 */
export function telegramRateLimit(req: ProductionRequest, res: Response, next: NextFunction): void {
  try {
    const userId = req.body?.message?.from?.id?.toString() || 
                   req.body?.callback_query?.from?.id?.toString() ||
                   req.ip || // Fallback to IP
                   'unknown';

    req.userId = userId;

    // Check rate limits
    const rateLimitCheck = rateLimiter.canMakeRequest(userId);
    
    if (!rateLimitCheck.allowed) {
      logger.warn(`Telegram rate limit exceeded for user ${userId}: ${rateLimitCheck.reason}`);
      
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

    next();
  } catch (error) {
    logger.error('Error in Telegram rate limiting:', error);
    next(); // Continue processing even if rate limiting fails
  }
}
