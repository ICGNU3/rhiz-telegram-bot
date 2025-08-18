# Railway Deployment Fix Guide

## Issues Found and Fixed

### 1. **Critical Issue: `.railwayignore` was excluding `dist/` folder**
- **Problem**: The `.railwayignore` file was excluding the `dist/` directory
- **Impact**: Railway couldn't find the compiled JavaScript files after build
- **Fix**: Removed `dist/` from `.railwayignore`

### 2. **Added `nixpacks.toml` for explicit build configuration**
- **Purpose**: Ensures Railway uses correct Node.js version and build commands
- **Configuration**:
  - Node.js 18.x
  - npm 9.x
  - Proper install and build sequence

## Deployment Checklist

### Pre-Deployment Steps:
1. ✅ Fixed `.railwayignore` (dist folder no longer excluded)
2. ✅ Created `nixpacks.toml` for Railway build configuration
3. ✅ Verified local build works: `npm run build`
4. ✅ Verified start command works: `npm start`
5. ✅ All dependencies properly configured
6. ✅ PORT configuration uses environment variable

### Railway Environment Variables Required:
```
NODE_ENV=production
TELEGRAM_BOT_TOKEN=<your_token>
TELEGRAM_WEBHOOK_URL=https://<your-app>.up.railway.app
OPENAI_API_KEY=<your_key>
ELEVENLABS_API_KEY=<your_key>
SUPABASE_URL=<your_url>
SUPABASE_ANON_KEY=<your_key>
SUPABASE_SERVICE_KEY=<your_key>
```

### Optional Environment Variables:
```
GOOGLE_SHEETS_CLIENT_EMAIL=<optional>
GOOGLE_SHEETS_PRIVATE_KEY=<optional>
ELEVENLABS_VOICE_ID=<optional, defaults to 21m00Tcm4TlvDq8ikWAM>
SENTRY_DSN=<optional>
POSTHOG_API_KEY=<optional>
```

## Deploy to Railway

### Method 1: Railway CLI
```bash
railway up
```

### Method 2: GitHub Integration
1. Push changes to GitHub:
```bash
git add .
git commit -m "Fix Railway deployment - remove dist from railwayignore and add nixpacks config"
git push
```
2. Railway will auto-deploy from GitHub

### Method 3: Railway Dashboard
1. Go to Railway dashboard
2. Create new project
3. Deploy from GitHub
4. Add environment variables
5. Deploy

## What Will Happen During Deployment

1. Railway detects `nixpacks.toml` and uses it for configuration
2. Installs Node.js 18.x and npm 9.x
3. Runs `npm ci --production=false` to install all dependencies
4. Runs `npm run build` to compile TypeScript
5. Starts app with `npm start`
6. App listens on Railway-provided PORT

## Troubleshooting

### If deployment still fails:

1. **Check Railway build logs** for specific errors
2. **Verify environment variables** are all set in Railway dashboard
3. **Check if `SUPABASE_SERVICE_KEY` is correct** (common issue)
4. **Ensure Telegram webhook URL** uses your Railway app URL

### Common Error Fixes:

- **"Cannot find module"**: Make sure all dependencies are in `package.json`
- **"Missing environment variable"**: Add all required vars to Railway
- **"Port already in use"**: Use `process.env.PORT` (already configured)
- **"Build failed"**: Check TypeScript errors with `npm run build` locally

## Success Indicators

When deployment succeeds:
1. Railway shows "Deployed" status
2. Health endpoint responds: `https://<your-app>.up.railway.app/health`
3. Logs show: "🚀 Rhiz Bot server running on port [PORT]"
4. Telegram webhook registered successfully

## Next Steps After Successful Deployment

1. Set Telegram webhook:
```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://<your-app>.up.railway.app/webhook/<YOUR_BOT_TOKEN>"}'
```

2. Test bot by sending `/start` command in Telegram

3. Monitor logs in Railway dashboard

## Files Changed
- `.railwayignore` - Removed dist/ exclusion
- `nixpacks.toml` - Created with proper build configuration

Your deployment should now work! 🚀