'use client';

const ACCESS_KEY = 'access_token';
const REFRESH_KEY = 'refresh_token';

function setCookie(name: string, value: string, maxAgeSec: number) {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSec}; SameSite=Lax`;
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

function clearCookie(name: string) {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; path=/; max-age=0`;
}

export const session = {
  getAccess: () => readCookie(ACCESS_KEY),
  getRefresh: () => readCookie(REFRESH_KEY),
  set(accessToken: string, refreshToken: string) {
    // Access token TTL aligns with backend default (15min); refresh token gets
    // 7 days. Cookies are non-HttpOnly so the JS can read them — switch to
    // HttpOnly via a Server Action when we tighten auth before production.
    setCookie(ACCESS_KEY, accessToken, 15 * 60);
    setCookie(REFRESH_KEY, refreshToken, 7 * 24 * 60 * 60);
  },
  clear() {
    clearCookie(ACCESS_KEY);
    clearCookie(REFRESH_KEY);
  },
};
