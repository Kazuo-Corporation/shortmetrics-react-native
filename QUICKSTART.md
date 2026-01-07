# Quick Start Guide

Get your Event Tracker SDK up and running in 5 minutes!

## Step 1: Build the Package

```bash
cd /home/johnny/shortmetrics-react-native
npm install
npm run build
```

## Step 2: Test Locally (Optional)

Package it for local testing:

```bash
npm pack
# Creates: kazuocorporation-shortmetrics-react-native-1.0.0.tgz
```

Install in your React Native/Expo project:

```bash
cd your-app-directory
npm install /home/johnny/shortmetrics-react-native/kazuocorporation-shortmetrics-react-native-1.0.0.tgz
npm install @react-native-async-storage/async-storage
```

## Step 3: Use in Your App

### Option A: Singleton Pattern (Recommended)

```typescript
// App.tsx or index.tsx
import { ShortMetrics } from "@kazuocorporation/shortmetrics-react-native";

// Configure once at app startup
ShortMetrics.configure({
  apiKey: "evt_YOUR_API_KEY",
  endpoint: "https://us-central1-YOUR_PROJECT.cloudfunctions.net/trackEvent",
  autoTrackSessions: true,
});

// Initialize immediately (optional, will auto-initialize on first track)
ShortMetrics.initialize();
```

Then use anywhere in your app:

```typescript
import { ShortMetrics } from "@kazuocorporation/shortmetrics-react-native";

// Track events from anywhere - no need to import an instance
await ShortMetrics.trackPredefined("purchase", { amount: 99.99 });
await ShortMetrics.trackCustom("button_clicked", { properties: { name: "signup" } });
```

### Option B: React Hook

```typescript
import { useShortMetrics, ShortMetrics } from "@kazuocorporation/shortmetrics-react-native";

function MyComponent() {
  // Hook configures the singleton
  useShortMetrics({
    apiKey: "evt_YOUR_API_KEY",
    endpoint: "https://...",
  });

  const handleClick = async () => {
    await ShortMetrics.trackCustom("button_clicked");
  };

  return <Button title="Click Me" onPress={handleClick} />;
}
```

## Step 4: Get Your API Key

1. Log into your dashboard
2. Go to Settings > Pixel Tracking
3. Click "Generate Pixel Key"
4. Copy the key (starts with `evt_`)
5. Add to your app's environment config

### Environment Setup

Create `.env` in your project root:

```bash
EXPO_PUBLIC_PIXEL_KEY=evt_YOUR_KEY_HERE
EXPO_PUBLIC_PIXEL_ENDPOINT=https://us-central1-YOUR_PROJECT.cloudfunctions.net/trackEvent
```

For React Native (non-Expo), use `REACT_NATIVE_PIXEL_KEY` or your preferred env solution.

Use in code:

```typescript
ShortMetrics.configure({
  apiKey: process.env.EXPO_PUBLIC_PIXEL_KEY!,
  endpoint: process.env.EXPO_PUBLIC_PIXEL_ENDPOINT!,
});
```

## Step 5: Track Events

### Identify Users

```typescript
// When user logs in
await ShortMetrics.identify("user_123", "user@example.com");

// When user logs out
await ShortMetrics.clearIdentity();
```

### Track Predefined Events

```typescript
// App installed
await ShortMetrics.trackPredefined("app_installed");

// Purchase
await ShortMetrics.trackPredefined("purchase", {
  amount: 99.99,
  currency: "USD",
  product: "Premium Plan",
});
```

### Track Custom Events

```typescript
await ShortMetrics.trackCustom("button_clicked", {
  properties: {
    button_name: "signup",
    screen: "home",
  },
});

await ShortMetrics.trackCustom("feature_used", {
  properties: {
    feature: "dark_mode",
    enabled: true,
  },
});
```

## Step 6: Verify Events

Check your BigQuery table to verify events are being tracked:

```bash
bq query --use_legacy_sql=false \
'SELECT
  event_id,
  timestamp,
  event_type,
  user_id,
  properties
FROM `pixel_event_tracking.events`
ORDER BY timestamp DESC
LIMIT 10'
```

Or check in BigQuery Console:
https://console.cloud.google.com/bigquery

## Common Patterns

### Track on App Launch

```typescript
// App.tsx
import { useEffect } from "react";
import { ShortMetrics } from "@kazuocorporation/shortmetrics-react-native";

function App() {
  useEffect(() => {
    // Track app open
    ShortMetrics.trackCustom("app_opened");

    // Cleanup on unmount
    return () => {
      ShortMetrics.reset();
    };
  }, []);

  return <YourAppContent />;
}
```

### Track Screen Views

```typescript
// Using React Navigation
import { useNavigationState } from "@react-navigation/native";
import { ShortMetrics } from "@kazuocorporation/shortmetrics-react-native";

function useScreenTracking() {
  const state = useNavigationState((state) => state);

  useEffect(() => {
    if (state) {
      const currentRoute = state.routes[state.index];
      ShortMetrics.trackCustom("screen_view", {
        properties: {
          screen: currentRoute.name,
          params: currentRoute.params,
        },
      });
    }
  }, [state]);
}
```

### Track Errors

```typescript
import { ErrorBoundary } from "react-error-boundary";
import { ShortMetrics } from "@kazuocorporation/shortmetrics-react-native";

function errorHandler(error: Error) {
  ShortMetrics.trackCustom("app_error", {
    properties: {
      message: error.message,
      stack: error.stack,
    },
  });
}

<ErrorBoundary onError={errorHandler}>
  <YourApp />
</ErrorBoundary>;
```

### Track Conversions

```typescript
import { ShortMetrics } from "@kazuocorporation/shortmetrics-react-native";

async function handlePurchaseComplete(amount: number, product: string) {
  // Track the purchase
  await ShortMetrics.trackPredefined("purchase", {
    amount,
    currency: "USD",
    product,
  });

  // Track as a conversion event too
  await ShortMetrics.trackCustom("conversion", {
    properties: {
      type: "purchase",
      value: amount,
      product,
    },
  });
}
```

## Troubleshooting

### Events not showing up?

1. **Check API key**: Make sure it starts with `evt_`
2. **Check endpoint**: Should be your Cloud Function URL
3. **Check console**: Look for error messages
4. **Verify BigQuery**: Table should exist at `pixel_event_tracking.events`

### TypeScript errors?

```bash
npm install --save-dev @types/react-native
```

### Build errors?

```bash
cd /home/johnny/shortmetrics-react-native
rm -rf dist node_modules
npm install
npm run build
```

## Next Steps

1. **Publish to npm**: See [PUBLISHING.md](./PUBLISHING.md)
2. **Add analytics dashboard**: Query BigQuery data
3. **Set up alerts**: Trigger on specific events
4. **Add more events**: Track user behavior
5. **A/B testing**: Use event properties to track experiments

## Need Help?

- Read the full [README.md](./README.md)
- Check the [example app](./example/App.tsx)
- Review your backend logs
- Verify BigQuery setup

## Production Checklist

Before going live:

- [ ] Tested all event types
- [ ] API key is in environment variables (not hardcoded)
- [ ] User identification works correctly
- [ ] Events appear in BigQuery
- [ ] Rate limits are appropriate
- [ ] Error handling is in place

Happy tracking! 🚀
