import { apiFetch } from '@/api/client';
import type {
  SecuredAdvance,
  SecuredAdvanceIssueCreateInput,
  SecuredAdvanceRecovery,
  SecuredAdvanceUpdateInput,
} from '@/api/types';

export function fetchSecuredAdvances(token: string, filters?: { contract_id?: number }) {
  return apiFetch<SecuredAdvance[]>('/secured-advances/', {
    token,
    query: { limit: 200, ...filters },
  });
}

export function fetchSecuredAdvance(token: string, id: number) {
  return apiFetch<SecuredAdvance>(`/secured-advances/${id}`, { token });
}

export function issueSecuredAdvance(token: string, payload: SecuredAdvanceIssueCreateInput) {
  return apiFetch<SecuredAdvance>('/secured-advances/issue', {
    method: 'POST',
    token,
    body: payload,
  });
}

export function updateSecuredAdvance(token: string, id: number, payload: SecuredAdvanceUpdateInput) {
  return apiFetch<SecuredAdvance>(`/secured-advances/${id}`, {
    method: 'PUT',
    token,
    body: payload,
  });
}

export function fetchSecuredAdvanceRecoveries(token: string, id: number) {
  return apiFetch<SecuredAdvanceRecovery[]>(`/secured-advances/${id}/recoveries`, { token });
}
