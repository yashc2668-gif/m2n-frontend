import { apiFetch, apiFetchList } from "@/api/client";
import type {
  LabourContractor,
  LabourContractorCreateInput,
  LabourContractorUpdateInput,
} from "@/api/types";

interface LabourContractorQueryOptions {
  isActive?: boolean | null;
  limit?: number;
}

export function fetchLabourContractors(
  token: string,
  options?: LabourContractorQueryOptions,
) {
  return apiFetchList<LabourContractor>("/labour-contractors/", {
    token,
    query: {
      limit: options?.limit ?? 100,
      is_active: options?.isActive ?? true,
    },
  });
}

export function createLabourContractor(
  token: string,
  payload: LabourContractorCreateInput,
) {
  return apiFetch<LabourContractor>("/labour-contractors/", {
    method: "POST",
    token,
    body: payload,
  });
}

export function updateLabourContractor(
  token: string,
  contractorId: number,
  payload: LabourContractorUpdateInput,
) {
  return apiFetch<LabourContractor>(`/labour-contractors/${contractorId}`, {
    method: "PUT",
    token,
    body: payload,
  });
}
