import axios, {
  AxiosError,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';
import { session } from './session';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/api/v1';

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: false,
});

api.interceptors.request.use((config) => {
  const token = session.getAccess();
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

// Refresh-on-401: when an admin's access token expires, transparently mint a
// new pair from the refresh token and retry the original request once. If the
// refresh itself fails (refresh token expired/revoked), wipe the session and
// bounce to /login.

type RetryConfig = InternalAxiosRequestConfig & { _retry?: boolean };

let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refresh = session.getRefresh();
  if (!refresh) return null;
  try {
    const res = await axios.post(
      `${API_BASE_URL}/auth/refresh`,
      { refreshToken: refresh },
    );
    const body = res.data;
    const payload = (body && typeof body === 'object' && 'data' in body
      ? body.data
      : body) as { accessToken?: string; refreshToken?: string };
    if (payload.accessToken && payload.refreshToken) {
      session.set(payload.accessToken, payload.refreshToken);
      return payload.accessToken;
    }
    return null;
  } catch {
    return null;
  }
}

api.interceptors.response.use(
  (res) => res,
  async (err: AxiosError) => {
    const status = err.response?.status;
    const original = err.config as RetryConfig | undefined;

    if (status !== 401 || !original || original._retry) {
      return Promise.reject(err);
    }

    // Don't try to refresh if the failing call IS the refresh endpoint.
    if (original.url?.endsWith('/auth/refresh')) {
      return Promise.reject(err);
    }

    original._retry = true;

    refreshing = refreshing ?? refreshAccessToken();
    const newToken = await refreshing;
    refreshing = null;

    if (!newToken) {
      session.clear();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      return Promise.reject(err);
    }

    original.headers.set('Authorization', `Bearer ${newToken}`);
    return api(original);
  },
);

/**
 * Backend wraps all responses in `{ success: true, data: <payload> }` via a
 * global TransformInterceptor. Use this to peel that layer off in callers.
 */
export function unwrap<T>(res: AxiosResponse): T {
  const body = res.data;
  if (body && typeof body === 'object' && 'data' in body) {
    return body.data as T;
  }
  return body as T;
}

export function errorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const ax = err as AxiosError<{ message?: string | string[] }>;
    const data = ax.response?.data;
    if (data?.message) {
      return Array.isArray(data.message) ? data.message[0] : data.message;
    }
  }
  return fallback;
}
