import { apiFetch, apiFetchList } from "@/api/client";
import type {
  MaterialStockAdjustment,
  MaterialStockAdjustmentCreateInput,
  MaterialStockAdjustmentUpdateInput,
} from "@/api/types";

export function fetchMaterialStockAdjustments(token: string) {
  return apiFetchList<MaterialStockAdjustment>("/material-stock-adjustments/", {
    token,
    query: { limit: 100 },
  });
}

export function createMaterialStockAdjustment(
  token: string,
  payload: MaterialStockAdjustmentCreateInput,
) {
  return apiFetch<MaterialStockAdjustment>("/material-stock-adjustments/", {
    method: "POST",
    token,
    body: payload,
  });
}

export function updateMaterialStockAdjustment(
  token: string,
  adjustmentId: number,
  payload: MaterialStockAdjustmentUpdateInput,
) {
  return apiFetch<MaterialStockAdjustment>(`/material-stock-adjustments/${adjustmentId}`, {
    method: "PUT",
    token,
    body: payload,
  });
}
