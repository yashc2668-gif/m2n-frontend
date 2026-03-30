import { apiFetch } from '@/api/client';
import type { BOQItem, BOQItemCreateInput, BOQItemUpdateInput } from '@/api/types';

export function fetchBOQItems(token: string, contractId: number) {
  return apiFetch<BOQItem[]>(`/contracts/${contractId}/boq-items/`, {
    token,
    query: { limit: 500 },
  });
}

export function createBOQItem(token: string, contractId: number, payload: BOQItemCreateInput) {
  return apiFetch<BOQItem>(`/contracts/${contractId}/boq-items/`, {
    method: 'POST',
    token,
    body: payload,
  });
}

export function updateBOQItem(token: string, contractId: number, itemId: number, payload: BOQItemUpdateInput) {
  return apiFetch<BOQItem>(`/contracts/${contractId}/boq-items/${itemId}`, {
    method: 'PUT',
    token,
    body: payload,
  });
}
