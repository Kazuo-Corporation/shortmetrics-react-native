import { getDeviceInfo } from '../../src/utils/deviceInfo';
import { Platform } from 'react-native';

describe('getDeviceInfo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset Platform to default values
    (Platform as any).OS = 'ios';
    (Platform as any).Version = '17.0';
  });

  it('should return device info using Platform API fallback', async () => {
    const info = await getDeviceInfo();
    
    expect(info).toEqual({
      platform: 'ios',
      os_version: '17.0',
      app_version: 'unknown',
      app_bundle_id: 'unknown',
      device_model: 'unknown',
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

  it('should return consistent structure', async () => {
    const info = await getDeviceInfo();
    
    expect(info).toHaveProperty('platform');
    expect(info).toHaveProperty('os_version');
    expect(info).toHaveProperty('app_version');
    expect(info).toHaveProperty('app_bundle_id');
    expect(info).toHaveProperty('device_model');
  });

  it('should handle iOS platform', async () => {
    (Platform as any).OS = 'ios';
    (Platform as any).Version = 17;
    
    const info = await getDeviceInfo();
    
    expect(info.platform).toBe('ios');
    expect(typeof info.os_version).toBe('string');
  });

  it('should handle numeric version numbers', async () => {
    (Platform as any).Version = 14;
    
    const info = await getDeviceInfo();
    
    expect(info.os_version).toBe('14');
  });
});
