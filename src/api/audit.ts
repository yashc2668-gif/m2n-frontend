import { apiDownload, apiFetchListPage, type ListPageParams } from '@/api/client';
import type { AuditLog } from '@/api/types';

export interface AuditLogListParams extends ListPageParams {
  entity_type?: string;
  entity_id?: number;
  action?: string;
  performed_by?: number;
  date_from?: string;
  date_to?: string;
}

export function fetchAuditLogsPage(token: string, params: AuditLogListParams = {}) {
  return apiFetchListPage<AuditLog>('/audit-logs/', {
    token,
    query: params,
  });
}

export function exportAuditLogs(token: string, params: AuditLogListParams = {}) {
  return apiDownload('/audit-logs/export', {
    token,
    query: params,
  });
}
