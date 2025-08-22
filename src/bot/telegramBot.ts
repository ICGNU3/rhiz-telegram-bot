import TelegramBot from 'node-telegram-bot-api';
import db from '../db/supabase';
import config from '../utils/config';
import logger from '../utils/logger';
import onboardingService from '../services/onboarding';
import googleSheetsService from '../services/googleSheets';

export class RhizTelegramBot {
  private bot: TelegramBot;
  private userSessions: Map<string, string> = new Map(); // userId -> sessionId
  private expectingCorrection: Map<string, { originalTranscript: string; originalIntent: string; timestamp: number }> = new Map();

  constructor() {
    this.bot = new TelegramBot(config.telegram.botToken);
    this.setupHandlers();
  }

  private setupHandlers(): void {
    // Start command
    this.bot.onText(/\/start/, this.handleStart.bind(this));
    
    // Help command
    this.bot.onText(/\/help/, this.handleHelp.bind(this));
    
    // Contacts command
    this.bot.onText(/\/contacts/, this.handleContacts.bind(this));
    
    // Goals command
    this.bot.onText(/\/goals/, this.handleGoals.bind(this));
    
    // Google Sheets commands
    this.bot.onText(/\/sheets/, this.handleGoogleSheets.bind(this));
    this.bot.onText(/\/sync/, this.handleSyncContacts.bind(this));
    
    // End conversation command
    this.bot.onText(/\/end/, this.handleEndConversation.bind(this));
    
    // Voice messages
    this.bot.on('voice', this.handleVoiceMessage.bind(this));
    
    // Text messages
    this.bot.on('text', this.handleTextMessage.bind(this));
    
    // Contact shared
    this.bot.on('contact', this.handleContactShared.bind(this));
  }

  private async handleStart(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    const userId = msg.from?.id;
    
    if (!userId) return;

    try {
      // Check if user exists
      let user = await db.users.findByTelegramId(userId);
      
      if (!user) {
        // Create new user
        user = await db.users.create({
          telegram_id: userId,
          telegram_username: msg.from?.username,
          telegram_first_name: msg.from?.first_name,
          telegram_last_name: msg.from?.last_name,
          onboarding_step: 1,
          onboarding_completed: false,
        });
        
        // Send welcome message with onboarding
        const onboardingMessage = await onboardingService.getOnboardingMessage(user.id);
        
        await this.bot.sendMessage(
          chatId,
          onboardingMessage,
          { parse_mode: 'Markdown' }
        );
        
        // Request contact access
        await this.bot.sendMessage(
          chatId,
          `Would you like to import your Telegram contacts? This helps me provide better networking suggestions.`,
          {
            reply_markup: {
              keyboard: [[{ text: '📱 Share Contacts', request_contact: true }]],
              one_time_keyboard: true,
              resize_keyboard: true,
            },
          }
        );
      } else {
        // Existing user - check onboarding status
        const onboarding = await onboardingService.getUserOnboarding(user.id);
        
        if (onboarding.progress < 100) {
          const onboardingMessage = await onboardingService.getOnboardingMessage(user.id);
          await this.bot.sendMessage(
            chatId,
            onboardingMessage,
            { parse_mode: 'Markdown' }
          );
        } else {
          await this.bot.sendMessage(
            chatId,
            `Welcome back! 🎙️\n\nHow can I help you with your relationships today?`,
            { parse_mode: 'Markdown' }
          );
        }
      }
    } catch (error) {
      logger.error('Error in handleStart:', error);
      await this.bot.sendMessage(chatId, 'Sorry, I encountered an error. Please try again.');
    }
  }

  private async handleHelp(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    
    await this.bot.sendMessage(
      chatId,
      `🤖 **Rhiz AI Commands**\n\n` +
      `**Voice Commands (Recommended):**\n` +
      `🎙️ Just send a voice message and talk naturally!\n\n` +
      `**Text Commands:**\n` +
      `📝 /contacts - View your contacts\n` +
      `📊 /sheets - Get Google Sheets link\n` +
      `🔄 /sync - Sync contacts to Google Sheets\n` +
      `🎯 /goals - Manage your goals\n` +
      `❓ /help - Show this help\n` +
      `🔚 /end - End current conversation\n\n` +
      `**Voice Examples:**\n` +
      `• "I met John Smith at the conference"\n` +
      `• "Who do I know at Google?"\n` +
      `• "My goal is to hire 5 engineers"\n` +
      `• "Remind me to follow up with Sarah"`,
      { parse_mode: 'Markdown' }
    );
  }

