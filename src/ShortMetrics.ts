import { AppState, AppStateStatus } from 'react-native';
import { Storage } from './storage';
import { EventQueue } from './queue';
import { getDeviceInfo, RESERVED_KEYS } from './utils/deviceInfo';
import type {
  AttributionInput,
  ShortMetricsConfig,
  ShortMetricsContext,
  TrackingEventOptions,
  EventType,
  PredefinedEvents,
  QueuedEvent,
} from './types';

const DEFAULT_ENDPOINT = 'https://api.shortmetrics.ai/events';

// Event types the server accepts; anything else would make it reject the whole batch
const SERVER_EVENT_TYPES = [
  'app_installed', 'purchase', 'trial_started', 'trial_ended',
  'subscription_started', 'subscription_cancelled', 'attribution',
];

class ShortMetricsInstance {
  private apiKey: string = '';
  private endpoint: string = DEFAULT_ENDPOINT;
  private configured: boolean = false;
  private autoTrackSessions: boolean = false;
  private loading: Promise<void> | null = null;
  private deviceLoading: Promise<Record<string, any>> | null = null;
  private deviceInfo: Record<string, any> | null = null;
  private sessionId: string = '';
  private installId: string = '';
  private currentUserId?: string;
  private currentUserEmail?: string;
  private currentUserPhone?: string;
  private context: Record<string, string | number | boolean> = {};
  private appStateSubscription: { remove: () => void } | null = null;
  private wasActive: boolean = false;
  private queue = this.createQueue();

