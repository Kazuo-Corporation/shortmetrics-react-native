import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { ShortMetrics } from '../src/ShortMetrics';
import { getDeviceInfo, RESERVED_KEYS } from '../src/utils/deviceInfo';
import type { QueuedEvent } from '../src/types';

jest.mock('../src/utils/deviceInfo', () => ({
  ...jest.requireActual('../src/utils/deviceInfo'),
  getDeviceInfo: jest.fn(),
}));

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('ShortMetrics', () => {
  const mockApiKey = 'evt2_test_123';
  const mockDeviceInfo = {
    platform: 'ios',
    os_version: '17.0',
    app_version: '1.0.0',
    app_bundle_id: 'com.example.app',
    device_model: 'iPhone 15',
    isExpo: true,
    locale: 'en-US',
    region: 'US',
    sdk_version: '1.1.0',
  };

  const fetchMock = () => global.fetch as jest.Mock;
  const sent = (): QueuedEvent[] =>
    fetchMock().mock.calls.flatMap((call) => JSON.parse(call[1].body).events);
  const sentOf = (eventType: string) => sent().filter((e) => e.eventType === eventType);
  // Event properties without the device signals
  const appProperties = (event: QueuedEvent) =>
    Object.fromEntries(Object.entries(event.properties).filter(([key]) => !RESERVED_KEYS.includes(key)));
  const lastOf = <T>(items: T[]) => items[items.length - 1];
  const appStateHandler = () =>
    lastOf((AppState.addEventListener as jest.Mock).mock.calls)[1] as (state: string) => void;

  const configure = (config: Partial<Parameters<typeof ShortMetrics.configure>[0]> = {}) =>
    ShortMetrics.configure({ apiKey: mockApiKey, ...config });

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    await ShortMetrics.reset();
    await AsyncStorage.clear();
    // Most tests run on an install that already sent app_installed
    await AsyncStorage.setItem('@event_tracker_install_tracked', 'true');

    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, headers: { get: () => null } });
    (getDeviceInfo as jest.Mock).mockResolvedValue(mockDeviceInfo);
  });

  afterEach(async () => {
    await ShortMetrics.reset();
    jest.useRealTimers();
  });

  describe('sending', () => {
    it('posts batches to the default endpoint with the API key', async () => {
      configure();
      await ShortMetrics.trackCustom('test_event');
      await ShortMetrics.flush();

      const [url, init] = fetchMock().mock.calls[0];
      expect(url).toBe('https://api.shortmetrics.ai/events');
      expect(init.headers).toEqual({ 'Content-Type': 'application/json', 'X-API-Key': mockApiKey });
      expect(JSON.parse(init.body).events).toHaveLength(1);
    });

    it('uses a configured endpoint', async () => {
      configure({ endpoint: 'https://example.com/events' });
      await ShortMetrics.trackCustom('test_event');
      await ShortMetrics.flush();

      expect(fetchMock().mock.calls[0][0]).toBe('https://example.com/events');
    });

    it('builds the event envelope', async () => {
      configure();
      await ShortMetrics.trackCustom('test_event', { properties: { screen: 'home' } });
      await ShortMetrics.flush();

      const [event] = sent();
      expect(event.eventId).toMatch(UUID_V4);
      expect(new Date(event.occurredAt).toISOString()).toBe(event.occurredAt);
      expect(event.eventType).toBe('custom_test_event');
      expect(event.sessionId).toEqual(expect.any(String));
      expect(event.installId).toEqual(expect.any(String));
      expect(event.properties).toEqual({ screen: 'home', ...mockDeviceInfo });
      expect(event).not.toHaveProperty('retries');
    });

    it('keeps trackPredefined and track working', async () => {
      configure();
      await ShortMetrics.trackPredefined('purchase', { amount: 9.99, currency: 'USD' });
      await ShortMetrics.track('custom_page_viewed', { userId: 'override', properties: { page: 'settings' } });
      await ShortMetrics.flush();

      expect(appProperties(sentOf('purchase')[0])).toEqual({ amount: 9.99, currency: 'USD' });
      expect(sentOf('custom_page_viewed')[0].userId).toBe('override');
    });

    it('fills device signals at flush time when they were not ready at track time', async () => {
      let resolveDevice: (info: typeof mockDeviceInfo) => void = () => {};
      (getDeviceInfo as jest.Mock).mockReturnValue(new Promise((resolve) => (resolveDevice = resolve)));
      configure();

      await ShortMetrics.trackCustom('early', { properties: { platform: 'tiktok', a: 1 } });
      const queued = JSON.parse((await AsyncStorage.getItem('@shortmetrics_queue'))!);
      expect(queued[0].properties).toEqual({ a: 1 });

      resolveDevice(mockDeviceInfo);
      await ShortMetrics.flush();
      expect(sent()[0].properties).toEqual({ a: 1, ...mockDeviceInfo });
    });
  });

  describe('track never rejects', () => {
    it('resolves when the network fails and keeps the event', async () => {
      fetchMock().mockRejectedValue(new TypeError('Network request failed'));
      configure();

      await expect(ShortMetrics.trackCustom('offline')).resolves.toBeUndefined();
      await expect(ShortMetrics.flush()).resolves.toBeUndefined();
      expect(JSON.parse((await AsyncStorage.getItem('@shortmetrics_queue'))!)).toHaveLength(1);
    });

    it('resolves before configure and sends once configured', async () => {
      await expect(ShortMetrics.trackCustom('before_configure')).resolves.toBeUndefined();
      await ShortMetrics.flush();
      expect(fetchMock()).not.toHaveBeenCalled();

      configure();
      await ShortMetrics.flush();
      expect(sentOf('custom_before_configure')).toHaveLength(1);
    });

    it('ignores event types the server would reject', async () => {
      configure();
      await expect(ShortMetrics.track('bogus' as any)).resolves.toBeUndefined();
      await ShortMetrics.trackCustom('ok');
      await ShortMetrics.flush();

      expect(sent().map((e) => e.eventType)).toEqual(['custom_ok']);
    });

    it('resolves when storage throws', async () => {
      (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('disk full'));
      configure();
      await expect(ShortMetrics.trackCustom('x')).resolves.toBeUndefined();
    });

    it('sends queued events after a restart', async () => {
      fetchMock().mockResolvedValue({ ok: false, status: 503, headers: { get: () => null } });
      configure();
      await ShortMetrics.trackCustom('queued');
      await ShortMetrics.flush();

      await ShortMetrics.reset();
      fetchMock().mockClear();
      fetchMock().mockResolvedValue({ ok: true, status: 200, headers: { get: () => null } });
      configure();
      await ShortMetrics.flush();

      expect(sent().map((e) => e.eventType)).toEqual(['custom_queued']);
    });
  });

  describe('storage compatibility', () => {
    it('reuses the 1.0.0 install, session and user keys', async () => {
      await AsyncStorage.setItem('@event_tracker_install_id', 'install-old');
      await AsyncStorage.setItem('@event_tracker_session_id', 'session-old');
      await AsyncStorage.setItem('@event_tracker_user_id', 'user-old');
      configure();

      await ShortMetrics.trackCustom('after_upgrade');
      await ShortMetrics.flush();

      expect(sent()).toHaveLength(1);
      expect(sent()[0]).toMatchObject({ installId: 'install-old', sessionId: 'session-old', userId: 'user-old' });
    });

    it('does not re-send app_installed when it was already tracked', async () => {
      configure();
      await ShortMetrics.initialize();
      await ShortMetrics.flush();

      expect(sentOf('app_installed')).toHaveLength(0);
    });

    it('sends app_installed once on first launch', async () => {
      await AsyncStorage.removeItem('@event_tracker_install_tracked');
      configure();
      await ShortMetrics.initialize();
      await ShortMetrics.flush();

      expect(sentOf('app_installed')).toHaveLength(1);
      expect(await AsyncStorage.getItem('@event_tracker_install_tracked')).toBe('true');
      expect(await AsyncStorage.getItem('@event_tracker_install_id')).toBe(sentOf('app_installed')[0].installId);

      await ShortMetrics.reset();
      configure();
      await ShortMetrics.initialize();
      await ShortMetrics.flush();
      expect(sentOf('app_installed')).toHaveLength(1);
    });

    it('creates and saves session and install IDs when none exist', async () => {
      configure();
      await ShortMetrics.initialize();

      expect(await AsyncStorage.getItem('@event_tracker_session_id')).toEqual(expect.any(String));
      expect(await AsyncStorage.getItem('@event_tracker_install_id')).toMatch(/^\d+-[a-z0-9]+$/);
    });
  });

  describe('identity', () => {
    it('identify works before configure', async () => {
      await expect(ShortMetrics.identify('user-1', 'a@example.com', '+1555')).resolves.toBeUndefined();
      configure();
      await ShortMetrics.trackCustom('after_identify');
      await ShortMetrics.flush();

      const [identified] = sentOf('custom_user_identified');
      expect(identified).toMatchObject({ userId: 'user-1', email: 'a@example.com', phone: '+1555' });
      expect(appProperties(identified)).toEqual({});
      expect(sentOf('custom_after_identify')[0]).toMatchObject({ userId: 'user-1', email: 'a@example.com' });
      expect(await AsyncStorage.getItem('@event_tracker_user_id')).toBe('user-1');
    });

    it('only sends custom_user_identified when the user changes', async () => {
      await AsyncStorage.setItem('@event_tracker_user_id', 'user-1');
      configure();
      await ShortMetrics.identify('user-1');
      await ShortMetrics.identify('user-2');
      await ShortMetrics.flush();

      expect(sentOf('custom_user_identified').map((e) => e.userId)).toEqual(['user-2']);
    });

    it('clearIdentity works before configure and clears the user and context', async () => {
      await ShortMetrics.identify('user-1', 'a@example.com');
      await ShortMetrics.setContext({ storefront_country: 'US' });
      await expect(ShortMetrics.clearIdentity()).resolves.toBeUndefined();

      configure();
      await ShortMetrics.trackCustom('signed_out');
      await ShortMetrics.flush();

      const [event] = sentOf('custom_signed_out');
      expect(event.userId).toBeUndefined();
      expect(event.email).toBeUndefined();
      expect(appProperties(event)).toEqual({});
      expect(await AsyncStorage.getItem('@event_tracker_user_id')).toBeNull();
      expect(await AsyncStorage.getItem('@shortmetrics_context')).toBeNull();
    });
  });

  describe('context', () => {
    it('merges, persists and stamps context; null and undefined remove keys', async () => {
      configure();
      await ShortMetrics.setContext({ storefront_country: 'US', att_status: 'authorized', idfa: 'abc' });
      await ShortMetrics.setContext({ att_status: 'denied', idfa: null, gaid: undefined });

      expect(JSON.parse((await AsyncStorage.getItem('@shortmetrics_context'))!)).toEqual({
        storefront_country: 'US',
        att_status: 'denied',
      });

      await ShortMetrics.trackCustom('with_context', { properties: { a: 1 } });
      await ShortMetrics.flush();
      expect(appProperties(sent()[0])).toEqual({ a: 1, storefront_country: 'US', att_status: 'denied' });
    });

    it('restores context after a restart', async () => {
      configure();
      await ShortMetrics.setContext({ relationship_id: 'rel-1' });
      await ShortMetrics.reset();

      configure();
      await ShortMetrics.trackCustom('restarted');
      await ShortMetrics.flush();
      expect(appProperties(sent()[0])).toEqual({ relationship_id: 'rel-1' });
    });

    it('clearContext removes all context', async () => {
      configure();
      await ShortMetrics.setContext({ relationship_id: 'rel-1' });
      await ShortMetrics.clearContext();
      await ShortMetrics.trackCustom('cleared');
      await ShortMetrics.flush();

      expect(appProperties(sent()[0])).toEqual({});
      expect(await AsyncStorage.getItem('@shortmetrics_context')).toBeNull();
    });

    it('lets context override app properties', async () => {
      configure();
      await ShortMetrics.setContext({ screen: 'context' });
      await ShortMetrics.trackCustom('x', { properties: { screen: 'app' } });
      await ShortMetrics.flush();

      expect(sent()[0].properties.screen).toBe('context');
    });
  });

  describe('reserved keys', () => {
    it('device signals win over app properties and context, with a dev warning', async () => {
      configure();
      await ShortMetrics.setContext({ region: 'XX' });
      await ShortMetrics.trackCustom('collision', { properties: { platform: 'tiktok', sdk_version: '0' } });
      await ShortMetrics.flush();

      expect(sent()[0].properties).toMatchObject({ platform: 'ios', sdk_version: '1.1.0', region: 'US' });
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('platform, sdk_version are reserved'));
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('region are reserved'));
    });

    it('drops reserved keys the device does not produce, before and after device info loads', async () => {
      const { region, ...withoutRegion } = mockDeviceInfo;
      (getDeviceInfo as jest.Mock).mockResolvedValue(withoutRegion);
      configure();
      await ShortMetrics.setContext({ region: 'CA-ON' });
      await ShortMetrics.trackCustom('late', { properties: { device_id: 'app', a: 1 } });
      await ShortMetrics.flush();

      expect(sent()[0].properties).toEqual({ a: 1, ...withoutRegion });
    });

    it('keeps the 1.0.0 paste event platform (tiktok) as social_platform', async () => {
      configure();
      await ShortMetrics.track('custom_attribution_post_url', {
        properties: { platform: 'tiktok', post_url: 'https://www.tiktok.com/@c/video/1', resolved_via: 'onboarding_answer' },
      });
      await ShortMetrics.trackCustom('other', { properties: { platform: 'tiktok' } });
      await ShortMetrics.flush();

      expect(sentOf('custom_attribution_post_url')[0].properties).toMatchObject({ platform: 'ios', social_platform: 'tiktok' });
      expect(sentOf('custom_other')[0].properties.social_platform).toBeUndefined();
    });
  });

  describe('trackAttribution', () => {
    it('sends only attribution when there is no post URL', async () => {
      configure();
      await ShortMetrics.trackAttribution({ source: 'tiktok', postUrl: '  ' });
      await ShortMetrics.flush();

      expect(sent().map((e) => e.eventType)).toEqual(['attribution']);
      expect(appProperties(sent()[0])).toEqual({ attribution: 'tiktok', resolved_via: 'onboarding_answer' });
    });

    it('sends attribution and custom_attribution_post_url with exact properties', async () => {
      configure();
      await ShortMetrics.trackAttribution({
        source: 'tiktok',
        postUrl: 'https://www.tiktok.com/@creator/video/123',
        socialPlatform: 'tiktok',
        promptVariant: 'v2',
        properties: { screen: 'quiz' },
      });
      await ShortMetrics.flush();

      expect(sent().map((e) => e.eventType)).toEqual(['attribution', 'custom_attribution_post_url']);
      expect(appProperties(sentOf('attribution')[0])).toEqual({
        attribution: 'tiktok',
        resolved_via: 'onboarding_answer',
        prompt_variant: 'v2',
        screen: 'quiz',
      });
      expect(appProperties(sentOf('custom_attribution_post_url')[0])).toEqual({
        post_url: 'https://www.tiktok.com/@creator/video/123',
        social_platform: 'tiktok',
        resolved_via: 'onboarding_answer',
        prompt_variant: 'v2',
        screen: 'quiz',
      });
      // The device OS is kept on the paste event
      expect(sentOf('custom_attribution_post_url')[0].properties.platform).toBe('ios');
    });

    it('omits social_platform and prompt_variant when not given and uses resolvedVia', async () => {
      configure();
      await ShortMetrics.trackAttribution({
        source: 'instagram',
        postUrl: 'https://www.instagram.com/reel/abc',
        socialPlatform: null,
        promptVariant: null,
        resolvedVia: 'deep_link',
      });
      await ShortMetrics.flush();

      expect(appProperties(sentOf('attribution')[0])).toEqual({ attribution: 'instagram', resolved_via: 'deep_link' });
      expect(appProperties(sentOf('custom_attribution_post_url')[0])).toEqual({
        post_url: 'https://www.instagram.com/reel/abc',
        resolved_via: 'deep_link',
      });
    });

    it('also accepts attribution through trackPredefined', async () => {
      configure();
      await ShortMetrics.trackPredefined('attribution', { attribution: 'friend', resolved_via: 'onboarding_answer' });
      await ShortMetrics.flush();

      expect(appProperties(sent()[0])).toEqual({ attribution: 'friend', resolved_via: 'onboarding_answer' });
    });
  });

  describe('app state', () => {
    it('does not track sessions by default but flushes on background', async () => {
      configure();
      await ShortMetrics.trackCustom('pending');
      appStateHandler()('background');
      await jest.advanceTimersByTimeAsync(0);

      expect(sent().map((e) => e.eventType)).toEqual(['custom_pending']);
    });

    it('tracks only real foreground transitions when enabled', async () => {
      configure({ autoTrackSessions: true });
      await ShortMetrics.initialize();
      const handler = appStateHandler();

      for (const state of ['inactive', 'active', 'inactive', 'background', 'background', 'active', 'active']) {
        handler(state);
        await jest.advanceTimersByTimeAsync(0);
      }
      await ShortMetrics.flush();

      expect(sent().map((e) => e.eventType)).toEqual(['custom_app_backgrounded', 'custom_app_opened']);
    });

    it('reset stops listeners and timers', async () => {
      configure();
      await ShortMetrics.trackCustom('pending');
      const subscription = lastOf((AppState.addEventListener as jest.Mock).mock.results).value;

      await ShortMetrics.reset();
      expect(subscription.remove).toHaveBeenCalled();
      await jest.advanceTimersByTimeAsync(60000);
      expect(fetchMock()).not.toHaveBeenCalled();
    });
  });

  describe('configure', () => {
    it('warns when configured twice', () => {
      configure();
      configure({ endpoint: 'https://other.example.com' });
      expect(console.warn).toHaveBeenCalledWith('ShortMetrics already configured. Call reset() first to reconfigure.');
    });

    it('resetSession creates and saves a new session ID', async () => {
      await AsyncStorage.setItem('@event_tracker_session_id', 'session-old');
      configure();
      await ShortMetrics.resetSession();

      const sessionId = await AsyncStorage.getItem('@event_tracker_session_id');
      expect(sessionId).not.toBe('session-old');
      await ShortMetrics.trackCustom('new_session');
      await ShortMetrics.flush();
      expect(sent()[0].sessionId).toBe(sessionId);
    });
  });
});
