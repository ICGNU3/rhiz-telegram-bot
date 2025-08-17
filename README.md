# Rhiz MVP - Complete Documentation

## Table of Contents
1. [Project Overview](#project-overview)
2. [Quick Start Guide](#quick-start-guide)
3. [Installation & Setup](#installation--setup)
4. [Architecture Overview](#architecture-overview)
5. [API Documentation](#api-documentation)
6. [Voice Processing Guide](#voice-processing-guide)
7. [Bot Commands Reference](#bot-commands-reference)
8. [Database Schema](#database-schema)
9. [Google Sheets Integration](#google-sheets-integration)
10. [Deployment Guide](#deployment-guide)
11. [Testing Guide](#testing-guide)
12. [Troubleshooting](#troubleshooting)
13. [Security Best Practices](#security-best-practices)
14. [Scaling Considerations](#scaling-considerations)

---

## Project Overview

### What is Rhiz?

Rhiz is an AI-powered relationship intelligence platform delivered through a voice-first Telegram bot. It helps professionals manage their network, track relationships, and discover valuable connections through natural voice interactions.

### Key Features

- **Voice-First Interface**: Natural conversation with AI through voice messages
- **Smart Contact Management**: Automatic extraction of contact details from voice notes
- **Relationship Intelligence**: AI-powered relationship scoring and insights
- **Introduction Engine**: Discovers and suggests valuable introductions
- **Google Sheets Sync**: Real-time synchronization with Google Sheets
- **Follow-up Reminders**: Automated reminders for relationship maintenance

### Technology Stack

- **Runtime**: Node.js 18+ with TypeScript
- **Database**: Supabase (PostgreSQL)
- **AI/ML**: OpenAI GPT-4, Whisper, text-embedding-3
- **Voice**: ElevenLabs TTS, OpenAI Whisper STT
- **Messaging**: Telegram Bot API
- **Hosting**: Railway.app
- **Integrations**: Google Sheets API

---

## Quick Start Guide

### Prerequisites

- Node.js 18+ and npm
- Telegram account
- OpenAI API key
- ElevenLabs API key
- Supabase account
- Google Cloud service account
- Railway account (for deployment)

### 5-Minute Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/rhiz-mvp.git
cd rhiz-mvp

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Edit .env with your API keys
nano .env

# Run database migrations
npm run db:migrate

# Start development server
npm run dev
```

### Create Your Telegram Bot

1. Open Telegram and search for @BotFather
2. Send `/newbot` and follow prompts
3. Copy your bot token to `.env`
4. Send `/setprivacy` and choose "Disable" for group privacy

---

## Installation & Setup

### Step 1: Environment Setup

Create a `.env` file with all required variables:

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
```

### Step 2: Supabase Setup

1. Create a new Supabase project
2. Go to SQL Editor and run the schema from `database/schema.sql`
3. Copy your project URL and keys to `.env`
4. Enable Row Level Security (RLS) for all tables

### Step 3: Google Sheets Setup

1. Create a Google Cloud project
2. Enable Google Sheets API
3. Create a service account
4. Download JSON credentials
5. Share your Google Sheet with the service account email

### Step 4: OpenAI Setup

1. Get API key from [platform.openai.com](https://platform.openai.com)
2. Ensure you have access to:
   - GPT-4 API
   - Whisper API
   - Embeddings API

### Step 5: ElevenLabs Setup

1. Sign up at [elevenlabs.io](https://elevenlabs.io)
2. Get your API key from profile settings
3. Choose or clone a voice (get voice ID)

---

## Architecture Overview

### System Design

```
┌─────────────────────────────────────────────────────────┐
│                    User Interface                        │
├─────────────────────────────────────────────────────────┤
│  Telegram Bot │ Voice Messages │ Google Sheets View     │
└─────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────┐
│                   Processing Layer                       │
├─────────────────────────────────────────────────────────┤
│  Webhook Handler │ Speech-to-Text │ Text-to-Speech      │
│                  │    (Whisper)    │  (ElevenLabs)      │
└─────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────┐
│                  Intelligence Layer                      │
├─────────────────────────────────────────────────────────┤
│  GPT-4 Analysis │ Intent Detection │ Embedding Search   │
│  Relationship Scoring │ Introduction Engine             │
└─────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────┐
│                     Data Layer                          │
├─────────────────────────────────────────────────────────┤
│  Supabase PostgreSQL │ Google Sheets API │ File Storage│
└─────────────────────────────────────────────────────────┘
```

### Request Flow

1. **User sends voice message** → Telegram Bot API
2. **Webhook receives update** → Express server
3. **Download audio file** → Telegram file API
4. **Convert OGG to WAV** → FFmpeg
5. **Transcribe audio** → OpenAI Whisper
6. **Detect intent** → GPT-4 analysis
7. **Process business logic** → Service layer
8. **Update database** → Supabase
9. **Sync to Google Sheets** → Sheets API
10. **Generate response** → GPT-4
11. **Convert to speech** → ElevenLabs
12. **Send voice response** → Telegram Bot API

---

## API Documentation

### Internal Service APIs

#### Contact Service

```typescript
// Add contact from voice transcript
contactService.addFromTranscript(userId: string, transcript: string): Promise<Contact>

// Search contacts
contactService.searchFromTranscript(userId: string, transcript: string): Promise<Contact[]>

// Update relationship score
contactService.updateRelationshipScore(contactId: string): Promise<void>

// Find similar contacts
contactService.findSimilar(contactId: string, limit?: number): Promise<Contact[]>
```

#### Relationship Service

```typescript
// Create goal from transcript
relationshipService.createGoalFromTranscript(userId: string, transcript: string): Promise<Goal>

// Calculate relationship score
relationshipService.calculateScore(contact: Contact, interactions: Interaction[]): Promise<number>

// Get relationship insights
relationshipService.getInsights(contactId: string): Promise<RelationshipInsight>
```

#### Introduction Service

```typescript
// Suggest introductions based on goals
introductionService.suggestFromGoals(userId: string): Promise<Introduction[]>

// Generate introduction message
introductionService.generateMessage(fromId: string, toId: string): Promise<string>

// Mark introduction as sent
introductionService.markSent(introId: string): Promise<void>
```

### REST API Endpoints

```typescript
// Webhook endpoint for Telegram
POST /webhook/bot:token
Body: Telegram Update object

// Health check
GET /health
Response: { status: 'ok', timestamp: Date }

// Manual sync trigger
POST /api/sync/:userId
Response: { synced: true, contacts: number }
```

---

## Voice Processing Guide

### Audio Pipeline

1. **Input Format**: Telegram OGG OPUS audio
2. **Conversion**: OGG → WAV (16kHz, mono)
3. **Transcription**: Whisper API
4. **Processing Time**: 3-5 seconds average

### Voice Commands

#### Adding Contacts
```
"I just met Sarah Chen, she's the CTO at TechStart and we discussed potential partnership opportunities"
```

#### Finding Contacts
```
"Tell me about David from the conference"
"Who do I know at Google?"
```

#### Setting Goals
```
"My goal is to raise a seed round by Q2"
"I'm looking for a technical co-founder"
```

#### Requesting Introductions
```
"Who can introduce me to investors?"
"I need to meet someone in enterprise sales"
```

### Voice Response Generation

The bot uses GPT-4 with a specific personality:
- Warm and professional tone
- Concise (2-3 sentences max)
- Proactive with suggestions
- Natural conversational style

---

## Bot Commands Reference

### User Commands

| Command | Description | Example |
|---------|-------------|---------|
| `/start` | Initialize bot and create user | `/start` |
| `/help` | Show help message | `/help` |
| `/contacts` | List all contacts | `/contacts` |
| `/goals` | Show active goals | `/goals` |
| `/introductions` | View suggested introductions | `/introductions` |
| `/reminders` | Check upcoming reminders | `/reminders` |
| `/export` | Export to Google Sheets | `/export` |
| `/settings` | Manage bot settings | `/settings` |

### Admin Commands

| Command | Description | Example |
|---------|-------------|---------|
| `/stats` | Show usage statistics | `/stats` |
| `/broadcast` | Send message to all users | `/broadcast Hello everyone!` |
| `/user` | View user details | `/user 123456789` |

### Voice Command Patterns

| Intent | Trigger Phrases | Example |
|--------|----------------|---------|
| ADD_CONTACT | "met someone", "just met", "new contact" | "I met John at the conference" |
| FIND_CONTACT | "who is", "tell me about", "find" | "Who is Sarah Chen?" |
| SET_GOAL | "my goal", "I want to", "trying to" | "My goal is to hire 5 engineers" |
| REQUEST_INTRO | "introduce me", "connect me with" | "Can you introduce me to investors?" |
| SET_REMINDER | "remind me", "follow up" | "Remind me to call David tomorrow" |

---

## Database Schema

### Core Tables

#### users
- `id`: UUID (Primary Key)
- `telegram_id`: BIGINT (Unique)
- `telegram_username`: TEXT
- `root_member`: BOOLEAN
- `settings`: JSONB
- `created_at`: TIMESTAMPTZ

#### contacts
- `id`: UUID (Primary Key)
- `user_id`: UUID (Foreign Key)
- `name`: TEXT (Required)
- `company`: TEXT
- `title`: TEXT
- `email`: TEXT
- `phone`: TEXT
- `relationship_score`: INTEGER (0-100)
- `trust_level`: ENUM
- `voice_notes`: TEXT[]
- `metadata`: JSONB

#### goals
- `id`: UUID (Primary Key)
- `user_id`: UUID (Foreign Key)
- `description`: TEXT
- `type`: ENUM
- `status`: ENUM
- `progress`: INTEGER (0-100)
- `target_date`: DATE

#### introductions
- `id`: UUID (Primary Key)
- `from_contact_id`: UUID (Foreign Key)
- `to_contact_id`: UUID (Foreign Key)
- `reason`: TEXT
- `suggested_message`: TEXT
- `status`: ENUM

### Indexes

```sql
-- Performance indexes
CREATE INDEX idx_contacts_user_id ON contacts(user_id);
CREATE INDEX idx_contacts_relationship_score ON contacts(relationship_score DESC);
CREATE INDEX idx_goals_user_status ON goals(user_id, status);
CREATE INDEX idx_introductions_user_status ON introductions(user_id, status);
```

---

## Google Sheets Integration

### Setup

1. Create a Google Sheet with these columns:
   - Name
   - Company
   - Title
   - Email
   - Phone
   - Relationship Score
   - Last Interaction
   - Notes

2. Share the sheet with your service account email

3. Get the spreadsheet ID from the URL:
   ```
   https://docs.google.com/spreadsheets/d/[SPREADSHEET_ID]/edit
   ```

### Sync Features

- **Real-time sync**: Updates within 5 seconds
- **Bidirectional**: Changes in Sheets reflect in bot
- **Batch updates**: Efficient bulk operations
- **Error recovery**: Automatic retry on failures

### Code Example

```typescript
async function syncToGoogleSheets(userId: string, contacts: Contact[]) {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: config.google.clientEmail,
      private_key: config.google.privateKey,
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  
  const values = contacts.map(c => [
    c.name,
    c.company,
    c.title,
    c.email,
    c.phone,
    c.relationship_score,
    c.last_interaction,
    c.notes
  ]);

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: 'A2:H',
    valueInputOption: 'RAW',
    requestBody: { values },
  });
}
```

---

## Deployment Guide

### Railway Deployment

1. **Install Railway CLI**
   ```bash
   npm install -g @railway/cli
   ```

2. **Login to Railway**
   ```bash
   railway login
   ```

3. **Create new project**
   ```bash
   railway init
   ```

4. **Add environment variables**
   ```bash
   railway variables set TELEGRAM_BOT_TOKEN=xxx
   railway variables set OPENAI_API_KEY=xxx
   # Add all other variables
   ```

5. **Deploy**
   ```bash
   railway up
   ```

6. **Set webhook**
   ```bash
   curl -F "url=https://your-app.railway.app/webhook" \
        https://api.telegram.org/bot<TOKEN>/setWebhook
   ```

### Production Checklist

- [ ] All environment variables set
- [ ] Database migrations run
- [ ] SSL certificate valid
- [ ] Webhook URL configured
- [ ] Error monitoring enabled (Sentry)
- [ ] Analytics configured (PostHog)
- [ ] Backup strategy in place
- [ ] Rate limiting configured
- [ ] Security headers enabled

---

## Testing Guide

### Unit Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

### Test Structure

```typescript
describe('ContactService', () => {
  it('should extract contact from transcript', async () => {
    const transcript = "I met John Doe at TechCorp";
    const contact = await contactService.addFromTranscript('user123', transcript);
    
    expect(contact.name).toBe('John Doe');
    expect(contact.company).toBe('TechCorp');
  });
});
```

### Integration Tests

```typescript
describe('Voice Processing Pipeline', () => {
  it('should process voice message end-to-end', async () => {
    const audioBuffer = fs.readFileSync('test-audio.ogg');
    const result = await voiceProcessor.processVoiceMessage(audioBuffer, 'user123');
    
    expect(result.transcript).toBeDefined();
    expect(result.intent).toBeDefined();
    expect(result.audioResponse).toBeInstanceOf(Buffer);
  });
});
```

### Manual Testing

1. **Test voice commands**
   - Send various voice messages
   - Test different accents/speeds
   - Verify transcription accuracy

2. **Test bot commands**
   - Run through all slash commands
   - Test with/without data
   - Verify error handling

3. **Test integrations**
   - Google Sheets sync
   - Contact import
   - Introduction suggestions

---

## Troubleshooting

### Common Issues

#### Bot Not Responding

**Problem**: Bot doesn't respond to messages

**Solutions**:
1. Check webhook is set correctly:
   ```bash
   curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo
   ```
2. Verify Railway app is running
3. Check logs for errors:
   ```bash
   railway logs
   ```

#### Voice Processing Failures

**Problem**: Voice messages fail to process

**Solutions**:
1. Check OpenAI API quota
2. Verify audio file conversion:
   ```bash
   ffmpeg -i input.ogg -acodec pcm_s16le -ar 16000 output.wav
   ```
3. Test Whisper API directly
4. Check temp directory permissions

#### Database Connection Issues

**Problem**: Cannot connect to Supabase

**Solutions**:
1. Verify connection string
2. Check IP whitelist settings
3. Test with Supabase client:
   ```javascript
   const { data, error } = await supabase.from('users').select('*');
   ```

#### Google Sheets Sync Issues

**Problem**: Data not syncing to Google Sheets

**Solutions**:
1. Verify service account permissions
2. Check spreadsheet ID is correct
3. Ensure sheet is shared with service account
4. Review API quotas

### Error Codes

| Code | Description | Solution |
|------|-------------|----------|
| `TELEGRAM_API_ERROR` | Telegram API request failed | Check bot token and permissions |
| `OPENAI_QUOTA_EXCEEDED` | OpenAI API limit reached | Upgrade plan or wait for reset |
| `AUDIO_CONVERSION_FAILED` | FFmpeg conversion error | Check FFmpeg installation |
| `DB_CONNECTION_FAILED` | Cannot connect to database | Verify connection string |
| `SHEETS_API_ERROR` | Google Sheets API error | Check credentials and permissions |

### Debug Mode

Enable debug logging:

```typescript
// In .env
LOG_LEVEL=debug

// In code
logger.debug('Processing voice message', {
  userId,
  fileId: voice.file_id,
  duration: voice.duration
});
```

---

## Security Best Practices

### API Key Management

1. **Never commit `.env` files**
2. **Use environment variables in production**
3. **Rotate keys regularly**
4. **Use separate keys for dev/staging/prod**

### Data Protection

1. **Enable RLS on all Supabase tables**
2. **Encrypt sensitive data at rest**
3. **Use HTTPS for all connections**
4. **Implement rate limiting**

### Bot Security

```typescript
// Rate limiting middleware
const rateLimiter = new Map();

function rateLimit(userId: string): boolean {
  const now = Date.now();
  const userLimits = rateLimiter.get(userId) || [];
  
  // Remove old entries (older than 1 minute)
  const recentRequests = userLimits.filter((t: number) => now - t < 60000);
  
  if (recentRequests.length >= 20) {
    return false; // Rate limit exceeded
  }
  
  recentRequests.push(now);
  rateLimiter.set(userId, recentRequests);
  return true;
}
```

### Input Validation

```typescript
// Validate and sanitize user input
function validateTranscript(transcript: string): string {
  // Remove potential SQL injection attempts
  let clean = transcript.replace(/['";\\]/g, '');
  
  // Limit length
  if (clean.length > 1000) {
    clean = clean.substring(0, 1000);
  }
  
  return clean;
}
```

---

## Scaling Considerations

### Performance Optimization

#### Database
- Add connection pooling
- Implement query caching
- Use database indexes effectively
- Consider read replicas for scaling

#### Voice Processing
- Queue long-running tasks
- Implement audio file caching
- Use CDN for voice responses
- Consider batch processing

#### Code Optimization
```typescript
// Use batch operations
async function batchUpdateContacts(contacts: Contact[]) {
  const batchSize = 100;
  for (let i = 0; i < contacts.length; i += batchSize) {
    const batch = contacts.slice(i, i + batchSize);
    await supabase.from('contacts').upsert(batch);
  }
}
```

### Scaling Strategy

#### Phase 1: 0-150 Users (Root Alpha)
- Single Railway instance
- Basic monitoring
- Manual support

#### Phase 2: 150-1,000 Users
- Add Redis caching
- Implement job queue
- Enhanced monitoring
- Semi-automated support

#### Phase 3: 1,000-10,000 Users
- Multiple server instances
- Load balancing
- Database replication
- Dedicated support team

#### Phase 4: 10,000+ Users
- Microservices architecture
- Kubernetes deployment
- Global CDN
- 24/7 support

### Cost Projections

| Users | Monthly Cost | Per User |
|-------|-------------|----------|
| 150 | $50 | $0.33 |
| 1,000 | $200 | $0.20 |
| 10,000 | $1,500 | $0.15 |
| 100,000 | $10,000 | $0.10 |

---

## Appendix

### Useful Commands

```bash
# Check bot status
curl https://api.telegram.org/bot<TOKEN>/getMe

# Set webhook
curl -F "url=https://your-app.railway.app/webhook" \
     https://api.telegram.org/bot<TOKEN>/setWebhook

# Get webhook info
curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo

# Delete webhook
curl https://api.telegram.org/bot<TOKEN>/deleteWebhook

# Test database connection
npm run db:test

# Run migrations
npm run db:migrate

# Generate types from database
npm run db:types
```

### Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `production` |
| `PORT` | Server port | `3000` |
| `TELEGRAM_BOT_TOKEN` | Bot authentication token | `123456:ABC-DEF...` |
| `TELEGRAM_WEBHOOK_URL` | Public webhook URL | `https://app.railway.app/webhook` |
| `OPENAI_API_KEY` | OpenAI API key | `sk-proj-...` |
| `ELEVENLABS_API_KEY` | ElevenLabs API key | `xi-...` |
| `ELEVENLABS_VOICE_ID` | Voice ID for TTS | `21m00Tcm4TlvDq8ikWAM` |
| `SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase anonymous key | `eyJ...` |
| `SUPABASE_SERVICE_KEY` | Supabase service key | `eyJ...` |
| `GOOGLE_SHEETS_CLIENT_EMAIL` | Service account email | `bot@project.iam.gserviceaccount.com` |
| `GOOGLE_SHEETS_PRIVATE_KEY` | Service account private key | `-----BEGIN PRIVATE KEY-----...` |

### Resources

- [Telegram Bot API Documentation](https://core.telegram.org/bots/api)
- [OpenAI API Documentation](https://platform.openai.com/docs)
- [ElevenLabs API Documentation](https://docs.elevenlabs.io)
- [Supabase Documentation](https://supabase.com/docs)
- [Google Sheets API Documentation](https://developers.google.com/sheets/api)
- [Railway Documentation](https://docs.railway.app)

### Support

- **GitHub Issues**: Report bugs and request features
- **Discord Community**: Join for real-time help
- **Email Support**: support@rhiz.ai
- **Documentation**: docs.rhiz.ai

---

## License

MIT License - See LICENSE file for details

## Contributing

See CONTRIBUTING.md for guidelines

## Changelog

See CHANGELOG.md for version history

---

*Last updated: August 2025*
*Version: 1.0.0*
