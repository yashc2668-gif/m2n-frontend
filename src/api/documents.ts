import { apiDownload, apiFetch, apiFetchList, apiFetchListPage, type ListPageParams } from '@/api/client';
import type { Document, DocumentCreateInput, DocumentUpdateInput } from '@/api/types';

export interface DocumentListParams extends ListPageParams {
  entity_type?: string;
  entity_id?: number;
  search?: string;
}

export function fetchDocuments(
  token: string,
  filters?: { entity_type?: string; entity_id?: number },
) {
  return apiFetchList<Document>('/documents/', {
    token,
    query: { limit: 200, ...filters },
  });
}

export function fetchDocumentsPage(token: string, params: DocumentListParams = {}) {
  return apiFetchListPage<Document>('/documents/', {
    token,
    query: params,
  });
}

export function fetchDocument(token: string, documentId: number) {
  return apiFetch<Document>(`/documents/${documentId}`, { token });
}

export function createDocument(token: string, payload: DocumentCreateInput) {
  return apiFetch<Document>('/documents/', {
    method: 'POST',
    token,
    body: payload,
  });
}

export function uploadDocument(token: string, formData: FormData) {
  return apiFetch<Document>('/documents/upload', {
    method: 'POST',
    token,
    body: formData,
  });
}

export function updateDocument(token: string, documentId: number, payload: DocumentUpdateInput) {
  return apiFetch<Document>(`/documents/${documentId}`, {
    method: 'PUT',
    token,
    body: payload,
  });
}

export function getDocumentDownloadUrl(documentId: number) {
  return `/documents/${documentId}/download`;
}

export function exportDocuments(token: string, params: DocumentListParams = {}) {
  return apiDownload('/documents/export', {
    token,
    query: params,
  });
}
