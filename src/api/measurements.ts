import { apiDownload, apiFetch } from '@/api/client';
import type {
  Measurement,
  MeasurementCreateInput,
  MeasurementUpdateInput,
} from '@/api/types';

export function fetchMeasurements(token: string, filters?: { contract_id?: number; status_filter?: string }) {
  return apiFetch<Measurement[]>('/measurements/', {
    token,
    query: { limit: 200, ...filters },
  });
}

export function fetchMeasurement(token: string, measurementId: number) {
  return apiFetch<Measurement>(`/measurements/${measurementId}`, { token });
}

export function createMeasurement(token: string, payload: MeasurementCreateInput) {
  return apiFetch<Measurement>('/measurements/', {
    method: 'POST',
    token,
    body: payload,
  });
}

export function updateMeasurement(token: string, measurementId: number, payload: MeasurementUpdateInput) {
  return apiFetch<Measurement>(`/measurements/${measurementId}`, {
    method: 'PUT',
    token,
    body: payload,
  });
}

export function deleteMeasurement(token: string, measurementId: number) {
  return apiFetch<void>(`/measurements/${measurementId}`, {
    method: 'DELETE',
    token,
  });
}

export function submitMeasurement(token: string, measurementId: number) {
  return apiFetch<Measurement>(`/measurements/${measurementId}/submit`, {
    method: 'POST',
    token,
    body: {},
  });
}

export function approveMeasurement(token: string, measurementId: number) {
  return apiFetch<Measurement>(`/measurements/${measurementId}/approve`, {
    method: 'POST',
    token,
    body: {},
  });
}

export function downloadMeasurementPdf(token: string, measurementId: number) {
  return apiDownload(`/measurements/${measurementId}/pdf`, { token });
}
