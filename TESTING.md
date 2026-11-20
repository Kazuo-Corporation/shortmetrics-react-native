# Testing Guide for ShortMetrics React Native

Comprehensive test suite for the ShortMetrics React Native SDK.

## 📊 Test Coverage

✅ **49 unit tests** passing  
✅ **79% code coverage** (lines)  
✅ **93% coverage** on ShortMetrics class  
✅ **87% coverage** on Storage class

## 🚀 Quick Start

### Run Unit Tests
```bash
npm test                # Run unit tests (default)
npm run test:unit       # Explicit unit tests
npm run test:watch      # Watch mode for development
npm run test:coverage   # Generate coverage report
```

### Run Integration Tests
```bash
# First, configure your backend endpoint
cp test.config.example.ts test.config.ts
# Edit test.config.ts with your actual API key and endpoint

# Then run integration tests
npm run test:integration  # Integration tests only
npm run test:all          # All tests (unit + integration)
```

## 📁 Test Structure

```
__tests__/
├── ShortMetrics.test.ts           # Main tracker tests
├── queue.test.ts                  # Persisted queue, batching, retries
├── Storage.test.ts                # AsyncStorage wrapper tests
├── useShortMetrics.test.tsx       # React hook tests
├── utils/
│   └── deviceInfo.test.ts         # Device signal tests
├── integration/
│   └── ShortMetrics.integration.test.ts  # Real backend tests
└── README.md                      # Detailed testing documentation
```

## 🧪 What's Tested

### Unit Tests (Mocked Dependencies)

#### ShortMetrics Class
- ✅ Initialization and auto-initialization
- ✅ Session management (create, restore, reset)
- ✅ User identification (identify, clear)
- ✅ Predefined events (purchase, trial, subscription, etc.)
- ✅ Custom events (with auto-prefixing)
- ✅ Device info integration
- ✅ Error handling (network failures, HTTP errors)
- ✅ Timestamp generation
- ✅ Header formatting
- ✅ Cleanup and destroy

#### Storage Class
- ✅ Session ID (get, set, clear)
- ✅ User ID (get, set, clear)
- ✅ Error handling for storage operations
- ✅ Null handling for missing data

#### Device Info Utility
- ✅ Platform detection
- ✅ Version handling (string/number)
- ✅ Fallback behavior
- ✅ Consistent data structure

#### React Hook
- ✅ Module exports
- ✅ Function signature
- ✅ Basic structure validation

### Integration Tests (Real Backend Calls)

**Configuration Required:** Copy `test.config.example.ts` to `test.config.ts`

Tests include:
- ✅ Custom event tracking
- ✅ All predefined event types
- ✅ User identification flow
- ✅ Session persistence
- ✅ Complex nested properties
- ✅ Various data types
- ✅ Error scenarios (invalid credentials, bad endpoints)
- ✅ Rapid-fire events

## 🔧 Configuration Files

### jest.config.js
Main Jest configuration with:
- TypeScript support via ts-jest
- React Native mocking
- Coverage thresholds
- Module mapping for AsyncStorage

### jest.setup.js
Global test setup:
- Console mocking (clean output)
- Fetch mocking
- React Native module mocks

### test.config.example.ts
Template for integration test configuration:
```typescript
export const TEST_CONFIG = {
  apiKey: 'evt2_YOUR_TEST_KEY',
  endpoint: undefined, // optional, defaults to https://api.shortmetrics.ai/events
};
```

## 📈 Coverage Report

Current coverage (as of last run):

| File             | Statements | Branches | Functions | Lines  |
|------------------|-----------|----------|-----------|--------|
| ShortMetrics.ts  | 93.33%    | 85.71%   | 92.30%    | 93.22% |
| Storage.ts       | 87.50%    | 100%     | 100%      | 87.50% |
| deviceInfo.ts    | 57.14%    | 15.38%   | 100%      | 57.14% |
| useShortMetrics  | 23.07%    | 0%       | 0%        | 23.07% |
| **Overall**      | **79.27%**| **55.55%**| **82.60%**| **79.09%** |

