export class OnboardingService {
  getWelcomeMessage(username?: string): string {
    const name = username ? ` ${username}` : '';
    return `🎉 Welcome${name} to Rhiz - Your AI Relationship Manager!

I'm here to help you build and maintain meaningful professional relationships through intelligent contact management and insights.

🚀 **Quick Start:**
• Send /tutorial for a step-by-step guide
• Try /samples to see example commands
• Use /help anytime for assistance
• Check /faq for common questions

💡 **Core Features:**
📝 Contact Management - Save and organize contacts
🎯 Goal Tracking - Set and track relationship goals  
🤝 Introduction Suggestions - Connect your network
📊 Relationship Analytics - Track engagement metrics
🎙️ Voice Processing - Extract contacts from voice notes

Ready to get started? Try sending:
"I met Sarah Chen, she's the CTO at TechStart"`;
  }

  getTutorial(): string[] {
    return [
      `📖 **Tutorial - Part 1: Adding Contacts**

The easiest way to add contacts is by describing who you met:

✅ Examples:
• "I met John Smith at Google, he's a Product Manager"
• "Just had coffee with Maria Garcia from Microsoft"
• "Connected with David Lee, founder of StartupX"

I'll automatically extract:
- Name
- Company
- Title/Role
- Context

Try it now! Tell me about someone you recently met.`,

      `📖 **Tutorial - Part 2: Voice Messages**

🎙️ Send voice messages for hands-free contact capture!

How it works:
1. Record a voice message describing your meeting
2. I'll transcribe and extract contact details
3. Review and confirm the extracted information

Perfect for:
• Post-meeting notes while walking
• Quick thoughts after conversations
• Detailed relationship context

Send a voice message to try it!`,

      `📖 **Tutorial - Part 3: Finding Contacts**

🔍 Search your network with natural language:

Examples:
• "Who did I meet at the conference?"
• "Show me contacts from Google"
• "Find all CTOs in my network"
• "Who works in marketing?"

Advanced searches:
• By company: "People from Microsoft"
• By role: "All the founders I know"
• By context: "Conference contacts"

Try searching now!`,

      `📖 **Tutorial - Part 4: Setting Goals**

🎯 Track relationship and networking goals:

Examples:
• "My goal is to expand into European markets by Q4"
• "I want to meet 5 new founders this month"
• "Goal: strengthen relationships with key clients"

I'll help you:
• Track progress
• Suggest relevant contacts
• Recommend actions
• Send reminders

Set your first goal!`,

      `📖 **Tutorial - Part 5: Getting Insights**

📊 Unlock relationship intelligence:

Commands to try:
• "How strong is my relationship with John?"
• "Show my networking stats"
• "Who should I follow up with?"
• "Suggest introductions"

Analytics include:
• Engagement frequency
• Relationship strength scores
• Network growth trends
• Follow-up recommendations

Ask for insights about your network!`
    ];
  }

  getSampleCommands(): string {
    return `🎯 **Sample Commands to Try:**

**Adding Contacts:**
📝 "I met Lisa Park at the AI Summit, she's the Head of Engineering at DataCo"
📝 "Just talked with Robert Chen from Apple about their new ML project"
📝 "Connected with founders: Tom Wilson (Startup1) and Jane Lee (Startup2)"

**Voice Messages:**
🎙️ Record: "Had a great lunch with Michael Brown from Amazon..."
🎙️ Record: "Met three interesting people at the conference today..."

**Searching:**
🔍 "Who did I meet last week?"
🔍 "Show me all my contacts from Google"
🔍 "Find CTOs in my network"

**Goals & Tracking:**
🎯 "Set goal: Meet 10 new investors by end of month"
🎯 "My objective is to build relationships in the fintech sector"

**Analytics:**
📊 "Show my networking stats"
📊 "How's my relationship with Sarah Chen?"
📊 "Who haven't I talked to recently?"

**Follow-ups:**
💡 "Suggest follow-ups for this week"
💡 "Who should I reconnect with?"

Try any of these commands to see how I work!`;
  }

  getFAQ(): string {
    return `❓ **Frequently Asked Questions**

**Q: How do I add a contact?**
A: Simply describe who you met naturally:
"I met John at Google, he's a PM" or send a voice message

**Q: Can I edit contact information?**
A: Yes! Say "Update John's title to Senior PM" or "John moved to Microsoft"

**Q: How does voice processing work?**
A: Send a voice message → I transcribe it → Extract contact info → You confirm

**Q: Is my data secure?**
A: Yes! All data is encrypted and stored securely. We never share your contacts.

**Q: Can I export my contacts?**
A: Coming soon! We're working on CSV and integration exports.

**Q: How do I delete a contact?**
A: Say "Delete contact John Smith" or "Remove John from my contacts"

**Q: What makes a "strong" relationship?**
A: Frequency of interaction, mutual connections, and engagement quality

**Q: Can I set reminders?**
A: Yes! Say "Remind me to follow up with John next week"

**Q: How do I see all my contacts?**
A: Say "Show all contacts" or "List my network"

**Q: Can I categorize contacts?**
A: Yes! Use tags like "investor", "client", "partner" when adding contacts

**Q: What's the relationship score?**
A: A 0-100 score based on interaction frequency, recency, and depth

**Q: Can I integrate with other tools?**
A: LinkedIn and CRM integrations coming soon!

Still have questions? Just ask me anything!`;
  }

  getHelpMessage(): string {
    return `🤖 **Rhiz Help Center**

**Available Commands:**
/start - Welcome message and quick start
/tutorial - Step-by-step guided tutorial
/samples - Example commands to try
/faq - Frequently asked questions
/help - This help message
/stats - Your networking statistics
/contacts - List all your contacts
/goals - View your goals
/settings - Configure preferences

**Quick Actions:**
• Add contact: "Met [Name] at [Company]"
• Search: "Find [Name/Company/Role]"
• Set goal: "My goal is [objective]"
• Get insights: "How's my relationship with [Name]?"

**Tips:**
💡 Use voice messages for detailed notes
💡 Be specific when describing contacts
💡 Set weekly networking goals
💡 Review follow-up suggestions daily

Need more help? Just ask your question!`;
  }

  getQuickTips(): string[] {
    return [
      "💡 Tip: After meetings, immediately send a voice note describing who you met",
      "💡 Tip: Set a weekly goal for new connections to grow your network consistently",
      "💡 Tip: Use specific details when adding contacts for better search later",
      "💡 Tip: Check follow-up suggestions every Monday to stay connected",
      "💡 Tip: Voice messages capture more context than text - use them often!",
      "💡 Tip: Tag contacts by how you met them (#conference, #introduction, #cold-outreach)",
      "💡 Tip: Strong relationships need consistent follow-up - aim for monthly check-ins",
      "💡 Tip: Review your networking stats weekly to track progress"
    ];
  }

  shouldShowOnboarding(messageCount: number): boolean {
    return messageCount <= 1;
  }

  getProgressMessage(step: number, total: number): string {
    const progress = '▓'.repeat(step) + '░'.repeat(total - step);
    return `Progress: [${progress}] ${step}/${total}`;
  }
}

export default new OnboardingService();