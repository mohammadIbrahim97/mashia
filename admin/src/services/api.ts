import axios, { AxiosError, AxiosResponse } from 'axios';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/api/v1';

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: false,
});

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

api.interceptors.request.use((config) => {
  const token = readCookie('access_token');
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

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
