import { Platform } from "react-native";

export async function getDeviceInfo(): Promise<any> {
  try {
    // Try to import expo-constants
    try {
      const Constants = require("expo-constants").default;
      if (Constants.expoConfig || Constants.manifest) {
        const config = Constants.expoConfig || Constants.manifest;
        return {
          platform: Platform.OS,
          os_version: Platform.Version?.toString() || "unknown",
          app_version: config.version || "unknown",
          app_bundle_id: Platform.OS === 'ios' 
            ? config.ios?.bundleIdentifier || "unknown"
            : config.android?.package || "unknown",
          device_model: Constants.deviceName || "unknown",
          isExpo: true,
        };
      }
    } catch (expoError) {
      // Expo not available, continue to try react-native-device-info
    }

    // Try to import react-native-device-info
    try {
      const DeviceInfo = require("react-native-device-info");
      return {
        platform: Platform.OS,
        os_version: await DeviceInfo.getSystemVersion(),
        app_version: DeviceInfo.getVersion(),
        app_bundle_id: DeviceInfo.getBundleId(),
        device_model: await DeviceInfo.getDeviceName(),
        device_id: await DeviceInfo.getUniqueId(),
        isExpo: false,
      };
    } catch (deviceInfoError) {
      // Device info not available
    }

    // Fallback - use basic Platform API
    return {
      platform: Platform.OS,
      os_version: Platform.Version?.toString() || "unknown",
      app_version: "unknown",
      app_bundle_id: "unknown",
      device_model: "unknown",
    };
  } catch (error) {
    console.error("Error getting device info:", error);
    return {
      platform: Platform.OS,
      os_version: "unknown",
      app_version: "unknown",
      app_bundle_id: "unknown",
      device_model: "unknown",
    };
  }
}
