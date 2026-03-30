import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { ApiError, configureApiAuthHandlers } from '@/api/client';
import {
  fetchCurrentUser,
  type LoginInput,
  loginRequest,
  logoutRequest,
  refreshSessionRequest,
} from '@/api/auth';
import type { TokenResponse, User } from '@/api/types';
import {
  clearStoredSession,
  readStoredSession,
  resolveStoredCsrfToken,
  writeStoredSession,
} from '@/features/auth/auth-storage';

export interface AuthContextValue {
  accessToken: string | null;
  hasSession: boolean;
  isAuthenticated: boolean;
  isBootstrapping: boolean;
  user: User | null;
  login: (credentials: LoginInput) => Promise<User>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

function buildStoredSession(response: TokenResponse) {
  return {
    accessToken: response.access_token,
    accessTokenExpiresAt: Date.now() + response.expires_in * 1000,
    csrfToken: response.csrf_token,
    user: response.user,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(() => readStoredSession()?.accessToken ?? null);
  const [csrfToken, setCsrfToken] = useState<string | null>(() => resolveStoredCsrfToken());
  const [user, setUser] = useState<User | null>(() => readStoredSession()?.user ?? null);
  const [accessTokenExpiresAt, setAccessTokenExpiresAt] = useState<number | null>(
    () => readStoredSession()?.accessTokenExpiresAt ?? null,
  );
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  const refreshPromiseRef = useRef<Promise<string | null> | null>(null);
  const refreshTimerRef = useRef<number | null>(null);

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current !== null) {
      window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  const clearSession = useCallback(() => {
    clearRefreshTimer();
    setAccessToken(null);
    setCsrfToken(null);
    setUser(null);
    setAccessTokenExpiresAt(null);
    clearStoredSession();
  }, [clearRefreshTimer]);

  const applySession = useCallback((response: TokenResponse) => {
    const session = buildStoredSession(response);
    setAccessToken(session.accessToken);
    setCsrfToken(session.csrfToken);
    setUser(session.user);
    setAccessTokenExpiresAt(session.accessTokenExpiresAt);
    writeStoredSession(session);
    return session.accessToken;
  }, []);

  const refreshAccessSession = useCallback(async () => {
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    const effectiveCsrfToken = resolveStoredCsrfToken() ?? csrfToken;
    if (!effectiveCsrfToken) {
      clearSession();
      return null;
    }

    refreshPromiseRef.current = refreshSessionRequest(effectiveCsrfToken)
      .then((response) => applySession(response))
      .catch(() => {
        clearSession();
        return null;
      })
      .finally(() => {
        refreshPromiseRef.current = null;
      });

    return refreshPromiseRef.current;
  }, [applySession, clearSession, csrfToken]);

  useEffect(() => {
    configureApiAuthHandlers({
      getAccessToken: () => accessToken,
      getCsrfToken: () => resolveStoredCsrfToken() ?? csrfToken,
      refreshSession: refreshAccessSession,
      handleUnauthorized: clearSession,
    });

    return () => {
      configureApiAuthHandlers(null);
    };
  }, [accessToken, clearSession, csrfToken, refreshAccessSession]);

  useEffect(() => {
    clearRefreshTimer();

    if (!accessToken || !accessTokenExpiresAt) {
      return;
    }

    const refreshInMs = Math.max(accessTokenExpiresAt - Date.now() - 60_000, 5_000);
    refreshTimerRef.current = window.setTimeout(() => {
      void refreshAccessSession();
    }, refreshInMs);

    return clearRefreshTimer;
  }, [accessToken, accessTokenExpiresAt, clearRefreshTimer, refreshAccessSession]);

  useEffect(() => {
    let isMounted = true;

    async function bootstrapSession() {
      setIsBootstrapping(true);

      const stored = readStoredSession();
      const browserCsrfToken = resolveStoredCsrfToken();

      if (stored?.accessToken) {
        try {
          const currentUser = await fetchCurrentUser(stored.accessToken, {
            retryOnUnauthorized: false,
          });
          if (!isMounted) {
            return;
          }

          setAccessToken(stored.accessToken);
          setCsrfToken(browserCsrfToken ?? stored.csrfToken);
          setUser(currentUser);
          setAccessTokenExpiresAt(stored.accessTokenExpiresAt);
          writeStoredSession({
            ...stored,
            csrfToken: browserCsrfToken ?? stored.csrfToken,
            user: currentUser,
          });
          setIsBootstrapping(false);
          return;
        } catch (error) {
          if (!(error instanceof ApiError) || error.status !== 401) {
            if (!isMounted) {
              return;
            }
            setAccessToken(stored.accessToken);
            setCsrfToken(browserCsrfToken ?? stored.csrfToken);
            setUser(stored.user);
            setAccessTokenExpiresAt(stored.accessTokenExpiresAt);
            setIsBootstrapping(false);
            return;
          }
        }
      }

      const refreshedToken = await refreshAccessSession();
      if (!isMounted) {
        return;
      }

      if (!refreshedToken) {
        clearSession();
      }
      setIsBootstrapping(false);
    }

    void bootstrapSession();

    return () => {
      isMounted = false;
    };
  }, [clearSession, refreshAccessSession]);

  const login = useCallback(async (credentials: LoginInput) => {
    const response = await loginRequest(credentials);
    applySession(response);
    setIsBootstrapping(false);
    return response.user;
  }, [applySession]);

  const logout = useCallback(async () => {
    const effectiveCsrfToken = resolveStoredCsrfToken() ?? csrfToken;
    try {
      if (effectiveCsrfToken) {
        await logoutRequest(effectiveCsrfToken);
      }
    } finally {
      clearSession();
      setIsBootstrapping(false);
    }
  }, [clearSession, csrfToken]);

  const value = useMemo<AuthContextValue>(
    () => ({
      accessToken,
      hasSession: Boolean(accessToken || csrfToken),
      isAuthenticated: Boolean(accessToken && user),
      isBootstrapping,
      user,
      login,
      logout,
    }),
    [accessToken, csrfToken, isBootstrapping, login, logout, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
