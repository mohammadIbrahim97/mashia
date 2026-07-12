"use client";

const ACCESS_KEY = "access_token";
const LEGACY_REFRESH_KEY = "refresh_token";
const USER_KEY = "admin_user";

type SessionUser = {
  fullName: string;
  role: "admin";
};

function setCookie(name: string, value: string, maxAgeSec: number) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSec}; SameSite=Lax`;
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

function clearCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; path=/; max-age=0`;
}

export const session = {
  getAccess: () => readCookie(ACCESS_KEY),
  getUser(): SessionUser | null {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      const user = parsed as Record<string, unknown>;
      if (typeof user.fullName !== "string") return null;
      if (user.role !== "admin") return null;
      return { fullName: user.fullName, role: "admin" };
    } catch {
      return null;
    }
  },
  set(accessToken: string, user?: SessionUser) {
    setCookie(ACCESS_KEY, accessToken, 15 * 60);
    clearCookie(LEGACY_REFRESH_KEY);
    if (typeof window !== "undefined" && user) {
      window.localStorage.setItem(USER_KEY, JSON.stringify(user));
    }
  },
  clear() {
    clearCookie(ACCESS_KEY);
    clearCookie(LEGACY_REFRESH_KEY);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(USER_KEY);
    }
  },
};
