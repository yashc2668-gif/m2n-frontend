interface ApiErrorBody {
  error?: {
    type?: string;
    message?: string;
    details?: unknown;
  };
  request_id?: string;
}

export interface PaginatedListResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export type ListSortDirection = 'asc' | 'desc';

export interface ListPageParams {
  [key: string]: string | number | boolean | null | undefined;
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_dir?: ListSortDirection;
}

export interface ApiRequestOptions extends Omit<RequestInit, 'body' | 'credentials'> {
  body?: BodyInit | object | null;
  query?: Record<string, string | number | boolean | null | undefined>;
  token?: string | null;
  csrfToken?: string | null;
  retryOnUnauthorized?: boolean;
}

interface ApiAuthHandlers {
  getAccessToken?: () => string | null;
  getCsrfToken?: () => string | null;
  refreshSession?: () => Promise<string | null>;
  handleUnauthorized?: () => void;
}

export class ApiError extends Error {
  status: number;
  type?: string;
  details?: unknown;
  requestId?: string;

  constructor(message: string, status: number, type?: string, details?: unknown, requestId?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.type = type;
    this.details = details;
    this.requestId = requestId;
  }
}

const defaultBaseUrl = 'http://localhost:8000/api/v1';
const rawBaseUrl = import.meta.env.VITE_API_BASE_URL ?? defaultBaseUrl;
export const apiBaseUrl = rawBaseUrl.replace(/\/$/, '');

const nonRefreshableAuthPaths = new Set([
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/logout',
  '/auth/forgot-password',
  '/auth/reset-password',
]);

let apiAuthHandlers: ApiAuthHandlers = {};

