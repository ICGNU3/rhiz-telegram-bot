import db from '../db/supabase';
import logger from '../utils/logger';
import config from '../utils/config';

export enum UserStatus {
  PENDING = 'pending',
  APPROVED = 'approved', 
  REJECTED = 'rejected',
  SUSPENDED = 'suspended'
}

export enum UserTier {
  ROOT_ALPHA = 'root_alpha',
  BETA = 'beta',
  PREMIUM = 'premium',
  ADMIN = 'admin'
}

interface AuthResult {
  authorized: boolean;
  user?: any;
  message?: string;
  requiresApproval?: boolean;
}

export class AuthorizationService {
  private adminTelegramIds: number[];
  
  constructor() {
    // Get admin IDs from environment variable
    const adminIds = process.env.ADMIN_TELEGRAM_IDS || '';
    this.adminTelegramIds = adminIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
    
    if (this.adminTelegramIds.length === 0) {
      logger.warn('No admin Telegram IDs configured. Set ADMIN_TELEGRAM_IDS environment variable.');
    }
  }

  async checkUserAuthorization(telegramId: number, userData?: {
    username?: string;
    first_name?: string;
    last_name?: string;
  }): Promise<AuthResult> {
    try {
      // Check if user is admin
      if (this.isAdmin(telegramId)) {
        const user = await this.getOrCreateAdminUser(telegramId, userData);
        return {
          authorized: true,
          user,
          message: '🔑 Admin access granted'
        };
      }

      // Check existing user status
      const existingUser = await db.users.findByTelegramId(telegramId);
      
      if (existingUser) {
        switch (existingUser.status) {
          case UserStatus.APPROVED:
            return {
              authorized: true,
              user: existingUser,
              message: '✅ Access granted'
            };
            
          case UserStatus.REJECTED:
            return {
              authorized: false,
              message: '❌ Access denied. Your request was rejected.'
            };
            
          case UserStatus.SUSPENDED:
            return {
              authorized: false,
              message: '⚠️ Account suspended. Contact admin for assistance.'
            };
            
          case UserStatus.PENDING:
            return {
              authorized: false,
              message: '⏳ Your access request is pending approval. You\'ll be notified when approved.',
              requiresApproval: false // Already requested
            };
        }
      }

      // New user - create pending request
      await this.createPendingUser(telegramId, userData);
      await this.notifyAdminsOfNewRequest(telegramId, userData);
      
      return {
        authorized: false,
        message: '📋 Access request submitted! Admins will review your request and notify you when approved.',
        requiresApproval: true
      };
      
    } catch (error) {
      logger.error('Authorization check failed:', error);
      return {
        authorized: false,
        message: '❌ Authorization system error. Please try again later.'
      };
    }
  }

  isAdmin(telegramId: number): boolean {
    return this.adminTelegramIds.includes(telegramId);
  }

  private async getOrCreateAdminUser(telegramId: number, userData?: any) {
    let user = await db.users.findByTelegramId(telegramId);
    
    if (!user) {
      user = await db.users.create({
        telegram_id: telegramId,
        username: userData?.username,
        first_name: userData?.first_name,
        last_name: userData?.last_name,
        status: UserStatus.APPROVED,
        subscription_tier: UserTier.ADMIN,
        onboarding_completed: true,
        approved_at: new Date(),
        approved_by: 'system'
      });
    } else if (user.subscription_tier !== UserTier.ADMIN) {
      // Upgrade existing user to admin
      user = await db.users.update(user.id, {
        subscription_tier: UserTier.ADMIN,
        status: UserStatus.APPROVED,
        approved_at: new Date(),
        approved_by: 'system'
      });
    }
    
    return user;
  }

  private async createPendingUser(telegramId: number, userData?: any) {
    return await db.users.create({
      telegram_id: telegramId,
      username: userData?.username,
      first_name: userData?.first_name,
      last_name: userData?.last_name,
      status: UserStatus.PENDING,
      subscription_tier: UserTier.ROOT_ALPHA,
      onboarding_completed: false,
      requested_at: new Date()
    });
  }

