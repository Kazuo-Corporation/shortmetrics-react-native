import { ShortMetrics } from '../src/ShortMetrics';
import { Storage } from '../src/storage';
import { getDeviceInfo } from '../src/utils/deviceInfo';

// Mock dependencies
jest.mock('../src/storage');
jest.mock('../src/utils/deviceInfo');

describe('ShortMetrics', () => {
  const mockApiKey = 'evt_test_123';
  const mockEndpoint = 'https://api.example.com/track';
  const mockDeviceInfo = {
    platform: 'ios',
    os_version: '17.0',
    app_version: '1.0.0',
    app_bundle_id: 'com.example.app',
    device_model: 'iPhone 15',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    
    // Reset singleton state
    await ShortMetrics.reset();
    
    // Mock fetch for unit tests
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
      text: async () => '',
    });
    
    // Setup default mocks
    (Storage.getSessionId as jest.Mock).mockResolvedValue(null);
    (Storage.setSessionId as jest.Mock).mockResolvedValue(undefined);
    (Storage.getUserId as jest.Mock).mockResolvedValue(null);
    (Storage.setUserId as jest.Mock).mockResolvedValue(undefined);
    (Storage.clearUserId as jest.Mock).mockResolvedValue(undefined);
    (Storage.getInstallId as jest.Mock).mockResolvedValue(null);
    (Storage.setInstallId as jest.Mock).mockResolvedValue(undefined);
    (Storage.isInstallTracked as jest.Mock).mockResolvedValue(true); // Default to true to avoid auto-tracking in most tests
    (Storage.setInstallTracked as jest.Mock).mockResolvedValue(undefined);
    (getDeviceInfo as jest.Mock).mockResolvedValue(mockDeviceInfo);

    ShortMetrics.configure({
      apiKey: mockApiKey,
      endpoint: mockEndpoint,
    });
  });

  afterEach(async () => {
    await ShortMetrics.reset();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await ShortMetrics.initialize();
      
      expect(getDeviceInfo).toHaveBeenCalled();
      expect(Storage.getSessionId).toHaveBeenCalled();
    });

    it('should restore saved session ID', async () => {
      const savedSessionId = 'saved-session-123';
      (Storage.getSessionId as jest.Mock).mockResolvedValue(savedSessionId);
      
      await ShortMetrics.initialize();
      await ShortMetrics.trackCustom('test_event');
      
      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const eventData = JSON.parse(fetchCall[1].body);
      expect(eventData.sessionId).toBe(savedSessionId);
    });

    it('should create and save new session ID if none exists', async () => {
      await ShortMetrics.initialize();
      
      expect(Storage.setSessionId).toHaveBeenCalled();
      const sessionId = (Storage.setSessionId as jest.Mock).mock.calls[0][0];
      expect(typeof sessionId).toBe('string');
      expect(sessionId.length).toBeGreaterThan(0);
    });

    it('should restore saved user ID', async () => {
      const savedUserId = 'user-123';
      (Storage.getUserId as jest.Mock).mockResolvedValue(savedUserId);
      
      await ShortMetrics.initialize();
      await ShortMetrics.trackCustom('test_event');
      
      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const eventData = JSON.parse(fetchCall[1].body);
      expect(eventData.userId).toBe(savedUserId);
    });

    it('should restore saved install ID', async () => {
      const savedInstallId = 'install-456';
      (Storage.getInstallId as jest.Mock).mockResolvedValue(savedInstallId);
      
      await ShortMetrics.initialize();
      await ShortMetrics.trackCustom('test_event');
      
      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const eventData = JSON.parse(fetchCall[1].body);
      expect(eventData.installId).toBe(savedInstallId);
    });

    it('should create and save new install ID if none exists', async () => {
      await ShortMetrics.initialize();
      
      expect(Storage.setInstallId).toHaveBeenCalled();
      const installId = (Storage.setInstallId as jest.Mock).mock.calls[0][0];
      expect(typeof installId).toBe('string');
      expect(installId.length).toBeGreaterThan(0);
      expect(installId).toMatch(/^\d+-[a-z0-9]+$/); // Time-based format
    });

    it('should not initialize twice', async () => {
      await ShortMetrics.initialize();
      await ShortMetrics.initialize();
      
      expect(getDeviceInfo).toHaveBeenCalledTimes(1);
    });

    it('should auto-track app_installed on first launch', async () => {
      (Storage.isInstallTracked as jest.Mock).mockResolvedValue(false);
      
      await ShortMetrics.initialize();
      
      expect(Storage.isInstallTracked).toHaveBeenCalled();
      expect(Storage.setInstallTracked).toHaveBeenCalled();
      
      // Check that app_installed event was sent
      const fetchCalls = (global.fetch as jest.Mock).mock.calls;
      const installEvent = fetchCalls.find((call: any[]) => {
        const eventData = JSON.parse(call[1].body);
        return eventData.eventType === 'app_installed';
      });
      expect(installEvent).toBeDefined();
    });

    it('should not track app_installed if already tracked', async () => {
      (Storage.isInstallTracked as jest.Mock).mockResolvedValue(true);
      
      await ShortMetrics.initialize();
      
      expect(Storage.isInstallTracked).toHaveBeenCalled();
      expect(Storage.setInstallTracked).not.toHaveBeenCalled();
      
      // Check that app_installed event was NOT sent
      const fetchCalls = (global.fetch as jest.Mock).mock.calls;
      const installEvent = fetchCalls.find((call: any[]) => {
        const eventData = JSON.parse(call[1].body);
        return eventData.eventType === 'app_installed';
      });
      expect(installEvent).toBeUndefined();
    });

    it('should handle initialization errors gracefully', async () => {
      (getDeviceInfo as jest.Mock).mockRejectedValue(new Error('Device info error'));
      
      // Should not throw
      await expect(ShortMetrics.initialize()).resolves.toBeUndefined();
    });
  });

  describe('identify', () => {
    it('should identify user with all details on first identification', async () => {
      const userId = 'user-456';
      const email = 'user@example.com';
      const phone = '+1234567890';
      
      await ShortMetrics.identify(userId, email, phone);
      
      expect(Storage.setUserId).toHaveBeenCalledWith(userId);
      
      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const eventData = JSON.parse(fetchCall[1].body);
      expect(eventData.eventType).toBe('custom_user_identified');
      expect(eventData.userId).toBe(userId);
      expect(eventData.email).toBe(email);
      expect(eventData.phone).toBe(phone);
    });

    it('should identify user with only userId', async () => {
      const userId = 'user-789';
      
      await ShortMetrics.identify(userId);
      
      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const eventData = JSON.parse(fetchCall[1].body);
      expect(eventData.userId).toBe(userId);
      expect(eventData.email).toBeUndefined();
      expect(eventData.phone).toBeUndefined();
    });

    it('should not send event when identifying same user again', async () => {
      await ShortMetrics.identify('user-same');
      
      jest.clearAllMocks();
      
      // Identify same user again
      await ShortMetrics.identify('user-same');
      
      // Should not send custom_user_identified event
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should send event when user changes', async () => {
      await ShortMetrics.identify('user-first');
      
      jest.clearAllMocks();
      
      // Identify different user
      await ShortMetrics.identify('user-second');
      
      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const eventData = JSON.parse(fetchCall[1].body);
      expect(eventData.eventType).toBe('custom_user_identified');
      expect(eventData.userId).toBe('user-second');
    });

    it('should send event after clearIdentity and re-identify', async () => {
      await ShortMetrics.identify('user-123');
      await ShortMetrics.clearIdentity();
      
      jest.clearAllMocks();
      
      // Re-identify same user after clearing
      await ShortMetrics.identify('user-123');
      
      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const eventData = JSON.parse(fetchCall[1].body);
      expect(eventData.eventType).toBe('custom_user_identified');
      expect(eventData.userId).toBe('user-123');
    });

    it('should persist user ID for subsequent events', async () => {
      await ShortMetrics.identify('user-persistent');
      
      jest.clearAllMocks();
      await ShortMetrics.trackCustom('button_click');
      
      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const eventData = JSON.parse(fetchCall[1].body);
      expect(eventData.userId).toBe('user-persistent');
    });
  });

  describe('clearIdentity', () => {
    it('should clear user identity', async () => {
      await ShortMetrics.identify('user-123', 'user@test.com');
      await ShortMetrics.clearIdentity();
      
      expect(Storage.clearUserId).toHaveBeenCalled();
      
      jest.clearAllMocks();
      await ShortMetrics.trackCustom('test_event');
      
      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const eventData = JSON.parse(fetchCall[1].body);
      expect(eventData.userId).toBeUndefined();
      expect(eventData.email).toBeUndefined();
      expect(eventData.phone).toBeUndefined();
    });
  });

  describe('trackPredefined', () => {
    it('should track purchase event', async () => {
      await ShortMetrics.trackPredefined('purchase', {
        amount: 99.99,
        currency: 'USD',
        product: 'Premium Plan',
      });
      
      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const eventData = JSON.parse(fetchCall[1].body);
      
      expect(eventData.eventType).toBe('purchase');
      expect(eventData.properties).toMatchObject({
        amount: 99.99,
        currency: 'USD',
        product: 'Premium Plan',
      });
    });

    it('should track app_installed event', async () => {
      await ShortMetrics.trackPredefined('app_installed');
      
      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const eventData = JSON.parse(fetchCall[1].body);
      
      expect(eventData.eventType).toBe('app_installed');
    });
  });

  describe('trackCustom', () => {
    it('should add custom_ prefix to event name', async () => {
      await ShortMetrics.trackCustom('button_click');
      
      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const eventData = JSON.parse(fetchCall[1].body);
      
      expect(eventData.eventType).toBe('custom_button_click');
    });

    it('should not double-prefix custom_ events', async () => {
      await ShortMetrics.trackCustom('custom_already_prefixed');
      
      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const eventData = JSON.parse(fetchCall[1].body);
      
      expect(eventData.eventType).toBe('custom_already_prefixed');
    });

    it('should include custom properties', async () => {
      await ShortMetrics.trackCustom('feature_used', {
        properties: {
          feature_name: 'dark_mode',
          enabled: true,
        },
      });
      
      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const eventData = JSON.parse(fetchCall[1].body);
      
      expect(eventData.properties.feature_name).toBe('dark_mode');
      expect(eventData.properties.enabled).toBe(true);
    });

    it('should include device info in properties', async () => {
      await ShortMetrics.initialize();
      await ShortMetrics.trackCustom('test_event');
      
      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const eventData = JSON.parse(fetchCall[1].body);
      
      expect(eventData.properties).toMatchObject(mockDeviceInfo);
    });

    it('should include install ID in all events', async () => {
      await ShortMetrics.initialize();
      await ShortMetrics.trackCustom('test_event');
      
      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const eventData = JSON.parse(fetchCall[1].body);
      
      expect(eventData.installId).toBeDefined();
      expect(typeof eventData.installId).toBe('string');
      expect(eventData.installId.length).toBeGreaterThan(0);
    });

  });

  describe('track', () => {
    it('should auto-initialize if not initialized', async () => {
      await ShortMetrics.track('purchase');
      
      expect(getDeviceInfo).toHaveBeenCalled();
    });

    it('should send correct headers', async () => {
      await ShortMetrics.track('purchase');
      
      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      expect(fetchCall[1].headers).toMatchObject({
        'Content-Type': 'application/json',
        'X-API-Key': mockApiKey,
      });
    });

    it('should send to correct endpoint', async () => {
      await ShortMetrics.track('purchase');
      
      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      expect(fetchCall[0]).toBe(mockEndpoint);
    });
  });

  describe('error handling', () => {
    it('should throw error on fetch failure', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));
      
      await expect(ShortMetrics.track('purchase')).rejects.toThrow('Network error');
    });

    it('should throw error on HTTP error status', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'Bad Request',
      });
      
      await expect(ShortMetrics.track('purchase')).rejects.toThrow('Event tracking failed: 400 Bad Request');
    });

    it('should handle 500 errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });
      
      await expect(ShortMetrics.track('purchase')).rejects.toThrow('Event tracking failed: 500');
    });
  });

  describe('session management', () => {
    it('should reset session', async () => {
      await ShortMetrics.initialize();
      
      // Track event to get initial session
      await ShortMetrics.trackCustom('test1');
      const firstCall = (global.fetch as jest.Mock).mock.calls[0];
      const firstSessionId = JSON.parse(firstCall[1].body).sessionId;
      
      await ShortMetrics.resetSession();
      
      // Track another event
      await ShortMetrics.trackCustom('test2');
      const secondCall = (global.fetch as jest.Mock).mock.calls[1];
      const secondSessionId = JSON.parse(secondCall[1].body).sessionId;
      
      expect(secondSessionId).not.toBe(firstSessionId);
      expect(Storage.setSessionId).toHaveBeenCalledWith(secondSessionId);
    });

    it('should generate unique session IDs on multiple configurations', async () => {
      await ShortMetrics.trackCustom('test1');
      const session1 = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body).sessionId;
      
      // Reset and reconfigure
      await ShortMetrics.reset();
      ShortMetrics.configure({ apiKey: mockApiKey, endpoint: mockEndpoint });
      
      await ShortMetrics.trackCustom('test2');
      const session2 = JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body).sessionId;
      
      expect(session1).not.toBe(session2);
    });
  });

  describe('reset', () => {
    it('should cleanup and allow reconfiguration', async () => {
      await ShortMetrics.initialize();
      await ShortMetrics.reset();
      
      // Should be able to configure again
      ShortMetrics.configure({
        apiKey: mockApiKey,
        endpoint: mockEndpoint,
      });
      
      await expect(ShortMetrics.trackCustom('test')).resolves.not.toThrow();
    });
  });
});
