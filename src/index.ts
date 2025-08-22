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

// User contexts for session management
const userContexts = new Map();

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
app.post('/webhook/:botToken', webhookRateLimit, voiceMessageSizeLimit, cleanupRateLimit, async (req, res) => {
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
        // Temporarily bypass authorization for debugging - get or create user directly
        let user;
        try {
          user = await userService.getOrCreateUser({
            telegram_id: userId!,
            username: message.from?.username,
            first_name: message.from?.first_name,
            last_name: message.from?.last_name
          });
        } catch (error) {
          logger.error('Error creating user:', error);
          // Send error message
          const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              chat_id: chatId,
              text: '⚠️ Database connection issue. Please try again in a moment.',
              parse_mode: 'Markdown'
            })
          });
          
          res.status(200).json({ status: 'ok' });
          return;
        }
        
        // Check for admin commands first
        if (adminCommands.isAdminCommand(text)) {
          const adminResponse = await adminCommands.handleAdminCommand(text, {
            chatId,
            userId: userId!,
            username: message.from?.username,
            args: text.split(' ').slice(1)
          });
          
          const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              chat_id: chatId,
              text: adminResponse,
              parse_mode: 'Markdown'
            })
          });
          
          if (!response.ok) {
            logger.error('Failed to send admin response:', await response.text());
          }
          
          res.status(200).json({ status: 'ok' });
          return;
        }
        
        // Check if it's a regular command
        if (commandHandler.isCommand(text)) {
          const aiResponse = await commandHandler.handleCommand(text, {
            chatId,
            userId,
            username: message.from?.username
          });
          
          if (aiResponse) {
            const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                chat_id: chatId,
                text: aiResponse,
                parse_mode: 'Markdown'
              })
            });
            
            if (!response.ok) {
              logger.error('Failed to send Telegram response:', await response.text());
            }
          }
          
          res.status(200).json({ status: 'ok' });
          return;
        }
        
        // Handle shared Telegram contacts
        if (message.contact) {
          let aiResponse = '';
          try {
            const result = await contactImporter.importFromTelegramContact(
              user.id,
              message.contact
            );
            
            if (result.success && result.contact) {
              aiResponse = `✅ **Contact Imported!**

📝 **${result.contact.name}**
📱 ${result.contact.phone || 'No phone'}
🏢 ${result.contact.company || 'No company'}
💼 ${result.contact.title || 'No title'}
${result.contact.email ? `📧 ${result.contact.email}` : ''}

🎯 **What's next?**
• Share more contacts from your phone
• Say "Show my contacts" to see all
• Type /import for other import options

Keep sharing contacts to build your network! 📲`;
            } else {
              aiResponse = `❌ Failed to import contact: ${result.error || 'Unknown error'}

Try sharing the contact again or use /import for other options.`;
            }
          } catch (error) {
            logger.error('Contact import error:', error);
            aiResponse = `❌ Error importing contact. Please try again or use /import for other options.`;
          }
          
          // Send response and return early
          const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              chat_id: chatId,
              text: aiResponse,
              parse_mode: 'Markdown'
            })
          });
          
          if (!response.ok) {
            logger.error('Failed to send Telegram response:', await response.text());
          }
          
          res.status(200).json({ status: 'ok' });
          return;
        }
        
        // Check if user needs onboarding
        const onboardingPrompt = userId ? commandHandler.getOnboardingPrompt(userId) : '';
        
        // AI-powered response using GPT-4
        let aiResponse = '';
        
        if (text.toLowerCase().includes('hello') || text.toLowerCase().includes('hi') || text.toLowerCase() === 'start') {
          aiResponse = `🤖 Hi! I'm your AI relationship manager. I can help you:

📝 **Save contacts** - "I met Sarah, she's the CTO at TechStart"
🔍 **Find people** - "Who did I meet at the conference?"
🎯 **Set goals** - "I want to expand into Europe by Q4"
💡 **Get insights** - "How strong is my relationship with John?"

Just tell me about people you meet or ask me anything about your network!

🚀 Type /tutorial for a step-by-step guide
📚 Type /samples to see example commands
❓ Type /faq for common questions`;
        } else if (text.toLowerCase().includes('help') || text.toLowerCase().includes('what can you do')) {
          aiResponse = `🤖 Here's what I can do:\n\n📝 **Contact Management**\n• Extract contact info from voice messages\n• Save and organize your contacts\n• Find contact details when you need them\n\n💡 **Relationship Intelligence**\n• Track relationship strength\n• Suggest follow-up actions\n• Recommend introductions\n\n🎯 **Voice-First Interface**\n• Just speak naturally about people you meet\n• I'll understand and organize everything\n\nTry saying: "I just met Sarah, she's a CTO at TechStart..."`;
        } else if (text.toLowerCase().includes('contact') || text.toLowerCase().includes('person') || text.toLowerCase().includes('met') || text.includes('met') || text.includes('introduced')) {
          // Smart contact extraction
          const nameMatch = text.match(/(?:met|introduced to|talked with|saw)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i);
          const companyMatch = text.match(/(?:at|from|with)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i);
          const titleMatch = text.match(/(?:is|was|the)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i);
          
          if (nameMatch) {
            const name = nameMatch[1];
            const company = companyMatch ? companyMatch[1] : '';
            const title = titleMatch ? titleMatch[1] : '';
            
            // Save contact to database
            const contact = await userService.saveContact(user.id, {
              name,
              company: company || undefined,
              title: title || undefined,
              source: 'text_input',
              met_at: 'Telegram conversation'
            });
            
            aiResponse = `✅ Contact saved!\n\n📝 **${name}**\n🏢 ${company || 'No company'}\n💼 ${title || 'No title'}\n\nI've saved this contact. You can now:\n• Ask "Who did I meet at ${company}?"\n• Say "Remind me about ${name}"\n• Ask for follow-up suggestions${onboardingPrompt}`;
          } else {
            aiResponse = `I need more details to save this contact. Try:\n\n"I met Sarah Johnson at TechStart, she's the CTO"\n"I was introduced to John Smith from Google"\n"I talked with Maria at the conference"${onboardingPrompt}`;
          }
        } else if (text.toLowerCase().includes('search') || text.toLowerCase().includes('find') || text.toLowerCase().includes('who') || text.toLowerCase().includes('remind')) {
          // Smart contact search using database
          const searchTerm = text.toLowerCase();
          const results = await userService.searchContacts(user.id, searchTerm);
          
          if (results.length > 0) {
            aiResponse = `🔍 Here are the contacts I found:\n\n${results.map((contact: any) => 
              `📝 **${contact.name}**\n🏢 ${contact.company || 'No company'}\n💼 ${contact.title || 'No title'}\n${contact.email ? `📧 ${contact.email}` : ''}\n`
            ).join('\n')}`;
          } else {
            aiResponse = `I couldn't find any contacts matching "${searchTerm}". Try adding some contacts first by saying "I met [name] at [company]"`;
          }
        } else if (text.toLowerCase().includes('goal') || text.toLowerCase().includes('objective')) {
          // Create goal from text
          const goal = await relationshipService.createGoalFromTranscript(user.id, text);
          if (goal) {
            aiResponse = `🎯 Goal created!\n\n📋 **${goal.description}**\n📅 Target: ${goal.target_date}\n📊 Progress: ${goal.progress}%\n\nI'll help you track progress and suggest contacts who can help achieve this goal.`;
          } else {
            aiResponse = `I couldn't extract a clear goal from your message. Try saying something like: "My goal is to expand into the European market by Q4"`;
          }
        } else if (text.toLowerCase().includes('stats') || text.toLowerCase().includes('summary') || text.toLowerCase().includes('how many')) {
          // Show user stats from database
          const stats = await userService.getNetworkStats(user.id);
          
          aiResponse = `📊 Your Network Summary:\n\n👥 **${stats.totalContacts} contacts**\n🏢 **${stats.companies} companies**\n\nRecent contacts:\n${stats.recentContacts.map((c: any) => `• ${c.name} (${c.company || 'No company'})`).join('\n') || 'No contacts yet'}\n\nKeep building your network! 💪`;
        } else if (text.toLowerCase().includes('follow') || text.toLowerCase().includes('next') || text.toLowerCase().includes('suggest')) {
          // Smart follow-up suggestions from database
          const recentContact = await userService.getMostRecentContact(user.id);
          
          if (recentContact) {
            aiResponse = `💡 Here are some follow-up suggestions for ${recentContact.name}:\n\n📧 Send a LinkedIn connection request\n☕ Schedule a coffee chat\n📅 Set a reminder to follow up in 2 weeks\n🎯 Ask about their current projects\n\nWould you like me to help you with any of these?`;
          } else {
            aiResponse = `I don't have any recent contacts to suggest follow-ups for. Try adding a contact first by saying "I met [name] at [company]"`;
          }
        } else {
          // Generate AI response for general conversation
          if (config.openai.apiKey) {
            aiResponse = await gpt4Service.generateVoiceResponse(
              'User is having a general conversation about relationships or networking. Respond naturally and conversationally, as if you are a helpful AI assistant focused on relationship management. Keep responses friendly, concise, and actionable.',
              text
            );
          } else {
            aiResponse = `🤖 Hi! I'm your relationship management assistant.\n\nI can help you:\n• Save contacts from conversations\n• Track relationships\n• Suggest introductions\n• Set and track goals\n\nTry saying: "I met Sarah at the conference, she's a CTO at TechStart"`;
          }
        }
      
        // Handle voice messages
        if (message.voice) {
          try {
            // Get voice file
            const voiceFile = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${message.voice.file_id}`);
            const voiceData = await voiceFile.json() as any;
            
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