  /**
   * Configure ShortMetrics (call once at startup)
   */
  configure(config: ShortMetricsConfig): void {
    if (this.configured) {
      console.warn('ShortMetrics already configured. Call reset() first to reconfigure.');
      return;
    }

    this.apiKey = config.apiKey;
    this.endpoint = config.endpoint || DEFAULT_ENDPOINT;
    this.autoTrackSessions = config.autoTrackSessions !== false;
    this.configured = true;

    // Flush on foreground/background changes (and track sessions when enabled)
    this.wasActive = AppState.currentState === 'active';
    this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);
    this.queue.start();
  }

  /**
   * Restore saved state and send queued events. Called automatically on first use.
   */
  async initialize(): Promise<void> {
    await this.ready();
    void this.queue.flush();
  }

  /**
   * Identify user (works before configure; events are sent once configured)
   */
  async identify(userId: string, email?: string, phone?: string): Promise<void> {
    try {
      await this.ready();

      // Only track identification event if user changed
      const isUserChanging = this.currentUserId !== userId;
      this.currentUserId = userId;
      this.currentUserEmail = email;
      this.currentUserPhone = phone;

      await Storage.setUserId(userId);

      if (isUserChanging) {
        await this.track('custom_user_identified', { userId, email, phone });
      }
    } catch (error) {
      console.warn('ShortMetrics identify error:', error);
    }
  }

  /**
   * Clear user identity and app context
   */
  async clearIdentity(): Promise<void> {
    try {
      await this.ready();
      this.currentUserId = undefined;
      this.currentUserEmail = undefined;
      this.currentUserPhone = undefined;
      this.context = {};
      await Storage.clearUserId();
      await Storage.clearContext();
    } catch (error) {
      console.warn('ShortMetrics clearIdentity error:', error);
    }
  }

  /**
   * Merge keys into the saved app context; null or undefined removes a key
   */
  async setContext(context: ShortMetricsContext): Promise<void> {
    try {
      await this.ready();
      warnReservedKeys(context || {});
      const next = { ...this.context };
      for (const [key, value] of Object.entries(context || {})) {
        if (value === null || value === undefined) delete next[key];
        else next[key] = value;
      }
      this.context = next;
      await Storage.setContext(next);
    } catch (error) {
      console.warn('ShortMetrics setContext error:', error);
    }
  }

  /**
   * Remove all app context
   */
  async clearContext(): Promise<void> {
    try {
      await this.ready();
      this.context = {};
      await Storage.clearContext();
    } catch (error) {
      console.warn('ShortMetrics clearContext error:', error);
    }
  }

  /**
   * Track predefined event
   */
  async trackPredefined<K extends keyof PredefinedEvents>(
    eventType: K,
    properties?: PredefinedEvents[K],
    options?: Omit<TrackingEventOptions, 'properties'>
  ): Promise<void> {
    await this.track(eventType, {
      ...options,
      properties: properties as any,
    });
  }

  /**
   * Track custom event
   */
  async trackCustom(
    eventName: string,
    options?: TrackingEventOptions
  ): Promise<void> {
    const eventType = String(eventName).startsWith('custom_')
      ? eventName
      : `custom_${eventName}`;
    await this.track(eventType as EventType, options);
  }

  /**
   * Track the acquisition source answer, plus the pasted post URL when there is one
   */
  async trackAttribution(input: AttributionInput): Promise<void> {
    if (!input) return;
    const resolved_via = input.resolvedVia ?? 'onboarding_answer';
    const variant = input.promptVariant != null ? { prompt_variant: input.promptVariant } : {};

    await this.track('attribution', {
      properties: { attribution: input.source, resolved_via, ...variant, ...input.properties },
    });

    if (typeof input.postUrl === 'string' && input.postUrl.trim()) {
      await this.track('custom_attribution_post_url', {
        properties: {
          post_url: input.postUrl,
          ...(input.socialPlatform != null ? { social_platform: input.socialPlatform } : {}),
          resolved_via,
          ...variant,
          ...input.properties,
        },
      });
    }
  }

  /**
   * Track any event. Only adds the event to the queue, so it never rejects.
   */
  async track(
    eventType: EventType,
    options?: TrackingEventOptions
  ): Promise<void> {
    try {
      if (!eventType || (!eventType.startsWith('custom_') && !SERVER_EVENT_TYPES.includes(eventType))) {
        console.warn(`ShortMetrics ignored invalid event type: ${eventType}`);
        return;
      }

      await this.ready();
      await this.enqueue(eventType, options);
    } catch (error) {
      console.warn('ShortMetrics track error:', error);
    }
  }

  /**
   * Stamp identity, session and context onto the event and add it to the queue
   */
  private async enqueue(eventType: string, options?: TrackingEventOptions): Promise<void> {
    const appProperties = options?.properties || {};
    warnReservedKeys(appProperties);
    const properties: Record<string, any> = { ...appProperties, ...this.context };
    // 1.0.0 apps send the social platform as `platform` on the paste event; keep it before the device OS replaces it
    if (eventType === 'custom_attribution_post_url' && properties.platform != null && properties.social_platform == null) {
      properties.social_platform = properties.platform;
    }
    // Reserved keys always come from the device (added at flush time when not loaded yet)
    for (const key of RESERVED_KEYS) delete properties[key];
    if (this.deviceInfo) Object.assign(properties, this.deviceInfo);

    await this.queue.enqueue({
      eventId: uuid(),
      occurredAt: new Date().toISOString(),
      eventType,
      userId: options?.userId || this.currentUserId,
      email: options?.email || this.currentUserEmail,
      phone: options?.phone || this.currentUserPhone,
      sessionId: options?.sessionId || this.sessionId,
      installId: this.installId || undefined,
      properties,
    });
  }

  /**
   * Send queued events now
   */
  async flush(): Promise<void> {
    await this.ready();
    await this.queue.flush();
  }

  /**
   * Reset session (generate new session ID)
   */
  async resetSession(): Promise<void> {
    await this.ready();
    this.sessionId = this.generateSessionId();
    await Storage.setSessionId(this.sessionId);
  }

  /**
   * Restore saved identity, session, install ID, context and queue (once).
   * Tracks app_installed on first launch.
   */
  private ready(): Promise<void> {
    if (!this.loading) {
      this.loading = this.load();
    }
    return this.loading;
  }

  private async load(): Promise<void> {
    void this.loadDeviceInfo();
    try {
      const [savedSessionId, savedUserId, savedInstallId, savedContext] = await Promise.all([
        Storage.getSessionId(),
        Storage.getUserId(),
        Storage.getInstallId(),
        Storage.getContext(),
        this.queue.load(),
      ]);

      this.sessionId = savedSessionId || this.generateSessionId();
      if (!savedSessionId) await Storage.setSessionId(this.sessionId);

      this.currentUserId = savedUserId || undefined;

      this.installId = savedInstallId || this.generateInstallId();
      if (!savedInstallId) await Storage.setInstallId(this.installId);

      this.context = savedContext;

      // Auto-track app install on first launch
      const installTracked = await Storage.isInstallTracked();
      if (!installTracked) {
        await this.enqueue('app_installed');
        await Storage.setInstallTracked();
      }
    } catch (error) {
      console.error('ShortMetrics initialization error:', error);
      if (!this.sessionId) this.sessionId = this.generateSessionId();
    }
  }

  private loadDeviceInfo(): Promise<Record<string, any>> {
    if (!this.deviceLoading) {
      this.deviceLoading = getDeviceInfo()
        .catch(() => ({}))
        .then((info) => {
          this.deviceInfo = info;
          return info;
        });
    }
    return this.deviceLoading;
  }

  private createQueue(): EventQueue {
    return new EventQueue({
      getTarget: () => (this.configured ? { endpoint: this.endpoint, apiKey: this.apiKey } : null),
      prepare: async (events: QueuedEvent[]) => {
        const deviceInfo = await this.loadDeviceInfo();
        return events.map((event) => ({
          ...event,
          installId: event.installId || this.installId || undefined,
          properties: event.properties?.sdk_version === undefined
            ? { ...event.properties, ...deviceInfo }
            : event.properties,
        }));
      },
    });
  }

  /**
   * Handle app state changes: session events on real foreground changes, then flush
   */
  private handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (nextAppState !== 'active' && nextAppState !== 'background') return;
    const isActive = nextAppState === 'active';
    const changed = isActive !== this.wasActive;
    this.wasActive = isActive;

    const session = this.autoTrackSessions && changed
      ? this.trackCustom(isActive ? 'app_opened' : 'app_backgrounded')
      : Promise.resolve();
    void session.then(() => this.queue.flush());
  };

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Generate installation ID (time-based)
   */
  private generateInstallId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Reset and cleanup (useful for testing or reconfiguring). Saved state and queued events stay in storage.
   */
  async reset(): Promise<void> {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
    }
    this.queue.stop();
    this.queue = this.createQueue();
    this.apiKey = '';
    this.endpoint = DEFAULT_ENDPOINT;
    this.configured = false;
    this.autoTrackSessions = false;
    this.loading = null;
    this.deviceLoading = null;
    this.deviceInfo = null;
    this.sessionId = '';
    this.installId = '';
    this.currentUserId = undefined;
    this.currentUserEmail = undefined;
    this.currentUserPhone = undefined;
    this.context = {};
    this.appStateSubscription = null;
    this.wasActive = false;
  }
}

