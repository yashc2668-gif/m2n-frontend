import { apiFetch, apiFetchList } from '@/api/client';
import type { User, UserCreateInput, UserUpdateInput } from '@/api/types';

export function fetchUsers(token: string) {
  return apiFetchList<User>('/users/', {
    token,
    query: { limit: 500 },
  });
}

export function fetchUser(token: string, userId: number) {
  return apiFetch<User>(`/users/${userId}`, { token });
}

export function createUser(token: string, payload: UserCreateInput) {
  return apiFetch<User>('/users/', {
    method: 'POST',
    token,
    body: payload,
  });
}

export function updateUser(token: string, userId: number, payload: UserUpdateInput) {
  return apiFetch<User>(`/users/${userId}`, {
    method: 'PUT',
    token,
    body: payload,
  });
}

export function deleteUser(token: string, userId: number) {
  return apiFetch<void>(`/users/${userId}`, {
    method: 'DELETE',
    token,
  });
}
