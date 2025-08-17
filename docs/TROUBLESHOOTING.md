# Rhiz Troubleshooting Guide

## Quick Diagnosis

### Bot Not Responding

**Symptoms:**
- Bot doesn't respond to messages
- Webhook errors in logs
- 404 errors when accessing bot

**Quick Fixes:**
1. Check if Railway app is running
2. Verify webhook is set correctly
3. Check bot token is valid

### Voice Processing Issues

**Symptoms:**
- Voice messages fail to process
- Transcription errors
- Audio conversion failures

**Quick Fixes:**
1. Check OpenAI API quota
2. Verify FFmpeg installation
3. Test Whisper API directly

## Common Issues and Solutions

### 1. Bot Not Responding

#### Problem: Bot doesn't respond to messages

**Diagnosis Steps:**
1. Check webhook status:
   ```bash
   curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo
   ```

2. Verify Railway app is running:
   ```bash
   railway status
   railway logs
   ```

3. Test webhook endpoint:
   ```bash
   curl -X POST https://your-app.railway.app/webhook/bot:token \
     -H "Content-Type: application/json" \
     -d '{"update_id": 1, "message": {"text": "test"}}'
   ```

**Solutions:**

**A. Webhook not set**
```bash
# Set webhook
curl -F "url=https://your-app.railway.app/webhook" \
     https://api.telegram.org/bot<TOKEN>/setWebhook
```

**B. Railway app down**
```bash
# Restart app
railway up

# Check environment variables
railway variables list
```

**C. Invalid bot token**
- Verify token in `.env` file
- Check token with BotFather
- Regenerate token if needed

**D. SSL certificate issues**
- Ensure Railway app has valid SSL
- Check webhook URL uses HTTPS
- Verify domain is accessible

### 2. Voice Processing Failures

#### Problem: Voice messages fail to process

**Diagnosis Steps:**
1. Check OpenAI API status:
   ```bash
   curl -H "Authorization: Bearer $OPENAI_API_KEY" \
        https://api.openai.com/v1/models
   ```

2. Test audio conversion:
   ```bash
   ffmpeg -i input.ogg -acodec pcm_s16le -ar 16000 output.wav
   ```

3. Check temp directory permissions:
   ```bash
   ls -la /tmp/
   chmod 755 /tmp/
   ```

**Solutions:**

**A. OpenAI API quota exceeded**
- Check usage at platform.openai.com
- Upgrade plan or wait for reset
- Implement rate limiting

**B. Audio conversion failed**
```bash
# Install FFmpeg
# macOS
brew install ffmpeg

# Ubuntu
sudo apt update
sudo apt install ffmpeg

# Windows
# Download from https://ffmpeg.org/download.html
```

**C. Invalid audio format**
- Ensure audio is OGG OPUS format
- Check file size (max 50MB)
- Verify audio duration (max 60 seconds)

**D. Whisper API errors**
```bash
# Test Whisper directly
curl -X POST https://api.openai.com/v1/audio/transcriptions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -F "file=@test.wav" \
  -F "model=whisper-1"
```

### 3. Database Connection Issues

#### Problem: Cannot connect to Supabase

**Diagnosis Steps:**
1. Test connection string:
   ```bash
   curl -H "apikey: $SUPABASE_ANON_KEY" \
        "$SUPABASE_URL/rest/v1/users?select=*&limit=1"
   ```

2. Check IP whitelist:
   - Go to Supabase Dashboard
   - Settings > Database > Connection Pooling
   - Verify IP is not blocked

3. Test with Supabase client:
   ```javascript
   const { data, error } = await supabase.from('users').select('*');
   console.log('Error:', error);
   ```

**Solutions:**

**A. Invalid connection string**
- Verify SUPABASE_URL format
- Check anon key is correct
- Ensure service key is set

**B. IP whitelist restrictions**
- Add Railway IP to whitelist
- Use connection pooling
- Check RLS policies

