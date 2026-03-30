import { apiFetch } from "@/api/client";
import type {
  MaterialRequisition,
  MaterialRequisitionApproveInput,
  MaterialRequisitionCreateInput,
} from "@/api/types";

export function fetchMaterialRequisitions(token: string) {
  return apiFetch<MaterialRequisition[]>("/material-requisitions/", {
    token,
    query: { limit: 100 },
  });
}

export function createMaterialRequisition(token: string, payload: MaterialRequisitionCreateInput) {
  return apiFetch<MaterialRequisition>("/material-requisitions/", {
    method: "POST",
    token,
    body: payload,
  });
}

export function submitMaterialRequisition(token: string, requisitionId: number, remarks?: string) {
  return apiFetch<MaterialRequisition>(`/material-requisitions/${requisitionId}/submit`, {
    method: "POST",
    token,
    body: remarks ? { remarks } : {},
  });
}

export function approveMaterialRequisition(
  token: string,
  requisitionId: number,
  payload: MaterialRequisitionApproveInput,
) {
  return apiFetch<MaterialRequisition>(`/material-requisitions/${requisitionId}/approve`, {
    method: "POST",
    token,
    body: payload,
  });
}

export function rejectMaterialRequisition(token: string, requisitionId: number, remarks?: string) {
  return apiFetch<MaterialRequisition>(`/material-requisitions/${requisitionId}/reject`, {
    method: "POST",
    token,
    body: remarks ? { remarks } : {},
  });
}
