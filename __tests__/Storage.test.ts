import AsyncStorage from '@react-native-async-storage/async-storage';
import { Storage } from '../src/storage';

describe('Storage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear the mock storage
    (AsyncStorage.clear as jest.Mock)();
  });

  describe('Session ID', () => {
    it('should get session ID', async () => {
      await (AsyncStorage.setItem as jest.Mock)('@event_tracker_session_id', 'session-123');
      
      const result = await Storage.getSessionId();
      
      expect(AsyncStorage.getItem).toHaveBeenCalledWith('@event_tracker_session_id');
      expect(result).toBe('session-123');
    });

    it('should return null when no session ID exists', async () => {
      const result = await Storage.getSessionId();
      
      expect(result).toBeNull();
    });

    it('should set session ID', async () => {
      await Storage.setSessionId('new-session');
      
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@event_tracker_session_id',
        'new-session'
      );
    });

    it('should clear session ID', async () => {
      await Storage.setSessionId('session-to-clear');
      await Storage.clearSessionId();
      
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@event_tracker_session_id');
    });

    it('should handle errors gracefully when getting', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('Storage error'));
      
      const result = await Storage.getSessionId();
      
      expect(result).toBeNull();
    });

    it('should handle errors gracefully when setting', async () => {
      (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('Storage error'));
      
      // Should not throw
      await expect(Storage.setSessionId('test')).resolves.toBeUndefined();
    });
  });

  describe('User ID', () => {
    it('should get user ID', async () => {
      await (AsyncStorage.setItem as jest.Mock)('@event_tracker_user_id', 'user-456');
      
      const result = await Storage.getUserId();
      
      expect(AsyncStorage.getItem).toHaveBeenCalledWith('@event_tracker_user_id');
      expect(result).toBe('user-456');
    });

    it('should return null when no user ID exists', async () => {
      const result = await Storage.getUserId();
      
      expect(result).toBeNull();
    });

    it('should set user ID', async () => {
      await Storage.setUserId('new-user');
      
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@event_tracker_user_id',
        'new-user'
      );
    });

    it('should clear user ID', async () => {
      await Storage.setUserId('user-to-clear');
      await Storage.clearUserId();
      
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@event_tracker_user_id');
    });

    it('should handle errors gracefully', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('Storage error'));
      
      const result = await Storage.getUserId();
      
      expect(result).toBeNull();
    });
  });

  describe('Install ID', () => {
    it('should get install ID', async () => {
      await (AsyncStorage.setItem as jest.Mock)('@event_tracker_install_id', 'install-789');
      
      const result = await Storage.getInstallId();
      
      expect(AsyncStorage.getItem).toHaveBeenCalledWith('@event_tracker_install_id');
      expect(result).toBe('install-789');
    });

    it('should return null when no install ID exists', async () => {
      const result = await Storage.getInstallId();
      
      expect(result).toBeNull();
    });

    it('should set install ID', async () => {
      await Storage.setInstallId('new-install');
      
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@event_tracker_install_id',
        'new-install'
      );
    });

    it('should handle errors gracefully when getting', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('Storage error'));
      
      const result = await Storage.getInstallId();
      
      expect(result).toBeNull();
    });

    it('should handle errors gracefully when setting', async () => {
      (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('Storage error'));
      
      // Should not throw
      await expect(Storage.setInstallId('test')).resolves.toBeUndefined();
    });
  });
});
