import { afterEach, describe, expect, it } from 'vitest';

import {
  clearStoredSession,
  readCookie,
  readStoredSession,
  resolveStoredCsrfToken,
  writeStoredSession,
} from '@/features/auth/auth-storage';

const sampleSession = {
  accessToken: 'token-123',
  accessTokenExpiresAt: 1_700_000_000_000,
  csrfToken: 'csrf-storage',
  user: {
    id: 1,
    company_id: null,
    full_name: 'Viewer User',
    email: 'viewer@example.com',
    phone: null,
    role: 'viewer',
    is_active: true,
    created_at: '2026-03-28T00:00:00Z',
  },
};

describe('auth storage', () => {
  afterEach(() => {
    clearStoredSession();
    document.cookie = 'm2n_csrf_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
  });

  it('persists and restores the frontend session payload', () => {
    writeStoredSession(sampleSession);
    expect(readStoredSession()).toEqual(sampleSession);
  });

  it('prefers the browser csrf cookie over stale local storage', () => {
    writeStoredSession(sampleSession);
    document.cookie = 'm2n_csrf_token=csrf-cookie; path=/';

    expect(readCookie('m2n_csrf_token')).toBe('csrf-cookie');
    expect(resolveStoredCsrfToken()).toBe('csrf-cookie');
  });
});
