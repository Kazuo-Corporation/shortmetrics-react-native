# ShortMetrics for React Native & Expo

A lightweight, TypeScript-first event tracking SDK for React Native and Expo apps. Track user events, conversions, and analytics with a simple, privacy-focused API.

## Features

✅ **Works with both React Native & Expo** - No native code required  
✅ **TypeScript support** - Full type safety with IntelliSense  
✅ **Session management** - Automatic session tracking  
✅ **User identification** - Persist user data across app launches  
✅ **Auto-tracking** - Automatic app lifecycle events  
✅ **Device info** - Automatic device metadata collection  
✅ **Privacy-first** - No unnecessary data collection  
✅ **React hooks** - Easy integration with React components

## Installation

```bash
# Using npm
npm install @kazuocorporation/shortmetrics-react-native @react-native-async-storage/async-storage

# Using yarn
yarn add @kazuocorporation/shortmetrics-react-native @react-native-async-storage/async-storage

# For Expo
npx expo install @kazuocorporation/shortmetrics-react-native @react-native-async-storage/async-storage
```

### Optional Dependencies

For enhanced device information:

```bash
# Expo
npx expo install expo-constants

# React Native (bare)
npm install react-native-device-info
```

## Quick Start

### 1. Configure the Tracker

```typescript
import { ShortMetrics } from "@kazuocorporation/shortmetrics-react-native";

// Configure once at app startup
ShortMetrics.configure({
  apiKey: "evt_YOUR_API_KEY",
  endpoint: "https://your-endpoint.cloudfunctions.net/trackEvent",
  autoTrackSessions: true,
});

// Initialize (async) - optional, will auto-initialize on first track
await ShortMetrics.initialize();
```

### 2. Track Events

```typescript
// Track predefined events
await ShortMetrics.trackPredefined("purchase", {
  amount: 99.99,
  currency: "USD",
});

// Track custom events
await ShortMetrics.trackCustom("button_clicked", {
  properties: {
    button_name: "signup",
    screen: "home",
  },
});
```

### 3. Identify Users

```typescript
// When user logs in
await ShortMetrics.identify("user_123", "user@example.com", "+1234567890");

// When user logs out
await ShortMetrics.clearIdentity();
```

## Usage

### Using with React Hook

```typescript
import {
  useShortMetrics,
  ShortMetrics,
} from "@kazuocorporation/shortmetrics-react-native";

function MyComponent() {
  // Hook configures the singleton and returns it
  useShortMetrics({
    apiKey: "evt_YOUR_API_KEY",
    endpoint: "https://your-endpoint.com/trackEvent",
  });

  const handlePurchase = async () => {
    await ShortMetrics.trackPredefined("purchase", { amount: 29.99 });
  };

  return <Button title="Buy Now" onPress={handlePurchase} />;
}
```

### Predefined Events

The SDK supports these predefined events:

```typescript
// App lifecycle
await ShortMetrics.trackPredefined("app_installed");

// Purchases
await ShortMetrics.trackPredefined("purchase", {
  amount: 99.99,
  currency: "USD",
  product: "Premium Plan",
});
```

### Custom Events

All custom events are automatically prefixed with `custom_`:

```typescript
// Track any custom event
await ShortMetrics.trackCustom("feature_used", {
  properties: {
    feature_name: "dark_mode",
    enabled: true,
  },
});

// Or use the generic track method
await ShortMetrics.track("custom_page_viewed", {
  properties: {
    page: "settings",
    section: "profile",
  },
});
```

## Configuration

```typescript
interface ShortMetricsConfig {
  /** Your pixel API key (evt_xxxx) */
  apiKey: string;

  /** API endpoint URL */
  endpoint: string;

  /** Enable automatic session tracking (default: true) */
  autoTrackSessions?: boolean;
}
```

## Advanced Features

### Session Management

```typescript
// Reset the session (generate new session ID)
await ShortMetrics.resetSession();
```

### Event Options

```typescript
await ShortMetrics.track("custom_event", {
  userId: "user_123", // Override current user
  email: "user@example.com", // Add email
  phone: "+1234567890", // Add phone
  sessionId: "custom_session", // Override session
  properties: {
    // Custom properties
    key: "value",
  },
});
```

## Best Practices

### 1. Configure Once

Configure the tracker once in your app's entry point:

```typescript
// App.tsx or index.tsx
import { ShortMetrics } from "@kazuocorporation/shortmetrics-react-native";

ShortMetrics.configure({
  apiKey: process.env.REACT_NATIVE_PIXEL_KEY!,
  endpoint: process.env.REACT_NATIVE_PIXEL_ENDPOINT!,
});

// Optional: Initialize immediately (otherwise auto-initializes on first track)
ShortMetrics.initialize();
```

### 2. Clean Up

Always clean up in your root component:

```typescript
useEffect(() => {
  return () => {
    ShortMetrics.reset();
  };
}, []);
```

### 3. Handle Errors Gracefully

The SDK logs errors but doesn't throw. Track critical events without try/catch:

```typescript
// Safe to call without error handling
await ShortMetrics.trackPredefined("purchase", { amount: 99 });
```

### 4. Identify Users Early

```typescript
// As soon as user authenticates
useEffect(() => {
  if (user) {
    ShortMetrics.identify(user.id, user.email, user.phone);
  }
}, [user]);
```

## Auto-Tracked Events

When `autoTrackSessions: true`, these events are tracked automatically:

- `custom_app_opened` - App comes to foreground
- `custom_app_backgrounded` - App goes to background

## Device Information

The SDK automatically collects:

- Platform (iOS/Android)
- OS Version
- App Version
- Device Model
- Device ID (if available)

All device info is included in event properties.

## Privacy & Security

- API keys are designed to be public (embedded in apps)
- No PII is collected unless explicitly provided
- Events are rate-limited on the server
- User data is stored locally using AsyncStorage
- Session IDs are randomly generated

## Troubleshooting

### Events not appearing

1. Check your API key is correct
2. Verify endpoint URL
3. Check console logs for errors
4. Verify BigQuery table exists on backend

### TypeScript errors

Make sure you have the types installed:

```bash
npm install --save-dev @types/react-native
```

### AsyncStorage errors

Install the peer dependency:

```bash
npm install @react-native-async-storage/async-storage
```

## API Reference

### ShortMetrics

ShortMetrics is a singleton, accessed via static methods:

#### Methods

- `configure(config): void` - Configure the tracker (must be called first)
- `initialize(): Promise<void>` - Initialize the tracker (optional, auto-initializes on first track)
- `identify(userId, email?, phone?): Promise<void>` - Identify user
- `clearIdentity(): Promise<void>` - Clear user identity
- `track(eventType, options?): Promise<void>` - Track any event
- `trackPredefined(eventType, properties?, options?): Promise<void>` - Track predefined event
- `trackCustom(eventName, options?): Promise<void>` - Track custom event
- `resetSession(): Promise<void>` - Reset session ID
- `reset(): Promise<void>` - Clean up and reset (useful for testing or reconfiguring)

## Example App

See the `example/` directory for a complete working example.

## License

MIT

## Support

For issues or questions:

- Check the troubleshooting guide above
- Review the example app
- Open an issue on GitHub