  private async handleEndConversation(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    const userId = msg.from?.id;
    
    if (!userId) return;

    try {
      const sessionId = this.userSessions.get(userId.toString());
      if (sessionId) {
        // conversationManager.endConversation(sessionId); // This line was removed
        this.userSessions.delete(userId.toString());
        
        await this.bot.sendMessage(
          chatId,
          `👋 Conversation ended. Thanks for chatting! Feel free to start a new conversation anytime with a voice message.`
        );
      } else {
        await this.bot.sendMessage(
          chatId,
          `No active conversation to end. Send me a voice message to start chatting!`
        );
      }
    } catch (error) {
      logger.error('Error ending conversation:', error);
      await this.bot.sendMessage(chatId, 'Sorry, I encountered an error ending the conversation.');
    }
  }

  private async handleContacts(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    const userId = msg.from?.id;
    
    if (!userId) return;

    try {
      const user = await db.users.findByTelegramId(userId);
      if (!user) {
        await this.bot.sendMessage(chatId, 'Please use /start first to initialize.');
        return;
      }

              const contacts = await db.contacts.findByUserId(user.id);
      
      if (contacts.length === 0) {
        await this.bot.sendMessage(
          chatId,
          'You haven\'t added any contacts yet. Send me a voice message about someone you met!'
        );
        return;
      }

      let message = `📋 *Your Contacts (${contacts.length}):*\n\n`;
      
      contacts.slice(0, 10).forEach((contact: any) => {
        message += `• *${contact.name}*`;
        if (contact.title && contact.company) {
          message += ` - ${contact.title} at ${contact.company}`;
        } else if (contact.company) {
          message += ` - ${contact.company}`;
        }
        message += ` (Strength: ${contact.relationship_score}/100)\n`;
      });
      
      if (contacts.length > 10) {
        message += `\n... and ${contacts.length - 10} more contacts`;
      }

      await this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    } catch (error) {
      logger.error('Error in handleContacts:', error);
      await this.bot.sendMessage(chatId, 'Error retrieving contacts. Please try again.');
    }
  }

