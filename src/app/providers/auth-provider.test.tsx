import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { TokenResponse } from '@/api/types';
import { AuthProvider, useAuth } from '@/app/providers/auth-provider';
import { clearStoredSession, readStoredSession } from '@/features/auth/auth-storage';

const authApiMocks = vi.hoisted(() => ({
  fetchCurrentUser: vi.fn(),
  loginRequest: vi.fn(),
  logoutRequest: vi.fn(),
  refreshSessionRequest: vi.fn(),
}));

vi.mock('@/api/auth', () => ({
  fetchCurrentUser: authApiMocks.fetchCurrentUser,
  loginRequest: authApiMocks.loginRequest,
  logoutRequest: authApiMocks.logoutRequest,
  refreshSessionRequest: authApiMocks.refreshSessionRequest,
}));

function buildTokenResponse(overrides?: Partial<TokenResponse>): TokenResponse {
  return {
    access_token: 'access-123',
    token_type: 'bearer',
    expires_in: 900,
    refresh_expires_in: 604800,
    csrf_token: 'csrf-123',
    user: {
      id: 7,
      company_id: null,
      full_name: 'Viewer User',
      email: 'viewer@example.com',
      phone: null,
      role: 'viewer',
      is_active: true,
      created_at: '2026-03-28T00:00:00Z',
    },
    ...overrides,
  };
}

function AuthConsumer() {
  const { isAuthenticated, isBootstrapping, user, login, logout } = useAuth();

  return (
    <div>
      <p data-testid="boot">{isBootstrapping ? 'booting' : 'settled'}</p>
      <p data-testid="auth">{isAuthenticated ? 'authenticated' : 'guest'}</p>
      <p data-testid="email">{user?.email ?? 'no-user'}</p>
      <button onClick={() => void login({ email: 'viewer@example.com', password: 'StrongPass1!' })}>
        login
      </button>
      <button onClick={() => void logout()}>logout</button>
    </div>
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    clearStoredSession();
    document.cookie = 'm2n_csrf_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
    authApiMocks.fetchCurrentUser.mockReset();
    authApiMocks.loginRequest.mockReset();
    authApiMocks.logoutRequest.mockReset();
    authApiMocks.refreshSessionRequest.mockReset();
  });

  afterEach(() => {
    cleanup();
    clearStoredSession();
    document.cookie = 'm2n_csrf_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
  });

  it('bootstraps from refresh cookie when only the silent session is available', async () => {
    document.cookie = 'm2n_csrf_token=csrf-cookie; path=/';
    authApiMocks.refreshSessionRequest.mockResolvedValue(
      buildTokenResponse({ csrf_token: 'csrf-cookie' }),
    );

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('boot')).toHaveTextContent('settled');
    });

    expect(screen.getByTestId('auth')).toHaveTextContent('authenticated');
    expect(screen.getByTestId('email')).toHaveTextContent('viewer@example.com');
    expect(authApiMocks.refreshSessionRequest).toHaveBeenCalledWith('csrf-cookie');
    expect(readStoredSession()?.accessToken).toBe('access-123');
  });

  it('stores the new session on login and clears it on logout', async () => {
    const user = userEvent.setup();
    authApiMocks.loginRequest.mockResolvedValue(buildTokenResponse({ csrf_token: 'csrf-login' }));
    authApiMocks.logoutRequest.mockResolvedValue({ message: 'Session closed' });

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('boot')).toHaveTextContent('settled');
    });

    await user.click(screen.getByRole('button', { name: 'login' }));

    await waitFor(() => {
      expect(screen.getByTestId('auth')).toHaveTextContent('authenticated');
    });
    expect(readStoredSession()?.csrfToken).toBe('csrf-login');

    await user.click(screen.getByRole('button', { name: 'logout' }));

    await waitFor(() => {
      expect(screen.getByTestId('auth')).toHaveTextContent('guest');
    });
    expect(authApiMocks.logoutRequest).toHaveBeenCalledWith('csrf-login');
    expect(readStoredSession()).toBeNull();
  });
});
