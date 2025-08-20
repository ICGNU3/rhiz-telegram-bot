# 🔐 Authorization System Setup Guide

## Quick Setup (Production Ready)

### 1. **Set Admin Users in Railway**

In your Railway dashboard, add this environment variable:

```
ADMIN_TELEGRAM_IDS=123456789,987654321
```

Replace with your actual Telegram user IDs. To find your Telegram ID:
1. Message `@userinfobot` on Telegram
2. It will reply with your user ID
3. Add that number to the environment variable

### 2. **Run Database Migration**

Execute this SQL in your Supabase SQL Editor:

```sql
-- Copy the contents of database/authorization-schema.sql
-- This adds authorization fields to the users table
```

### 3. **Deploy to Railway**

```bash
git add .
git commit -m "Add user authorization system"
git push
```

## How It Works

### **User Flow:**
1. **New User** sends any message to bot
2. **Request Created** - User gets "pending approval" message
3. **Admin Notified** - All admins get notification with approve/reject buttons
4. **Admin Approves** - User gets welcome message and full access
5. **User Can Use Bot** - Full functionality unlocked

### **Admin Flow:**
1. **Get Notifications** when new users request access
2. **Use Admin Commands** to manage users:
   - `/approve 123456789` - Approve user
   - `/reject 123456789 Reason` - Reject user
   - `/pending` - List pending requests
   - `/user_info 123456789` - View user details

## Admin Commands

| Command | Description | Example |
|---------|-------------|---------|
| `/admin_help` | Show all admin commands | `/admin_help` |
| `/pending` | List users awaiting approval | `/pending` |
| `/approve <id>` | Approve user access | `/approve 123456789` |
| `/reject <id> [reason]` | Reject user access | `/reject 123456789 Spam` |
| `/suspend <id> [reason]` | Suspend user | `/suspend 123456789 Abuse` |
| `/unsuspend <id>` | Unsuspend user | `/unsuspend 123456789` |
| `/user_info <id>` | View user details | `/user_info 123456789` |
| `/stats` | System statistics | `/stats` |
| `/list_admins` | Show admin users | `/list_admins` |

## User Statuses

- **🔄 Pending** - Awaiting admin approval
- **✅ Approved** - Full bot access
- **❌ Rejected** - Access denied
- **⚠️ Suspended** - Temporarily blocked

## Security Features

- **Whitelist Only** - Only approved users can use the bot
- **Admin Notifications** - Instant alerts for new requests
- **Audit Trail** - Track who approved/rejected users
- **Automatic Blocking** - Unauthorized users get blocked message
- **Admin Commands** - Easy user management interface

## Environment Variables

```bash
# Required: Comma-separated list of admin Telegram IDs
ADMIN_TELEGRAM_IDS=123456789,987654321

# Existing required variables
TELEGRAM_BOT_TOKEN=your_bot_token
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_key
```

## Testing Authorization

1. **Test as Non-Admin**: 
   - Use different Telegram account
   - Should get "pending approval" message
   
2. **Test Admin Commands**:
   - Use admin account
   - Try `/admin_help`
   - Should see admin commands

3. **Test Approval Flow**:
   - Approve the test user
   - Test user should get welcome message
   - Test user should have full access

## Production Tips

- **Add Multiple Admins** for redundancy
- **Monitor Pending Requests** daily
- **Use Rejection Reasons** for clarity
- **Suspend Abusive Users** instead of rejecting
- **Regular Stats Review** with `/stats`

## Troubleshooting

**Admin commands not working?**
- Check `ADMIN_TELEGRAM_IDS` environment variable
- Verify your Telegram ID is correct
- Restart Railway service after env changes

**Users not getting notifications?**
- Check bot token is correct
- Verify Supabase connection
- Check Railway logs for errors

**Database errors?**
- Run the authorization SQL migration
- Check Supabase permissions
- Verify table structure

Your bot is now secure and only accessible to approved users! 🔒