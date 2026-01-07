/**
 * Integration Tests
 * 
 * These tests make real HTTP requests to your backend.
 * 
 * Setup:
 * 1. Copy test.config.example.ts to test.config.ts
 * 2. Fill in your real API key and endpoint
 * 3. Run: npm run test:integration
 * 
 * To skip these tests, run: npm run test:unit
 */

import { ShortMetrics } from '../../src/ShortMetrics';
import * as fs from 'fs';
import * as path from 'path';

// Try to load test config
let TEST_CONFIG: { apiKey: string; endpoint: string } | null = null;

try {
  const configPath = path.join(__dirname, '../../test.config.ts');
  if (fs.existsSync(configPath)) {
    TEST_CONFIG = require('../../test.config').TEST_CONFIG;
  }
} catch (error) {
  // Config not found, tests will be skipped
}

const describeIf = TEST_CONFIG ? describe : describe.skip;

describeIf('ShortMetrics Integration Tests', () => {
  beforeAll(() => {
    if (!TEST_CONFIG) {
      throw new Error('Test config not found');
    }
  });

  beforeEach(async () => {
    // Don't mock anything - use real implementations
    jest.unmock('../../src/storage');
    jest.unmock('../../src/utils/deviceInfo');
    
    // Reset and configure singleton
    await ShortMetrics.reset();
    ShortMetrics.configure({
      apiKey: TEST_CONFIG!.apiKey,
      endpoint: TEST_CONFIG!.endpoint,
    });
  });

  afterEach(async () => {
    await ShortMetrics.reset();
    // Clean up storage after each test
    const { Storage } = require('../../src/storage');
    await Storage.clearSessionId();
    await Storage.clearUserId();
  });

  describe('Basic Event Tracking', () => {
    it('should successfully send a custom event', async () => {
      await expect(
        ShortMetrics.trackCustom('integration_test_event', {
          properties: {
            test_type: 'basic',
            timestamp: new Date().toISOString(),
          },
        })
      ).resolves.not.toThrow();
    }, 10000);

    it('should successfully send a predefined event', async () => {
      await expect(
        ShortMetrics.trackPredefined('purchase', {
          amount: 99.99,
          currency: 'USD',
          product: 'Integration Test Product',
        })
      ).resolves.not.toThrow();
    }, 10000);

    it('should send app_installed event', async () => {
      await expect(
        ShortMetrics.trackPredefined('app_installed')
      ).resolves.not.toThrow();
    }, 10000);
  });

  describe('User Identification', () => {
    it('should identify user and send event', async () => {
      const userId = `test_user_${Date.now()}`;
      const email = `test_${Date.now()}@example.com`;
      const phone = '+1234567890';

      await expect(
        ShortMetrics.identify(userId, email, phone)
      ).resolves.not.toThrow();
    }, 10000);

    it('should persist user ID across events', async () => {
      const userId = `test_user_${Date.now()}`;
      
      await ShortMetrics.identify(userId);
      
      // This event should include the user ID
      await expect(
        ShortMetrics.trackCustom('test_with_user')
      ).resolves.not.toThrow();
    }, 10000);

    it('should clear user identity', async () => {
      await ShortMetrics.identify(`user_${Date.now()}`);
      await ShortMetrics.clearIdentity();
      
      // This should work without user ID
      await expect(
        ShortMetrics.trackCustom('test_without_user')
      ).resolves.not.toThrow();
    }, 10000);
  });

  describe('Session Management', () => {
    it('should track events with session ID', async () => {
      await ShortMetrics.initialize();
      
      await expect(
        ShortMetrics.trackCustom('session_test')
      ).resolves.not.toThrow();
    }, 10000);

    it('should reset session and continue tracking', async () => {
      await ShortMetrics.initialize();
      await ShortMetrics.trackCustom('before_reset');
      
      await ShortMetrics.resetSession();
      
      await expect(
        ShortMetrics.trackCustom('after_reset')
      ).resolves.not.toThrow();
    }, 10000);
  });

  describe('Complex Properties', () => {
    it('should send event with nested properties', async () => {
      await expect(
        ShortMetrics.trackCustom('complex_event', {
          properties: {
            user_info: {
              name: 'Test User',
              age: 25,
            },
            preferences: {
              theme: 'dark',
              notifications: true,
            },
            tags: ['test', 'integration', 'complex'],
          },
        })
      ).resolves.not.toThrow();
    }, 10000);

    it('should send event with various data types', async () => {
      await expect(
        ShortMetrics.trackCustom('data_types_test', {
          properties: {
            string_value: 'test',
            number_value: 42,
            float_value: 3.14,
            boolean_value: true,
            null_value: null,
            array_value: [1, 2, 3],
            object_value: { key: 'value' },
          },
        })
      ).resolves.not.toThrow();
    }, 10000);
  });

  describe('Error Handling', () => {
    it('should handle invalid API key gracefully', async () => {
      await ShortMetrics.reset();
      ShortMetrics.configure({
        apiKey: 'evt_invalid_key_12345',
        endpoint: TEST_CONFIG!.endpoint,
      });

      await expect(
        ShortMetrics.trackCustom('test_event')
      ).rejects.toThrow();
    }, 10000);

    it('should handle invalid endpoint gracefully', async () => {
      await ShortMetrics.reset();
      ShortMetrics.configure({
        apiKey: TEST_CONFIG!.apiKey,
        endpoint: 'https://invalid-endpoint-that-does-not-exist.com/track',
      });

      await expect(
        ShortMetrics.trackCustom('test_event')
      ).rejects.toThrow();
    }, 10000);
  });

  describe('Rapid Fire Events', () => {
    it('should handle multiple rapid events', async () => {
      const promises = [];
      
      for (let i = 0; i < 5; i++) {
        promises.push(
          ShortMetrics.trackCustom(`rapid_event_${i}`, {
            properties: { index: i },
          })
        );
      }
      
      await expect(
        Promise.all(promises)
      ).resolves.not.toThrow();
    }, 15000);
  });
});

// Display helpful message if tests are skipped
if (!TEST_CONFIG) {
  console.log('\n⚠️  Integration tests skipped!');
  console.log('To run integration tests:');
  console.log('1. Copy test.config.example.ts to test.config.ts');
  console.log('2. Fill in your API key and endpoint');
  console.log('3. Run: npm run test:integration\n');
}

