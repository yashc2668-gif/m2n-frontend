import { apiDownload, apiFetch, apiFetchList } from "@/api/client";
import type {
  RABill,
  RABillActionInput,
  RABillCreateInput,
  RABillGenerateInput,
} from "@/api/types";

export function fetchRABills(token: string, contractId?: number | null) {
  return apiFetchList<RABill>("/ra-bills/", {
    token,
    query: { limit: 100, contract_id: contractId ?? undefined },
  });
}

export function createRABill(token: string, payload: RABillCreateInput) {
  return apiFetch<RABill>("/ra-bills/", {
    method: "POST",
    token,
    body: payload,
  });
}

export function generateRABill(
  token: string,
  billId: number,
  payload?: RABillGenerateInput,
) {
  return apiFetch<RABill>(`/ra-bills/${billId}/generate`, {
    method: "POST",
    token,
    body: payload ?? {},
  });
}

export function submitRABill(
  token: string,
  billId: number,
  payload?: RABillActionInput,
) {
  return apiFetch<RABill>(`/ra-bills/${billId}/submit`, {
    method: "POST",
    token,
    body: payload ?? {},
  });
}

export function verifyRABill(
  token: string,
  billId: number,
  payload?: RABillActionInput,
) {
  return apiFetch<RABill>(`/ra-bills/${billId}/verify`, {
    method: "POST",
    token,
    body: payload ?? {},
  });
}

export function approveRABill(
  token: string,
  billId: number,
  payload?: RABillActionInput,
) {
  return apiFetch<RABill>(`/ra-bills/${billId}/approve`, {
    method: "POST",
    token,
    body: payload ?? {},
  });
}

export function rejectRABill(
  token: string,
  billId: number,
  payload?: RABillActionInput,
) {
  return apiFetch<RABill>(`/ra-bills/${billId}/reject`, {
    method: "POST",
    token,
    body: payload ?? {},
  });
}

export function cancelRABill(
  token: string,
  billId: number,
  payload?: RABillActionInput,
) {
  return apiFetch<RABill>(`/ra-bills/${billId}/cancel`, {
    method: "POST",
    token,
    body: payload ?? {},
  });
}

export function holdRABill(
  token: string,
  billId: number,
  payload?: RABillActionInput,
) {
  return apiFetch<RABill>(`/ra-bills/${billId}/finance-hold`, {
    method: "POST",
    token,
    body: payload ?? {},
  });
}

export function markRABillPartiallyPaid(
  token: string,
  billId: number,
  payload?: RABillActionInput,
) {
  return apiFetch<RABill>(`/ra-bills/${billId}/partially-paid`, {
    method: "POST",
    token,
    body: payload ?? {},
  });
}

export function markRABillPaid(
  token: string,
  billId: number,
  payload?: RABillActionInput,
) {
  return apiFetch<RABill>(`/ra-bills/${billId}/paid`, {
    method: "POST",
    token,
    body: payload ?? {},
  });
}

export function downloadRABillPdf(token: string, billId: number) {
  return apiDownload(`/ra-bills/${billId}/pdf`, { token });
}
