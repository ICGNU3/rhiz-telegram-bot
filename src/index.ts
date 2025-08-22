import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import config from './utils/config';
import logger from './utils/logger';
import { RhizTelegramBot } from './bot/telegramBot';
import gpt4Service from './ai/gpt4';
import contactService from './services/contacts';
import relationshipService from './services/relationships';
import introductionService from './services/introductions';
import commandHandler from './bot/commandHandler';
import contactImporter from './bot/contactImporter';
import userService from './services/userService';
import authService from './middleware/authorization';
import adminCommands from './bot/adminCommands';
import { 
  webhookRateLimit, 
  apiRateLimit, 
  voiceMessageSizeLimit, 
  cleanupRateLimit,
  getRateLimitStats 
} from './middleware/rateLimit';
import {
  securityHeaders,
  enhancedHealthCheck,
  inputValidation,
  requestLogging,
  errorHandler,
  performanceMonitoring,
  telegramRateLimit
} from './middleware/production';

// User contexts for session management
const userContexts = new Map();

const app = express();

// Production middleware stack
app.use(securityHeaders);
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : true,
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogging);
app.use(performanceMonitoring);
app.use(inputValidation);

// Enhanced health check endpoint
app.get('/health', enhancedHealthCheck);

// Rate limit statistics endpoint
app.get('/api/rate-limits', getRateLimitStats);

// Google OAuth callback endpoint
app.get('/auth/google/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    
    if (!code || !state) {
      return res.status(400).json({ error: 'Missing authorization code or state' });
    }

    const userId = state as string;
    
    // Import Google Sheets service
    const googleSheetsService = (await import('./services/googleSheets')).default;
    
    // Handle OAuth callback
    const userConfig = await googleSheetsService.handleOAuthCallback(code as string, userId);
    
    // Create a new spreadsheet for the user
    const spreadsheetId = await googleSheetsService.createContactsSheet(userConfig, `Rhiz Contacts - ${userId}`);
    
    // Update user's Google Sheets configuration
    const db = (await import('./db/supabase')).default;
    
    await db.users.update(userId, {
      google_access_token: userConfig.access_token,
      google_refresh_token: userConfig.refresh_token,
      google_sheets_id: spreadsheetId,
      google_sheets_url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    });

    // Return success page
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Google Sheets Connected!</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            .success { color: #28a745; font-size: 24px; margin-bottom: 20px; }
            .info { color: #666; margin-bottom: 30px; }
            .link { color: #007bff; text-decoration: none; }
          </style>
        </head>
        <body>
          <div class="success">✅ Google Sheets Connected Successfully!</div>
          <div class="info">
            Your Rhiz bot is now connected to Google Sheets.<br>
            Your contacts will be automatically synced with enriched data.
          </div>
          <div>
            <a href="https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit" class="link" target="_blank">
              View Your Spreadsheet
            </a>
          </div>
          <div style="margin-top: 30px; color: #999;">
            You can close this window and return to Telegram.
          </div>
        </body>
      </html>
    `);
    
  } catch (error) {
    logger.error('Error in Google OAuth callback:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Connection Error</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            .error { color: #dc3545; font-size: 24px; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <div class="error">❌ Connection Failed</div>
          <div>There was an error connecting to Google Sheets. Please try again.</div>
        </body>
      </html>
    `);
  }
});

// Webhook endpoint for Telegram
app.post('/webhook/:botToken', telegramRateLimit, voiceMessageSizeLimit, cleanupRateLimit, async (req, res) => {
  try {
    const { botToken } = req.params;
    const update = req.body;
    
    logger.info('Received webhook update', {
      updateId: update.update_id,
      messageType: update.message ? 'message' : update.callback_query ? 'callback_query' : 'unknown',
      userId: update.message?.from?.id || update.callback_query?.from?.id,
      timestamp: new Date().toISOString()
    });

    // Validate bot token
    if (botToken !== config.telegram.botToken) {
      logger.warn('Invalid bot token in webhook', {
        providedToken: botToken.substring(0, 10) + '...',
        expectedToken: config.telegram.botToken.substring(0, 10) + '...',
        timestamp: new Date().toISOString()
      });
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Process the update using existing handlers
    if (update.message) {
      const message = update.message;
      const chatId = message.chat.id;
      const text = message.text || '';
      const userId = message.from?.id;
      
      logger.info(`Processing message from ${message.from?.username}: ${text}`);
      
      try {
        // Import and use the command handler
        const commandHandler = (await import('./bot/commandHandler')).default;
        
        // Check if it's a command
        if (commandHandler.isCommand(text)) {
          const response = await commandHandler.handleCommand(text, {
            chatId,
            userId,
            username: message.from?.username
          });
          
          if (response) {
            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: chatId,
                text: response,
                parse_mode: 'Markdown'
              })
            });
          }
        } else if (text.trim()) {
          // Handle regular text messages
          const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: `I received your message: "${text}"\n\nTry sending a voice message for the best experience, or use /help to see available commands!`
            })
          });
          
          if (!response.ok) {
            logger.error('Failed to send Telegram response:', await response.text());
          }
        }
      } catch (error) {
        logger.error('Error processing message:', error);
        
        // Send error message to user
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: 'Sorry, I encountered an error processing your message. Please try again!'
          })
        });
      }
    }
    
    res.status(200).json({ status: 'ok' });
  } catch (error) {
    logger.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Manual sync endpoint
app.post('/api/sync/:userId', apiRateLimit, cleanupRateLimit, async (req, res) => {
  try {
    const { userId } = req.params;
    logger.info(`Manual sync requested for user: ${userId}`);
    res.json({
      synced: true,
      contacts: 0,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error in manual sync:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start server
const PORT = config.port || 3000;
app.listen(PORT, () => {
  logger.info(`🚀 Rhiz Bot server running on port ${PORT}`);
  logger.info(`📊 Health check: http://localhost:${PORT}/health`);
  logger.info(`🔗 Webhook: http://localhost:${PORT}/webhook/YOUR_BOT_TOKEN`);
  logger.info(`🌍 Environment: ${config.env}`);
  logger.info(`🔑 Bot Token configured: ${config.telegram.botToken ? 'Yes' : 'No'}`);
  logger.info(`🤖 OpenAI configured: ${config.openai.apiKey ? 'Yes' : 'No'}`);
}).on('error', (error) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

export default app;
