import { apiFetch, apiFetchList } from "@/api/client";
import type {
  Contract,
  ContractCreateInput,
  ContractUpdateInput,
} from "@/api/types";

export function fetchContracts(token: string, projectId?: number | null) {
  return apiFetchList<Contract>("/contracts/", {
    token,
    query: {
      limit: 100,
      project_id: projectId ?? undefined,
    },
  });
}

export function createContract(token: string, payload: ContractCreateInput) {
  return apiFetch<Contract>("/contracts/", {
    method: "POST",
    token,
    body: payload,
  });
}

export function updateContract(
  token: string,
  contractId: number,
  payload: ContractUpdateInput,
) {
  return apiFetch<Contract>(`/contracts/${contractId}`, {
    method: "PUT",
    token,
    body: payload,
  });
}