function createUrl(path: string, query?: ApiRequestOptions['query']) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${apiBaseUrl}${normalizedPath}`);

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') {
        return;
      }
      url.searchParams.set(key, String(value));
    });
  }

  return url;
}

function buildApiError(response: Response, data: ApiErrorBody | null) {
  return new ApiError(
    data?.error?.message ?? response.statusText,
    response.status,
    data?.error?.type,
    data?.error?.details,
    data?.request_id ?? response.headers.get('X-Request-ID') ?? undefined,
  );
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return undefined as T;
  }

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const data = isJson ? ((await response.json()) as T | ApiErrorBody) : null;

  if (!response.ok) {
    throw buildApiError(response, (data as ApiErrorBody | null) ?? null);
  }

  return data as T;
}

async function performFetch<T>(
  path: string,
  options: ApiRequestOptions,
  tokenOverride?: string | null,
  csrfOverride?: string | null,
): Promise<T> {
  const { body, headers, query, token, csrfToken, ...rest } = options;
  const requestHeaders = new Headers(headers);

  let requestBody: BodyInit | undefined;
  if (body instanceof FormData || typeof body === 'string' || body instanceof URLSearchParams) {
    requestBody = body;
  } else if (body !== null && body !== undefined) {
    requestHeaders.set('Content-Type', 'application/json');
    requestBody = JSON.stringify(body);
  }

  requestHeaders.set('Accept', 'application/json');

  const effectiveToken = tokenOverride ?? token ?? apiAuthHandlers.getAccessToken?.() ?? null;
  const effectiveCsrfToken = csrfOverride ?? csrfToken ?? apiAuthHandlers.getCsrfToken?.() ?? null;

  if (effectiveToken) {
    requestHeaders.set('Authorization', `Bearer ${effectiveToken}`);
  }

  if (effectiveCsrfToken) {
    requestHeaders.set(
      import.meta.env.VITE_CSRF_HEADER_NAME ?? 'X-CSRF-Token',
      effectiveCsrfToken,
    );
  }

  const response = await fetch(createUrl(path, query), {
    ...rest,
    credentials: 'include',
    headers: requestHeaders,
    body: requestBody,
  });

  return parseResponse<T>(response);
}

async function performDownload(
  path: string,
  options: ApiRequestOptions,
  tokenOverride?: string | null,
  csrfOverride?: string | null,
): Promise<Blob> {
  const { body, headers, query, token, csrfToken, ...rest } = options;
  const requestHeaders = new Headers(headers);

  let requestBody: BodyInit | undefined;
  if (body instanceof FormData || typeof body === 'string' || body instanceof URLSearchParams) {
    requestBody = body;
  } else if (body !== null && body !== undefined) {
    requestHeaders.set('Content-Type', 'application/json');
    requestBody = JSON.stringify(body);
  }

  const effectiveToken = tokenOverride ?? token ?? apiAuthHandlers.getAccessToken?.() ?? null;
  const effectiveCsrfToken = csrfOverride ?? csrfToken ?? apiAuthHandlers.getCsrfToken?.() ?? null;

  if (effectiveToken) {
    requestHeaders.set('Authorization', `Bearer ${effectiveToken}`);
  }

  if (effectiveCsrfToken) {
    requestHeaders.set(
      import.meta.env.VITE_CSRF_HEADER_NAME ?? 'X-CSRF-Token',
      effectiveCsrfToken,
    );
  }

  const response = await fetch(createUrl(path, query), {
    ...rest,
    credentials: 'include',
    headers: requestHeaders,
    body: requestBody,
  });

  if (!response.ok) {
    let data: ApiErrorBody | null = null;
    if (response.headers.get('content-type')?.includes('application/json')) {
      data = (await response.json()) as ApiErrorBody;
    }
    throw buildApiError(response, data);
  }

  return response.blob();
}

export function configureApiAuthHandlers(handlers: ApiAuthHandlers | null) {
  apiAuthHandlers = handlers ?? {};
}

export async function apiFetch<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const retryOnUnauthorized = options.retryOnUnauthorized ?? Boolean(options.token);

  try {
    return await performFetch<T>(path, options);
  } catch (error) {
    if (!(error instanceof ApiError)) {
      throw error;
    }

    const shouldAttemptRefresh =
      error.status === 401 &&
      retryOnUnauthorized &&
      !nonRefreshableAuthPaths.has(path) &&
      typeof apiAuthHandlers.refreshSession === 'function';

    if (!shouldAttemptRefresh) {
      if (error.status === 401) {
        apiAuthHandlers.handleUnauthorized?.();
      }
      throw error;
    }

    const refreshedToken = await apiAuthHandlers.refreshSession?.();
    if (!refreshedToken) {
      apiAuthHandlers.handleUnauthorized?.();
      throw error;
    }

    try {
      return await performFetch<T>(
        path,
        { ...options, retryOnUnauthorized: false },
        refreshedToken,
        apiAuthHandlers.getCsrfToken?.() ?? null,
      );
    } catch (retryError) {
      if (retryError instanceof ApiError && retryError.status === 401) {
        apiAuthHandlers.handleUnauthorized?.();
      }
      throw retryError;
    }
  }
}

export async function apiFetchList<T>(path: string, options: ApiRequestOptions = {}) {
  const response = await apiFetch<T[] | PaginatedListResponse<T>>(path, options);
  if (Array.isArray(response)) {
    return response;
  }
  return response.items ?? [];
}

export async function apiFetchListPage<T>(path: string, options: ApiRequestOptions = {}) {
  const response = await apiFetch<T[] | PaginatedListResponse<T>>(path, options);
  if (Array.isArray(response)) {
    return {
      items: response,
      total: response.length,
      page: 1,
      limit: response.length || 1,
    } satisfies PaginatedListResponse<T>;
  }
  return response;
}

export async function apiDownload(path: string, options: ApiRequestOptions = {}) {
  return performDownload(path, options);
}

export function getApiBaseHost() {
  try {
    return new URL(apiBaseUrl).host;
  } catch {
    return apiBaseUrl;
  }
}

export function getApiErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (
      error.status === 409 &&
      /modified concurrently|refresh and retry|lock_version/i.test(error.message)
    ) {
      return 'Someone updated this record before you. Reload the latest data and try again.';
    }
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Something went wrong while talking to the backend.';
}
