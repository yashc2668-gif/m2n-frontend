import { apiFetch, apiFetchList } from "@/api/client";
import type {
  SiteExpense,
  SiteExpenseActionInput,
  SiteExpenseCreateInput,
  SiteExpenseUpdateInput,
} from "@/api/types";

interface SiteExpenseQueryOptions {
  projectId?: number | null;
  status?: string | null;
  expenseHead?: string | null;
  search?: string | null;
  limit?: number;
}

export function fetchSiteExpenses(token: string, options?: SiteExpenseQueryOptions) {
  return apiFetchList<SiteExpense>("/site-expenses/", {
    token,
    query: {
      limit: options?.limit ?? 100,
      project_id: options?.projectId ?? undefined,
      status_filter: options?.status ?? undefined,
      expense_head: options?.expenseHead ?? undefined,
      search: options?.search ?? undefined,
    },
  });
}

export function createSiteExpense(token: string, payload: SiteExpenseCreateInput) {
  return apiFetch<SiteExpense>("/site-expenses/", {
    method: "POST",
    token,
    body: payload,
  });
}

export function updateSiteExpense(token: string, expenseId: number, payload: SiteExpenseUpdateInput) {
  return apiFetch<SiteExpense>(`/site-expenses/${expenseId}`, {
    method: "PUT",
    token,
    body: payload,
  });
}

export function approveSiteExpense(token: string, expenseId: number, payload?: SiteExpenseActionInput) {
  return apiFetch<SiteExpense>(`/site-expenses/${expenseId}/approve`, {
    method: "POST",
    token,
    body: payload ?? {},
  });
}

export function paySiteExpense(token: string, expenseId: number, payload?: SiteExpenseActionInput) {
  return apiFetch<SiteExpense>(`/site-expenses/${expenseId}/pay`, {
    method: "POST",
    token,
    body: payload ?? {},
  });
}