*Note: React hooks (useShortMetrics) are difficult to test in isolation and require a React rendering context. The hook is tested via the example app.*

## 🎯 Coverage Thresholds

Minimum required coverage:
- Lines: 70%
- Statements: 70%
- Functions: 65%
- Branches: 55%

*Thresholds are set lower for branches due to the React hook module which is harder to test in isolation.*

## 🐛 Debugging Tests

### Clear Jest Cache
```bash
npx jest --clearCache
```

### Run Specific Test File
```bash
npm test -- ShortMetrics.test.ts
```

### Run Tests Matching Pattern
```bash
npm test -- --testNamePattern="should initialize"
```

### Verbose Output
```bash
npm test -- --verbose
```

## 📝 Writing New Tests

### Unit Test Template
```typescript
import { YourClass } from '../src/YourClass';

jest.mock('../src/dependency');

describe('YourClass', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should do something', async () => {
    const instance = new YourClass();
    const result = await instance.method();
    expect(result).toBe(expected);
  });
});
```

### Integration Test Template
```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ShortMetrics } from '../../src/ShortMetrics';

describe('Feature Integration', () => {
  it('should work with real backend', async () => {
    ShortMetrics.configure({
      apiKey: TEST_CONFIG.apiKey,
      endpoint: TEST_CONFIG.endpoint,
    });

    await ShortMetrics.trackCustom('test_event');
    await ShortMetrics.flush();
    // The queue is empty once the server accepted the batch
    expect(JSON.parse((await AsyncStorage.getItem('@shortmetrics_queue')) || '[]')).toEqual([]);
  }, 30000); // Timeout for network requests
});
```

## 🔍 Integration Test Setup

1. **Copy configuration template:**
   ```bash
   cp test.config.example.ts test.config.ts
   ```

2. **Edit `test.config.ts`:**
   ```typescript
   export const TEST_CONFIG = {
     apiKey: 'evt2_YOUR_ACTUAL_KEY',  // Your test API key
     endpoint: undefined,              // Optional, defaults to https://api.shortmetrics.ai/events
   };
   ```

3. **Run integration tests:**
   ```bash
   npm run test:integration
   ```

4. **Watch for successful events in your backend logs**

*The `test.config.ts` file is gitignored to keep your credentials safe.*

## ✨ Best Practices

1. **Isolation**: Each test should be independent
2. **Descriptive Names**: Test names should explain behavior
3. **Arrange-Act-Assert**: Structure tests clearly
4. **Mock External Dependencies**: Only integration tests hit real APIs
5. **Clean Up**: Use `afterEach` to reset state
6. **Appropriate Timeouts**: Integration tests need 10-15 second timeouts
7. **Test Error Cases**: Don't just test the happy path

## 🚨 Common Issues

### "Cannot find module 'react-native'"
- React Native is mocked in `jest.setup.js`
- Make sure the setup file is loaded

### "Integration tests skipped"
- Create `test.config.ts` from the example file
- Fill in your actual API credentials

### Tests timeout
- Increase timeout: `it('test', async () => { ... }, 15000);`
- Check network connection for integration tests

### Low coverage on hooks
- React hooks require rendering context
- Test hooks via the example app or use `@testing-library/react`

## 📚 Resources

- [Jest Documentation](https://jestjs.io/)
- [Testing Library](https://testing-library.com/)
- [React Native Testing](https://reactnative.dev/docs/testing-overview)
- [ts-jest Documentation](https://kulshekhar.github.io/ts-jest/)

## 🎉 Summary

You now have:
- ✅ 49 passing unit tests
- ✅ Comprehensive integration test suite
- ✅ 79% code coverage
- ✅ Automated coverage thresholds
- ✅ Easy-to-run test commands
- ✅ Well-documented test structure

Run `npm test` to execute the full unit test suite!

