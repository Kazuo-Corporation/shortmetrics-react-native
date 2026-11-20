# ShortMetrics for React Native & Expo

A lightweight, TypeScript-first event tracking SDK for React Native and Expo apps. Events are queued on the device, sent in batches and retried until the server accepts them.

## Features

✅ **Works with both React Native & Expo** - No native code required  
✅ **TypeScript support** - Full type safety with IntelliSense  
✅ **Persistent queue** - Events survive offline periods and app restarts  
✅ **Batching and retries** - Up to 50 events per request, with backoff  
✅ **User identification** - Persist user data across app launches  
✅ **App context** - Values set once and added to every later event  
✅ **Device signals** - The same device fields on every event  
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

These are used when installed; none is required:

```bash
# Expo: app version, bundle ID, build number, OS build ID
npx expo install expo-constants expo-application expo-device

# React Native (bare), or for the WebView user agent
npm install react-native-device-info
```

## Quick Start

### 1. Configure the Tracker

```typescript
import { ShortMetrics } from "@kazuocorporation/shortmetrics-react-native";

// Configure once at app startup
ShortMetrics.configure({
  apiKey: "evt2_YOUR_API_KEY",
});

// Initialize (async) - optional, will auto-initialize on first use
await ShortMetrics.initialize();
```

### 2. Track Events

```typescript
// Track predefined events
ShortMetrics.trackPredefined("purchase", {
  amount: 99.99,
  currency: "USD",
});

// Track custom events
ShortMetrics.trackCustom("button_clicked", {
  properties: {
    button_name: "signup",
    screen: "home",
  },
});
```

Tracking only adds the event to the queue, so the returned promise resolves quickly and never rejects.

### 3. Identify Users

```typescript
// When user logs in
await ShortMetrics.identify("user_123", "user@example.com", "+1234567890");

// When user logs out (also clears the app context)
await ShortMetrics.clearIdentity();
```

`identify` and `clearIdentity` also work before `configure`; events wait in the queue until the SDK is configured.

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
    apiKey: "evt2_YOUR_API_KEY",
  });

  const handlePurchase = () => {
    ShortMetrics.trackPredefined("purchase", { amount: 29.99 });
  };

  return <Button title="Buy Now" onPress={handlePurchase} />;
}
```

### Predefined Events

```typescript
// App lifecycle (sent automatically once per install)
ShortMetrics.trackPredefined("app_installed");

// Purchases
ShortMetrics.trackPredefined("purchase", {
  amount: 99.99,
  currency: "USD",
  product: "Premium Plan",
});

// Acquisition source
ShortMetrics.trackPredefined("attribution", {
  attribution: "tiktok",
  resolved_via: "onboarding_answer",
});
```

### Attribution

`trackAttribution` sends the onboarding source answer and, when the user pasted one, the post URL:

```typescript
ShortMetrics.trackAttribution({
  source: "tiktok",
  postUrl: "https://www.tiktok.com/@creator/video/123", // optional
  socialPlatform: "tiktok", // optional
  promptVariant: "v2", // optional
});
```

This sends:

- `attribution` with `{ attribution, resolved_via, prompt_variant? }`
- `custom_attribution_post_url` with `{ post_url, social_platform?, resolved_via, prompt_variant? }`, only when `postUrl` is set

`resolved_via` defaults to `onboarding_answer`; pass `resolvedVia` to change it. Anything in `properties` is added to both events.

### Custom Events

All custom events are automatically prefixed with `custom_`:

```typescript
// Track any custom event
ShortMetrics.trackCustom("feature_used", {
  properties: {
    feature_name: "dark_mode",
    enabled: true,
  },
});

// Or use the generic track method
ShortMetrics.track("custom_page_viewed", {
  properties: {
    page: "settings",
    section: "profile",
  },
});
```

### App Context

`setContext` saves values on the device and adds them to the properties of every event tracked afterwards. Keys are merged; `null` or `undefined` removes a key.

```typescript
await ShortMetrics.setContext({ storefront_country: "US", att_status: "authorized" });
await ShortMetrics.setContext({ idfa: null }); // remove one key
await ShortMetrics.clearContext(); // remove all keys
```

The context is restored on the next launch and cleared by `clearIdentity()`.

## Configuration

```typescript
interface ShortMetricsConfig {
  /** Your pixel API key (evt2_xxxx) */
  apiKey: string;

  /** API endpoint URL (default: https://api.shortmetrics.ai/events) */
  endpoint?: string;

