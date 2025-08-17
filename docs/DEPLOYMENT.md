# Rhiz Deployment Guide

## Railway Deployment

### Prerequisites

- Railway account
- All API keys configured
- Database schema ready

### Step-by-Step Deployment

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
   railway variables set ELEVENLABS_API_KEY=xxx
   railway variables set SUPABASE_URL=xxx
   railway variables set SUPABASE_ANON_KEY=xxx
   railway variables set SUPABASE_SERVICE_KEY=xxx
   railway variables set GOOGLE_SHEETS_CLIENT_EMAIL=xxx
   railway variables set GOOGLE_SHEETS_PRIVATE_KEY=xxx
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
- [ ] Error monitoring enabled
- [ ] Analytics configured
- [ ] Backup strategy in place
- [ ] Rate limiting configured
- [ ] Security headers enabled

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NODE_ENV` | Environment mode | Yes |
| `PORT` | Server port | Yes |
| `TELEGRAM_BOT_TOKEN` | Bot authentication token | Yes |
| `TELEGRAM_WEBHOOK_URL` | Public webhook URL | Yes |
| `OPENAI_API_KEY` | OpenAI API key | Yes |
| `ELEVENLABS_API_KEY` | ElevenLabs API key | Yes |
| `SUPABASE_URL` | Supabase project URL | Yes |
| `SUPABASE_ANON_KEY` | Supabase anonymous key | Yes |
| `SUPABASE_SERVICE_KEY` | Supabase service key | Yes |
| `GOOGLE_SHEETS_CLIENT_EMAIL` | Service account email | Yes |
| `GOOGLE_SHEETS_PRIVATE_KEY` | Service account private key | Yes |

## Useful Commands

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
```
