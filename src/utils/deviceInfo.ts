import { Dimensions, NativeModules, PixelRatio, Platform } from "react-native";

export const SDK_VERSION = "1.1.0";

/** Keys the SDK always sets on event properties; app properties and context never override them. */
export const RESERVED_KEYS = [
  "platform", "os_version", "app_version", "app_bundle_id", "device_model", "device_id", "isExpo",
  "build_number", "os_build_id", "screen_width", "screen_height", "screen_scale", "font_scale",
  "locale", "region", "timezone", "user_agent", "sdk_version",
];

// react-native-device-info can be in node_modules without its native module (e.g. pulled in by
// posthog-react-native). Requiring it then throws, and a require after startup is reported to
// React Native as a fatal error even inside try/catch, so only load it when the native side exists.
// The require must stay inside try/catch: Metro only bundles a missing optional module when its
// require is in a try block, otherwise apps without react-native-device-info fail to build.
function requireDeviceInfo(): any {
  if (!NativeModules?.RNDeviceInfo) return undefined;
  try { return require("react-native-device-info"); } catch (error) { return undefined; }
}

export async function getDeviceInfo(): Promise<any> {
  const base = await getBaseInfo();
  let extra: Record<string, unknown> = {};
  try {
    extra = await getExtraSignals();
  } catch (error) {
    // Extra signals are best effort
  }
  return { ...base, ...extra, sdk_version: SDK_VERSION };
}

// The five original 1.0.0 keys, with the same values and fallbacks, so existing rows stay consistent
async function getBaseInfo(): Promise<any> {
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
      const DeviceInfo = requireDeviceInfo();
      if (!DeviceInfo) throw new Error("react-native-device-info is not linked");
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

// Signals added in 1.1.0; each one is omitted when unavailable
async function getExtraSignals(): Promise<Record<string, unknown>> {
  const signals: Record<string, unknown> = {};

  // Literal requires so Metro bundles them; each module is optional
  let Application: any, Device: any, DeviceInfo: any, Constants: any;
  try { Application = require("expo-application"); } catch (error) {}
  try { Constants = require("expo-constants").default; } catch (error) {}
  try { Device = require("expo-device"); } catch (error) {}
  try { DeviceInfo = requireDeviceInfo(); } catch (error) {}
  signals.build_number = Application?.nativeBuildVersion ?? (await call(DeviceInfo?.getBuildNumber));
  signals.os_build_id = Device?.osBuildId ?? (await call(DeviceInfo?.getBuildId));
  // Expo apps without react-native-device-info get the same WebView user agent from expo-constants
  signals.user_agent = (await call(DeviceInfo?.getUserAgent)) ?? (await call(() => Constants?.getWebViewUserAgentAsync?.()));

  const screen = await call(() => Dimensions.get("screen"));
  signals.screen_width = screen?.width;
  signals.screen_height = screen?.height;
  signals.screen_scale = await call(() => PixelRatio.get());
  signals.font_scale = await call(() => PixelRatio.getFontScale());

  const intl = await call(() => Intl.DateTimeFormat().resolvedOptions());
  signals.locale = intl?.locale;
  signals.region = regionOf(intl?.locale);
  signals.timezone = intl?.timeZone;

  for (const key of Object.keys(signals)) {
    if (signals[key] === undefined || signals[key] === null || signals[key] === "") delete signals[key];
  }
  return signals;
}

// Calls an optional getter, giving up after 3s so a slow native call (e.g. the WebView user agent) never stalls sending
async function call(fn?: () => unknown): Promise<any> {
  if (typeof fn !== "function") return undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise((resolve) => { timer = setTimeout(resolve, 3000); });
    return await Promise.race([Promise.resolve().then(fn), timeout]);
  } catch (error) {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

/** The region subtag of a BCP 47 locale ("en-US" -> "US", "zh-Hans-CN" -> "CN"), stopping at extensions */
export function regionOf(locale?: string): string | undefined {
  if (!locale) return undefined;
  for (const part of locale.split(/[-_]/).slice(1)) {
    if (part.length === 1) return undefined;
    if (/^[A-Za-z]{2}$|^\d{3}$/.test(part)) return part.toUpperCase();
  }
  return undefined;
}