**C. Database schema issues**
```sql
-- Check if tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';

-- Run migrations
-- Copy and run database/schema.sql
```

**D. RLS policies blocking access**
```sql
-- Disable RLS temporarily for testing
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE contacts DISABLE ROW LEVEL SECURITY;

-- Re-enable after fixing policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
```

### 4. Google Sheets Sync Issues

#### Problem: Data not syncing to Google Sheets

**Diagnosis Steps:**
1. Test service account permissions:
   ```bash
   curl -H "Authorization: Bearer $(gcloud auth print-access-token)" \
        https://sheets.googleapis.com/v4/spreadsheets
   ```

2. Check spreadsheet sharing:
   - Verify service account email has access
   - Check permissions (Editor required)
   - Ensure spreadsheet ID is correct

3. Test API directly:
   ```bash
   curl -H "Authorization: Bearer $GOOGLE_ACCESS_TOKEN" \
        "https://sheets.googleapis.com/v4/spreadsheets/$SPREADSHEET_ID"
   ```

**Solutions:**

**A. Service account not shared**
- Share spreadsheet with service account email
- Grant Editor permissions
- Check sharing settings

**B. Invalid credentials**
```bash
# Regenerate service account key
# Download new JSON file
# Update environment variables
```

**C. API not enabled**
- Enable Google Sheets API
- Enable Google Drive API
- Check API quotas

**D. Spreadsheet ID incorrect**
- Extract ID from URL
- Format: `https://docs.google.com/spreadsheets/d/[ID]/edit`
- Verify ID matches environment variable

### 5. Memory and Performance Issues

#### Problem: App crashes or runs slowly

**Diagnosis Steps:**
1. Check Railway logs:
   ```bash
   railway logs --tail
   ```

2. Monitor memory usage:
   ```bash
   railway logs | grep "Memory"
   ```

3. Check API response times:
   ```bash
   time curl https://your-app.railway.app/health
   ```

**Solutions:**

**A. Memory leaks**
- Implement proper error handling
- Close database connections
- Use streaming for large files

**B. Slow API responses**
- Add caching layer
- Optimize database queries
- Use connection pooling

**C. Railway plan limits**
- Upgrade to Pro plan
- Optimize resource usage
- Implement rate limiting

### 6. Environment Variable Issues

#### Problem: App can't read environment variables

**Diagnosis Steps:**
1. Check Railway variables:
   ```bash
   railway variables list
   ```

2. Test locally:
   ```bash
   node -e "console.log(process.env.TELEGRAM_BOT_TOKEN)"
   ```

3. Verify .env file:
   ```bash
   cat .env | grep -v "^#" | grep -v "^$"
   ```

**Solutions:**

**A. Missing variables**
```bash
# Add missing variables
railway variables set TELEGRAM_BOT_TOKEN=xxx
railway variables set OPENAI_API_KEY=xxx
# ... add all required variables
```

**B. Invalid format**
- Remove quotes around values
- Use correct line endings
- Check for extra spaces

**C. Variable not loaded**
```javascript
// Ensure dotenv is loaded early
import dotenv from 'dotenv';
dotenv.config();
```

## Error Codes Reference

### Telegram API Errors

| Code | Description | Solution |
|------|-------------|----------|
| `400` | Bad Request | Check request format |
| `401` | Unauthorized | Verify bot token |
| `403` | Forbidden | Check bot permissions |
| `404` | Not Found | Verify chat/user exists |
| `429` | Too Many Requests | Implement rate limiting |

### OpenAI API Errors

| Code | Description | Solution |
|------|-------------|----------|
| `401` | Invalid API Key | Check API key |
| `429` | Rate Limit Exceeded | Wait or upgrade plan |
| `500` | Server Error | Retry with exponential backoff |
| `503` | Service Unavailable | Check OpenAI status |

### Supabase Errors

