# Changelog

## 1.1.0

### Added

- Persistent event queue (`@shortmetrics_queue`, up to 1,000 events). Events are sent as `{ events: [...] }` with up to 50 per request and retried with backoff on network errors, timeouts, 5xx and 429 (honouring `Retry-After`).
- `flush()` sends queued events right away.
- `setContext()` / `clearContext()`: app context saved on the device and added to every later event.
- `trackAttribution()` sends `attribution` and, with a post URL, `custom_attribution_post_url` (with `social_platform`).
- `attribution` is a predefined event type.
- Each event carries a client `eventId` (UUID v4) and `occurredAt`.
- Device signals: `build_number`, `os_build_id`, `screen_width`, `screen_height`, `screen_scale`, `font_scale`, `locale`, `region`, `timezone`, `user_agent`, `sdk_version`.

### Changed

- `endpoint` is optional and defaults to `https://api.shortmetrics.ai/events`.
- `autoTrackSessions` defaults to `false`. When enabled, events are sent only on real foreground/background changes.
- Device signal keys are reserved: they win over app properties and context. Send a post's platform as `social_platform`, not `platform`. A 1.0.0-style `custom_attribution_post_url` with `platform` (tiktok/instagram) and no `social_platform` keeps that value as `social_platform`.
- `track`, `trackPredefined`, `trackCustom`, `identify` and `clearIdentity` never reject, and `identify` / `clearIdentity` work before `configure`.
- `clearIdentity()` also clears the app context.

### Removed

- The unused config options `debug`, `enableBatching`, `batchSize` and `batchTimeout`, and the unused event fields `retries`, `url` and `referrer`.

### Backward compatibility

- Event names, top-level fields (`eventType`, `userId`, `email`, `phone`, `sessionId`, `installId`) and the flat `properties` shape are unchanged. The server already accepts the batch format, so 1.1.0 works with the current backend.
- The 1.0.0 device keys (`platform`, `os_version`, `app_version`, `app_bundle_id`, `device_model`, `device_id`, `isExpo`) keep their values and fallbacks.
- The 1.0.0 storage keys are reused, so upgraded installs keep their install ID, session ID and user ID and do not send `app_installed` again.

## 1.0.0

- Initial release.
