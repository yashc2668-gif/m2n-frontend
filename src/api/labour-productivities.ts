import { apiFetch, apiFetchList } from '@/api/client';
import type {
  LabourProductivity,
  LabourProductivityCreateInput,
  LabourProductivityUpdateInput,
} from '@/api/types';

export function fetchLabourProductivities(
  token: string,
  filters?: { project_id?: number; contract_id?: number; labour_id?: number; trade?: string },
) {
  return apiFetchList<LabourProductivity>('/labour-productivities/', {
    token,
    query: { limit: 200, ...filters },
  });
}

export function fetchLabourProductivity(token: string, id: number) {
  return apiFetch<LabourProductivity>(`/labour-productivities/${id}`, { token });
}

export function createLabourProductivity(token: string, payload: LabourProductivityCreateInput) {
  return apiFetch<LabourProductivity>('/labour-productivities/', {
    method: 'POST',
    token,
    body: payload,
  });
}

export function updateLabourProductivity(token: string, id: number, payload: LabourProductivityUpdateInput) {
  return apiFetch<LabourProductivity>(`/labour-productivities/${id}`, {
    method: 'PUT',
    token,
    body: payload,
  });
}