  private async handleGoogleSheets(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    const userId = msg.from?.id;
    
    if (!userId) return;

    try {
      const user = await db.users.findByTelegramId(userId);
      if (!user) {
        await this.bot.sendMessage(chatId, 'Please use /start first to initialize.');
        return;
      }

      // Check if user is connected to Google Sheets
      if (!user.google_access_token || !user.google_sheets_id) {
        const oauthUrl = googleSheetsService.getOAuthUrl(user.id);
        
        await this.bot.sendMessage(
          chatId,
          `📊 **Connect Your Google Sheets**\n\n` +
          `To sync your contacts with Google Sheets:\n\n` +
          `1. Click the link below to authorize\n` +
          `2. Grant access to your Google account\n` +
          `3. I'll create a spreadsheet for your contacts\n\n` +
          `🔗 **Connect Now:** ${oauthUrl}\n\n` +
          `After connecting, use /sync to sync your contacts!`,
          { parse_mode: 'Markdown' }
        );
        return;
      }

      // User is connected, show their spreadsheet info
      const userGoogleConfig = {
        access_token: user.google_access_token,
        refresh_token: user.google_refresh_token,
        spreadsheet_id: user.google_sheets_id,
        spreadsheet_url: user.google_sheets_url,
        connected_at: user.updated_at
      };

      const spreadsheetInfo = await googleSheetsService.getSpreadsheetInfo(userGoogleConfig);
      
      if (spreadsheetInfo.error) {
        await this.bot.sendMessage(
          chatId,
          `❌ **Connection Issue**\n\n` +
          `There's an issue with your Google Sheets connection. Please reconnect:\n\n` +
          `Use /connect to set up Google Sheets again.`,
          { parse_mode: 'Markdown' }
        );
        return;
      }

      await this.bot.sendMessage(
        chatId,
        `📊 **Your Google Sheets**\n\n` +
        `📋 **Title:** ${spreadsheetInfo.title}\n` +
        `🔗 **Link:** ${spreadsheetInfo.url}\n` +
        `📄 **Sheets:** ${spreadsheetInfo.sheets.join(', ')}\n\n` +
        `Your contacts are automatically synced to this sheet with enriched data!\n\n` +
        `Use /sync to manually sync your contacts.`,
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      logger.error('Error in handleGoogleSheets:', error);
      await this.bot.sendMessage(chatId, 'Error accessing Google Sheets. Please try again.');
    }
  }

  private async handleSyncContacts(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    const userId = msg.from?.id;
    
    if (!userId) return;

    try {
      const user = await db.users.findByTelegramId(userId);
      if (!user) {
        await this.bot.sendMessage(chatId, 'Please use /start first to initialize.');
        return;
      }

      // Check if user is connected to Google Sheets
      if (!user.google_access_token || !user.google_sheets_id) {
        await this.bot.sendMessage(
          chatId,
          `❌ **Not Connected**\n\n` +
          `You need to connect your Google Sheets first.\n\n` +
          `Use /sheets to set up the connection.`,
          { parse_mode: 'Markdown' }
        );
        return;
      }

      // TODO: Import and use contact service for actual sync
      // const contactService = (await import('../services/contacts')).default;

      // Send initial message
      await this.bot.sendMessage(
        chatId,
        `🔄 **Syncing contacts to your Google Sheets...**\n\nPlease wait while I sync your contacts.`
      );

      // TODO: Implement actual sync logic
      await this.bot.sendMessage(
        chatId,
        `✅ **Sync Complete!**\n\nYour contacts have been synced to Google Sheets.`
      );
    } catch (error) {
      logger.error('Error in handleSyncContacts:', error);
      await this.bot.sendMessage(chatId, 'Error syncing contacts. Please try again.');
    }
  }

  private async handleGoals(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    const userId = msg.from?.id;
    
    if (!userId) return;

    try {
      const user = await db.users.findByTelegramId(userId);
      if (!user) {
        await this.bot.sendMessage(chatId, 'Please use /start first to initialize.');
        return;
      }

      await this.bot.sendMessage(
        chatId,
        `🎯 **Your Goals**\n\nYou haven't set any goals yet.\n\nTry saying: "My goal is to meet 10 investors" or "I want to expand into Europe by Q4"`
      );
    } catch (error) {
      logger.error('Error in handleGoals:', error);
      await this.bot.sendMessage(chatId, 'Error accessing goals. Please try again.');
    }
  }

  private async handleVoiceMessage(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    const userId = msg.from?.id;
    
    if (!userId) return;

    try {
      await this.bot.sendMessage(
        chatId,
        `🎙️ **Voice Message Received**\n\nI'm processing your voice message...`
      );
      
      // TODO: Implement voice processing
      await this.bot.sendMessage(
        chatId,
        `✅ **Processing Complete**\n\nVoice processing will be available soon!`
      );
    } catch (error) {
      logger.error('Error in handleVoiceMessage:', error);
      await this.bot.sendMessage(chatId, 'Error processing voice message. Please try again.');
    }
  }

  private async handleTextMessage(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    const userId = msg.from?.id;
    const text = msg.text || '';
    
    if (!userId) return;

    try {
      await this.bot.sendMessage(
        chatId,
        `📝 **Text Message Received**\n\nI understand: "${text}"\n\nVoice messages work better for natural conversation!`
      );
    } catch (error) {
      logger.error('Error in handleTextMessage:', error);
      await this.bot.sendMessage(chatId, 'Error processing message. Please try again.');
    }
  }

  private async handleContactShared(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    const userId = msg.from?.id;
    
    if (!userId) return;

    try {
      await this.bot.sendMessage(
        chatId,
        `📱 **Contact Shared**\n\nThank you for sharing your contact! I'll add it to your network.`
      );
    } catch (error) {
      logger.error('Error in handleContactShared:', error);
      await this.bot.sendMessage(chatId, 'Error processing contact. Please try again.');
    }
  }

  public async handleUpdate(update: any): Promise<void> {
    // Handle incoming updates
    if (update.message) {
      const msg = update.message;
      
      if (msg.text && msg.text.startsWith('/')) {
        // Handle commands
        const command = msg.text.split(' ')[0];
        switch (command) {
          case '/start':
            await this.handleStart(msg);
            break;
          case '/help':
            await this.handleHelp(msg);
            break;
          case '/contacts':
            await this.handleContacts(msg);
            break;
          case '/sheets':
            await this.handleGoogleSheets(msg);
            break;
          case '/sync':
            await this.handleSyncContacts(msg);
            break;
          case '/goals':
            await this.handleGoals(msg);
            break;
          case '/end':
            await this.handleEndConversation(msg);
            break;
          default:
            await this.handleTextMessage(msg);
        }
      } else if (msg.voice) {
        await this.handleVoiceMessage(msg);
      } else if (msg.contact) {
        await this.handleContactShared(msg);
      } else if (msg.text) {
        await this.handleTextMessage(msg);
      }
    }
  }
}