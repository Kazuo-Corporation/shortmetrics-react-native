# ShortMetrics React Native Package - Overview

An event tracking SDK for React Native and Expo apps that sends events to the ShortMetrics pixel backend (`trackEvent` behind `https://api.shortmetrics.ai/events`), which stores them in BigQuery `event_tracking.pixel_events`.

## Package Structure

```
shortmetrics-react-native/
├── src/
│   ├── ShortMetrics.ts         # Singleton API: identity, context, tracking, app state
│   ├── queue.ts                # Persisted queue, batching, retries
│   ├── useShortMetrics.ts      # React hook
│   ├── types.ts                # TypeScript types
│   ├── storage.ts              # AsyncStorage wrapper
│   ├── index.ts                # Public exports
│   └── utils/
│       └── deviceInfo.ts       # Device signals
├── __tests__/                  # Jest unit tests (integration tests in __tests__/integration)
├── example/
│   └── App.tsx                 # Example implementation
├── README.md                   # Full documentation
├── QUICKSTART.md               # Quick start guide
├── PUBLISHING.md               # npm publishing guide
└── CHANGELOG.md                # Release notes
```

## How It Works

```
App calls track*  ──►  ShortMetrics stamps the event  ──►  AsyncStorage queue
                       (eventId, occurredAt, user,          (@shortmetrics_queue,
                        session, context, device)            max 1,000 events)
                                                                   │
                                                                   ▼
BigQuery  ◄──  pixelIngestWorker  ◄──  trackEvent  ◄──  POST { events: [≤50] }
event_tracking.pixel_events            (API key check,      (retried with backoff
                                        rate limit)          on 5xx / 429 / network)
```

1. **Track:** `track`, `trackPredefined`, `trackCustom` and `trackAttribution` add an event to the queue and resolve. They never reject.
2. **Stamp:** each event gets a UUID v4 `eventId`, an ISO `occurredAt`, the current user, session and app context, and the device signals. The install ID and device signals are filled in at send time if they were not ready yet.
3. **Send:** about 2 seconds after tracking, on `initialize()`, on foreground/background changes, every 30 seconds while events wait, or on `flush()`. One request at a time, 15 second timeout.
4. **Result:** 2xx removes the batch; network errors, 5xx and 429 retry with backoff from 2 seconds to 5 minutes (honouring `Retry-After`); any other 4xx drops the batch with a `console.warn`.

## What the Backend Receives

```
POST https://api.shortmetrics.ai/events
Content-Type: application/json
X-API-Key: evt2_YOUR_KEY_HERE
```

```json
{
  "events": [
    {
      "eventId": "6f1c2a9e-1b2c-4d3e-8f90-1a2b3c4d5e6f",
      "occurredAt": "2026-11-20T12:00:00.000Z",
      "eventType": "custom_attribution_post_url",
      "userId": "user_123",
      "sessionId": "1732104000000-abc123",
      "installId": "1732104000000-k3j4h5g6f7",
      "properties": {
        "post_url": "https://www.tiktok.com/@creator/video/123",
        "social_platform": "tiktok",
        "resolved_via": "onboarding_answer",
        "storefront_country": "US",
        "platform": "ios",
        "os_version": "18.1",
        "app_version": "1.4.0",
        "app_bundle_id": "com.example.app",
        "device_model": "iPhone",
        "isExpo": true,
        "build_number": "42",
        "screen_width": 393,
        "screen_height": 852,
        "screen_scale": 3,
        "font_scale": 1,
        "locale": "en-US",
        "region": "US",
        "timezone": "America/Los_Angeles",
        "sdk_version": "1.1.0"
      }
    }
  ]
}
```

`properties` stays flat: the ingest worker reads `app_bundle_id`, `platform` and `app_version` from it. Device signal keys are reserved and always win over app properties and context, so `platform` is always the device OS; a post's platform goes in `social_platform`.

The backend also accepts the 1.0.0 format (one event per request, no `events` wrapper).

## Predefined Events

These events work without the `custom_` prefix:

| Event Type | Use Case | Example Properties |
|-----------|----------|-------------------|
| `app_installed` | First app install (sent automatically) | - |
| `purchase` | In-app purchase | `{ amount, currency, product }` |
| `attribution` | Acquisition source | `{ attribution, resolved_via, prompt_variant? }` |

All other events need the `custom_` prefix or `trackCustom()`. Any other event type is ignored with a warning, because the server would reject the whole batch.

## Configuration

```typescript
{
  apiKey: string;              // Required (evt2_...)
  endpoint?: string;           // Default: https://api.shortmetrics.ai/events
  autoTrackSessions?: boolean; // custom_app_opened / custom_app_backgrounded (default: false)
}
```

## What Gets Stored Locally

Using AsyncStorage:

```
@event_tracker_install_id      → "1732104000000-k3j4h5g6f7"
@event_tracker_session_id      → "1732104000000-abc123"
@event_tracker_user_id         → "user_123"
@event_tracker_install_tracked → "true"
@shortmetrics_context          → {"storefront_country":"US"}
@shortmetrics_queue            → [...events waiting to be sent]
```

The `@event_tracker_*` keys are the 1.0.0 keys, so upgraded installs keep their IDs and do not send `app_installed` again.

## Privacy

- API keys are meant to be public (embedded in apps); the backend rate-limits them
- Only what you track, the device signals and the context you set are sent
- User IDs, email and phone are sent only after `identify()`

## Testing

```bash
npm test                  # unit tests
npx tsc --noEmit -p .     # typecheck
npm run test:integration  # real requests, needs test.config.ts
```

Verify events in BigQuery:

```bash
bq query --use_legacy_sql=false \
'SELECT event_id, timestamp, event_type, platform, properties
 FROM `event_tracking.pixel_events`
 ORDER BY timestamp DESC LIMIT 10'
```

## Documentation Files

- **README.md** - Complete user documentation
- **QUICKSTART.md** - 5-minute setup guide
- **PUBLISHING.md** - How to publish to npm
- **CHANGELOG.md** - Release notes
- **PACKAGE_OVERVIEW.md** - This file (architecture)
- **example/App.tsx** - Working example app