/** UUID v4 from Math.random (Hermes has no crypto.randomUUID) */
function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function warnReservedKeys(properties: Record<string, unknown>): void {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return;
  const collisions = Object.keys(properties).filter((key) => RESERVED_KEYS.includes(key));
  if (collisions.length) {
    console.warn(`ShortMetrics: ${collisions.join(', ')} are reserved device signal keys and are overwritten`);
  }
}

// Create singleton instance
const instance = new ShortMetricsInstance();

// Export singleton API
export const ShortMetrics = {
  /**
   * Configure ShortMetrics with your API key (endpoint defaults to https://api.shortmetrics.ai/events)
   */
  configure: (config: ShortMetricsConfig) => instance.configure(config),

  /**
   * Initialize ShortMetrics (restores saved state, sends queued events)
   * This is called automatically on first use, but you can call it explicitly
   */
  initialize: () => instance.initialize(),

  /**
   * Identify a user
   */
  identify: (userId: string, email?: string, phone?: string) =>
    instance.identify(userId, email, phone),

  /**
   * Clear user identity and app context
   */
  clearIdentity: () => instance.clearIdentity(),

  /**
   * Merge keys into the app context stamped on every later event (null removes a key)
   */
  setContext: (context: ShortMetricsContext) => instance.setContext(context),

  /**
   * Remove all app context
   */
  clearContext: () => instance.clearContext(),

  /**
   * Track a predefined event
   */
  trackPredefined: <K extends keyof PredefinedEvents>(
    eventType: K,
    properties?: PredefinedEvents[K],
    options?: Omit<TrackingEventOptions, 'properties'>
  ) => instance.trackPredefined(eventType, properties, options),

  /**
   * Track a custom event
   */
  trackCustom: (eventName: string, options?: TrackingEventOptions) =>
    instance.trackCustom(eventName, options),

  /**
   * Track the acquisition source answer (and the pasted post URL, if any)
   */
  trackAttribution: (input: AttributionInput) => instance.trackAttribution(input),

  /**
   * Track any event
   */
  track: (eventType: EventType, options?: TrackingEventOptions) =>
    instance.track(eventType, options),

  /**
   * Send queued events now
   */
  flush: () => instance.flush(),

  /**
   * Reset the current session
   */
  resetSession: () => instance.resetSession(),

  /**
   * Reset and cleanup the tracker (useful for testing or reconfiguring)
   */
  reset: () => instance.reset(),
};
