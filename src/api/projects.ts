import { apiDownload, apiFetch, apiFetchList, apiFetchListPage, type ListPageParams } from "@/api/client";
import type {
  Project,
  ProjectCreateInput,
  ProjectUpdateInput,
} from "@/api/types";

export interface ProjectListParams extends ListPageParams {
  company_id?: number;
  status_filter?: string;
  search?: string;
}

export function fetchProjects(token: string) {
  return apiFetchList<Project>("/projects/", {
    token,
    query: { limit: 100 },
  });
}

export function fetchProjectsPage(token: string, params: ProjectListParams = {}) {
  return apiFetchListPage<Project>("/projects/", {
    token,
    query: params,
  });
}

export function createProject(token: string, payload: ProjectCreateInput) {
  return apiFetch<Project>("/projects/", {
    method: "POST",
    token,
    body: payload,
  });
}

export function updateProject(
  token: string,
  projectId: number,
  payload: ProjectUpdateInput,
) {
  return apiFetch<Project>(`/projects/${projectId}`, {
    method: "PUT",
    token,
    body: payload,
  });
}

export function deleteProject(token: string, projectId: number) {
  return apiFetch<void>(`/projects/${projectId}`, {
    method: "DELETE",
    token,
  });
}

export function exportProjects(token: string, params: ProjectListParams = {}) {
  return apiDownload("/projects/export", {
    token,
    query: params,
  });
}
