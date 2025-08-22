# 🔗 Google Sheets Integration Setup

## Overview

Rhiz now supports **per-user Google Sheets integration**! Each user can connect their own Google account and have their contacts automatically synced to their personal spreadsheet with enriched data.

## Features

✅ **Individual User Accounts** - Each user connects their own Google account  
✅ **Automatic Contact Sync** - Contacts sync automatically when added  
✅ **Data Enrichment** - AI-powered insights and additional data  
✅ **Real-time Updates** - Changes reflect immediately in Google Sheets  
✅ **Privacy First** - Each user's data stays in their own account  

## Setup Instructions

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the following APIs:
   - Google Sheets API
   - Google Drive API

### 2. Configure OAuth 2.0

1. Go to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **OAuth 2.0 Client IDs**
3. Choose **Web application**
4. Set authorized redirect URIs:
   ```
   https://your-app.railway.app/auth/google/callback
   ```
5. Copy the **Client ID** and **Client Secret**

### 3. Set Environment Variables

Add these to your Railway environment:

```bash
# Google OAuth (for per-user authentication)
GOOGLE_OAUTH_CLIENT_ID=your-oauth-client-id
GOOGLE_OAUTH_CLIENT_SECRET=your-oauth-client-secret

# Google Service Account (for admin operations)
GOOGLE_SHEETS_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_SHEETS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
```

### 4. Deploy and Test

1. Deploy your updated application
2. Users can now use `/sheets` to connect their Google account
3. Each user gets their own spreadsheet automatically created

## User Experience

### For Users

1. **Connect Account**: Use `/sheets` command
2. **Authorize**: Click the OAuth link and grant permissions
3. **Auto-Sync**: Contacts sync automatically when added
4. **Manual Sync**: Use `/sync` to force a sync
5. **View Data**: Access enriched contact data in their spreadsheet

### Bot Commands

- `/sheets` - Connect to Google Sheets or view current sheet
- `/sync` - Manually sync contacts to Google Sheets
- `/contacts` - View your contacts in the bot

## Data Structure

Each user's spreadsheet contains:

| Column | Description |
|--------|-------------|
| Name | Contact's full name |
| Company | Company name |
| Title | Job title |
| Email | Email address |
| Phone | Phone number |
| Relationship Score | AI-calculated relationship strength (1-100) |
| Last Interaction | Date of last interaction |
| Notes | Voice notes and context |
| LinkedIn URL | LinkedIn profile URL |
| Twitter URL | Twitter profile URL |
| Website | Company/personal website |
| Location | Geographic location |
| Industry | Company industry (enriched) |
| Company Size | Company size (enriched) |
| Funding Stage | Company funding stage (enriched) |
| AI Insights | AI-generated relationship insights |
| Enriched Data | Additional enriched information |

## Security & Privacy

- **User Isolation**: Each user's data is completely separate
- **OAuth Tokens**: Stored securely in database, encrypted at rest
- **Minimal Permissions**: Only requests necessary Google Sheets access
- **No Data Sharing**: Users can't access each other's data

## Troubleshooting

### Common Issues

**"User not connected to Google Sheets"**
- User needs to use `/sheets` to connect their account first

**"Connection Issue"**
- OAuth tokens may have expired
- User should reconnect using `/sheets`

**"Permission Denied"**
- Check that Google Sheets API is enabled
- Verify OAuth client configuration

### Environment Variables Check

```bash
# Verify these are set in Railway
railway variables list | grep GOOGLE
```

### Testing OAuth Flow

1. Use `/sheets` command in bot
2. Click the OAuth link
3. Grant permissions
4. Should redirect to success page
5. Check that spreadsheet was created

## Advanced Configuration

### Custom Spreadsheet Templates

You can customize the spreadsheet structure by modifying the `syncContactsToSheet` method in `src/services/googleSheets.ts`.

### Additional Enrichment APIs

The enrichment system can be extended with:
- Clearbit API for company data
- Crunchbase API for funding info
- LinkedIn API for professional data
- Twitter API for social presence

### Rate Limiting

Google Sheets API has quotas:
- 100 requests per 100 seconds per user
- 300 requests per 100 seconds per project

The system handles rate limiting automatically.

## Support

If you encounter issues:

1. Check Railway logs: `railway logs`
2. Verify environment variables are set correctly
3. Test OAuth flow manually
4. Check Google Cloud Console for API quotas

---

**Note**: This setup enables true multi-user Google Sheets integration where each user maintains their own private spreadsheet with their contacts and enriched data.
