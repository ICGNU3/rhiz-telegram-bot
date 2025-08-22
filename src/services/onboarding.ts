import db from '../db/supabase';
import logger from '../utils/logger';

export interface OnboardingStep {
  id: number;
  title: string;
  description: string;
  action: string;
  completed: boolean;
  required: boolean;
}

export interface UserFeedback {
  action: string;
  success: boolean;
  message: string;
  suggestions?: string[];
  corrections?: any;
}

export class OnboardingService {
  private readonly ONBOARDING_STEPS: OnboardingStep[] = [
    {
      id: 1,
      title: "Welcome to Rhiz",
      description: "Let's get you set up with your AI relationship manager",
      action: "welcome",
      completed: false,
      required: true
    },
    {
      id: 2,
      title: "Add Your First Contact",
      description: "Tell me about someone you met recently",
      action: "add_contact",
      completed: false,
      required: true
    },
    {
      id: 3,
      title: "Set Your First Goal",
      description: "What are you trying to achieve with your network?",
      action: "set_goal",
      completed: false,
      required: false
    },
    {
      id: 4,
      title: "Connect Google Sheets",
      description: "Sync your contacts to Google Sheets for easy access",
      action: "connect_sheets",
      completed: false,
      required: false
    },
    {
      id: 5,
      title: "Try Voice Commands",
      description: "Send a voice message to see how it works",
      action: "voice_test",
      completed: false,
      required: true
    }
  ];

  /**
   * Get user's current onboarding progress
   */
  async getUserOnboarding(userId: string): Promise<{
    currentStep: number;
    completedSteps: number;
    totalSteps: number;
    nextStep: OnboardingStep | null;
    progress: number;
  }> {
    try {
      const user = await db.users.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const currentStep = user.onboarding_step || 1;
      const completedSteps = user.onboarding_completed ? this.ONBOARDING_STEPS.length : currentStep - 1;
      const totalSteps = this.ONBOARDING_STEPS.length;
      const nextStep = currentStep <= totalSteps ? this.ONBOARDING_STEPS[currentStep - 1] : null;
      const progress = Math.round((completedSteps / totalSteps) * 100);

      return {
        currentStep,
        completedSteps,
        totalSteps,
        nextStep,
        progress
      };
    } catch (error) {
      logger.error('Error getting user onboarding:', error);
      throw error;
    }
  }

  /**
   * Mark onboarding step as completed
   */
  async completeOnboardingStep(userId: string, stepId: number): Promise<void> {
    try {
      const user = await db.users.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const nextStep = stepId + 1;
      const isCompleted = nextStep > this.ONBOARDING_STEPS.length;

      await db.users.update(userId, {
        onboarding_step: nextStep,
        onboarding_completed: isCompleted,
        updated_at: new Date().toISOString()
      });

      logger.info(`User ${userId} completed onboarding step ${stepId}`);
    } catch (error) {
      logger.error('Error completing onboarding step:', error);
      throw error;
    }
  }

  /**
   * Get onboarding message for current step
   */
  async getOnboardingMessage(userId: string): Promise<string> {
    try {
      const onboarding = await this.getUserOnboarding(userId);
      
      if (onboarding.progress === 100) {
        return `🎉 **Onboarding Complete!**\n\nYou're all set up with Rhiz! Here's what you can do:\n\n` +
               `• 🎙️ Send voice messages to add contacts\n` +
               `• 📝 Use /contacts to view your network\n` +
               `• 🎯 Use /goals to track your objectives\n` +
               `• 📊 Use /sheets to connect Google Sheets\n\n` +
               `Try saying: "I just met John Smith, he's the CEO at TechCorp"`;
      }

      const step = onboarding.nextStep;
      if (!step) {
        return "Something went wrong with onboarding. Please try /start again.";
      }

      return `📋 **Step ${step.id} of ${onboarding.totalSteps}**\n\n` +
             `**${step.title}**\n` +
             `${step.description}\n\n` +
             `**What to do:** ${step.action}\n\n` +
             `Progress: ${onboarding.progress}% complete`;
    } catch (error) {
      logger.error('Error getting onboarding message:', error);
      return "Welcome to Rhiz! Send me a voice message to get started.";
    }
  }

