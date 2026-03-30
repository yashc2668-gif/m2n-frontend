import { apiFetchList } from "@/api/client";
import type { LabourContractor } from "@/api/types";

export function fetchLabourContractors(token: string) {
  return apiFetchList<LabourContractor>("/labour-contractors/", {
    token,
    query: { limit: 100, is_active: true },
  });
}
