#!/usr/bin/env node

// Railway startup script with better error handling
console.log('🚀 Starting Rhiz Bot on Railway...');
console.log('📊 Environment:', process.env.NODE_ENV || 'development');
console.log('🔑 PORT:', process.env.PORT || '3000');

// Check environment variables
const envStatus = {
  'TELEGRAM_BOT_TOKEN': process.env.TELEGRAM_BOT_TOKEN ? '✅ Set' : '❌ Missing',
  'OPENAI_API_KEY': process.env.OPENAI_API_KEY ? '✅ Set' : '⚠️ Missing (optional)',
  'SUPABASE_URL': process.env.SUPABASE_URL ? '✅ Set' : '❌ Missing',
  'SUPABASE_ANON_KEY': process.env.SUPABASE_ANON_KEY ? '✅ Set' : '⚠️ Missing',
  'SUPABASE_SERVICE_ROLE_KEY': process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '⚠️ Missing',
  'ELEVENLABS_API_KEY': process.env.ELEVENLABS_API_KEY ? '✅ Set' : '⚠️ Missing (optional)'
};

console.log('\n🔐 Environment Variables Status:');
Object.entries(envStatus).forEach(([key, status]) => {
  console.log(`  ${key}: ${status}`);
});

// Check if we have minimum required variables
const hasMinimumConfig = process.env.TELEGRAM_BOT_TOKEN && 
                         process.env.SUPABASE_URL && 
                         (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY);

if (!hasMinimumConfig) {
  console.warn('\n⚠️ Warning: Missing required environment variables');
  console.warn('The app may not function properly without:');
  console.warn('  - TELEGRAM_BOT_TOKEN');
  console.warn('  - SUPABASE_URL');
  console.warn('  - SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY');
}

// Try to start the app
console.log('\n📦 Loading application...');
try {
  require('./dist/index.js');
  console.log('✅ App started successfully');
} catch (error) {
  console.error('\n❌ Failed to start app:', error.message);
  
  // Provide helpful error messages
  if (error.message.includes('supabase')) {
    console.error('\n💡 Hint: Make sure Supabase environment variables are set in Railway');
  }
  if (error.message.includes('Cannot find module')) {
    console.error('\n💡 Hint: Make sure to run "npm run build" before starting');
  }
  
  console.error('\nStack trace:', error.stack);
  process.exit(1);
}
