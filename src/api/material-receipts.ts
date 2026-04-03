import { apiFetch, apiFetchList } from "@/api/client";
import type {
  MaterialReceipt,
  MaterialReceiptCreateInput,
  MaterialReceiptUpdateInput,
} from "@/api/types";

export function fetchMaterialReceipts(token: string) {
  return apiFetchList<MaterialReceipt>("/material-receipts/", {
    token,
    query: { limit: 100 },
  });
}

export function createMaterialReceipt(token: string, payload: MaterialReceiptCreateInput) {
  return apiFetch<MaterialReceipt>("/material-receipts/", {
    method: "POST",
    token,
    body: payload,
  });
}

export function updateMaterialReceipt(
  token: string,
  receiptId: number,
  payload: MaterialReceiptUpdateInput,
) {
  return apiFetch<MaterialReceipt>(`/material-receipts/${receiptId}`, {
    method: "PUT",
    token,
    body: payload,
  });
}
