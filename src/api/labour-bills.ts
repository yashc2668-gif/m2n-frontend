import { apiDownload, apiFetch } from "@/api/client";
import type {
  LabourBill,
  LabourBillCreateInput,
  LabourBillTransitionInput,
  LabourBillUpdateInput,
} from "@/api/types";

export function fetchLabourBills(token: string) {
  return apiFetch<LabourBill[]>("/labour-bills/", {
    token,
    query: { limit: 100 },
  });
}

export function createLabourBill(token: string, payload: LabourBillCreateInput) {
  return apiFetch<LabourBill>("/labour-bills/", {
    method: "POST",
    token,
    body: payload,
  });
}

export function updateLabourBill(token: string, billId: number, payload: LabourBillUpdateInput) {
  return apiFetch<LabourBill>(`/labour-bills/${billId}`, {
    method: "PUT",
    token,
    body: payload,
  });
}

export function approveLabourBill(token: string, billId: number, payload?: LabourBillTransitionInput) {
  return apiFetch<LabourBill>(`/labour-bills/${billId}/approve`, {
    method: "POST",
    token,
    body: payload ?? {},
  });
}

export function markLabourBillPaid(token: string, billId: number, payload?: LabourBillTransitionInput) {
  return apiFetch<LabourBill>(`/labour-bills/${billId}/mark-paid`, {
    method: "POST",
    token,
    body: payload ?? {},
  });
}

export function downloadLabourBillPdf(token: string, billId: number) {
  return apiDownload(`/labour-bills/${billId}/pdf`, { token });
}
