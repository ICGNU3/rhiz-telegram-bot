# Rhiz Setup Guide

## Quick Start (5 minutes)

### Prerequisites

- Node.js 18+ and npm
- Telegram account
- OpenAI API key
- ElevenLabs API key
- Supabase account
- Google Cloud service account
- Railway account (for deployment)

### Step-by-Step Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/rhiz-mvp.git
   cd rhiz-mvp
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   nano .env
   ```

4. **Configure your API keys**
   - Get Telegram bot token from @BotFather
   - Get OpenAI API key from platform.openai.com
   - Get ElevenLabs API key from elevenlabs.io
   - Set up Supabase project and get credentials
   - Create Google Cloud service account

5. **Run database migrations**
   ```bash
   npm run db:migrate
   ```

6. **Start development server**
   ```bash
   npm run dev
   ```

## Detailed Setup Instructions

### 1. Telegram Bot Setup

1. Open Telegram and search for @BotFather
2. Send `/newbot` command
3. Choose a name for your bot (e.g., "Rhiz Relationship Manager")
4. Choose a username (must end in 'bot', e.g., "rhiz_relationship_bot")
5. Copy the bot token to your `.env` file
6. Send `/setprivacy` and choose "Disable" for group privacy
7. Send `/setcommands` with the following:
   ```
   start - Initialize the bot
   help - Show help message
   contacts - List all contacts
   goals - Show active goals
   introductions - View suggested introductions
   reminders - Check upcoming reminders
   export - Export to Google Sheets
   settings - Manage bot settings
   ```

### 2. OpenAI Setup

1. Go to [platform.openai.com](https://platform.openai.com)
2. Create an account or sign in
3. Go to API Keys section
4. Create a new API key
5. Copy the key to your `.env` file
6. Ensure you have access to:
   - GPT-4 API
   - Whisper API
   - Embeddings API

### 3. ElevenLabs Setup

1. Sign up at [elevenlabs.io](https://elevenlabs.io)
2. Go to your profile settings
3. Copy your API key
4. Go to Voice Library
5. Choose or clone a voice
6. Copy the voice ID to your `.env` file

### 4. Supabase Setup

1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Go to Settings > API
4. Copy your project URL and anon key
5. Go to Settings > API > Service Role
6. Copy your service role key
7. Go to SQL Editor
8. Run the schema from `database/schema.sql`
9. Enable Row Level Security (RLS) for all tables

### 5. Google Cloud Setup

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project
3. Enable Google Sheets API
4. Go to IAM & Admin > Service Accounts
5. Create a new service account
6. Download the JSON credentials
7. Share your Google Sheet with the service account email
8. Extract the client email and private key to your `.env` file

### 6. Railway Deployment

1. Install Railway CLI:
   ```bash
   npm install -g @railway/cli
   ```

2. Login to Railway:
   ```bash
   railway login
   ```

3. Create new project:
   ```bash
   railway init
   ```

4. Add environment variables:
   ```bash
   railway variables set TELEGRAM_BOT_TOKEN=xxx
   railway variables set OPENAI_API_KEY=xxx
   railway variables set ELEVENLABS_API_KEY=xxx
   railway variables set SUPABASE_URL=xxx
   railway variables set SUPABASE_ANON_KEY=xxx
   railway variables set SUPABASE_SERVICE_KEY=xxx
   railway variables set GOOGLE_SHEETS_CLIENT_EMAIL=xxx
   railway variables set GOOGLE_SHEETS_PRIVATE_KEY=xxx
   ```

5. Deploy:
   ```bash
   railway up
   ```

6. Set webhook:
   ```bash
   curl -F "url=https://your-app.railway.app/webhook" \
        https://api.telegram.org/bot<TOKEN>/setWebhook
   ```

## Environment Variables

Create a `.env` file with the following variables:

```bash
# Node Environment
NODE_ENV=development
PORT=3000

# Telegram Bot
TELEGRAM_BOT_TOKEN=6234567890:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_WEBHOOK_URL=https://your-app.railway.app/webhook

# OpenAI
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxx

# ElevenLabs
ELEVENLABS_API_KEY=xxxxxxxxxxxx
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM

# Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Google Sheets
GOOGLE_SHEETS_CLIENT_EMAIL=rhiz-bot@project.iam.gserviceaccount.com
GOOGLE_SHEETS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"

# Optional: Monitoring
SENTRY_DSN=https://xxxxx@xxxxx.ingest.sentry.io/xxxxx
POSTHOG_API_KEY=phc_xxxxxxxxxxxx
```

## Verification Steps

After setup, verify everything is working:

1. **Test bot connection**:
   ```bash
   curl https://api.telegram.org/bot<TOKEN>/getMe
   ```

2. **Test database connection**:
   ```bash
   npm run db:test
   ```

3. **Test OpenAI API**:
   ```bash
   curl -H "Authorization: Bearer $OPENAI_API_KEY" \
        https://api.openai.com/v1/models
   ```

4. **Test ElevenLabs API**:
   ```bash
   curl -H "xi-api-key: $ELEVENLABS_API_KEY" \
        https://api.elevenlabs.io/v1/voices
   ```

5. **Test Google Sheets API**:
   ```bash
   curl -H "Authorization: Bearer $(gcloud auth print-access-token)" \
        https://sheets.googleapis.com/v4/spreadsheets
   ```

## Troubleshooting

### Common Issues

**Bot not responding**:
- Check webhook is set correctly
- Verify Railway app is running
- Check logs for errors

**Voice processing failures**:
- Check OpenAI API quota
- Verify audio file conversion
- Test Whisper API directly

**Database connection issues**:
- Verify connection string
- Check IP whitelist settings
- Test with Supabase client

**Google Sheets sync issues**:
- Verify service account permissions
- Check spreadsheet ID is correct
- Ensure sheet is shared with service account

### Getting Help

- Check the [Troubleshooting Guide](../docs/TROUBLESHOOTING.md)
- Join our [Discord Community](https://discord.gg/rhiz)
- Open an issue on [GitHub](https://github.com/yourusername/rhiz-mvp/issues)
- Email support at support@rhiz.ai