  /** Track custom_app_opened / custom_app_backgrounded (default: false) */
  autoTrackSessions?: boolean;
}
```

## Sending and the Queue

- Every event is saved in AsyncStorage (`@shortmetrics_queue`, up to 1,000 events; the oldest are dropped beyond that).
- The queue is sent about 2 seconds after an event is tracked, on `initialize()`, when the app comes to the foreground or goes to the background, and every 30 seconds while events are waiting. `flush()` sends it right away.
- Each request is `POST <endpoint>` with `{ "events": [...] }` and up to 50 events, the `X-API-Key` header and a 15 second timeout. Only one request runs at a time.
- A 2xx response removes the batch. A network error, timeout, 5xx or 429 keeps it and retries with backoff from 2 seconds up to 5 minutes, honouring `Retry-After`. Any other 4xx drops the batch with a `console.warn`.

Each event carries a client `eventId` (UUID v4) and `occurredAt` (ISO time) set when it was tracked:

```json
{
  "events": [
    {
      "eventId": "6f1c2a9e-1b2c-4d3e-8f90-1a2b3c4d5e6f",
      "occurredAt": "2026-11-20T12:00:00.000Z",
      "eventType": "purchase",
      "userId": "user_123",
      "sessionId": "1732104000000-abc123",
      "installId": "1732104000000-k3j4h5g6f7",
      "properties": { "amount": 99.99, "currency": "USD", "platform": "ios", "sdk_version": "1.1.0" }
    }
  ]
}
```

## Device Signals

The SDK adds these keys to the properties of every event. They are reserved: they always win over app properties and context, and a dev build logs a warning when an app key collides with one.

| Key | Source |
| --- | --- |
| `platform`, `os_version` | `Platform` (`ios` / `android`) |
| `app_version`, `app_bundle_id`, `device_model` | expo-constants or react-native-device-info (`unknown` when unavailable) |
| `device_id`, `isExpo` | react-native-device-info / expo-constants (as in 1.0.0) |
| `build_number`, `os_build_id` | expo-application / expo-device, or react-native-device-info |
| `screen_width`, `screen_height`, `screen_scale`, `font_scale` | `Dimensions` / `PixelRatio` |
| `locale`, `region`, `timezone` | `Intl.DateTimeFormat().resolvedOptions()` (`region` is the locale's region) |
| `user_agent` | react-native-device-info (WebView user agent) |
| `sdk_version` | This SDK |

Keys other than the first five are left out when they are unavailable. The server adds the IP-derived fields.

## Advanced Features

### Session Management

```typescript
// Reset the session (generate new session ID)
await ShortMetrics.resetSession();
```

### Event Options

```typescript
ShortMetrics.track("custom_event", {
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

## Auto-Tracked Events

- `app_installed` - First launch of an install (sent once; upgrades from 1.0.0 do not send it again)

When `autoTrackSessions: true`:

- `custom_app_opened` - App comes to the foreground from the background
- `custom_app_backgrounded` - App goes from the foreground to the background

Passing through `inactive` (for example the app switcher or Control Center) does not send an event.

## Storage Keys

| Key | Content |
| --- | --- |
| `@event_tracker_install_id` | Install ID |
| `@event_tracker_session_id` | Session ID |
| `@event_tracker_user_id` | Identified user ID |
| `@event_tracker_install_tracked` | `true` once `app_installed` was queued |
| `@shortmetrics_context` | App context |
| `@shortmetrics_queue` | Events waiting to be sent |

## Privacy & Security

- API keys are designed to be public (embedded in apps)
- No PII is collected unless explicitly provided
- Events are rate-limited on the server
- User data is stored locally using AsyncStorage
- Session IDs are randomly generated

## Troubleshooting

### Events not appearing

1. Check your API key is correct (starts with `evt2_`)
2. If you set `endpoint`, check it (default: `https://api.shortmetrics.ai/events`)
3. Check console warnings: a rejected batch is logged as `ShortMetrics dropped N events: <status>`
4. Events are stored in BigQuery `event_tracking.pixel_events`

### AsyncStorage errors

Install the peer dependency:

```bash
npm install @react-native-async-storage/async-storage
```

## API Reference

### ShortMetrics

ShortMetrics is a singleton, accessed via static methods:

#### Methods

- `configure(config): void` - Configure the tracker
- `initialize(): Promise<void>` - Restore saved state and send queued events (optional, runs on first use)
- `identify(userId, email?, phone?): Promise<void>` - Identify user
- `clearIdentity(): Promise<void>` - Clear user identity and app context
- `setContext(context): Promise<void>` - Merge keys into the app context
- `clearContext(): Promise<void>` - Remove all app context
- `track(eventType, options?): Promise<void>` - Track any event
- `trackPredefined(eventType, properties?, options?): Promise<void>` - Track predefined event
- `trackCustom(eventName, options?): Promise<void>` - Track custom event
- `trackAttribution(input): Promise<void>` - Track the acquisition source and post URL
- `flush(): Promise<void>` - Send queued events now
- `resetSession(): Promise<void>` - Reset session ID
- `reset(): Promise<void>` - Stop timers and listeners and clear in-memory state (useful for testing or reconfiguring)

## Example App

See the `example/` directory for a complete working example.

## Changelog

See [CHANGELOG.md](./CHANGELOG.md).

## License

MIT
