import { apiFetchList } from "@/api/client";
import type { Company } from "@/api/types";

export function fetchCompanies(token: string) {
  return apiFetchList<Company>("/companies/", {
    token,
    query: { limit: 100 },
  });
}
