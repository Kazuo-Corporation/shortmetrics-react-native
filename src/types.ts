export interface ShortMetricsConfig {
  /** Your pixel API key (evt_xxxx) */
  apiKey: string;
  /** API endpoint URL */
  endpoint: string;
  /** Enable debug logging */
  debug?: boolean;
  /** Enable automatic session tracking */
  autoTrackSessions?: boolean;
  /** Batch events (send multiple at once) */
  enableBatching?: boolean;
  /** Batch size before auto-send */
  batchSize?: number;
  /** Batch timeout in ms */
  batchTimeout?: number;
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
}

export type EventType = keyof PredefinedEvents | `custom_${string}`;

export interface DeviceInfo {
  platform: 'ios' | 'android' | 'web' | string;
  os_version: string;
  app_version: string;
  app_bundle_id: string;
  device_model: string;
  device_id?: string;
}

export interface QueuedEvent {
  eventType: string;
  userId?: string;
  email?: string;
  phone?: string;
  sessionId?: string;
  installId?: string;
  properties?: Record<string, any>;
  url?: string;
  referrer?: string;
  retries?: number;
}

