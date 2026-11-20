import AsyncStorage from '@react-native-async-storage/async-storage';

const SESSION_ID_KEY = '@event_tracker_session_id';
const USER_ID_KEY = '@event_tracker_user_id';
const INSTALL_TRACKED_KEY = '@event_tracker_install_tracked';
const INSTALL_ID_KEY = '@event_tracker_install_id';
const CONTEXT_KEY = '@shortmetrics_context';
const QUEUE_KEY = '@shortmetrics_queue';

export class Storage {
  static async getSessionId(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(SESSION_ID_KEY);
    } catch (error) {
      console.error('Error getting session ID:', error);
      return null;
    }
  }

  static async setSessionId(sessionId: string): Promise<void> {
    try {
      await AsyncStorage.setItem(SESSION_ID_KEY, sessionId);
    } catch (error) {
      console.error('Error setting session ID:', error);
    }
  }

  static async clearSessionId(): Promise<void> {
    try {
      await AsyncStorage.removeItem(SESSION_ID_KEY);
    } catch (error) {
      console.error('Error clearing session ID:', error);
    }
  }

  static async getUserId(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(USER_ID_KEY);
    } catch (error) {
      console.error('Error getting user ID:', error);
      return null;
    }
  }

  static async setUserId(userId: string): Promise<void> {
    try {
      await AsyncStorage.setItem(USER_ID_KEY, userId);
    } catch (error) {
      console.error('Error setting user ID:', error);
    }
  }

  static async clearUserId(): Promise<void> {
    try {
      await AsyncStorage.removeItem(USER_ID_KEY);
    } catch (error) {
      console.error('Error clearing user ID:', error);
    }
  }

  static async isInstallTracked(): Promise<boolean> {
    try {
      const tracked = await AsyncStorage.getItem(INSTALL_TRACKED_KEY);
      return tracked === 'true';
    } catch (error) {
      console.error('Error checking install tracked:', error);
      return false;
    }
  }

  static async setInstallTracked(): Promise<void> {
    try {
      await AsyncStorage.setItem(INSTALL_TRACKED_KEY, 'true');
    } catch (error) {
      console.error('Error setting install tracked:', error);
    }
  }

  static async getInstallId(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(INSTALL_ID_KEY);
    } catch (error) {
      console.error('Error getting install ID:', error);
      return null;
    }
  }

  static async setInstallId(installId: string): Promise<void> {
    try {
      await AsyncStorage.setItem(INSTALL_ID_KEY, installId);
    } catch (error) {
      console.error('Error setting install ID:', error);
    }
  }

  static async getContext(): Promise<Record<string, any>> {
    try {
      const value = JSON.parse((await AsyncStorage.getItem(CONTEXT_KEY)) || '{}');
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch (error) {
      console.error('Error getting context:', error);
      return {};
    }
  }

  static async setContext(context: Record<string, any>): Promise<void> {
    try {
      await AsyncStorage.setItem(CONTEXT_KEY, JSON.stringify(context));
    } catch (error) {
      console.error('Error setting context:', error);
    }
  }

  static async clearContext(): Promise<void> {
    try {
      await AsyncStorage.removeItem(CONTEXT_KEY);
    } catch (error) {
      console.error('Error clearing context:', error);
    }
  }

  static async getQueue(): Promise<any[]> {
    try {
      const value = JSON.parse((await AsyncStorage.getItem(QUEUE_KEY)) || '[]');
      return Array.isArray(value) ? value : [];
    } catch (error) {
      console.error('Error getting event queue:', error);
      return [];
    }
  }

  static async setQueue(events: unknown[]): Promise<void> {
    try {
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(events));
    } catch (error) {
      console.error('Error setting event queue:', error);
    }
  }
}