| Code | Description | Solution |
|------|-------------|----------|
| `PGRST116` | JWT Expired | Refresh token |
| `PGRST301` | Row Level Security | Check RLS policies |
| `PGRST302` | Invalid JWT | Verify JWT format |
| `PGRST303` | JWT Verification Failed | Check signing key |

### Google Sheets API Errors

| Code | Description | Solution |
|------|-------------|----------|
| `400` | Bad Request | Check request format |
| `401` | Unauthorized | Verify credentials |
| `403` | Forbidden | Check permissions |
| `404` | Not Found | Verify spreadsheet ID |
| `429` | Quota Exceeded | Check API quotas |

## Debug Mode

Enable debug logging for detailed troubleshooting:

### Environment Setup

```bash
# Add to .env
LOG_LEVEL=debug
DEBUG=true
NODE_ENV=development
```

### Code Implementation

```typescript
// In your application
import logger from './utils/logger';

logger.debug('Processing voice message', {
  userId,
  fileId: voice.file_id,
  duration: voice.duration,
  timestamp: new Date().toISOString()
});

// Add request logging middleware
app.use((req, res, next) => {
  logger.debug(`${req.method} ${req.path}`, {
    headers: req.headers,
    body: req.body,
    timestamp: new Date().toISOString()
  });
  next();
});
```

### Railway Debug

```bash
# View detailed logs
railway logs --tail --debug

# Check app status
railway status

# View environment
railway variables list
```

## Performance Monitoring

### Key Metrics to Monitor

1. **Response Time**
   - Webhook processing time
   - Voice transcription time
   - Database query time

2. **Error Rates**
   - API error percentage
   - Failed webhook percentage
   - Database connection errors

3. **Resource Usage**
   - Memory consumption
   - CPU usage
   - Database connections

4. **User Activity**
   - Active users per day
   - Voice messages processed
   - Contacts created

### Monitoring Setup

```typescript
// Add monitoring middleware
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('Request completed', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration,
      timestamp: new Date().toISOString()
    });
  });
  
  next();
});
```

## Getting Help

### Self-Service Resources

1. **Documentation**
   - [Setup Guide](./SETUP.md)
   - [API Documentation](./API.md)
   - [Deployment Guide](./DEPLOYMENT.md)

2. **Community**
   - [Discord Server](https://discord.gg/rhiz)
   - [GitHub Issues](https://github.com/yourusername/rhiz-mvp/issues)
   - [GitHub Discussions](https://github.com/yourusername/rhiz-mvp/discussions)

3. **External Resources**
   - [Telegram Bot API Docs](https://core.telegram.org/bots/api)
   - [OpenAI API Docs](https://platform.openai.com/docs)
   - [Supabase Docs](https://supabase.com/docs)
   - [Railway Docs](https://docs.railway.app)

### Contact Support

**Before contacting support, please:**

1. Check this troubleshooting guide
2. Search existing issues on GitHub
3. Try the debug mode
4. Collect relevant logs and error messages

**When contacting support, include:**

- Error message and stack trace
- Steps to reproduce the issue
- Environment details (OS, Node version, etc.)
- Relevant logs
- Screenshots if applicable

**Support Channels:**

- **Email**: support@rhiz.ai
- **Discord**: #support channel
- **GitHub**: Create an issue with "bug" label

### Escalation Process

1. **Level 1**: Self-service (documentation, community)
2. **Level 2**: Community support (Discord, GitHub)
3. **Level 3**: Email support (response within 24 hours)
4. **Level 4**: Priority support (for paid plans)

## Prevention Best Practices

### Regular Maintenance

1. **Monitor logs daily**
2. **Check API quotas weekly**
3. **Update dependencies monthly**
4. **Review security settings quarterly**

### Proactive Measures

1. **Implement health checks**
2. **Set up alerting**
3. **Use monitoring tools**
4. **Regular backups**
5. **Security audits**

### Documentation

1. **Keep setup docs updated**
2. **Document custom configurations**
3. **Maintain runbooks**
4. **Update troubleshooting guide**
