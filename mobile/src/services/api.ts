import axios, { AxiosError, AxiosInstance } from 'axios';
import * as Keychain from 'react-native-keychain';
import { config } from '../config';

let cachedToken: string | null = null;

async function readToken(): Promise<string | null> {
  if (cachedToken) return cachedToken;
  try {
    const creds = await Keychain.getGenericPassword({
      service: config.jwtKeychainService,
    });
    if (!creds) return null;
    cachedToken = creds.password;
    return cachedToken;
  } catch {
    return null;
  }
}

export async function setAccessToken(token: string | null): Promise<void> {
  cachedToken = token;
  if (token === null) {
    await Keychain.resetGenericPassword({ service: config.jwtKeychainService });
    return;
  }
  await Keychain.setGenericPassword('jwt', token, {
    service: config.jwtKeychainService,
  });
}

export const api: AxiosInstance = axios.create({
  baseURL: `${config.apiBaseUrl}${config.apiPathPrefix}`,
  timeout: 15000,
});

api.interceptors.request.use(async (req) => {
  const token = await readToken();
  if (token) {
    req.headers.Authorization = `Bearer ${token}`;
  }
  return req;
});

export function isApiError(err: unknown): err is AxiosError<{ message?: string }> {
  return axios.isAxiosError(err);
}
