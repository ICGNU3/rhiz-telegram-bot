# Rhiz Setup Guide

## Prerequisites

- Node.js 18+
- Supabase account
- OpenAI API access (GPT-4 enabled)
- ElevenLabs account
- Google Cloud Console access
- Telegram account

## Quick Setup

### 1. Get API Keys

#### Telegram Bot
1. Message [@BotFather](https://t.me/botfather) on Telegram
2. Send `/newbot`
3. Name: "Rhiz Relationship Intelligence"
4. Username: "your_unique_bot_name_bot"
5. Copy the bot token

#### OpenAI
1. Go to [platform.openai.com](https://platform.openai.com)
2. Create API key
3. Ensure you have GPT-4 access and billing set up

#### ElevenLabs
1. Sign up at [elevenlabs.io](https://elevenlabs.io)
2. Go to Profile → API Keys
3. Generate new API key

#### Google OAuth
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create project
3. Enable Google Sheets API and Google Drive API
4. Create OAuth 2.0 credentials (Web application)
5. Add redirect URI: `https://your-domain.com/auth/google/callback`

#### Supabase
1. Create project at [supabase.com](https://supabase.com)
2. Go to Settings → API
3. Copy your URL and keys

### 2. Setup Environment

1. Copy `.env.example` to `.env`
2. Fill in all your API keys

### 3. Setup Database

1. Go to your Supabase project
2. Open SQL Editor
3. Copy and run the complete `database/schema.sql`

### 4. Install and Run

```bash
npm install
npm run dev
```
