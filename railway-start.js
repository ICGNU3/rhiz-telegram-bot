#!/usr/bin/env node

// Simple Railway startup script for debugging
console.log('🚀 Starting Rhiz Bot on Railway...');
console.log('📊 Environment:', process.env.NODE_ENV || 'development');
console.log('🔑 PORT:', process.env.PORT || '3000');
console.log('🤖 TELEGRAM_BOT_TOKEN:', process.env.TELEGRAM_BOT_TOKEN ? 'Set' : 'Not set');
console.log('🧠 OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'Set' : 'Not set');

// Try to start the app
try {
  require('./dist/index.js');
  console.log('✅ App started successfully');
} catch (error) {
  console.error('❌ Failed to start app:', error.message);
  console.error('Stack trace:', error.stack);
  process.exit(1);
}
