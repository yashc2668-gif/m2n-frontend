import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ApiError,
  apiFetch,
  configureApiAuthHandlers,
  getApiErrorMessage,
} from '@/api/client';

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

describe('api client helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    configureApiAuthHandlers(null);
  });

  it('prefers ApiError messages', () => {
    const error = new ApiError('Conflict detected', 409, 'db_conflict');
    expect(getApiErrorMessage(error)).toBe('Conflict detected');
  });

  it('falls back to generic errors', () => {
    expect(getApiErrorMessage(new Error('Network unavailable'))).toBe('Network unavailable');
    expect(getApiErrorMessage('unexpected')).toBe(
      'Something went wrong while talking to the backend.',
    );
  });

  it('retries once after refreshing an expired access token', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          { error: { message: 'Invalid or expired token', type: 'authentication_error' } },
          { status: 401 },
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse({ id: 7, name: 'ok' }, { status: 200 }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const refreshSession = vi.fn().mockResolvedValue('fresh-token');
    configureApiAuthHandlers({
      getAccessToken: () => 'stale-token',
      getCsrfToken: () => 'csrf-two',
      refreshSession,
      handleUnauthorized: vi.fn(),
    });

    const result = await apiFetch<{ id: number; name: string }>('/projects', {
      method: 'GET',
      token: 'stale-token',
    });

    expect(result).toEqual({ id: 7, name: 'ok' });
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const firstHeaders = new Headers(fetchMock.mock.calls[0][1]?.headers as HeadersInit);
    const secondHeaders = new Headers(fetchMock.mock.calls[1][1]?.headers as HeadersInit);
    expect(firstHeaders.get('Authorization')).toBe('Bearer stale-token');
    expect(secondHeaders.get('Authorization')).toBe('Bearer fresh-token');
    expect(fetchMock.mock.calls[1][1]?.credentials).toBe('include');
  });

  it('clears auth through handler when refresh cannot recover a 401', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(
        { error: { message: 'Invalid or expired token', type: 'authentication_error' } },
        { status: 401 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const handleUnauthorized = vi.fn();
    configureApiAuthHandlers({
      getAccessToken: () => 'expired-token',
      refreshSession: vi.fn().mockResolvedValue(null),
      handleUnauthorized,
    });

    await expect(
      apiFetch('/materials', {
        method: 'GET',
        token: 'expired-token',
      }),
    ).rejects.toBeInstanceOf(ApiError);

    expect(handleUnauthorized).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
