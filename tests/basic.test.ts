import { describe, it, expect } from '@jest/globals';

describe('Basic Functionality', () => {
  it('should have working imports', () => {
    // Test that we can import our modules
    expect(() => {
      require('../src/utils/config');
    }).not.toThrow();
  });

  it('should have working logger', () => {
    const logger = require('../src/utils/logger').default;
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
  });

  it('should have working database connection', () => {
    const db = require('../src/db/supabase').default;
    expect(db).toBeDefined();
    expect(db.users).toBeDefined();
    expect(db.contacts).toBeDefined();
  });

  it('should have working services', () => {
    const contactService = require('../src/services/contacts').default;
    expect(contactService).toBeDefined();
    
    const relationshipService = require('../src/services/relationships').default;
    expect(relationshipService).toBeDefined();
    
    const introductionService = require('../src/services/introductions').default;
    expect(introductionService).toBeDefined();
  });
});
