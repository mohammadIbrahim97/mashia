import { Platform } from 'react-native';

/**
 * API base URL.
 *
 * - Android emulator → http://10.0.2.2:3000 (loopback to host machine)
 * - iOS simulator → http://localhost:3000
 * - Physical device → set MASHIA_API_URL via env or app.json before bundling
 *
 * Override at runtime by editing this file or wiring react-native-config.
 */
function defaultApiBaseUrl(): string {
  // Build-time substitution would be ideal; for now Platform branch keeps Phase A simple.
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3000';
  }
  return 'http://localhost:3000';
}

export const config = {
  apiBaseUrl: defaultApiBaseUrl(),
  apiPathPrefix: '/api/v1',
  jwtKeychainService: 'com.mashia.app.auth',
} as const;
