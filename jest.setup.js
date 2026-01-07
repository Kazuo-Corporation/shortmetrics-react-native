// Mock console methods to keep test output clean
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
  log: jest.fn(),
};

// Note: fetch is NOT mocked globally to allow integration tests to work
// Unit tests should mock fetch explicitly if needed: global.fetch = jest.fn()

// Mock React Native completely
jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
    currentState: 'active',
  },
  Platform: {
    OS: 'ios',
    Version: '17.0',
    select: jest.fn((obj) => obj.ios),
  },
}));
