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
    const { userId, username } = context;
    
    if (userId) {
      const count = this.userMessageCount.get(userId) || 0;
      this.userMessageCount.set(userId, count + 1);
    }

    logger.info(`Processing command: ${command} for user: ${username || userId}`);

    // Handle natural language queries first
    if (!command.startsWith('/')) {
      return this.handleNaturalLanguageQuery(command, context);
    }

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
        return this.listContacts();
      
      case '/goals':
        return this.listGoals();
      
      case '/import':
        return this.showImportOptions();
      
      case '/connect_google':
        return this.initiateGoogleConnect(context);
      
      case '/sync_telegram':
        return this.showTelegramSync();
        
      default:
        if (command.startsWith('/')) {
          return `Unknown command: ${command}\n\nType /help to see available commands.`;
        }
        return '';
    }
  }

  private async handleNaturalLanguageQuery(text: string, context: CommandContext): Promise<string> {
    const lowerText = text.toLowerCase();
    
    try {
      // Import services
      const contactService = (await import('../services/contacts')).default;
      const db = (await import('../db/supabase')).default;
      
      // Find user
      const user = await db.users.findByTelegramId(context.userId!);
      if (!user) {
        return 'Please use /start first to initialize your account.';
      }

      // Pattern 1: "Who do I know at [company]?"
      const companyMatch = lowerText.match(/who do i know at (.+?)(?:\?|$)/);
      if (companyMatch) {
        const company = companyMatch[1].trim();
        const contacts = await contactService.findByCompany(user.id, company);
        return this.formatCompanyContacts(contacts, company);
      }

      // Pattern 2: "Find [role/title]"
      const roleMatch = lowerText.match(/find (.+?)(?:\?|$)/);
      if (roleMatch) {
        const role = roleMatch[1].trim();
        const contacts = await contactService.findByRole(user.id, role);
        return this.formatRoleContacts(contacts, role);
      }

      // Pattern 3: "Show me my [type] contacts"
      const typeMatch = lowerText.match(/show me my (.+?) contacts/);
      if (typeMatch) {
        const type = typeMatch[1].trim();
        const contacts = await contactService.findByType(user.id, type);
        return this.formatTypeContacts(contacts, type);
      }

      // Pattern 4: "Who should I follow up with?"
      if (lowerText.includes('follow up') || lowerText.includes('check in')) {
        const contacts = await contactService.findNeedingFollowUp(user.id);
        return this.formatFollowUpContacts(contacts);
      }

      // Pattern 5: "My strongest connections"
      if (lowerText.includes('strongest') || lowerText.includes('best') || lowerText.includes('closest')) {
        const contacts = await contactService.findStrongestConnections(user.id);
        return this.formatStrongestContacts(contacts);
      }

      // Pattern 6: "Recent contacts"
      if (lowerText.includes('recent') || lowerText.includes('latest') || lowerText.includes('new')) {
        const contacts = await contactService.findRecentContacts(user.id);
        return this.formatRecentContacts(contacts);
      }

      // Pattern 7: "Who could help with [topic]?"
      const helpMatch = lowerText.match(/who could help with (.+?)(?:\?|$)/);
      if (helpMatch) {
        const topic = helpMatch[1].trim();
        const contacts = await contactService.findByExpertise(user.id, topic);
        return this.formatExpertiseContacts(contacts, topic);
      }

      // Default: Suggest voice input
      return `I understand you're asking about your network. Try these natural queries:

• "Who do I know at Google?"
• "Find investors in fintech"
• "Show me my strongest connections"
• "Who should I follow up with?"
• "Recent contacts"
• "Who could help with marketing?"

Or send a voice message describing what you're looking for! 🎙️`;
      
    } catch (error) {
      logger.error('Error processing natural language query:', error);
      return 'Sorry, I encountered an error processing your request. Please try again!';
    }
  }

  private handleStart(_context: CommandContext): string {
    const { userId, username } = _context;
    
    if (userId) {
      this.userMessageCount.set(userId, 1);
      this.tutorialProgress.set(userId, 0);
    }
    
    return onboardingService.getWelcomeMessage(username);
  }

  private handleTutorial(_context: CommandContext): string {
    const { userId } = _context;
    const tutorials = onboardingService.getTutorial();
    
    if (!userId) {
      return tutorials[0] + '\n\n📌 Send /next to continue';
    }
    
    this.tutorialProgress.set(userId, 0);
    const progress = onboardingService.getProgressMessage(1, tutorials.length);
    
    return tutorials[0] + `\n\n${progress}\n📌 Send /next to continue or /skip to exit tutorial`;
  }

  private handleNextTutorial(_context: CommandContext): string {
    const { userId } = _context;
    
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

  private skipTutorial(_context: CommandContext): string {
    const { userId } = _context;
    
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

  private getUserStats(_context: CommandContext): string {
    const { userId } = _context;
    const messageCount = userId ? this.userMessageCount.get(userId) || 0 : 0;
    
    return `📊 **Your Stats**
    
Messages sent: ${messageCount}
Contacts: 0 (coming soon)
Goals: 0 (coming soon)
Relationship score: N/A

Use the bot more to see your stats grow!`;
  }

  private listContacts(): string {
    return `📚 **Your Contacts**

You haven't added any contacts yet.

**How to add contacts:**
• "I met John at Google"
• Send a voice message
• "Connected with Sarah, CTO at StartupX"

Try adding your first contact!`;
  }

  private listGoals(): string {

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

  private showImportOptions(): string {
    return `📥 **Import Your Contacts**

Choose an import method:

**1️⃣ Telegram Contacts** 📱
Type /sync_telegram to import from your phone

**2️⃣ CSV File Upload**
Send me a CSV file with your contacts

**3️⃣ Google Contacts** 
Type /connect_google to sync

**4️⃣ Bulk Text Import**
Send contacts as:
• Name - Company - Title
• Name at Company
• Or just names on separate lines

**5️⃣ Voice Message**
Record a voice note listing your contacts

**Example bulk text:**
\`\`\`
Sarah Chen - Microsoft - PM
John Smith at Google
David Lee, CTO, StartupX
Maria Garcia
\`\`\`

Just paste your contacts and I'll import them!`;
  }

  private initiateGoogleConnect(_context: CommandContext): string {
    const { userId } = _context;
    
    // In production, you'd generate an OAuth URL here
    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${process.env.GOOGLE_CLIENT_ID || 'YOUR_CLIENT_ID'}&` +
      `redirect_uri=${process.env.GOOGLE_REDIRECT_URI || 'https://rhiz.up.railway.app/auth/google/callback'}&` +
      `response_type=code&` +
      `scope=https://www.googleapis.com/auth/contacts.readonly&` +
      `state=${userId}`;
    
    return `🔗 **Connect Google Contacts**

To import your Google contacts:

1. Click this link to authorize:
${googleAuthUrl}

2. Allow access to your contacts
3. You'll be redirected back to Telegram
4. Your contacts will be imported automatically

**Privacy Note:**
• We only read contact names, emails, and companies
• Your data is encrypted and private
• You can revoke access anytime in Google settings

Having issues? Try sending your contacts as text instead!`;
  }

  private showTelegramSync(): string {
    return `📱 **Import from Telegram Contacts**

To import contacts from your phone:

**Step 1: Share Contacts**
1. Click the 📎 attachment button in Telegram
2. Select "Contact" 
3. Choose contacts from your phone
4. Send them to this chat

**Step 2: Bulk Share (Recommended)**
• You can select multiple contacts at once
• Send them one by one or in groups
• I'll automatically import each contact

**What I'll Import:**
✅ Name and phone number
✅ Email (if in contact)
✅ Company/Organization
✅ Job title
✅ Notes and additional info

**Privacy:**
🔒 Your contacts stay private to your account
🔒 Only you can see your imported contacts
🔒 Data is encrypted and secure

**Alternative:**
If sharing contacts doesn't work, try:
• Copying contact info as text
• Exporting from your phone as CSV
• Using voice messages to describe contacts

Ready? Start sharing your contacts with the bot! 📲`;
  }

  private formatCompanyContacts(contacts: any[], company: string): string {
    if (contacts.length === 0) {
      return `You don't have any contacts at ${company} yet.\n\nTry adding some with voice messages like:\n"I met John at ${company}"`;
    }

    let message = `👥 **Your contacts at ${company}** (${contacts.length}):\n\n`;
    
    contacts.forEach((contact, index) => {
      message += `${index + 1}. **${contact.name}**`;
      if (contact.title) message += ` - ${contact.title}`;
      if (contact.relationship_strength) message += ` (Strength: ${contact.relationship_strength}/100)`;
      message += '\n';
    });

    return message;
  }

  private formatRoleContacts(contacts: any[], role: string): string {
    if (contacts.length === 0) {
      return `You don't have any ${role} contacts yet.\n\nTry adding some with voice messages like:\n"I met a ${role} at the conference"`;
    }

    let message = `👥 **Your ${role} contacts** (${contacts.length}):\n\n`;
    
    contacts.forEach((contact, index) => {
      message += `${index + 1}. **${contact.name}**`;
      if (contact.company) message += ` at ${contact.company}`;
      if (contact.relationship_strength) message += ` (Strength: ${contact.relationship_strength}/100)`;
      message += '\n';
    });

    return message;
  }

  private formatTypeContacts(contacts: any[], type: string): string {
    if (contacts.length === 0) {
      return `You don't have any ${type} contacts yet.\n\nTry adding some with voice messages!`;
    }

    let message = `👥 **Your ${type} contacts** (${contacts.length}):\n\n`;
    
    contacts.forEach((contact, index) => {
      message += `${index + 1}. **${contact.name}**`;
      if (contact.title) message += ` - ${contact.title}`;
      if (contact.company) message += ` at ${contact.company}`;
      message += '\n';
    });

    return message;
  }

  private formatFollowUpContacts(contacts: any[]): string {
    if (contacts.length === 0) {
      return `🎉 Great! All your relationships are up to date.\n\nKeep building your network with voice messages!`;
    }

    let message = `📞 **Contacts needing follow-up** (${contacts.length}):\n\n`;
    
    contacts.forEach((contact, index) => {
      message += `${index + 1}. **${contact.name}**`;
      if (contact.company) message += ` at ${contact.company}`;
      if (contact.last_interaction_date) {
        const daysAgo = Math.floor((Date.now() - new Date(contact.last_interaction_date).getTime()) / (1000 * 60 * 60 * 24));
        message += ` (${daysAgo} days ago)`;
      }
      message += '\n';
    });

    message += '\n💡 **Follow-up ideas:**\n• Send a quick check-in message\n• Share relevant industry news\n• Ask about their recent projects\n• Offer to help with something';

    return message;
  }

  private formatStrongestContacts(contacts: any[]): string {
    if (contacts.length === 0) {
      return `Start building strong relationships! Add contacts with voice messages and interact regularly.`;
    }

    let message = `💪 **Your strongest connections** (${contacts.length}):\n\n`;
    
    contacts.forEach((contact, index) => {
      message += `${index + 1}. **${contact.name}**`;
      if (contact.title) message += ` - ${contact.title}`;
      if (contact.company) message += ` at ${contact.company}`;
      message += ` (Strength: ${contact.relationship_strength}/100)\n`;
    });

    return message;
  }

  private formatRecentContacts(contacts: any[]): string {
    if (contacts.length === 0) {
      return `No contacts yet! Start building your network with voice messages.`;
    }

    let message = `🆕 **Recently added contacts** (${contacts.length}):\n\n`;
    
    contacts.forEach((contact, index) => {
      const daysAgo = Math.floor((Date.now() - new Date(contact.created_at).getTime()) / (1000 * 60 * 60 * 24));
      message += `${index + 1}. **${contact.name}**`;
      if (contact.title) message += ` - ${contact.title}`;
      if (contact.company) message += ` at ${contact.company}`;
      message += ` (${daysAgo} days ago)\n`;
    });

    return message;
  }

  private formatExpertiseContacts(contacts: any[], topic: string): string {
    if (contacts.length === 0) {
      return `No contacts found with ${topic} expertise.\n\nTry adding more diverse contacts or be more specific with your search.`;
    }

    let message = `🎯 **Contacts who could help with ${topic}** (${contacts.length}):\n\n`;
    
    contacts.forEach((contact, index) => {
      message += `${index + 1}. **${contact.name}**`;
      if (contact.title) message += ` - ${contact.title}`;
      if (contact.company) message += ` at ${contact.company}`;
      message += '\n';
    });

    message += '\n💡 **Next steps:**\n• Send them a message about your ${topic} needs\n• Ask for advice or introductions\n• Offer to help them in return';

    return message;
  }
}

export default new CommandHandler();