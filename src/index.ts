import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import config from './utils/config';
import logger from './utils/logger';
import { RhizTelegramBot } from './bot/telegramBot';

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    uptime: process.uptime()
  });
});

// Webhook endpoint for Telegram
app.post('/webhook/:botToken', async (req, res) => {
  try {
    const { botToken } = req.params;
    const update = req.body;
    
    logger.info(`Received Telegram webhook for bot token: ${botToken}`);
    
    // Handle the Telegram update
    if (update.message) {
      const message = update.message;
      const chatId = message.chat.id;
      const text = message.text || '';
      
      logger.info(`Received message from ${message.from?.username}: ${text}`);
      
      // AI-powered response
      let aiResponse = '';
      
      if (text.toLowerCase().includes('hello') || text.toLowerCase().includes('hi') || text.toLowerCase().includes('start')) {
        aiResponse = `🎙️ Hello! I'm your AI relationship manager.\n\nI can help you:\n• Save contacts from voice notes\n• Find contact details\n• Suggest introductions\n• Track relationships\n\nTry sending me a voice message about someone you met!`;
      } else if (text.toLowerCase().includes('contact') || text.toLowerCase().includes('person') || text.toLowerCase().includes('met')) {
        aiResponse = `Great! I can help you save contact information.\n\nPlease send me a voice message describing the person you met, including:\n• Their name\n• Company/role\n• How you met\n• Any important details\n\nI'll extract and save this information for you!`;
      } else if (text.toLowerCase().includes('help') || text.toLowerCase().includes('what can you do')) {
        aiResponse = `🤖 Here's what I can do:\n\n📝 **Contact Management**\n• Extract contact info from voice messages\n• Save and organize your contacts\n• Find contact details when you need them\n\n💡 **Relationship Intelligence**\n• Track relationship strength\n• Suggest follow-up actions\n• Recommend introductions\n\n🎯 **Voice-First Interface**\n• Just speak naturally about people you meet\n• I'll understand and organize everything\n\nTry saying: "I just met Sarah, she's the CTO at TechStart..."`;
      } else {
        aiResponse = `I understand you said: "${text}"\n\nI'm designed to help with relationship management. Try:\n• Sending a voice message about someone you met\n• Asking "What can you do?"\n• Saying "Help" for more options`;
      }
      
      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: aiResponse
        })
      });
      
      if (!response.ok) {
        logger.error('Failed to send Telegram response:', await response.text());
      }
    }
    
    res.status(200).json({ status: 'ok' });
  } catch (error) {
    logger.error('Error handling webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Manual sync endpoint
app.post('/api/sync/:userId', async (req, res) => {
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