  private async notifyAdminsOfNewRequest(telegramId: number, userData?: any) {
    const message = `🔔 **New Bot Access Request**

👤 **User**: ${userData?.first_name || ''} ${userData?.last_name || ''} (@${userData?.username || 'no username'})
🆔 **Telegram ID**: ${telegramId}
⏰ **Requested**: ${new Date().toLocaleString()}

**Actions:**
• \`/approve ${telegramId}\` - Approve access
• \`/reject ${telegramId}\` - Reject access
• \`/user_info ${telegramId}\` - View details`;

    // Send to all admins
    for (const adminId of this.adminTelegramIds) {
      try {
        await this.sendTelegramMessage(adminId, message);
      } catch (error) {
        logger.error(`Failed to notify admin ${adminId}:`, error);
      }
    }
  }

  async approveUser(telegramId: number, approvedBy: string): Promise<boolean> {
    try {
      const user = await db.users.findByTelegramId(telegramId);
      if (!user) return false;

      await db.users.update(user.id, {
        status: UserStatus.APPROVED,
        approved_at: new Date(),
        approved_by: approvedBy
      });

      // Notify user
      const message = `🎉 **Access Approved!**

Welcome to Rhiz! Your access has been approved.

🚀 **Get Started:**
• Send /tutorial for a guided walkthrough
• Try saying "I met John at Google"
• Import contacts with /import

Enjoy building your network! 📱`;

      await this.sendTelegramMessage(telegramId, message);
      
      logger.info(`User ${telegramId} approved by ${approvedBy}`);
      return true;
    } catch (error) {
      logger.error('Failed to approve user:', error);
      return false;
    }
  }

  async rejectUser(telegramId: number, rejectedBy: string, reason?: string): Promise<boolean> {
    try {
      const user = await db.users.findByTelegramId(telegramId);
      if (!user) return false;

      await db.users.update(user.id, {
        status: UserStatus.REJECTED,
        rejected_at: new Date(),
        rejected_by: rejectedBy,
        rejection_reason: reason
      });

      // Notify user
      const message = `❌ **Access Request Rejected**

Your request for bot access has been rejected.

${reason ? `**Reason**: ${reason}` : ''}

If you believe this is an error, please contact the administrators.`;

      await this.sendTelegramMessage(telegramId, message);
      
      logger.info(`User ${telegramId} rejected by ${rejectedBy}`);
      return true;
    } catch (error) {
      logger.error('Failed to reject user:', error);
      return false;
    }
  }

  async suspendUser(telegramId: number, suspendedBy: string, reason?: string): Promise<boolean> {
    try {
      const user = await db.users.findByTelegramId(telegramId);
      if (!user) return false;

      await db.users.update(user.id, {
        status: UserStatus.SUSPENDED,
        suspended_at: new Date(),
        suspended_by: suspendedBy,
        suspension_reason: reason
      });

      // Notify user
      const message = `⚠️ **Account Suspended**

Your account has been suspended.

${reason ? `**Reason**: ${reason}` : ''}

Contact administrators if you have questions.`;

      await this.sendTelegramMessage(telegramId, message);
      
      logger.info(`User ${telegramId} suspended by ${suspendedBy}`);
      return true;
    } catch (error) {
      logger.error('Failed to suspend user:', error);
      return false;
    }
  }

  async getPendingUsers(): Promise<any[]> {
    try {
      // For now, return empty array - will implement proper query later
      // This requires adding a new method to the database service
      return [];
    } catch (error) {
      logger.error('Failed to get pending users:', error);
      return [];
    }
  }

  private async sendTelegramMessage(chatId: number, text: string): Promise<void> {
    const botToken = config.telegram.botToken;
    if (!botToken) {
      logger.error('No bot token configured for admin notifications');
      return;
    }

    try {
      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'Markdown'
        })
      });

      if (!response.ok) {
        throw new Error(`Telegram API error: ${response.statusText}`);
      }
    } catch (error) {
      logger.error(`Failed to send Telegram message to ${chatId}:`, error);
      throw error;
    }
  }

  getAuthorizationMessage(): string {
    return `🔐 **Access Restricted**

This bot is currently in private beta and requires approval.

📋 **What happens next:**
1. Your access request has been submitted
2. Admins will review your request
3. You'll be notified when approved

⏱️ **Typical approval time**: 24-48 hours

Thank you for your interest in Rhiz! 🚀`;
  }

  getUnauthorizedMessage(): string {
    return `❌ **Access Denied**

You don't have permission to use this bot.

If you believe this is an error, please contact the administrators.`;
  }
}

export default new AuthorizationService();