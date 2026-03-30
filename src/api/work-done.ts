import { apiFetch } from '@/api/client';
import type { WorkDone } from '@/api/types';

export function fetchWorkDone(token: string, filters?: { contract_id?: number; measurement_id?: number }) {
  return apiFetch<WorkDone[]>('/work-done/', {
    token,
    query: { limit: 500, ...filters },
  });
}
