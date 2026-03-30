import { apiFetch } from '@/api/client';
import type {
  MessageResponse,
  TokenResponse,
  User,
} from '@/api/types';

export interface LoginInput {
  email: string;
  password: string;
}

export interface ForgotPasswordInput {
  email: string;
}

export interface ResetPasswordInput {
  email: string;
  otp_code: string;
  new_password: string;
}

export function loginRequest(payload: LoginInput) {
  return apiFetch<TokenResponse>('/auth/login', {
    method: 'POST',
    body: payload,
    retryOnUnauthorized: false,
  });
}

export function refreshSessionRequest(csrfToken: string) {
  return apiFetch<TokenResponse>('/auth/refresh', {
    method: 'POST',
    csrfToken,
    retryOnUnauthorized: false,
  });
}

export function logoutRequest(csrfToken: string, revokeAllSessions = false) {
  return apiFetch<MessageResponse>('/auth/logout', {
    method: 'POST',
    body: { revoke_all_sessions: revokeAllSessions },
    csrfToken,
    retryOnUnauthorized: false,
  });
}

export function forgotPasswordRequest(payload: ForgotPasswordInput) {
  return apiFetch<MessageResponse>('/auth/forgot-password', {
    method: 'POST',
    body: payload,
    retryOnUnauthorized: false,
  });
}

export function resetPasswordRequest(payload: ResetPasswordInput) {
  return apiFetch<MessageResponse>('/auth/reset-password', {
    method: 'POST',
    body: payload,
    retryOnUnauthorized: false,
  });
}

export function fetchCurrentUser(token: string, options?: { retryOnUnauthorized?: boolean }) {
  return apiFetch<User>('/auth/me', {
    method: 'GET',
    token,
    retryOnUnauthorized: options?.retryOnUnauthorized ?? true,
  });
}
