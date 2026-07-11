import axios, { AxiosError, AxiosResponse } from "axios";
import { session } from "./session";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:3000/api/v1";

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: false,
});

api.interceptors.request.use((config) => {
  const token = session.getAccess();
  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err: AxiosError) => {
    if (err.response?.status === 401) {
      session.clear();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  },
);

/**
 * Backend wraps all responses in `{ success: true, data: <payload> }` via a
 * global TransformInterceptor. Use this to peel that layer off in callers.
 */
export function unwrap<T>(res: AxiosResponse): T {
  const body = res.data;
  if (body && typeof body === "object" && "data" in body) {
    return body.data as T;
  }
  return body as T;
}

function isUnsafeServerMessage(message: string): boolean {
  const trimmed = message.trim();
  return (
    /^Cannot\s+GET\b/i.test(trimmed) ||
    /\/api\/v\d+\//i.test(trimmed) ||
    /^Request failed with status code\s+\d{3}$/i.test(trimmed)
  );
}

export function errorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const ax = err as AxiosError<{ message?: string | string[] }>;
    const data = ax.response?.data;
    const rawMessage = data?.message
      ? Array.isArray(data.message)
        ? data.message[0]
        : data.message
      : null;

    if (rawMessage && !isUnsafeServerMessage(rawMessage)) {
      return rawMessage;
    }
  }
  return fallback;
}
