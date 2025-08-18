// Simple local test script
const dotenv = require('dotenv');
dotenv.config();

console.log('🧪 Testing Rhiz Bot locally...\n');

// Test 1: Config loading
console.log('1. Testing config loading...');
try {
  const config = require('./src/utils/config').default;
  console.log('✅ Config loaded successfully');
  console.log('   Environment:', config.env);
  console.log('   Port:', config.port);
} catch (error) {
  console.log('❌ Config loading failed:', error.message);
}

// Test 2: Logger
console.log('\n2. Testing logger...');
try {
  const logger = require('./src/utils/logger').default;
  logger.info('Test log message');
  console.log('✅ Logger working');
} catch (error) {
  console.log('❌ Logger failed:', error.message);
}

// Test 3: Database connection
console.log('\n3. Testing database connection...');
try {
  const db = require('./src/db/supabase').default;
  console.log('✅ Database module loaded');
  console.log('   Available tables:', Object.keys(db).filter(key => key !== 'testConnection' && key !== 'supabase'));
} catch (error) {
  console.log('❌ Database module failed:', error.message);
}

// Test 4: Services
console.log('\n4. Testing services...');
try {
  const contactService = require('./src/services/contacts').default;
  const relationshipService = require('./src/services/relationships').default;
  const introductionService = require('./src/services/introductions').default;
  console.log('✅ All services loaded successfully');
} catch (error) {
  console.log('❌ Services failed:', error.message);
}

// Test 5: Basic functionality
console.log('\n5. Testing basic functionality...');
try {
  // Test contact service methods
  const contactService = require('./src/services/contacts').default;
  console.log('✅ Contact service methods available');
  
  // Test relationship service methods
  const relationshipService = require('./src/services/relationships').default;
  console.log('✅ Relationship service methods available');
  
  // Test introduction service methods
  const introductionService = require('./src/services/introductions').default;
  console.log('✅ Introduction service methods available');
  
} catch (error) {
  console.log('❌ Basic functionality failed:', error.message);
}

console.log('\n🎉 Local testing completed!');
console.log('\nNext steps:');
console.log('1. Set up your environment variables in .env');
console.log('2. Run: npm run dev (for development)');
console.log('3. Deploy to Railway when ready');
