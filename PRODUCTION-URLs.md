# 🌐 Production URLs - Rhiz Telegram Bot

## **Live Application**
- **Main URL:** https://rhiz.railway.app
- **Health Check:** https://rhiz.railway.app/health
- **Webhook Endpoint:** https://rhiz.railway.app/webhook/YOUR_BOT_TOKEN
- **Rate Limit Stats:** https://rhiz.railway.app/api/rate-limits

## **Required Environment Variables Update**

In your Railway dashboard, update these environment variables:

```bash
# Telegram Configuration
TELEGRAM_WEBHOOK_URL=https://rhiz.railway.app

# Google OAuth (if using)
GOOGLE_REDIRECT_URI=https://rhiz.railway.app/auth/google/callback

# Admin Configuration
ADMIN_TELEGRAM_IDS=your_telegram_id_here
```

## **Telegram Bot Setup**

### **1. Set Webhook URL**
```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
     -H "Content-Type: application/json" \
     -d '{"url": "https://rhiz.railway.app/webhook/<YOUR_BOT_TOKEN>"}'
```

### **2. Verify Webhook**
```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
```

Should return:
```json
{
  "ok": true,
  "result": {
    "url": "https://rhiz.railway.app/webhook/YOUR_BOT_TOKEN",
    "has_custom_certificate": false,
    "pending_update_count": 0
  }
}
```

## **Testing Endpoints**

### **Health Check**
```bash
curl https://rhiz.railway.app/health
```
Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-XX...",
  "version": "1.0.0",
  "uptime": 1234
}
```

### **Rate Limit Stats (Admin)**
```bash
curl https://rhiz.railway.app/api/rate-limits
```

## **Domain Configuration Steps**

### **In Railway Dashboard:**
1. Go to your project
2. Click "Settings" → "Domains"
3. Add custom domain: `rhiz.railway.app`
4. Follow Railway's DNS setup instructions
5. Wait for domain to propagate (5-10 minutes)

### **Verification:**
- ✅ Domain resolves to Railway
- ✅ SSL certificate active
- ✅ Health endpoint responds
- ✅ Webhook receiving messages

## **Production Checklist**

- [ ] Custom domain configured in Railway
- [ ] Environment variables updated
- [ ] Telegram webhook URL set
- [ ] Admin Telegram IDs configured
- [ ] Database migration run
- [ ] Health check responding
- [ ] Bot responding to messages
- [ ] Authorization system working

## **Monitoring**

### **Key URLs to Monitor:**
- Health: https://rhiz.railway.app/health
- Webhook delivery in Telegram Bot API

### **Log Sources:**
- Railway deployment logs
- Supabase database logs
- Telegram Bot API webhook logs

Your bot is now live at **https://rhiz.railway.app**! 🚀