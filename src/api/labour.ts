import { apiFetch, apiFetchList } from "@/api/client";
import type {
  Labour,
  LabourCreateInput,
  LabourUpdateInput,
} from "@/api/types";

interface LabourQueryOptions {
  contractorId?: number;
  isActive?: boolean | null;
  search?: string;
  limit?: number;
}

export function fetchLabours(token: string, options?: LabourQueryOptions) {
  return apiFetchList<Labour>("/labours/", {
    token,
    query: {
      limit: options?.limit ?? 100,
      contractor_id: options?.contractorId,
      is_active: options?.isActive ?? undefined,
      search: options?.search,
    },
  });
}

export function createLabour(token: string, payload: LabourCreateInput) {
  return apiFetch<Labour>("/labours/", {
    method: "POST",
    token,
    body: payload,
  });
}

export function updateLabour(
  token: string,
  labourId: number,
  payload: LabourUpdateInput,
) {
  return apiFetch<Labour>(`/labours/${labourId}`, {
    method: "PUT",
    token,
    body: payload,
  });
}
