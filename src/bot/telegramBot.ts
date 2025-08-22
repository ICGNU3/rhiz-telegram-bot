import TelegramBot from 'node-telegram-bot-api';
import db from '../db/supabase';
import contactImporter from './contactImporter';
import onboardingService from '../services/onboarding';
import voiceProcessor from '../voice/processor';
import config from '../utils/config';
import logger from '../utils/logger';
import relationshipService from '../services/relationships';
import introductionService from '../services/introductions';
import contactService from '../services/contacts';

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

      // Import Google Sheets service
      const googleSheetsService = (await import('../services/googleSheets')).default;
      
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

      // Import services
      const contactService = (await import('../services/contacts')).default;

      // Send initial message
      await this.bot.sendMessage(
        chatId,
        `🔄 **Syncing contacts to your Google Sheets...**\n\n` +
        `This will:\n` +
        `• Sync all your contacts\n` +
        `• Enrich with additional data\n` +
        `• Update relationship insights\n\n` +
        `Please wait...`,
        { parse_mode: 'Markdown' }
      );

      // Sync contacts
      await contactService.syncContactsToGoogleSheets(user.id);

      await this.bot.sendMessage(
        chatId,
        `✅ **Contacts Synced Successfully!**\n\n` +
        `Your contacts have been updated in your Google Sheets with enriched data!\n\n` +
        `Use /sheets to view your spreadsheet.`,
        { parse_mode: 'Markdown' }
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

      const goals = await db.goals.findActive(user.id);
      
      if (goals.length === 0) {
        await this.bot.sendMessage(
          chatId,
          'You haven\'t set any goals yet. Send me a voice message like:\n' +
          '"My goal is to raise funding for my startup" or\n' +
          '"I want to find a technical co-founder"'
        );
        return;
      }

      let message = `🎯 *Your Active Goals:*\n\n`;
      
      goals.forEach((goal: any, index: number) => {
        message += `${index + 1}. ${goal.description}\n`;
        message += `   Type: ${goal.type}\n`;
        message += `   Progress: ${goal.progress}%\n\n`;
      });

      await this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    } catch (error) {
      logger.error('Error in handleGoals:', error);
      await this.bot.sendMessage(chatId, 'Error retrieving goals. Please try again.');
    }
  }

  private async handleVoiceMessage(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    const userId = msg.from?.id;
    
    if (!userId) return;

    try {
      // Get user
      const user = await db.users.findByTelegramId(userId);
      if (!user) {
        await this.bot.sendMessage(chatId, 'Please use /start first to initialize.');
        return;
      }

      // Get file info
      const fileId = msg.voice?.file_id;
      if (!fileId) {
        await this.bot.sendMessage(chatId, 'I couldn\'t process that voice message. Please try again.');
        return;
      }

      // Download audio file
      const file = await this.bot.getFile(fileId);
      const audioBuffer = await this.downloadFile(file.file_path!);

      // Process voice message
      const sessionId = this.userSessions.get(userId.toString()) || `session_${Date.now()}`;
      this.userSessions.set(userId.toString(), sessionId);

      const result = await voiceProcessor.processVoiceMessage(
        audioBuffer,
        userId.toString(),
        { user },
        sessionId
      );

      // Provide feedback on what was understood
      const feedback = await onboardingService.provideFeedback(user.id, 'voice_processing', {
        transcript: result.transcript,
        intent: result.intent
      });

      // Send feedback message first
      await this.bot.sendMessage(
        chatId,
        feedback.message,
        { parse_mode: 'Markdown' }
      );

      // If user wants to correct, wait for their response
      if (feedback.message.includes("Is this correct?")) {
        // Set a flag to expect correction
        this.expectingCorrection.set(userId.toString(), {
          originalTranscript: result.transcript,
          originalIntent: result.intent,
          timestamp: Date.now()
        });
        return;
      }

      // Send voice response
      await this.bot.sendVoice(chatId, result.audioResponse, {
        caption: result.response,
      });

      // If conversation should continue, show suggested actions
      if (result.shouldContinue && result.suggestedActions.length > 0) {
        const actionButtons = result.suggestedActions.map(action => [{ text: action }]);
        
        await this.bot.sendMessage(
          chatId,
          `💡 **Quick Actions:**\n\n${result.suggestedActions.join('\n')}\n\nOr just continue talking naturally!`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              keyboard: actionButtons,
              one_time_keyboard: true,
              resize_keyboard: true,
            },
          }
        );
      }

      // Update onboarding progress if this was a voice test
      const onboarding = await onboardingService.getUserOnboarding(user.id);
      if (onboarding.nextStep?.action === 'voice_test') {
        await onboardingService.completeOnboardingStep(user.id, onboarding.currentStep);
      }

    } catch (error) {
      logger.error('Error processing voice message:', error);
      await this.bot.sendMessage(
        chatId,
        'I had trouble processing your voice message. Could you try again?'
      );
    }
  }

  /**
   * Download file from Telegram
   */
  private async downloadFile(filePath: string): Promise<Buffer> {
    try {
      const response = await fetch(`https://api.telegram.org/file/bot${config.telegram.botToken}/${filePath}`);
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      logger.error('Error downloading file:', error);
      throw error;
    }
  }

  /**
   * Handle text commands
   */
  private async handleCommand(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    const text = msg.text;
    
    if (!text) return;

    try {
      switch (text.toLowerCase()) {
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
          await this.bot.sendMessage(
            chatId,
            `Unknown command: ${text}\n\nUse /help to see available commands.`
          );
      }
    } catch (error) {
      logger.error('Error handling command:', error);
      await this.bot.sendMessage(chatId, 'Sorry, I encountered an error processing that command.');
    }
  }

  private async handleTextMessage(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    const userId = msg.from?.id;
    const text = msg.text;
    
    if (!userId || !text) return;

    try {
      // Check if user is expecting a correction
      const correctionData = this.expectingCorrection.get(userId.toString());
      if (correctionData && Date.now() - correctionData.timestamp < 30000) { // 30 second window
        // Handle correction
        const correctionMessage = await onboardingService.handleCorrection(
          userId.toString(),
          correctionData.originalTranscript,
          text
        );
        
        await this.bot.sendMessage(chatId, correctionMessage, { parse_mode: 'Markdown' });
        this.expectingCorrection.delete(userId.toString());
        return;
      }

      // Get user
      const user = await db.users.findByTelegramId(userId);
      if (!user) {
        await this.bot.sendMessage(chatId, 'Please use /start first to initialize.');
        return;
      }

      // Check if user is in an active session
      const sessionId = this.userSessions.get(userId.toString());
      if (sessionId) {
        // Process as part of ongoing conversation
        await this.bot.sendMessage(chatId, "I'm processing your message as part of our conversation. Please send a voice message for the best experience.");
        return;
      }

      // Handle text commands
      if (text.startsWith('/')) {
        await this.handleCommand(msg);
        return;
      }

      // Handle regular text messages
      let aiResponse: string;
      
      if (text.toLowerCase().includes('hello') || text.toLowerCase().includes('hi')) {
        aiResponse = `Hello! 👋 I'm your AI relationship manager. Send me a voice message to tell me about someone you met, or type /help to see what I can do!`;
      } else if (text.toLowerCase().includes('help') || text.toLowerCase().includes('what can you do')) {
        aiResponse = `🤖 Here's what I can do:\n\n📝 **Contact Management**\n• Extract contact info from voice messages\n• Save and organize your contacts\n• Find contact details when you need them\n\n💡 **Relationship Intelligence**\n• Track relationship strength\n• Suggest follow-up actions\n• Recommend introductions\n\n🎯 **Voice-First Interface**\n• Just speak naturally about people you meet\n• I'll understand and organize everything\n\nTry saying: "I just met Sarah, she's a CTO at TechStart..."`;
      } else if (text.toLowerCase().includes('contact') || text.toLowerCase().includes('person') || text.toLowerCase().includes('met') || text.includes('met') || text.includes('introduced')) {
        // Smart contact extraction
        aiResponse = `I understand you're talking about a contact! For the best experience, please send me a voice message describing the person you met. I can extract their name, company, title, and other details automatically.\n\nTry saying: "I just met John Smith, he's the CEO at TechCorp and we discussed potential partnership opportunities"`;
      } else if (text.toLowerCase().includes('goal') || text.toLowerCase().includes('objective') || text.toLowerCase().includes('trying to')) {
        aiResponse = `I can help you set and track goals! Send me a voice message describing what you're trying to achieve, and I'll help you track your progress.\n\nTry saying: "My goal is to raise $1M in funding by Q2" or "I'm looking for a technical co-founder"`;
      } else if (text.toLowerCase().includes('introduction') || text.toLowerCase().includes('connect') || text.toLowerCase().includes('introduce')) {
        aiResponse = `I can help you find valuable introductions in your network! Send me a voice message describing who you want to meet, and I'll suggest people who can introduce you.\n\nTry saying: "Who can introduce me to investors?" or "I need to meet someone in enterprise sales"`;
      } else {
        aiResponse = `I understand you said: "${text}"\n\nFor the best experience, please send me a voice message! I can understand natural speech much better and provide more helpful responses.\n\nTry saying: "I just met someone interesting" or "Who do I know at Google?"`;
      }

      await this.bot.sendMessage(chatId, aiResponse, { parse_mode: 'Markdown' });
      
    } catch (error) {
      logger.error('Error in handleTextMessage:', error);
      await this.bot.sendMessage(chatId, 'Sorry, I encountered an error. Please try again.');
    }
  }

  private async handleContactShared(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    const contact = msg.contact;
    const userId = msg.from?.id;
    
    if (!userId || !contact) return;

    try {
      const user = await db.users.findByTelegramId(userId);
      if (!user) {
        await this.bot.sendMessage(chatId, 'Please use /start first to initialize.');
        return;
      }

      // Import the shared contact
      await contactService.importTelegramContact(user.id, contact);
      
      await this.bot.sendMessage(
        chatId,
        `✅ Added ${contact.first_name} ${contact.last_name || ''} to your contacts!\n\n` +
        `Send me a voice note if you'd like to add more details about them.`
      );
    } catch (error) {
      logger.error('Error handling shared contact:', error);
      await this.bot.sendMessage(chatId, 'Error adding contact. Please try again.');
    }
  }

  private async handleIntent(
    chatId: number,
    userId: string,
    intent: string,
    transcript: string,
    response: string
  ): Promise<void> {
    try {
      switch (intent) {
        case 'ADD_CONTACT':
          await contactService.addFromTranscript(userId, transcript);
          break;
          
        case 'FIND_CONTACT':
          const contacts = await contactService.searchFromTranscript(userId, transcript);
          if (contacts.length > 0) {
            let message = 'Found these contacts:\n\n';
            contacts.forEach((c: any) => {
              message += `• ${c.name} - ${c.company || 'No company'}\n`;
            });
            await this.bot.sendMessage(chatId, message);
          }
          break;
          
        case 'SET_GOAL':
          await relationshipService.createGoalFromTranscript(userId, transcript);
          break;
          
        case 'REQUEST_INTRO':
          const intros = await introductionService.suggestFromTranscript(userId, transcript);
          if (intros.length > 0) {
            await this.bot.sendMessage(
              chatId,
              `I found ${intros.length} potential introduction(s). Check /introductions to see them!`
            );
          }
          break;
          
        case 'SET_REMINDER':
          // Handle reminder creation
          break;
          
        default:
          // General response already handled
          break;
      }
    } catch (error) {
      logger.error('Error handling intent:', error);
    }
  }

  async setWebhook(): Promise<void> {
    try {
      await this.bot.setWebHook(`${config.telegram.webhookUrl}/bot${config.telegram.botToken}`);
      logger.info('Webhook set successfully');
    } catch (error) {
      logger.error('Error setting webhook:', error);
      throw error;
    }
  }

  async deleteWebhook(): Promise<void> {
    try {
      await this.bot.deleteWebHook();
      logger.info('Webhook deleted successfully');
    } catch (error) {
      logger.error('Error deleting webhook:', error);
      throw error;
    }
  }

  processUpdate(update: any): void {
    this.bot.processUpdate(update);
  }
}

export default new RhizTelegramBot();
