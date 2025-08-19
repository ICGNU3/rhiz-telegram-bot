import onboardingService from './onboarding';
import logger from '../utils/logger';

interface CommandContext {
  chatId: number;
  userId?: number;
  username?: string;
  messageCount?: number;
}

export class CommandHandler {
  private tutorialProgress: Map<number, number> = new Map();
  private userMessageCount: Map<number, number> = new Map();

  async handleCommand(command: string, context: CommandContext): Promise<string> {
    const { chatId, userId, username } = context;
    
    if (userId) {
      const count = this.userMessageCount.get(userId) || 0;
      this.userMessageCount.set(userId, count + 1);
    }

    logger.info(`Processing command: ${command} for user: ${username || userId}`);

    switch (command.toLowerCase()) {
      case '/start':
        return this.handleStart(context);
      
      case '/help':
        return onboardingService.getHelpMessage();
      
      case '/tutorial':
        return this.handleTutorial(context);
      
      case '/samples':
      case '/examples':
        return onboardingService.getSampleCommands();
      
      case '/faq':
      case '/questions':
        return onboardingService.getFAQ();
      
      case '/tips':
        return this.getRandomTip();
      
      case '/next':
        return this.handleNextTutorial(context);
      
      case '/skip':
        return this.skipTutorial(context);
      
      case '/stats':
        return this.getUserStats(context);
      
      case '/contacts':
        return this.listContacts(context);
      
      case '/goals':
        return this.listGoals(context);
        
      default:
        if (command.startsWith('/')) {
          return `Unknown command: ${command}\n\nType /help to see available commands.`;
        }
        return '';
    }
  }

  private handleStart(context: CommandContext): string {
    const { userId, username } = context;
    
    if (userId) {
      this.userMessageCount.set(userId, 1);
      this.tutorialProgress.set(userId, 0);
    }
    
    return onboardingService.getWelcomeMessage(username);
  }

  private handleTutorial(context: CommandContext): string {
    const { userId } = context;
    const tutorials = onboardingService.getTutorial();
    
    if (!userId) {
      return tutorials[0] + '\n\n📌 Send /next to continue';
    }
    
    this.tutorialProgress.set(userId, 0);
    const progress = onboardingService.getProgressMessage(1, tutorials.length);
    
    return tutorials[0] + `\n\n${progress}\n📌 Send /next to continue or /skip to exit tutorial`;
  }

  private handleNextTutorial(context: CommandContext): string {
    const { userId } = context;
    
    if (!userId) {
      return 'Please start the tutorial first with /tutorial';
    }
    
    const currentStep = this.tutorialProgress.get(userId) || 0;
    const tutorials = onboardingService.getTutorial();
    const nextStep = currentStep + 1;
    
    if (nextStep >= tutorials.length) {
      this.tutorialProgress.delete(userId);
      return `🎉 **Tutorial Complete!**
      
You've learned all the basics of using Rhiz!

**What's Next?**
• Try the /samples command for real examples
• Add your first contact
• Set a networking goal
• Explore /faq for more details

Ready to build your network? Let's go! 🚀`;
    }
    
    this.tutorialProgress.set(userId, nextStep);
    const progress = onboardingService.getProgressMessage(nextStep + 1, tutorials.length);
    
    return tutorials[nextStep] + `\n\n${progress}\n📌 Send /next to continue or /skip to exit`;
  }

  private skipTutorial(context: CommandContext): string {
    const { userId } = context;
    
    if (userId) {
      this.tutorialProgress.delete(userId);
    }
    
    return `Tutorial skipped. You can restart it anytime with /tutorial\n\nTry /samples to see example commands or /help for assistance.`;
  }

  private getRandomTip(): string {
    const tips = onboardingService.getQuickTips();
    const randomTip = tips[Math.floor(Math.random() * tips.length)];
    return randomTip + '\n\nWant more tips? Check out /tutorial or /faq';
  }

  private getUserStats(context: CommandContext): string {
    const { userId } = context;
    const messageCount = userId ? this.userMessageCount.get(userId) || 0 : 0;
    
    return `📊 **Your Stats**
    
Messages sent: ${messageCount}
Contacts: 0 (coming soon)
Goals: 0 (coming soon)
Relationship score: N/A

Use the bot more to see your stats grow!`;
  }

  private listContacts(context: CommandContext): string {
    return `📚 **Your Contacts**

You haven't added any contacts yet.

**How to add contacts:**
• "I met John at Google"
• Send a voice message
• "Connected with Sarah, CTO at StartupX"

Try adding your first contact!`;
  }

  private listGoals(context: CommandContext): string {
    return `🎯 **Your Goals**

You haven't set any goals yet.

**How to set goals:**
• "My goal is to meet 10 investors"
• "I want to expand into Europe by Q4"
• "Goal: strengthen client relationships"

Set your first goal to get started!`;
  }

  isCommand(text: string): boolean {
    return text.startsWith('/');
  }

  shouldShowOnboarding(userId: number): boolean {
    const messageCount = this.userMessageCount.get(userId) || 0;
    return onboardingService.shouldShowOnboarding(messageCount);
  }

  getOnboardingPrompt(userId: number): string {
    if (this.shouldShowOnboarding(userId)) {
      return '\n\n💡 New here? Try /tutorial for a guided walkthrough!';
    }
    return '';
  }
}

export default new CommandHandler();