import { apiDownload, apiFetch, apiFetchList, apiFetchListPage, type ListPageParams } from '@/api/client';
import type {
  Document,
  DocumentCreateInput,
  DocumentEntityType,
  DocumentUpdateInput,
} from '@/api/types';

export interface DocumentListParams extends ListPageParams {
  entity_type?: DocumentEntityType;
  entity_id?: number;
  document_type?: string;
  search?: string;
}

export function fetchDocuments(
  token: string,
  filters?: {
    entity_type?: DocumentEntityType;
    entity_id?: number;
    document_type?: string;
    search?: string;
  },
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

export function downloadDocument(token: string, documentId: number) {
  return apiDownload(getDocumentDownloadUrl(documentId), { token });
}

export function exportDocuments(token: string, params: DocumentListParams = {}) {
  return apiDownload('/documents/export', {
    token,
    query: params,
  });
}