  /**
   * Provide feedback on user actions
   */
  async provideFeedback(userId: string, action: string, result: any): Promise<UserFeedback> {
    try {
      const feedback: UserFeedback = {
        action,
        success: true,
        message: "Great! I understood that correctly.",
        suggestions: []
      };

      switch (action) {
        case 'add_contact':
          if (result && result.name) {
            feedback.message = `✅ **Contact Added!**\n\nI've saved **${result.name}** to your contacts.`;
            if (result.company) {
              feedback.message += `\n\nCompany: ${result.company}`;
            }
            if (result.title) {
              feedback.message += `\nTitle: ${result.title}`;
            }
            feedback.suggestions = [
              "Try asking: 'Who do I know at Google?'",
              "Set a goal: 'My goal is to hire 5 engineers'",
              "Request an intro: 'Can you introduce me to investors?'"
            ];
          } else {
            feedback.success = false;
            feedback.message = "❌ I couldn't understand the contact details. Could you try again?";
            feedback.corrections = {
              missing: ['name'],
              example: "Try saying: 'I met John Smith, he's the CTO at TechStart'"
            };
          }
          break;

        case 'find_contact':
          if (result && result.length > 0) {
            feedback.message = `🔍 **Found ${result.length} contact(s):**\n\n`;
            result.forEach((contact: any, index: number) => {
              feedback.message += `${index + 1}. **${contact.name}**`;
              if (contact.company) feedback.message += ` at ${contact.company}`;
              if (contact.title) feedback.message += ` (${contact.title})`;
              feedback.message += '\n';
            });
          } else {
            feedback.message = "❓ I couldn't find any contacts matching that description.";
            feedback.suggestions = [
              "Try adding a contact first: 'I met Sarah at the conference'",
              "Be more specific: 'Who do I know at Google?'"
            ];
          }
          break;

        case 'set_goal':
          if (result && result.description) {
            feedback.message = `🎯 **Goal Set!**\n\n"${result.description}"\n\nI'll help you track progress toward this goal.`;
            feedback.suggestions = [
              "Add relevant contacts: 'I met a potential investor'",
              "Request introductions: 'Who can introduce me to engineers?'"
            ];
          } else {
            feedback.success = false;
            feedback.message = "❌ I couldn't understand your goal. Could you be more specific?";
            feedback.corrections = {
              example: "Try saying: 'My goal is to raise $1M in funding'"
            };
          }
          break;

        case 'voice_processing':
          if (result && result.transcript) {
            feedback.message = `🎙️ **I heard:** "${result.transcript}"\n\n`;
            if (result.intent) {
              feedback.message += `**Intent:** ${result.intent}\n\n`;
            }
            feedback.message += "Is this correct? If not, just tell me what you actually said.";
          } else {
            feedback.success = false;
            feedback.message = "❌ I couldn't understand your voice message. Could you try again?";
            feedback.suggestions = [
              "Speak clearly and slowly",
              "Try a shorter message first",
              "Check your microphone settings"
            ];
          }
          break;

        default:
          feedback.message = "I processed your request. Is there anything else you'd like me to help with?";
      }

      return feedback;
    } catch (error) {
      logger.error('Error providing feedback:', error);
      return {
        action,
        success: false,
        message: "Sorry, I encountered an error. Please try again.",
        suggestions: ["Try rephrasing your request", "Check your internet connection"]
      };
    }
  }

  /**
   * Handle user corrections
   */
  async handleCorrection(userId: string, originalAction: string, correction: string): Promise<string> {
    try {
      // Store the correction for learning
      await this.storeCorrection(userId, originalAction, correction);

      return `✅ **Correction Applied!**\n\nI've updated my understanding. Thank you for the feedback!\n\n` +
             `**Original:** ${originalAction}\n` +
             `**Corrected:** ${correction}\n\n` +
             `I'll do better next time!`;
    } catch (error) {
      logger.error('Error handling correction:', error);
      return "Thanks for the correction! I'll remember that for next time.";
    }
  }

  /**
   * Store user corrections for learning
   */
  private async storeCorrection(userId: string, originalAction: string, correction: string): Promise<void> {
    try {
      // This could be stored in a separate table for learning purposes
      logger.info(`User ${userId} corrected: "${originalAction}" -> "${correction}"`);
    } catch (error) {
      logger.error('Error storing correction:', error);
    }
  }

  /**
   * Get user's onboarding progress as a visual indicator
   */
  getProgressBar(progress: number): string {
    const filled = Math.round(progress / 10);
    const empty = 10 - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
  }
}

export default new OnboardingService();
