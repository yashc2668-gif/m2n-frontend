import { apiFetch } from '@/api/client';
import type { ContractDashboard, DashboardFinance, DashboardSummary } from '@/api/types';

export function fetchDashboardSummary(token: string) {
  return apiFetch<DashboardSummary>('/dashboard/summary', { token });
}

export function fetchDashboardFinance(token: string) {
  return apiFetch<DashboardFinance>('/dashboard/finance', { token });
}

export function fetchContractDashboard(token: string, contractId: number) {
  return apiFetch<ContractDashboard>(`/dashboard/contracts/${contractId}`, { token });
}
