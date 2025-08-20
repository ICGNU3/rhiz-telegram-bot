#!/usr/bin/env node

/**
 * Script to set Telegram webhook URL for production
 * Usage: node scripts/set-webhook.js
 */

const https = require('https');

async function setWebhook() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  
  if (!botToken) {
    console.error('❌ TELEGRAM_BOT_TOKEN environment variable not set');
    process.exit(1);
  }

  const webhookUrl = `https://rhiz.railway.app/webhook/${botToken}`;
  const apiUrl = `https://api.telegram.org/bot${botToken}/setWebhook`;
  
  console.log('🔗 Setting webhook URL...');
  console.log(`📡 Webhook URL: ${webhookUrl}`);
  
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: webhookUrl,
        drop_pending_updates: true
      })
    });

    const result = await response.json();
    
    if (result.ok) {
      console.log('✅ Webhook set successfully!');
      console.log(`📊 Result:`, result.result);
      
      // Verify webhook
      console.log('\n🔍 Verifying webhook...');
      const verifyResponse = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
      const verifyResult = await verifyResponse.json();
      
      if (verifyResult.ok) {
        console.log('✅ Webhook verification successful!');
        console.log('📋 Webhook Info:');
        console.log(`   URL: ${verifyResult.result.url}`);
        console.log(`   Pending updates: ${verifyResult.result.pending_update_count}`);
        console.log(`   Last error: ${verifyResult.result.last_error_message || 'None'}`);
      } else {
        console.error('❌ Webhook verification failed:', verifyResult);
      }
    } else {
      console.error('❌ Failed to set webhook:', result);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error setting webhook:', error.message);
    process.exit(1);
  }
}

async function testHealthEndpoint() {
  console.log('\n🏥 Testing health endpoint...');
  
  try {
    const response = await fetch('https://rhiz.railway.app/health');
    const result = await response.json();
    
    if (response.ok && result.status === 'ok') {
      console.log('✅ Health endpoint working!');
      console.log(`🕐 Uptime: ${Math.floor(result.uptime)}s`);
    } else {
      console.error('❌ Health endpoint failed:', result);
    }
  } catch (error) {
    console.error('❌ Health endpoint error:', error.message);
  }
}

// Main execution
async function main() {
  console.log('🚀 Rhiz Bot Production Setup\n');
  
  await testHealthEndpoint();
  await setWebhook();
  
  console.log('\n🎉 Setup complete!');
  console.log('📱 Your bot should now be receiving messages at https://rhiz.railway.app');
  console.log('💬 Try sending a message to your bot to test!');
}

main().catch(console.error);