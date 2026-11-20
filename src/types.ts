export interface ShortMetricsConfig {
  /** Your pixel API key (evt2_xxxx) */
  apiKey: string;
  /** API endpoint URL (default: https://api.shortmetrics.ai/events) */
  endpoint?: string;
  /** Send custom_app_opened / custom_app_backgrounded on foreground changes (default: false) */
  autoTrackSessions?: boolean;
}

export interface TrackingEventOptions {
  /** User ID */
  userId?: string;
  /** User email */
  email?: string;
  /** User phone */
  phone?: string;
  /** Custom properties */
  properties?: Record<string, any>;
  /** Override session ID */
  sessionId?: string;
}

export interface PredefinedEvents {
  app_installed: void;
  purchase: { amount?: number; currency?: string; [key: string]: any };
  attribution: { attribution: string; resolved_via?: string; prompt_variant?: string; [key: string]: any };
}

export type EventType = keyof PredefinedEvents | `custom_${string}`;

/** App context stamped onto every event tracked after it is set. null or undefined removes a key. */
export type ShortMetricsContext = Record<string, string | number | boolean | null | undefined>;

export interface AttributionInput {
  /** The acquisition source answer, sent as `attribution` */
  source: string;
  /** The pasted post URL; when set, a custom_attribution_post_url event is also sent */
  postUrl?: string | null;
  /** The social platform of the post URL (tiktok, instagram, ...) */
  socialPlatform?: string | null;
  /** The onboarding prompt variant the user saw */
  promptVariant?: string | null;
  /** How the source was resolved (default: onboarding_answer) */
  resolvedVia?: string;
  /** Extra properties added to both events */
  properties?: Record<string, unknown>;
}

/** Device signals the SDK adds to every event. These keys are reserved and always win. */
export interface DeviceInfo {
  platform: 'ios' | 'android' | 'web' | string;
  os_version: string;
  app_version: string;
  app_bundle_id: string;
  device_model: string;
  device_id?: string;
  isExpo?: boolean;
  build_number?: string;
  os_build_id?: string;
  screen_width?: number;
  screen_height?: number;
  screen_scale?: number;
  font_scale?: number;
  locale?: string;
  region?: string;
  timezone?: string;
  user_agent?: string;
  sdk_version: string;
}

/** One event as sent to the server inside { events: [...] } */
export interface QueuedEvent {
  eventId: string;
  occurredAt: string;
  eventType: string;
  userId?: string;
  email?: string;
  phone?: string;
  sessionId?: string;
  installId?: string;
  properties: Record<string, any>;
}
