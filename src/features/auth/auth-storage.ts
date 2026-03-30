import type { User } from '@/api/types';

const storageKey = 'm2n.frontend.session';
const csrfCookieName = import.meta.env.VITE_CSRF_COOKIE_NAME ?? 'm2n_csrf_token';

export interface StoredSession {
  accessToken: string;
  accessTokenExpiresAt: number;
  csrfToken: string;
  user: User;
}

export function readStoredSession(): StoredSession | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.localStorage.getItem(storageKey);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as StoredSession;
  } catch {
    window.localStorage.removeItem(storageKey);
    return null;
  }
}

export function writeStoredSession(session: StoredSession) {
  window.localStorage.setItem(storageKey, JSON.stringify(session));
}

export function clearStoredSession() {
  window.localStorage.removeItem(storageKey);
}

export function readCookie(name: string): string | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const cookie = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));

  if (!cookie) {
    return null;
  }

  const value = cookie.slice(name.length + 1);
  return value ? decodeURIComponent(value) : null;
}

export function resolveStoredCsrfToken() {
  return readCookie(csrfCookieName) ?? readStoredSession()?.csrfToken ?? null;
}
