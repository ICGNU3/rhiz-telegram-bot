import TelegramBot from 'node-telegram-bot-api';
import config from '../utils/config';
import logger from '../utils/logger';
import db from '../db/supabase';
import voiceProcessor from '../voice/processor';
import conversationManager from '../voice/conversationManager';
import contactService from '../services/contacts';
import relationshipService from '../services/relationships';
import introductionService from '../services/introductions';

export class RhizTelegramBot {
  private bot: TelegramBot;
  private userSessions: Map<string, string> = new Map(); // userId -> sessionId

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
        });
        
        // Send welcome message
        await this.bot.sendMessage(
          chatId,
          `🎙️ Welcome to Rhiz - Your AI Relationship Manager!\n\n` +
          `I'm here to help you build and maintain meaningful professional relationships.\n\n` +
          `Here's what I can do:\n` +
          `• 📝 Save contacts from voice notes\n` +
          `• 🔍 Find and recall contact details\n` +
          `• 💡 Suggest valuable introductions\n` +
          `• ⏰ Set follow-up reminders\n` +
          `• 📊 Track relationship strength\n\n` +
          `Just send me a voice message to start a conversation! For example:\n` +
          `"I just met Sarah Chen, she's the CTO at TechStart..."\n\n` +
          `Type /help for more commands.`
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
        await this.bot.sendMessage(
          chatId,
          `Welcome back! 🎙️\n\nHow can I help you with your relationships today?`
        );
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
        await conversationManager.endConversation(sessionId);
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
    const voice = msg.voice;
    
    if (!userId || !voice) return;

    try {
      // Send typing indicator
      await this.bot.sendChatAction(chatId, 'typing');
      
      // Get user
      const user = await db.users.findByTelegramId(userId);
      if (!user) {
        await this.bot.sendMessage(chatId, 'Please use /start first to initialize.');
        return;
      }

      // Get or create session
      let sessionId = this.userSessions.get(userId.toString());
      if (!sessionId) {
        sessionId = await conversationManager.startConversation(user.id);
        this.userSessions.set(userId.toString(), sessionId);
      }

      // Save voice message record
      const voiceMessage = await db.voiceMessages.create({
        user_id: user.id,
        telegram_file_id: voice.file_id,
        telegram_message_id: msg.message_id,
        duration: voice.duration,
      });

      // Download voice file
      const fileLink = await this.bot.getFileLink(voice.file_id);
      const response = await fetch(fileLink);
      const audioBuffer = Buffer.from(await response.arrayBuffer());

      // Process voice message with conversation context
      const result = await voiceProcessor.processVoiceMessage(
        audioBuffer,
        user.id,
        { user, recentContacts: await db.contacts.findByUserId(user.id) },
        sessionId
      );

      // Update voice message record
      await db.voiceMessages.markProcessed(
        voiceMessage.id,
        result.transcript,
        result.intent
      );

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

    } catch (error) {
      logger.error('Error processing voice message:', error);
      await this.bot.sendMessage(
        chatId,
        'I had trouble processing your voice message. Could you try again?'
      );
    }
  }

  private async handleTextMessage(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    const text = msg.text;
    const userId = msg.from?.id;
    
    // Skip if it's a command
    if (text?.startsWith('/')) return;
    
    if (!userId) return;

    try {
      // Check if user has an active session
      const sessionId = this.userSessions.get(userId.toString());
      
      if (sessionId) {
        // Process as part of ongoing conversation
        const result = await conversationManager.processVoiceInput(userId.toString(), text, sessionId);
        
        await this.bot.sendMessage(chatId, result.response);
        
        if (result.shouldContinue && result.suggestedActions.length > 0) {
          const actionButtons = result.suggestedActions.map(action => [{ text: action }]);
          
          await this.bot.sendMessage(
            chatId,
            `💡 **Quick Actions:**\n\n${result.suggestedActions.join('\n')}`,
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
      } else {
        // No active session, encourage voice usage
        await this.bot.sendMessage(
          chatId,
          'I work best with voice messages! 🎙️\n' +
          'Just tap the microphone and tell me about:\n' +
          '• Someone you met\n' +
          '• A goal you\'re working on\n' +
          '• Someone you\'re looking for\n\n' +
          'Or use /help to see available commands.'
        );
      }
    } catch (error) {
      logger.error('Error handling text message:', error);
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
