import { apiDownload, apiFetch, apiFetchList } from '@/api/client';
import type {
  OutstandingBill,
  Payment,
  PaymentActionInput,
  PaymentAllocationCreateInput,
  PaymentCreateInput,
} from '@/api/types';

export function fetchPayments(token: string, contractId?: number | null) {
  return apiFetchList<Payment>('/payments/', {
    token,
    query: { limit: 100, contract_id: contractId ?? undefined },
  });
}

export function fetchOutstandingBills(token: string, contractId?: number | null) {
  return apiFetchList<OutstandingBill>('/payments/outstanding/ra-bills', {
    token,
    query: { limit: 100, contract_id: contractId ?? undefined },
  });
}

export function createPayment(token: string, payload: PaymentCreateInput) {
  return apiFetch<Payment>('/payments/', {
    method: 'POST',
    token,
    body: payload,
  });
}

export function approvePayment(token: string, paymentId: number, payload?: PaymentActionInput) {
  return apiFetch<Payment>(`/payments/${paymentId}/approve`, {
    method: 'POST',
    token,
    body: payload ?? {},
  });
}

export function releasePayment(token: string, paymentId: number, payload?: PaymentActionInput) {
  return apiFetch<Payment>(`/payments/${paymentId}/release`, {
    method: 'POST',
    token,
    body: payload ?? {},
  });
}

export function allocatePayment(
  token: string,
  paymentId: number,
  allocations: PaymentAllocationCreateInput[],
) {
  return apiFetch<Payment>(`/payments/${paymentId}/allocate`, {
    method: 'POST',
    token,
    body: allocations,
  });
}

export function downloadPaymentPdf(token: string, paymentId: number) {
  return apiDownload(`/payments/${paymentId}/pdf`, { token });
}
