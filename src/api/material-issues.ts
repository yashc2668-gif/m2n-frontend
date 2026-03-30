import { apiFetch } from "@/api/client";
import type {
  MaterialIssue,
  MaterialIssueCreateInput,
  MaterialIssueUpdateInput,
} from "@/api/types";

export function fetchMaterialIssues(token: string) {
  return apiFetch<MaterialIssue[]>("/material-issues/", {
    token,
    query: { limit: 100 },
  });
}

export function createMaterialIssue(token: string, payload: MaterialIssueCreateInput) {
  return apiFetch<MaterialIssue>("/material-issues/", {
    method: "POST",
    token,
    body: payload,
  });
}

export function updateMaterialIssue(token: string, issueId: number, payload: MaterialIssueUpdateInput) {
  return apiFetch<MaterialIssue>(`/material-issues/${issueId}`, {
    method: "PUT",
    token,
    body: payload,
  });
}
