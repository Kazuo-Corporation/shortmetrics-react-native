# Test Suite Documentation

This directory contains comprehensive tests for the ShortMetrics React Native SDK.

## Test Types

### 1. Unit Tests
Tests individual components in isolation with mocked dependencies.

**Location:** `__tests__/*.test.ts`

**Files:**
- `Storage.test.ts` - Tests for AsyncStorage wrapper
- `ShortMetrics.test.ts` - Tests for the main tracker (identity, context, attribution, storage compatibility)
- `queue.test.ts` - Tests for the persisted queue (batching, retries, cap)
- `useShortMetrics.test.tsx` - Tests for React hook

**Run:**
```bash
npm test                  # Run unit tests only
npm run test:unit         # Run unit tests only
npm run test:watch        # Run in watch mode
npm run test:coverage     # Run with coverage report
```

### 2. Integration Tests
Tests with real HTTP requests to your backend (requires configuration).

**Location:** `__tests__/integration/*.test.ts`

**Files:**
- `ShortMetrics.integration.test.ts` - End-to-end tests with real backend

**Setup:**
1. Copy `test.config.example.ts` to `test.config.ts` (in root directory)
2. Fill in your actual API key (the endpoint defaults to https://api.shortmetrics.ai/events):
   ```typescript
   export const TEST_CONFIG = {
     apiKey: 'evt2_YOUR_ACTUAL_KEY',
     endpoint: undefined,
   };
   ```

**Run:**
```bash
npm run test:integration  # Run integration tests only
npm run test:all          # Run all tests (unit + integration)
```

## What Gets Tested

### Unit Tests Coverage
- ✅ Storage operations (AsyncStorage wrapper)
- ✅ Event tracker initialization
- ✅ User identification
- ✅ Session management
- ✅ Custom event tracking
- ✅ Predefined event tracking
- ✅ Persisted queue (survives restarts, cap of 1,000)
- ✅ Batches of up to 50 events
- ✅ Retry with backoff and Retry-After; other 4xx dropped
- ✅ Context and reserved device signal keys
- ✅ Attribution events
- ✅ Error handling
- ✅ React hook lifecycle

### Integration Tests Coverage
- ✅ Real HTTP requests to backend
- ✅ All predefined event types
- ✅ Custom events
- ✅ User identification flow
- ✅ Session persistence
- ✅ A batch of events accepted by the real backend
- ✅ Complex properties
- ✅ Error scenarios (invalid credentials, network errors)
- ✅ Rapid-fire events

## Test Commands

```bash
# Unit tests
npm test                  # Default (unit tests only)
npm run test:unit         # Explicit unit tests
npm run test:watch        # Watch mode for development
npm run test:coverage     # Generate coverage report

# Integration tests
npm run test:integration  # Integration tests only
npm run test:all          # All tests (unit + integration)
```

## Coverage Thresholds

Minimum coverage targets (configured in `jest.config.js`):
- Branches: 70%
- Functions: 70%
- Lines: 70%
- Statements: 70%

## CI/CD Integration

For continuous integration, run:
```bash
npm run test:coverage     # Unit tests with coverage
npm run test:integration  # Integration tests (if config exists)
```

## Troubleshooting

### Integration Tests Not Running
If you see "Integration tests skipped", make sure:
1. `test.config.ts` exists in the root directory
2. The file exports `TEST_CONFIG` with valid credentials
3. Your backend endpoint is accessible

### Tests Timing Out
Integration tests have longer timeouts (10-15 seconds). If they still timeout:
1. Check your network connection
2. Verify your backend is responding
3. Check the endpoint URL is correct

### Mock Issues
If mocks aren't working:
1. Clear Jest cache: `npx jest --clearCache`
2. Restart your test runner
3. Check mock imports are at the top of test files

## Writing New Tests

### Unit Test Template
```typescript
import { YourClass } from '../src/YourClass';

jest.mock('../src/dependency');

describe('YourClass', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should do something', () => {
    // Arrange
    const instance = new YourClass();
    
    // Act
    const result = instance.method();
    
    // Assert
    expect(result).toBe(expected);
  });
});
```

### Integration Test Template
```typescript
import { TEST_CONFIG } from '../../test.config';

const describeIf = TEST_CONFIG ? describe : describe.skip;

describeIf('Feature Integration', () => {
  it('should work with real backend', async () => {
    // Test with real API calls
  }, 10000); // Timeout in ms
});
```

## Best Practices

1. **Keep tests isolated** - Each test should be independent
2. **Use descriptive names** - Test names should explain what they test
3. **Test behavior, not implementation** - Focus on what, not how
4. **Mock external dependencies** - Only integration tests should hit real APIs
5. **Clean up after tests** - Use afterEach to reset state
6. **Use appropriate timeouts** - Integration tests need longer timeouts
7. **Test error cases** - Don't just test the happy path

## Resources

- [Jest Documentation](https://jestjs.io/)
- [Testing Library](https://testing-library.com/)
- [React Native Testing](https://reactnative.dev/docs/testing-overview)

