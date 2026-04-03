import { apiFetch, apiFetchList } from "@/api/client";
import type {
  LabourAdvance,
  LabourAdvanceCreateInput,
  LabourAdvanceRecovery,
  LabourAdvanceRecoveryCreateInput,
  LabourAdvanceUpdateInput,
} from "@/api/types";

export function fetchLabourAdvances(token: string) {
  return apiFetchList<LabourAdvance>("/labour-advances/", {
    token,
    query: { limit: 100 },
  });
}

export function createLabourAdvance(token: string, payload: LabourAdvanceCreateInput) {
  return apiFetch<LabourAdvance>("/labour-advances/", {
    method: "POST",
    token,
    body: payload,
  });
}

export function updateLabourAdvance(token: string, advanceId: number, payload: LabourAdvanceUpdateInput) {
  return apiFetch<LabourAdvance>(`/labour-advances/${advanceId}`, {
    method: "PUT",
    token,
    body: payload,
  });
}

export function addLabourAdvanceRecovery(
  token: string,
  advanceId: number,
  payload: LabourAdvanceRecoveryCreateInput,
) {
  return apiFetch<LabourAdvance>(`/labour-advances/${advanceId}/recoveries`, {
    method: "POST",
    token,
    body: payload,
  });
}

export function fetchLabourAdvanceRecoveries(token: string, advanceId: number) {
  return apiFetch<LabourAdvanceRecovery[]>(`/labour-advances/${advanceId}/recoveries`, {
    token,
  });
}
