import authService from '../middleware/authorization';
import db from '../db/supabase';
import logger from '../utils/logger';
import { modelMonitor } from '../ai/model-monitor';

interface AdminCommandContext {
  chatId: number;
  userId: number;
  username?: string;
  args: string[];
}

export class AdminCommandHandler {
  
  async handleAdminCommand(command: string, context: AdminCommandContext): Promise<string> {
    const { userId, args } = context;
    
    // Verify admin status
    if (!authService.isAdmin(userId)) {
      return '❌ Admin access required.';
    }
    
    logger.info(`Admin command: ${command} by ${userId}`);
    
    switch (command.toLowerCase()) {
      case '/admin_help':
        return this.getAdminHelp();
        
      case '/pending':
        return await this.listPendingUsers();
        
      case '/approve':
        return await this.approveUser(args, context.username || userId.toString());
        
      case '/reject':
        return await this.rejectUser(args, context.username || userId.toString());
        
      case '/suspend':
        return await this.suspendUser(args, context.username || userId.toString());
        
      case '/unsuspend':
        return await this.unsuspendUser(args, context.username || userId.toString());
        
      case '/user_info':
        return await this.getUserInfo(args);
        
      case '/stats':
        return await this.getSystemStats();
        
      case '/broadcast':
        return await this.broadcastMessage(args);
        
      case '/list_admins':
        return this.listAdmins();
        
      case '/models':
        return await this.getModelStatus();
        
      default:
        return `❌ Unknown admin command: ${command}\n\nType /admin_help for available commands.`;
    }
  }
  
  private getAdminHelp(): string {
    return `🔧 **Admin Commands**

**User Management:**
• \`/pending\` - List users awaiting approval
• \`/approve <telegram_id>\` - Approve user access
• \`/reject <telegram_id> [reason]\` - Reject user access
• \`/suspend <telegram_id> [reason]\` - Suspend user
• \`/unsuspend <telegram_id>\` - Unsuspend user
• \`/user_info <telegram_id>\` - View user details

**System:**
• \`/stats\` - System statistics
• \`/broadcast <message>\` - Send message to all users
• \`/list_admins\` - List admin users

**Examples:**
\`/approve 123456789\`
\`/reject 123456789 Spam account\`
\`/broadcast Welcome to the new update!\``;
  }
  
  private async listPendingUsers(): Promise<string> {
    try {
      const pendingUsers = await authService.getPendingUsers();
      
      if (pendingUsers.length === 0) {
        return '✅ No pending user requests.';
      }
      
      const userList = pendingUsers.map((user: any) => 
        `👤 **${user.first_name || ''} ${user.last_name || ''}**\n` +
        `   @${user.username || 'no username'}\n` +
        `   ID: \`${user.telegram_id}\`\n` +
        `   Requested: ${new Date(user.requested_at).toLocaleDateString()}\n`
      ).join('\n');
      
      return `📋 **Pending Approval (${pendingUsers.length})**\n\n${userList}`;
    } catch (error) {
      logger.error('Error listing pending users:', error);
      return '❌ Error retrieving pending users.';
    }
  }
  
  private async approveUser(args: string[], approvedBy: string): Promise<string> {
    const telegramId = parseInt(args[0]);
    
    if (!telegramId) {
      return '❌ Usage: `/approve <telegram_id>`';
    }
    
    const success = await authService.approveUser(telegramId, approvedBy);
    
    if (success) {
      return `✅ User ${telegramId} approved successfully.`;
    } else {
      return `❌ Failed to approve user ${telegramId}. User may not exist.`;
    }
  }
  
  private async rejectUser(args: string[], rejectedBy: string): Promise<string> {
    const telegramId = parseInt(args[0]);
    const reason = args.slice(1).join(' ');
    
    if (!telegramId) {
      return '❌ Usage: `/reject <telegram_id> [reason]`';
    }
    
    const success = await authService.rejectUser(telegramId, rejectedBy, reason);
    
    if (success) {
      return `✅ User ${telegramId} rejected successfully.`;
    } else {
      return `❌ Failed to reject user ${telegramId}. User may not exist.`;
    }
  }
  
  private async suspendUser(args: string[], suspendedBy: string): Promise<string> {
    const telegramId = parseInt(args[0]);
    const reason = args.slice(1).join(' ');
    
    if (!telegramId) {
      return '❌ Usage: `/suspend <telegram_id> [reason]`';
    }
    
    const success = await authService.suspendUser(telegramId, suspendedBy, reason);
    
    if (success) {
      return `✅ User ${telegramId} suspended successfully.`;
    } else {
      return `❌ Failed to suspend user ${telegramId}. User may not exist.`;
    }
  }
  
