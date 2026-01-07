import { AppState, AppStateStatus } from 'react-native';
import { Storage } from './storage';
import { getDeviceInfo } from './utils/deviceInfo';
import type {
  ShortMetricsConfig,
  TrackingEventOptions,
  EventType,
  PredefinedEvents,
  QueuedEvent,
} from './types';

class ShortMetricsInstance {
  private apiKey: string = '';
  private endpoint: string = '';
  private sessionId: string = '';
  private installId: string = '';
  private deviceInfo: any = null;
  private initialized: boolean = false;
  private configured: boolean = false;
  private currentUserId?: string;
  private currentUserEmail?: string;
  private currentUserPhone?: string;
  private appStateSubscription: any = null;

  /**
   * Configure ShortMetrics (must be called before using)
   */
  configure(config: ShortMetricsConfig): void {
    if (this.configured) {
      console.warn('ShortMetrics already configured. Call reset() first to reconfigure.');
      return;
    }

    this.apiKey = config.apiKey;
    this.endpoint = config.endpoint;
    
    // Generate session ID
    this.sessionId = this.generateSessionId();

    // Auto-track app state changes
    if (config.autoTrackSessions !== false) {
      this.setupAppStateTracking();
    }

    this.configured = true;
  }

  /**
   * Initialize tracker (async operations)
   */
  async initialize(): Promise<void> {
    if (!this.configured) {
      throw new Error('ShortMetrics must be configured before initialization. Call ShortMetrics.configure() first.');
    }

    if (this.initialized) return;

    // Set initialized flag immediately to prevent infinite recursion
    this.initialized = true;

    try {
      // Load device info
      this.deviceInfo = await getDeviceInfo();

      // Restore or create session
      const savedSessionId = await Storage.getSessionId();
      if (savedSessionId) {
        this.sessionId = savedSessionId;
      } else {
        await Storage.setSessionId(this.sessionId);
      }

      // Restore user ID if exists
      const savedUserId = await Storage.getUserId();
      if (savedUserId) {
        this.currentUserId = savedUserId;
      }

      // Restore or create installation ID
      const savedInstallId = await Storage.getInstallId();
      if (savedInstallId) {
        this.installId = savedInstallId;
      } else {
        this.installId = this.generateInstallId();
        await Storage.setInstallId(this.installId);
      }

      // Auto-track app install on first launch
      const installTracked = await Storage.isInstallTracked();
      if (!installTracked) {
        await this.trackPredefined('app_installed');
        await Storage.setInstallTracked();
      }
    } catch (error) {
      console.error('ShortMetrics initialization error:', error);
      this.initialized = false; // Reset on error
    }
  }

  /**
   * Identify user
   */
  async identify(userId: string, email?: string, phone?: string): Promise<void> {
    this.ensureConfigured();

    // Check if user ID is changing
    const isUserChanging = this.currentUserId !== userId;
    
    this.currentUserId = userId;
    this.currentUserEmail = email;
    this.currentUserPhone = phone;
    
    await Storage.setUserId(userId);

    // Only track identification event if user changed
    if (isUserChanging) {
      await this.track('custom_user_identified', {
        userId,
        email,
        phone,
      });
    }
  }

  /**
   * Clear user identity
   */
  async clearIdentity(): Promise<void> {
    this.ensureConfigured();
    this.currentUserId = undefined;
    this.currentUserEmail = undefined;
    this.currentUserPhone = undefined;
    await Storage.clearUserId();
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
    const eventType = eventName.startsWith('custom_')
      ? eventName
      : `custom_${eventName}`;
    await this.track(eventType as EventType, options);
  }

  /**
   * Track any event
   */
  async track(
    eventType: EventType,
    options?: TrackingEventOptions
  ): Promise<void> {
    this.ensureConfigured();

    if (!this.initialized) {
      await this.initialize();
    }

    const eventData: QueuedEvent = {
      eventType,
      userId: options?.userId || this.currentUserId,
      email: options?.email || this.currentUserEmail,
      phone: options?.phone || this.currentUserPhone,
      sessionId: options?.sessionId || this.sessionId,
      installId: this.installId,
      properties: {
        ...this.deviceInfo,
        ...options?.properties,
      },
      retries: 0,
    };

    await this.sendEvent(eventData);
  }

  /**
   * Send event to server
   */
  private async sendEvent(eventData: QueuedEvent): Promise<void> {
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
        },
        body: JSON.stringify(eventData),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Event tracking failed: ${response.status} ${error}`);
      }

      await response.json();
    } catch (error) {
      console.error('Event tracking error:', error);
      throw error;
    }
  }

  /**
   * Setup app state tracking
   */
  private setupAppStateTracking(): void {
    this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);
  }

  /**
   * Handle app state changes
   */
  private handleAppStateChange = async (nextAppState: AppStateStatus) => {
    if (nextAppState === 'active') {
      // App came to foreground
      await this.trackCustom('app_opened');
    } else if (nextAppState === 'background') {
      // App went to background
      await this.trackCustom('app_backgrounded');
    }
  };

  /**
   * Reset session (generate new session ID)
   */
  async resetSession(): Promise<void> {
    this.ensureConfigured();
    this.sessionId = this.generateSessionId();
    await Storage.setSessionId(this.sessionId);
  }

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
   * Check if configured
   */
  private ensureConfigured(): void {
    if (!this.configured) {
      throw new Error('ShortMetrics must be configured first. Call ShortMetrics.configure() with your config.');
    }
  }

  /**
   * Reset and cleanup (useful for testing or reconfiguring)
   */
  async reset(): Promise<void> {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
    }
    this.apiKey = '';
    this.endpoint = '';
    this.sessionId = '';
    this.installId = '';
    this.deviceInfo = null;
    this.initialized = false;
    this.configured = false;
    this.currentUserId = undefined;
    this.currentUserEmail = undefined;
    this.currentUserPhone = undefined;
    this.appStateSubscription = null;
  }
}

// Create singleton instance
const instance = new ShortMetricsInstance();

// Export singleton API
export const ShortMetrics = {
  /**
   * Configure ShortMetrics with your API credentials
   * Must be called before using any other methods
   */
  configure: (config: ShortMetricsConfig) => instance.configure(config),
  
  /**
   * Initialize ShortMetrics (loads device info, restores session, etc.)
   * This is called automatically on first track() call, but you can call it explicitly
   */
  initialize: () => instance.initialize(),
  
  /**
   * Identify a user
   */
  identify: (userId: string, email?: string, phone?: string) => 
    instance.identify(userId, email, phone),
  
  /**
   * Clear user identity
   */
  clearIdentity: () => instance.clearIdentity(),
  
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
   * Track any event
   */
  track: (eventType: EventType, options?: TrackingEventOptions) =>
    instance.track(eventType, options),
  
  /**
   * Reset the current session
   */
  resetSession: () => instance.resetSession(),
  
  /**
   * Reset and cleanup the tracker (useful for testing or reconfiguring)
   */
  reset: () => instance.reset(),
};

