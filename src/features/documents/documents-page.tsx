import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, FolderOpen, Search, Upload } from 'lucide-react';
import { useDeferredValue, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';

import { useAuth } from '@/app/providers/auth-provider';
import { apiBaseUrl, getApiErrorMessage } from '@/api/client';
import { exportDocuments, fetchDocuments, fetchDocumentsPage } from '@/api/documents';
import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { PageSkeleton } from '@/components/feedback/skeleton';
import { UploadProgress, useUploadProgress } from '@/components/feedback/upload-progress';
import { PermissionGate } from '@/components/shell/permission-gate';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Drawer } from '@/components/ui/drawer';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import type { Document as DocType, DocumentEntityType } from '@/api/types';
import { saveBlob } from '@/lib/download';
import { formatDate, titleCase } from '@/lib/format';
import { hasPermissions } from '@/lib/permissions';
import { useKeyboardShortcuts } from '@/lib/use-keyboard-shortcuts';

const inputClassName =
  'w-full rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-amber-100';
const labelClassName = 'text-sm font-semibold text-[var(--surface-ink)]';

const entityToneMap: Record<string, 'accent' | 'info' | 'success' | 'warning'> = {
  contract: 'accent',
  measurement: 'info',
  ra_bill: 'success',
  payment: 'warning',
  vendor: 'warning',
  company: 'info',
  site_expense: 'accent',
};

const documentEntityOptions: Array<{ value: DocumentEntityType; label: string }> = [
  { value: 'contract', label: 'Contract' },
  { value: 'measurement', label: 'Measurement' },
  { value: 'ra_bill', label: 'RA Bill' },
  { value: 'payment', label: 'Payment' },
  { value: 'vendor', label: 'Vendor' },
  { value: 'company', label: 'Company' },
  { value: 'site_expense', label: 'Site Expense' },
];