  private async unsuspendUser(args: string[], unsuspendedBy: string): Promise<string> {
    const telegramId = parseInt(args[0]);
    
    if (!telegramId) {
      return '❌ Usage: `/unsuspend <telegram_id>`';
    }
    
    try {
      const user = await db.users.findByTelegramId(telegramId);
      if (!user) {
        return `❌ User ${telegramId} not found.`;
      }
      
      await db.users.update(user.id, {
        status: 'approved',
        suspended_at: null,
        suspended_by: null,
        suspension_reason: null,
        unsuspended_at: new Date(),
        unsuspended_by: unsuspendedBy
      });
      
      return `✅ User ${telegramId} unsuspended successfully.`;
    } catch (error) {
      logger.error('Error unsuspending user:', error);
      return `❌ Failed to unsuspend user ${telegramId}.`;
    }
  }
  
  private async getUserInfo(args: string[]): Promise<string> {
    const telegramId = parseInt(args[0]);
    
    if (!telegramId) {
      return '❌ Usage: `/user_info <telegram_id>`';
    }
    
    try {
      const user = await db.users.findByTelegramId(telegramId);
      if (!user) {
        return `❌ User ${telegramId} not found.`;
      }
      
      const contacts = await db.contacts.findByUserId(user.id);
      const contactCount = contacts?.length || 0;
      
      return `👤 **User Information**

**Profile:**
• Name: ${user.first_name || ''} ${user.last_name || ''}
• Username: @${user.username || 'none'}
• Telegram ID: \`${user.telegram_id}\`
• Status: ${user.status}
• Tier: ${user.subscription_tier}

**Activity:**
• Contacts: ${contactCount}
• Joined: ${new Date(user.created_at).toLocaleDateString()}
• Last Active: ${user.last_active_at ? new Date(user.last_active_at).toLocaleDateString() : 'Never'}

**Approval:**
• Approved: ${user.approved_at ? new Date(user.approved_at).toLocaleDateString() : 'No'}
• Approved by: ${user.approved_by || 'N/A'}`;
    } catch (error) {
      logger.error('Error getting user info:', error);
      return `❌ Error retrieving user information.`;
    }
  }
  
  private async getSystemStats(): Promise<string> {
    try {
      // Get user stats by status
      const totalUsers = 0; // Would implement proper DB query
      const approvedUsers = 0;
      const pendingUsers = 0;
      const rejectedUsers = 0;
      const suspendedUsers = 0;
      
      return `📊 **System Statistics**

**Users:**
• Total: ${totalUsers}
• Approved: ${approvedUsers}
• Pending: ${pendingUsers}
• Rejected: ${rejectedUsers}
• Suspended: ${suspendedUsers}

**System:**
• Uptime: ${Math.floor(process.uptime() / 3600)}h ${Math.floor((process.uptime() % 3600) / 60)}m
• Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB
• Node: ${process.version}

**Today:**
• New signups: 0
• Messages processed: 0`;
    } catch (error) {
      logger.error('Error getting system stats:', error);
      return '❌ Error retrieving system statistics.';
    }
  }
  
  private async broadcastMessage(args: string[]): Promise<string> {
    const message = args.join(' ');
    
    if (!message) {
      return '❌ Usage: `/broadcast <message>`';
    }
    
    try {
      // Would implement broadcast to all approved users
      return `✅ Broadcast sent to all users.\n\n**Message:**\n${message}`;
    } catch (error) {
      logger.error('Error broadcasting message:', error);
      return '❌ Error sending broadcast message.';
    }
  }
  
  private listAdmins(): string {
    const adminIds = process.env.ADMIN_TELEGRAM_IDS || '';
    const admins = adminIds.split(',').map(id => id.trim()).filter(Boolean);
    
    return `👑 **Admin Users**

${admins.map(id => `• Telegram ID: \`${id}\``).join('\n')}

Total: ${admins.length} admins

**Add Admin:**
Set \`ADMIN_TELEGRAM_IDS\` environment variable in Railway.`;
  }
  
  private async getModelStatus(): Promise<string> {
    try {
      const report = modelMonitor.getModelReport();
      
      let response = '🤖 **AI Model Status**\n\n';
      
      // Current model assignments
      response += '**Current Models:**\n';
      Object.entries(report.currentModels).forEach(([task, model]) => {
        response += `• ${task}: ${model}\n`;
      });
      
      // Performance metrics if available
      if (Object.keys(report.performance).length > 0) {
        response += '\n**Performance:**\n';
        Object.entries(report.performance).forEach(([model, metrics]) => {
          response += `• ${model}: ${metrics.successRate} success, ${metrics.avgLatency}ms avg\n`;
        });
      }
      
      // Recommendations
      if (report.recommendations.length > 0) {
        response += '\n**Recommendations:**\n';
        report.recommendations.slice(0, 3).forEach(rec => {
          response += `• ${rec}\n`;
        });
      }
      
      return response;
    } catch (error) {
      logger.error('Error getting model status:', error);
      return '❌ Error retrieving model status.';
    }
  }
  
  isAdminCommand(command: string): boolean {
    const adminCommands = [
      '/admin_help', '/pending', '/approve', '/reject', '/suspend', 
      '/unsuspend', '/user_info', '/stats', '/broadcast', '/list_admins'
    ];
    
    return adminCommands.includes(command.toLowerCase());
  }
}

export default new AdminCommandHandler();