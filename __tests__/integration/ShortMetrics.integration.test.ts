/**
 * Integration Tests
 *
 * These tests make real HTTP requests to your backend.
 *
 * Setup:
 * 1. Copy test.config.example.ts to test.config.ts
 * 2. Fill in your real API key (and endpoint, if not the default)
 * 3. Run: npm run test:integration
 *
 * To skip these tests, run: npm run test:unit
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { ShortMetrics } from '../../src/ShortMetrics';
import * as fs from 'fs';
import * as path from 'path';

// Try to load test config
let TEST_CONFIG: { apiKey: string; endpoint?: string } | null = null;

try {
  const configPath = path.join(__dirname, '../../test.config.ts');
  if (fs.existsSync(configPath)) {
    TEST_CONFIG = require('../../test.config').TEST_CONFIG;
  }
} catch (error) {
  // Config not found, tests will be skipped
}

const describeIf = TEST_CONFIG ? describe : describe.skip;

// Events still waiting in the persisted queue
const queued = async () => JSON.parse((await AsyncStorage.getItem('@shortmetrics_queue')) || '[]');

describeIf('ShortMetrics Integration Tests', () => {
  beforeEach(async () => {
    await ShortMetrics.reset();
    await AsyncStorage.clear();
    ShortMetrics.configure({ apiKey: TEST_CONFIG!.apiKey, endpoint: TEST_CONFIG!.endpoint });
  });

  afterEach(async () => {
    await ShortMetrics.reset();
  });

  it('sends a batch of events', async () => {
    const runId = `integration_${Date.now()}`;
    await ShortMetrics.identify(`test_user_${Date.now()}`);
    await ShortMetrics.setContext({ integration_run: runId });
    await ShortMetrics.trackCustom('integration_test_event', { properties: { index: 1 } });
    await ShortMetrics.trackAttribution({
      source: 'tiktok',
      postUrl: 'https://www.tiktok.com/@shortmetrics/video/1',
      socialPlatform: 'tiktok',
    });

    await ShortMetrics.flush();

    expect(await queued()).toEqual([]);
    console.log(`Sent events with properties.integration_run = ${runId}`);
  }, 30000);

  it('drops events rejected for an invalid API key', async () => {
    await ShortMetrics.reset();
    ShortMetrics.configure({ apiKey: 'evt2_invalid_key_12345', endpoint: TEST_CONFIG!.endpoint });

    await ShortMetrics.trackCustom('test_event');
    await ShortMetrics.flush();

    expect(await queued()).toEqual([]);
  }, 30000);

  it('keeps events when the endpoint is unreachable', async () => {
    await ShortMetrics.reset();
    ShortMetrics.configure({
      apiKey: TEST_CONFIG!.apiKey,
      endpoint: 'https://invalid-endpoint-that-does-not-exist.com/track',
    });

    await ShortMetrics.trackCustom('test_event');
    await ShortMetrics.flush();

    expect(await queued()).toHaveLength(1);
  }, 30000);
});

// Display helpful message if tests are skipped
if (!TEST_CONFIG) {
  console.log('\n⚠️  Integration tests skipped!');
  console.log('To run integration tests:');
  console.log('1. Copy test.config.example.ts to test.config.ts');
  console.log('2. Fill in your API key');
  console.log('3. Run: npm run test:integration\n');
}
