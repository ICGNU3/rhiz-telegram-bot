# 🚀 Rhiz Bot - Final Setup Checklist

## ✅ **Current Status: PARTIALLY CONFIGURED**

**Live URL**: https://rhiz.up.railway.app  
**Health Check**: ✅ Working  
**Deployment**: ✅ Successfully deployed to Railway  

## 🚨 **CRITICAL: Environment Variables Need Real API Keys**

Your app is deployed but using "test" values for API keys. You need to replace these with real keys:

### **Current Variables (Need Real Values):**
```bash
TELEGRAM_BOT_TOKEN=test          # ❌ Need real bot token
OPENAI_API_KEY=test              # ❌ Need real OpenAI key
ELEVENLABS_API_KEY=test          # ❌ Need real ElevenLabs key
SUPABASE_URL=test                # ❌ Need real Supabase URL
SUPABASE_ANON_KEY=test           # ❌ Need real Supabase anon key
SUPABASE_SERVICE_KEY=test        # ❌ Need real Supabase service key
```

### **✅ Already Set Correctly:**
```bash
ADMIN_TELEGRAM_IDS=1185785193    # ✅ Your Telegram ID
TELEGRAM_WEBHOOK_URL=https://rhiz.up.railway.app/webhook  # ✅ Correct
OPENAI_MODEL=gpt-3.5-turbo       # ✅ Optimized model
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM  # ✅ Default voice
NODE_ENV=production              # ✅ Production environment
```

## 🔧 **Step-by-Step Setup Instructions**

### **1. Get Your API Keys**

**Telegram Bot Token:**
1. Message @BotFather on Telegram
2. Send `/newbot` (or use existing bot)
3. Choose name: "Rhiz Relationship Manager"
4. Choose username: "rhiz_relationship_bot" (or similar)
5. Copy the bot token

**OpenAI API Key:**
1. Go to https://platform.openai.com/api-keys
2. Create new API key
3. Copy the key (starts with `sk-`)

**ElevenLabs API Key:**
1. Go to https://elevenlabs.io/
2. Sign up/login
3. Go to profile settings
4. Copy your API key

**Supabase Credentials:**
1. Go to your Supabase project dashboard
2. Settings → API
3. Copy:
   - Project URL
   - anon/public key
   - service_role key

### **2. Set Real Environment Variables**

Run these commands with your real API keys:

```bash
# Replace the "test" values with real keys
railway variables --set "TELEGRAM_BOT_TOKEN=YOUR_REAL_BOT_TOKEN"
railway variables --set "OPENAI_API_KEY=YOUR_REAL_OPENAI_KEY"
railway variables --set "ELEVENLABS_API_KEY=YOUR_REAL_ELEVENLABS_KEY"
railway variables --set "SUPABASE_URL=YOUR_REAL_SUPABASE_URL"
railway variables --set "SUPABASE_ANON_KEY=YOUR_REAL_SUPABASE_ANON_KEY"
railway variables --set "SUPABASE_SERVICE_KEY=YOUR_REAL_SUPABASE_SERVICE_KEY"
```

### **3. Set Telegram Webhook**

After setting the bot token, configure the webhook:

```bash
# Replace YOUR_BOT_TOKEN with your actual bot token
curl -X POST "https://api.telegram.org/bot/YOUR_BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://rhiz.up.railway.app/webhook"}'
```

### **4. Verify Database Schema**

Make sure your Supabase database has the correct schema:

```bash
# Check if database is accessible
curl -X POST "https://YOUR_SUPABASE_URL/rest/v1/rpc/test_connection" \
  -H "apikey: YOUR_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer YOUR_SUPABASE_ANON_KEY"
```

## 🧪 **Testing Checklist**

Once you've set the real API keys:

### **1. Health Check**
```bash
curl https://rhiz.up.railway.app/health
```
**Expected**: `{"status":"ok","version":"1.0.0"}`

### **2. Bot Response Test**
1. Find your bot on Telegram
2. Send `/start`
3. **Expected**: Welcome message with instructions

### **3. Voice Message Test**
1. Send a voice message: "I just met John Smith, he's the CTO at TechCorp"
2. **Expected**: Bot extracts contact info and responds

### **4. Database Test**
1. Check if contact was saved in Supabase
2. **Expected**: New contact appears in database

## 🎯 **What Should Work After Setup**

✅ **Voice Processing**: STT → AI Analysis → TTS Response  
✅ **Contact Management**: Extract and save contact details  
✅ **Relationship Intelligence**: AI-powered insights  
✅ **Database Integration**: Persistent storage in Supabase  
✅ **Cost Optimization**: GPT-3.5 Turbo for 90% cost reduction  
✅ **Real-time Responses**: Fast voice interactions  

## 🚨 **Common Issues & Solutions**

**Bot not responding:**
- Check webhook URL is correct
- Verify bot token is valid
- Check Railway logs: `railway logs`

**Voice processing fails:**
- Verify OpenAI API key has credits
- Check ElevenLabs API key is valid
- Ensure audio format is supported

**Database errors:**
- Verify Supabase credentials
- Check database schema is applied
- Ensure RLS policies are configured

## 📊 **Performance Expectations**

- **Response Time**: 2-5 seconds for voice processing
- **Cost**: ~$0.003 per voice message (with GPT-3.5 Turbo)
- **Uptime**: 99.9% (Railway SLA)
- **Scalability**: Handles multiple concurrent users

## 🎉 **Final Verification**

After completing all steps:

1. **Test bot functionality** with voice messages
2. **Monitor Railway dashboard** for any errors
3. **Check Supabase dashboard** for data storage
4. **Verify cost optimization** in OpenAI dashboard

## 📞 **Need Help?**

If you encounter issues:
1. Check Railway logs: `railway logs`
2. Verify environment variables: `railway variables`
3. Test individual components
4. Check this checklist again

**Your Rhiz bot will be fully operational once you replace the "test" API keys with real ones!** 🚀
