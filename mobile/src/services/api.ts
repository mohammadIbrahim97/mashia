import axios, { AxiosError, AxiosInstance } from 'axios';
import * as Keychain from 'react-native-keychain';
import { config } from '../config';

export type Tokens = {
  accessToken: string;
  refreshToken: string;
};

let cached: Tokens | null = null;

export async function loadTokens(): Promise<Tokens | null> {
  if (cached) return cached;
  try {
    const creds = await Keychain.getGenericPassword({
      service: config.jwtKeychainService,
    });
    if (!creds) return null;
    const parsed = JSON.parse(creds.password) as Tokens;
    cached = parsed;
    return parsed;
  } catch {
    return null;
  }
}

export async function setTokens(tokens: Tokens | null): Promise<void> {
  cached = tokens;
  if (tokens === null) {
    await Keychain.resetGenericPassword({ service: config.jwtKeychainService });
    return;
  }
  await Keychain.setGenericPassword(
    'jwt',
    JSON.stringify(tokens),
    { service: config.jwtKeychainService },
  );
}

/**
 * Extracts the application payload from the backend's TransformInterceptor
 * envelope: { success, data, timestamp }.
 */
export function unwrap<T>(res: { data: { data: T } | T }): T {
  const body = res.data as { data?: T };
  if (body && typeof body === 'object' && 'data' in body) {
    return body.data as T;
  }
  return res.data as T;
}

export const api: AxiosInstance = axios.create({
  baseURL: `${config.apiBaseUrl}${config.apiPathPrefix}`,
  timeout: 15000,
});

api.interceptors.request.use(async (req) => {
  const tokens = await loadTokens();
  if (tokens?.accessToken) {
    req.headers.Authorization = `Bearer ${tokens.accessToken}`;
  }
  return req;
});

export function isApiError(err: unknown): err is AxiosError<{ message?: string }> {
  return axios.isAxiosError(err);
}

export function errorMessage(err: unknown, fallback: string): string {
  if (isApiError(err)) {
    const data = err.response?.data;
    if (data && typeof data === 'object' && 'message' in data) {
      const m = (data as { message?: unknown }).message;
      if (typeof m === 'string') return m;
      if (Array.isArray(m) && typeof m[0] === 'string') return m[0];
    }
    if (err.message) return err.message;
  }
  return fallback;
}
