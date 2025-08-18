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
      const userId = message.from?.id;
      
      logger.info(`Received message from ${message.from?.username}: ${text}`);
      
      try {
        // AI-powered response using GPT-4
        let aiResponse = '';
        
        if (text.toLowerCase().includes('hello') || text.toLowerCase().includes('hi') || text.toLowerCase().includes('start')) {
          aiResponse = await gpt4Service.generateVoiceResponse(
            'User is greeting the bot',
            text
          );
        } else if (text.toLowerCase().includes('help') || text.toLowerCase().includes('what can you do')) {
          aiResponse = `🤖 Here's what I can do:\n\n📝 **Contact Management**\n• Extract contact info from voice messages\n• Save and organize your contacts\n• Find contact details when you need them\n\n💡 **Relationship Intelligence**\n• Track relationship strength\n• Suggest follow-up actions\n• Recommend introductions\n\n🎯 **Voice-First Interface**\n• Just speak naturally about people you meet\n• I'll understand and organize everything\n\nTry saying: "I just met Sarah, she's the CTO at TechStart..."`;
        } else if (text.toLowerCase().includes('contact') || text.toLowerCase().includes('person') || text.toLowerCase().includes('met')) {
          // Try to extract contact information from the text
          const contactInfo = await contactService.addFromTranscript(userId?.toString() || 'unknown', text);
          if (contactInfo) {
            aiResponse = `✅ Contact saved!\n\n📝 **${contactInfo.name}**\n🏢 ${contactInfo.company || 'Unknown company'}\n💼 ${contactInfo.title || 'Unknown title'}\n\nI've saved this contact to your relationship database. I can help you:\n• Track interactions\n• Suggest follow-ups\n• Find similar contacts\n\nTry asking: "Who did I meet at the conference?"`;
          } else {
            aiResponse = `I tried to extract contact information from your message, but I need more details.\n\nPlease include:\n• Their name\n• Company/role\n• How you met\n• Any important details\n\nOr send me a voice message for better processing!`;
          }
        } else if (text.toLowerCase().includes('search') || text.toLowerCase().includes('find') || text.toLowerCase().includes('who')) {
          // Search for contacts
          const searchResults = await contactService.searchFromTranscript(userId?.toString() || 'unknown', text);
          if (searchResults && searchResults.length > 0) {
            aiResponse = `🔍 Here are the contacts I found:\n\n${searchResults.map(contact => 
              `📝 **${contact.name}**\n🏢 ${contact.company || 'Unknown'}\n💼 ${contact.title || 'Unknown'}\n`
            ).join('\n')}`;
          } else {
            aiResponse = `I couldn't find any contacts matching your search. Try being more specific or add more contacts first!`;
          }
        } else if (text.toLowerCase().includes('goal') || text.toLowerCase().includes('objective')) {
          // Create goal from text
          const goal = await relationshipService.createGoalFromTranscript(userId?.toString() || 'unknown', text);
          if (goal) {
            aiResponse = `🎯 Goal created!\n\n📋 **${goal.description}**\n📅 Target: ${goal.target_date}\n📊 Progress: ${goal.progress}%\n\nI'll help you track progress and suggest contacts who can help achieve this goal.`;
          } else {
            aiResponse = `I couldn't extract a clear goal from your message. Try saying something like: "My goal is to expand into the European market by Q4"`;
          }
        } else {
          // Generate AI response for general conversation
          aiResponse = await gpt4Service.generateVoiceResponse(
            'User is having a general conversation about relationships or networking. Respond naturally and conversationally, as if you are a helpful AI assistant focused on relationship management. Keep responses friendly, concise, and actionable.',
            text
          );
        }
      
        // Handle voice messages
        if (message.voice) {
          try {
            // Get voice file
            const voiceFile = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${message.voice.file_id}`);
            const voiceData = await voiceFile.json();
            
            if (voiceData.ok) {
              const fileUrl = `https://api.telegram.org/bot${botToken}/${voiceData.result.file_path}`;
              
              // Send processing message
              await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: chatId,
                  text: `🎙️ Processing your voice message...`
                })
              });
              
              // For now, acknowledge voice message
              aiResponse = `🎙️ I received your voice message! I'm working on processing it.\n\nFor now, please send a text message describing the person you met, and I'll extract the contact information for you.`;
            } else {
              aiResponse = `Sorry, I couldn't process your voice message. Please send a text message instead.`;
            }
          } catch (error) {
            logger.error('Error processing voice message:', error);
            aiResponse = `Sorry, I encountered an error processing your voice message. Please send a text message instead.`;
          }
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
      } catch (error) {
        logger.error('Error processing message:', error);
        
        // Send error message to user
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chat_id: chatId,
            text: `Sorry, I encountered an error processing your message. Please try again or say "Help" for assistance.`
          })
        });
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