export default function DocumentsPage() {
  const { accessToken, user } = useAuth();
  const queryClient = useQueryClient();
  const [entityFilter, setEntityFilter] = useState<DocumentEntityType | ''>('');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [tablePage, setTablePage] = useState(1);
  const [tablePageSize, setTablePageSize] = useState(25);
  const [tableSort, setTableSort] = useState<{ id: string; direction: 'asc' | 'desc' }>({
    id: 'updated_at',
    direction: 'desc',
  });
  const [showUpload, setShowUpload] = useState(false);
  const [drawerDoc, setDrawerDoc] = useState<DocType | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadEntityType, setUploadEntityType] = useState<DocumentEntityType>('contract');
  const [uploadEntityId, setUploadEntityId] = useState('');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDocumentType, setUploadDocumentType] = useState('');
  const [uploadRemarks, setUploadRemarks] = useState('');
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const { progress: uploadProgress, fileName: uploadingFileName, isUploading, upload: xhrUpload, cancel: cancelUpload, reset: resetUpload } = useUploadProgress();

  const resetTablePage = useEffectEvent(() => {
    setTablePage(1);
  });

  useEffect(() => {
    resetTablePage();
  }, [deferredSearch, entityFilter]);

  const documentsOverviewQuery = useQuery({
    queryKey: ['documents', 'overview', entityFilter],
    queryFn: () => fetchDocuments(accessToken ?? '', entityFilter ? { entity_type: entityFilter } : undefined),
    enabled: Boolean(accessToken),
  });
  const documentsTableQuery = useQuery({
    queryKey: ['documents', 'table', entityFilter, deferredSearch, tablePage, tablePageSize, tableSort.id, tableSort.direction],
    queryFn: () =>
      fetchDocumentsPage(accessToken ?? '', {
        entity_type: entityFilter || undefined,
        search: deferredSearch || undefined,
        page: tablePage,
        limit: tablePageSize,
        sort_by: tableSort.id,
        sort_dir: tableSort.direction,
      }),
    enabled: Boolean(accessToken),
    placeholderData: (previous) => previous,
  });

  const documents = useMemo(
    () => (Array.isArray(documentsOverviewQuery.data) ? documentsOverviewQuery.data : []),
    [documentsOverviewQuery.data],
  );
  const tablePageData = documentsTableQuery.data;
  const tableRows = Array.isArray(tablePageData?.items) ? tablePageData.items : [];

  const metrics = useMemo(() => ({
    total: documents.length,
    contracts: documents.filter((d) => d.entity_type === 'contract').length,
    measurements: documents.filter((d) => d.entity_type === 'measurement').length,
    bills: documents.filter((d) => d.entity_type === 'ra_bill' || d.entity_type === 'payment').length,
  }), [documents]);

  const canCreate = hasPermissions(user?.role ?? 'viewer', ['documents:create']);
  useKeyboardShortcuts({
    'ctrl+n': () => {
      if (!canCreate) return;
      setShowUpload(true);
      setServerMessage(null);
    },
    '/': () => searchRef.current?.focus(),
  });
  const exportMutation = useMutation({
    mutationFn: async () =>
      exportDocuments(accessToken ?? '', {
        entity_type: entityFilter || undefined,
        search: deferredSearch || undefined,
        sort_by: tableSort.id,
        sort_dir: tableSort.direction,
      }),
    onSuccess: (blob) => {
      saveBlob(blob, 'm2n-documents.csv');
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!uploadFile || !uploadEntityId || !uploadTitle) throw new Error('All fields are required.');
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('entity_type', uploadEntityType);
      formData.append('entity_id', uploadEntityId);
      formData.append('title', uploadTitle.trim());
      if (uploadDocumentType.trim()) {
        formData.append('document_type', uploadDocumentType.trim());
      }
      if (uploadRemarks.trim()) {
        formData.append('remarks', uploadRemarks.trim());
      }
      const resp = await xhrUpload(`${apiBaseUrl}/documents/upload`, formData, accessToken ?? '');
      if (!resp.ok) throw new Error(await resp.text());
      return resp.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['documents'] });
      setServerMessage('Document uploaded.');
      setShowUpload(false);
      setUploadFile(null);
      setUploadEntityId('');
      setUploadTitle('');
      setUploadDocumentType('');
      setUploadRemarks('');
      resetUpload();
    },
  });

  if (documentsOverviewQuery.isLoading || documentsTableQuery.isLoading) {
    return <PageSkeleton statCount={4} tableRows={8} tableColumns={7} />;
  }

  if (documentsOverviewQuery.error || documentsTableQuery.error) {
    return (
      <ErrorState
        description={getApiErrorMessage(documentsOverviewQuery.error ?? documentsTableQuery.error)}
        onRetry={() => {
          void documentsOverviewQuery.refetch();
          void documentsTableQuery.refetch();
        }}
      />
    );
  }

  return (
    <PermissionGate permissions={['documents:read']}>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Documents"
          title="Centralised document archive for contracts, quotations, measurements, and bills."
          description="Upload and manage files attached to ERP entities, including vendor and company quotation records. Documents support versioning so you can track history."
          actions={
            <Button disabled={!canCreate} onClick={() => { setShowUpload(true); setServerMessage(null); }}>
              <Upload className="size-4" /> Upload document
            </Button>
          }
        />

        <div className="grid gap-4 md:grid-cols-4">
          <StatCard label="Total" value={String(metrics.total)} caption="Documents in archive" icon={FolderOpen} tone="info" />
          <StatCard label="Contracts" value={String(metrics.contracts)} caption="Contract documents" icon={FileText} tone="accent" />
          <StatCard label="Measurements" value={String(metrics.measurements)} caption="Measurement documents" icon={FileText} tone="success" />
          <StatCard label="Bills/Payments" value={String(metrics.bills)} caption="Financial documents" icon={FileText} tone="info" />
        </div>

        <Card className="p-5">
          <div className="grid gap-4 lg:grid-cols-2">
            <label className="space-y-2">
              <span className={labelClassName}>Entity type</span>
              <select
                className={inputClassName}
                value={entityFilter}
                onChange={(e) => setEntityFilter((e.target.value || '') as DocumentEntityType | '')}
              >
                <option value="">All types</option>
                {documentEntityOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className={labelClassName}>Search</span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[var(--surface-faint)]" />
                <input ref={searchRef} className={`${inputClassName} pl-11`} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Title, file name, or document type" />
              </div>
            </label>
          </div>
        </Card>

        <DataTable
          columns={[
            { id: 'title', header: 'Title', cell: (row) => <div><p className="font-semibold text-[var(--surface-ink)]">{row.title}</p><p className="text-xs text-[var(--surface-faint)]">{row.latest_file_name}</p></div>, sortKey: 'title', exportValue: (row) => row.title, minWidth: 260 },
            { id: 'entity', header: 'Entity', cell: (row) => <Badge tone={entityToneMap[row.entity_type] ?? 'neutral'}>{titleCase(row.entity_type)} #{row.entity_id}</Badge>, sortKey: 'entity_type', exportValue: (row) => `${titleCase(row.entity_type)} #${row.entity_id}`, minWidth: 170 },
            { id: 'document_type', header: 'Type', cell: (row) => row.document_type || '-', sortKey: 'document_type', exportValue: (row) => row.document_type ?? '' },
            { id: 'current_version_number', header: 'Version', cell: (row) => `v${row.current_version_number}`, sortKey: 'current_version_number', exportValue: (row) => `v${row.current_version_number}` },
            { id: 'latest_file_size', header: 'Size', cell: (row) => row.latest_file_size ? `${(row.latest_file_size / 1024).toFixed(1)} KB` : '-', sortKey: 'latest_file_size', exportValue: (row) => row.latest_file_size ? `${(row.latest_file_size / 1024).toFixed(1)} KB` : '' },
            { id: 'updated_at', header: 'Date', cell: (row) => formatDate(row.updated_at ?? row.created_at), sortKey: 'updated_at', exportValue: (row) => row.updated_at ?? row.created_at },
            { header: 'Action', cell: (row) => <Button size="sm" variant="secondary" onClick={() => setDrawerDoc(row)}>View</Button> },
          ]}
          rows={tableRows}
          rowKey={(row) => row.id}
          loading={documentsTableQuery.isFetching}
          paginationMode="server"
          page={tablePage}
          pageSize={tablePageSize}
          totalRows={tablePageData?.total ?? 0}
          onPageChange={setTablePage}
          onPageSizeChange={setTablePageSize}
          sortingMode="server"
          sortId={tableSort.id}
          sortDir={tableSort.direction}
          onSortChange={(sort) => {
            if (!sort) return;
            setTableSort(sort);
          }}
          onExport={async () => {
            await exportMutation.mutateAsync();
          }}
          exporting={exportMutation.isPending}
          stickyHeader
          manageColumns
          resizableColumns
          maxHeight="720px"
          emptyState={<EmptyState title="No documents found" description="Upload documents to build your project archive." />}
        />

        <Drawer open={showUpload} title="Upload Document" description="Attach a file to a contract, measurement, RA bill, payment, vendor, or company." onClose={() => setShowUpload(false)}>
          <div className="space-y-4">
            <label className="space-y-2">
              <span className={labelClassName}>Title</span>
              <input className={inputClassName} value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} placeholder="Drawing revision A" />
            </label>
            <label className="space-y-2">
              <span className={labelClassName}>Entity type</span>
              <select
                className={inputClassName}
                value={uploadEntityType}
                onChange={(e) => setUploadEntityType(e.target.value as DocumentEntityType)}
              >
                {documentEntityOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className={labelClassName}>Entity ID</span>
              <input className={inputClassName} type="number" value={uploadEntityId} onChange={(e) => setUploadEntityId(e.target.value)} placeholder="1" />
            </label>
            <label className="space-y-2">
              <span className={labelClassName}>Document type</span>
              <input
                className={inputClassName}
                value={uploadDocumentType}
                onChange={(e) => setUploadDocumentType(e.target.value)}
                placeholder="quotation, invoice, drawing"
              />
            </label>
            <label className="space-y-2">
              <span className={labelClassName}>Remarks</span>
              <textarea
                className={`${inputClassName} min-h-24 resize-none`}
                value={uploadRemarks}
                onChange={(e) => setUploadRemarks(e.target.value)}
                placeholder="Optional notes for ops, finance, or follow-up"
              />
            </label>
            <label className="space-y-2">
              <span className={labelClassName}>File</span>
              <input type="file" className="text-sm" onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)} />
            </label>
            {serverMessage ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{serverMessage}</div> : null}
            {uploadMutation.error ? <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">{getApiErrorMessage(uploadMutation.error)}</div> : null}
            <UploadProgress progress={uploadProgress} fileName={uploadingFileName ?? undefined} onCancel={cancelUpload} />
            <Button disabled={isUploading || !uploadFile || !uploadTitle || !uploadEntityId} onClick={() => uploadMutation.mutate()}>
              {isUploading ? 'Uploading...' : 'Upload'}
            </Button>
          </div>
        </Drawer>

        <Drawer open={Boolean(drawerDoc)} title={drawerDoc?.title ?? ''} description={drawerDoc ? `${titleCase(drawerDoc.entity_type)} #${drawerDoc.entity_id}` : ''} onClose={() => setDrawerDoc(null)}>
          {drawerDoc ? (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--surface-faint)]">File</p><p className="text-sm text-[var(--surface-ink)]">{drawerDoc.latest_file_name}</p></div>
                <div className="space-y-1"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--surface-faint)]">Type</p><p className="text-sm text-[var(--surface-ink)]">{drawerDoc.document_type || 'General'}</p></div>
                <div className="space-y-1"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--surface-faint)]">Version</p><p className="text-sm text-[var(--surface-ink)]">v{drawerDoc.current_version_number}</p></div>
                <div className="space-y-1"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--surface-faint)]">Created</p><p className="text-sm text-[var(--surface-ink)]">{formatDate(drawerDoc.created_at)}</p></div>
              </div>
              {drawerDoc.remarks ? <p className="text-sm leading-6 text-[var(--surface-muted)]">{drawerDoc.remarks}</p> : null}
              {drawerDoc.versions.length > 1 ? (
                <div>
                  <h4 className="mb-3 text-lg text-[var(--surface-ink)]">Version History</h4>
                  <div className="space-y-2">
                    {drawerDoc.versions.map((v) => (
                      <div key={v.id} className="flex items-center justify-between rounded-[var(--radius)] border border-[color:var(--line)] bg-white/75 p-3">
                        <div><p className="text-sm font-semibold text-[var(--surface-ink)]">v{v.version_number} — {v.file_name}</p><p className="text-xs text-[var(--surface-faint)]">{formatDate(v.created_at)}</p></div>
                        {v.remarks ? <p className="text-sm text-[var(--surface-muted)]">{v.remarks}</p> : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </Drawer>
      </div>
    </PermissionGate>
  );
}
