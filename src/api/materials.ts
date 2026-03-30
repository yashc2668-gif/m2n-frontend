import { apiDownload, apiFetch, apiFetchList, apiFetchListPage, type ListPageParams } from "@/api/client";
import type {
  Material,
  MaterialCreateInput,
  MaterialStockSummary,
  MaterialUpdateInput,
} from "@/api/types";

export interface MaterialListParams extends ListPageParams {
  is_active?: boolean;
  category?: string;
  company_id?: number;
  project_id?: number;
  search?: string;
  attention?: string;
}

export function fetchMaterials(token: string) {
  return apiFetchList<Material>("/materials/", {
    token,
    query: { limit: 100 },
  });
}

export function fetchMaterialsPage(token: string, params: MaterialListParams = {}) {
  return apiFetchListPage<Material>("/materials/", {
    token,
    query: params,
  });
}

export function fetchMaterialStockSummary(token: string) {
  return apiFetch<MaterialStockSummary[]>("/materials/stock-summary", { token });
}

export function createMaterial(token: string, payload: MaterialCreateInput) {
  return apiFetch<Material>("/materials/", {
    method: "POST",
    token,
    body: payload,
  });
}

export function updateMaterial(token: string, materialId: number, payload: MaterialUpdateInput) {
  return apiFetch<Material>(`/materials/${materialId}`, {
    method: "PATCH",
    token,
    body: payload,
  });
}

export function exportMaterials(token: string, params: MaterialListParams = {}) {
  return apiDownload("/materials/export", {
    token,
    query: params,
  });
}
