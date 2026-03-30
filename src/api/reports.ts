import { apiDownload, apiFetch, apiFetchListPage, type ListPageParams } from '@/api/client';
import type {
  AgeingAnalysis,
  CashFlowForecast,
  ContractCommercialReportRow,
  LabourProductivityReport,
  MISSummaryReport,
  MaterialConsumptionReport,
  ProjectCostReportRow,
  RetentionTrackingRow,
  WBSReport,
} from '@/api/types';

export interface ProjectCostReportParams extends ListPageParams {
  company_id?: number;
  status_filter?: string;
  search?: string;
}

export function fetchProjectCostReportPage(token: string, params: ProjectCostReportParams = {}) {
  return apiFetchListPage<ProjectCostReportRow>('/reports/project-costs', {
    token,
    query: params,
  });
}

export function exportProjectCostReport(token: string, params: ProjectCostReportParams = {}) {
  return apiDownload('/reports/project-costs/export', {
    token,
    query: params,
  });
}

export interface ContractCommercialReportParams extends ListPageParams {
  company_id?: number;
  search?: string;
}

export function fetchContractCommercialReportPage(
  token: string,
  params: ContractCommercialReportParams = {},
) {
  return apiFetchListPage<ContractCommercialReportRow>('/reports/contract-commercials', {
    token,
    query: params,
  });
}

export function exportContractCommercialReport(
  token: string,
  params: ContractCommercialReportParams = {},
) {
  return apiDownload('/reports/contract-commercials/export', {
    token,
    query: params,
  });
}

export function fetchMISSummary(
  token: string,
  params: {
    company_id?: number;
    status_filter?: string;
    search?: string;
    months?: number;
    top_limit?: number;
  } = {},
) {
  return apiFetch<MISSummaryReport>('/reports/mis-summary', {
    token,
    query: params,
  });
}

export function fetchAgeingAnalysis(
  token: string,
  params: { company_id?: number; top_limit?: number } = {},
) {
  return apiFetch<AgeingAnalysis>('/reports/ageing-analysis', {
    token,
    query: params,
  });
}

export function fetchCashFlowForecast(
  token: string,
  params: {
    company_id?: number;
    search?: string;
    top_limit?: number;
    horizon_weeks?: number;
    collection_days?: number;
  } = {},
) {
  return apiFetch<CashFlowForecast>('/reports/cash-flow-forecast', {
    token,
    query: params,
  });
}

export interface MaterialConsumptionReportParams extends ListPageParams {
  company_id?: number;
  status_filter?: string;
  search?: string;
}

export function fetchMaterialConsumptionReport(
  token: string,
  params: MaterialConsumptionReportParams = {},
) {
  return apiFetch<MaterialConsumptionReport>('/reports/material-consumption', {
    token,
    query: params,
  });
}

export function exportMaterialConsumptionReport(
  token: string,
  params: MaterialConsumptionReportParams = {},
) {
  return apiDownload('/reports/material-consumption/export', {
    token,
    query: params,
  });
}

export interface LabourProductivityReportParams extends ListPageParams {
  company_id?: number;
  status_filter?: string;
  search?: string;
  window_days?: number;
  benchmark_days?: number;
}

export function fetchLabourProductivityReport(
  token: string,
  params: LabourProductivityReportParams = {},
) {
  return apiFetch<LabourProductivityReport>('/reports/labour-productivity', {
    token,
    query: params,
  });
}

export function exportLabourProductivityReport(
  token: string,
  params: LabourProductivityReportParams = {},
) {
  return apiDownload('/reports/labour-productivity/export', {
    token,
    query: params,
  });
}

export interface RetentionTrackingReportParams extends ListPageParams {
  company_id?: number;
  search?: string;
}

export function fetchRetentionTrackingReportPage(
  token: string,
  params: RetentionTrackingReportParams = {},
) {
  return apiFetchListPage<RetentionTrackingRow>('/reports/retention-tracking', {
    token,
    query: params,
  });
}

export function exportRetentionTrackingReport(
  token: string,
  params: RetentionTrackingReportParams = {},
) {
  return apiDownload('/reports/retention-tracking/export', {
    token,
    query: params,
  });
}

// ── WBS (Work Breakdown Structure) ───────────────────────

export interface WBSReportParams extends ListPageParams {
  company_id?: number;
  contract_id?: number;
  search?: string;
}

export function fetchWBSReport(token: string, params: WBSReportParams = {}) {
  return apiFetch<WBSReport>('/reports/wbs', {
    token,
    query: params,
  });
}

export function exportWBSReport(token: string, params: WBSReportParams = {}) {
  return apiDownload('/reports/wbs/export', {
    token,
    query: params,
  });
}

// ── Export endpoints for ageing, cash-flow, MIS ──────────

export function exportAgeingAnalysis(
  token: string,
  params: { company_id?: number; top_limit?: number } = {},
) {
  return apiDownload('/reports/ageing-analysis/export', {
    token,
    query: params,
  });
}

export function exportCashFlowForecast(
  token: string,
  params: {
    company_id?: number;
    search?: string;
    top_limit?: number;
    horizon_weeks?: number;
    collection_days?: number;
  } = {},
) {
  return apiDownload('/reports/cash-flow-forecast/export', {
    token,
    query: params,
  });
}

export function exportMISSummary(
  token: string,
  params: {
    company_id?: number;
    status_filter?: string;
    search?: string;
    months?: number;
    top_limit?: number;
  } = {},
) {
  return apiDownload('/reports/mis-summary/export', {
    token,
    query: params,
  });
}
