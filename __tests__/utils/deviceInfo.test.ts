import { getDeviceInfo, regionOf, RESERVED_KEYS, SDK_VERSION } from '../../src/utils/deviceInfo';
import { Dimensions, NativeModules, Platform } from 'react-native';

describe('getDeviceInfo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset Platform to default values
    (Platform as any).OS = 'ios';
    (Platform as any).Version = '17.0';
  });

  // Optional modules are not installed here; a throwing factory keeps them "missing" between tests
  const notInstalled = () => {
    throw new Error('Cannot find module');
  };
  afterEach(() => {
    jest.doMock('expo-application', notInstalled, { virtual: true });
    jest.doMock('expo-device', notInstalled, { virtual: true });
    jest.doMock('react-native-device-info', notInstalled, { virtual: true });
    jest.resetModules();
  });

  it('should keep the 1.0.0 Platform API fallback values', async () => {
    const info = await getDeviceInfo();

    expect(info).toMatchObject({
      platform: 'ios',
      os_version: '17.0',
      app_version: 'unknown',
      app_bundle_id: 'unknown',
      device_model: 'unknown',
    });
    expect(info).not.toHaveProperty('device_id');
    expect(info).not.toHaveProperty('isExpo');
  });

  it('should add screen, locale and sdk signals', async () => {
    const info = await getDeviceInfo();
    const { locale, timeZone } = Intl.DateTimeFormat().resolvedOptions();

    expect(info).toMatchObject({
      screen_width: 393,
      screen_height: 852,
      screen_scale: 3,
      font_scale: 1,
      locale,
      timezone: timeZone,
      sdk_version: SDK_VERSION,
    });
    expect(info.region).toBe(regionOf(locale));
  });

  it('should omit signals that are unavailable', async () => {
    (Dimensions.get as jest.Mock).mockImplementationOnce(() => {
      throw new Error('no screen');
    });

    const info = await getDeviceInfo();

    expect(info).not.toHaveProperty('screen_width');
    expect(info).not.toHaveProperty('build_number');
    expect(info).not.toHaveProperty('os_build_id');
    expect(info).not.toHaveProperty('user_agent');
  });

  it('should read build fields from expo-application and expo-device', async () => {
    jest.doMock('expo-application', () => ({ nativeBuildVersion: '42' }), { virtual: true });
    jest.doMock('expo-device', () => ({ osBuildId: '21A329' }), { virtual: true });

    const info = await getDeviceInfo();

    expect(info.build_number).toBe('42');
    expect(info.os_build_id).toBe('21A329');
  });

  it('should not load react-native-device-info when its native module is not linked', async () => {
    // e.g. Lume: posthog-react-native pulls the JS package in, but it is not autolinked
    const factory = jest.fn(() => {
      throw new Error('NativeModule.RNDeviceInfo is null');
    });
    jest.doMock('react-native-device-info', factory, { virtual: true });
    const linked = (NativeModules as any).RNDeviceInfo;
    (NativeModules as any).RNDeviceInfo = undefined;
    try {
      const info = await getDeviceInfo();

      expect(factory).not.toHaveBeenCalled();
      expect(info).not.toHaveProperty('user_agent');
      expect(info.app_version).toBe('unknown');
    } finally {
      (NativeModules as any).RNDeviceInfo = linked;
    }
  });

  it('should read the user agent from expo-constants without react-native-device-info', async () => {
    jest.doMock(
      'expo-constants',
      () => ({ default: { getWebViewUserAgentAsync: async () => 'Mozilla/5.0 (Expo)' } }),
      { virtual: true }
    );

    const info = await getDeviceInfo();

    expect(info.user_agent).toBe('Mozilla/5.0 (Expo)');
  });

  it('should use react-native-device-info for base info, build fields and user agent', async () => {
    jest.doMock(
      'react-native-device-info',
      () => ({
        getSystemVersion: () => '17.1',
        getVersion: () => '2.0.0',
        getBundleId: () => 'com.example.app',
        getDeviceName: async () => 'iPhone',
        getUniqueId: async () => 'device-1',
        getBuildNumber: () => '7',
        getBuildId: async () => 'build-id',
        getUserAgent: async () => 'Mozilla/5.0',
      }),
      { virtual: true }
    );

    const info = await getDeviceInfo();

    expect(info).toMatchObject({
      os_version: '17.1',
      app_version: '2.0.0',
      app_bundle_id: 'com.example.app',
      device_model: 'iPhone',
      device_id: 'device-1',
      isExpo: false,
      build_number: '7',
      os_build_id: 'build-id',
      user_agent: 'Mozilla/5.0',
    });
  });

  it('should handle different platforms', async () => {
    (Platform as any).OS = 'android';
    (Platform as any).Version = 13;

    const info = await getDeviceInfo();

    expect(info.platform).toBe('android');
    expect(info.os_version).toBe('13');
  });

  it('should handle missing Platform.Version', async () => {
    (Platform as any).OS = 'web';
    (Platform as any).Version = undefined;

    const info = await getDeviceInfo();

    expect(info.os_version).toBe('unknown');
  });

  it('should only require modules by literal name (Metro cannot bundle a dynamic require)', () => {
    const source = require('fs').readFileSync(require.resolve('../../src/utils/deviceInfo'), 'utf8');
    const requires: string[] = source.match(/require\([^)]*\)/g) || [];
    expect(requires.length).toBeGreaterThan(0);
    for (const call of requires) {
      expect(call).toMatch(/^require\("[^"]+"\)$/);
    }
  });

  it('should only return reserved keys', async () => {
    const info = await getDeviceInfo();

    for (const key of Object.keys(info)) {
      expect(RESERVED_KEYS).toContain(key);
    }
  });
});

describe('regionOf', () => {
  it('should read the region subtag', () => {
    expect(regionOf('en-US')).toBe('US');
    expect(regionOf('zh-Hans-CN')).toBe('CN');
    expect(regionOf('es-419')).toBe('419');
    expect(regionOf('en_gb')).toBe('GB');
  });

  it('should stop at extensions and handle missing regions', () => {
    expect(regionOf('en-u-ca-gregory')).toBeUndefined();
    expect(regionOf('en-US-u-ca-gregory')).toBe('US');
    expect(regionOf('fr')).toBeUndefined();
    expect(regionOf(undefined)).toBeUndefined();
  });
});
