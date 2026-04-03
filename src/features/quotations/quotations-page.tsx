import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Building2, Download, FileText, FolderOpen, Search, Truck, Upload } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';

import { useAuth } from '@/app/providers/auth-provider';
import { getApiErrorMessage } from '@/api/client';
import { fetchCompanies } from '@/api/companies';
import { downloadDocument, fetchDocuments, uploadDocument } from '@/api/documents';
import { fetchVendors } from '@/api/vendors';
import type { Company, Document, DocumentEntityType, Vendor } from '@/api/types';
import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { PageSkeleton } from '@/components/feedback/skeleton';
import { PermissionGate } from '@/components/shell/permission-gate';
import { Badge } from '@/components/ui/badge';
import { buttonVariants, Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Drawer } from '@/components/ui/drawer';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { saveBlob } from '@/lib/download';
import { formatCompactNumber, formatDate, titleCase } from '@/lib/format';
import { hasPermissions } from '@/lib/permissions';
import { useKeyboardShortcuts } from '@/lib/use-keyboard-shortcuts';
import { consumeQuotationContext } from '@/features/quotations/quotation-intake';

const inputClassName =
  'w-full rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-amber-100';
const labelClassName = 'text-sm font-semibold text-[var(--surface-ink)]';
const EMPTY_LIST: never[] = [];

type QuotationEntityType = Extract<DocumentEntityType, 'vendor' | 'company'>;
type QuotationScope = QuotationEntityType | 'all';

interface QuotationRow {
  document: Document;
  entityLabel: string;
  entitySummary: string;
  searchIndex: string;
}

const quotationEntityOptions: Array<{ value: QuotationEntityType; label: string }> = [
  { value: 'vendor', label: 'Vendor' },
  { value: 'company', label: 'Company' },
];

function buildVendorSummary(vendor: Vendor | undefined, entityId: number) {
  if (!vendor) {
    return `Vendor #${entityId}`;
  }

  return [
    titleCase(vendor.vendor_type),
    vendor.contact_person,
    vendor.phone,
    vendor.email,
    vendor.gst_number ? `GST ${vendor.gst_number}` : null,
    vendor.pan_number ? `PAN ${vendor.pan_number}` : null,
  ]
    .filter(Boolean)
    .join(' • ');
}

function buildCompanySummary(company: Company | undefined, entityId: number) {
  if (!company) {
    return `Company #${entityId}`;
  }

  return [
    company.address,
    company.phone,
    company.email,
    company.gst_number ? `GST ${company.gst_number}` : null,
    company.pan_number ? `PAN ${company.pan_number}` : null,
  ]
    .filter(Boolean)
    .join(' • ');
}

export default function QuotationsPage() {
  const { accessToken, user } = useAuth();
  const queryClient = useQueryClient();
  const [pendingContext] = useState(() => consumeQuotationContext());
  const [scopeFilter, setScopeFilter] = useState<QuotationScope>(pendingContext?.entityType ?? 'vendor');
  const [search, setSearch] = useState('');
  const [showUpload, setShowUpload] = useState(Boolean(pendingContext?.openComposer));
  const [uploadEntityType, setUploadEntityType] = useState<QuotationEntityType>(
    pendingContext?.entityType ?? 'vendor',
  );
  const [uploadEntityId, setUploadEntityId] = useState(
    pendingContext ? String(pendingContext.entityId) : '',
  );
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadRemarks, setUploadRemarks] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [activeQuotation, setActiveQuotation] = useState<QuotationRow | null>(null);
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [pageOpenedAt] = useState(() => Date.now());
  const searchRef = useRef<HTMLInputElement>(null);

  const documentsQuery = useQuery({
    queryKey: ['documents', 'quotations'],
    queryFn: () => fetchDocuments(accessToken ?? '', { document_type: 'quotation' }),
    enabled: Boolean(accessToken),
  });
  const vendorsQuery = useQuery({
    queryKey: ['vendors', 'quotation-directory'],
    queryFn: () => fetchVendors(accessToken ?? '', { vendorType: null, limit: 200 }),
    enabled: Boolean(accessToken),
  });
  const companiesQuery = useQuery({
    queryKey: ['companies', 'quotation-directory'],
    queryFn: () => fetchCompanies(accessToken ?? ''),
    enabled: Boolean(accessToken),
  });

  const quotationDocuments = Array.isArray(documentsQuery.data) ? documentsQuery.data : EMPTY_LIST;
  const vendors = Array.isArray(vendorsQuery.data) ? vendorsQuery.data : EMPTY_LIST;
  const companies = Array.isArray(companiesQuery.data) ? companiesQuery.data : EMPTY_LIST;

  const vendorMap = useMemo(() => new Map(vendors.map((vendor) => [vendor.id, vendor])), [vendors]);
  const companyMap = useMemo(() => new Map(companies.map((company) => [company.id, company])), [companies]);

  const directoryOptions = useMemo(
    () =>
      uploadEntityType === 'vendor'
        ? vendors.map((vendor) => ({
            id: vendor.id,
            label: vendor.name,
            caption: buildVendorSummary(vendor, vendor.id),
          }))
        : companies.map((company) => ({
            id: company.id,
            label: company.name,
            caption: buildCompanySummary(company, company.id),
          })),
    [companies, uploadEntityType, vendors],
  );

  const resolvedUploadEntityId = useMemo(() => {
    if (directoryOptions.some((option) => String(option.id) === uploadEntityId)) {
      return uploadEntityId;
    }

    return directoryOptions[0] ? String(directoryOptions[0].id) : '';
  }, [directoryOptions, uploadEntityId]);

  const quotationRows = useMemo<QuotationRow[]>(
    () =>
      quotationDocuments.map((document) => {
        const vendor = document.entity_type === 'vendor' ? vendorMap.get(document.entity_id) : undefined;
        const company = document.entity_type === 'company' ? companyMap.get(document.entity_id) : undefined;
        const entityLabel =
          vendor?.name ??
          company?.name ??
          `${titleCase(document.entity_type)} #${document.entity_id}`;
        const entitySummary =
          document.entity_type === 'vendor'
            ? buildVendorSummary(vendor, document.entity_id)
            : document.entity_type === 'company'
              ? buildCompanySummary(company, document.entity_id)
              : `${titleCase(document.entity_type)} record #${document.entity_id}`;

        return {
          document,
          entityLabel,
          entitySummary,
          searchIndex: [
            document.title,
            document.latest_file_name,
            document.document_type,
            document.remarks,
            entityLabel,
            entitySummary,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase(),
        };
      }),
    [companyMap, quotationDocuments, vendorMap],
  );

  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return quotationRows.filter((row) => {
      if (scopeFilter !== 'all' && row.document.entity_type !== scopeFilter) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return row.searchIndex.includes(normalizedSearch);
    });
  }, [quotationRows, scopeFilter, search]);

  const metrics = useMemo(
    () => ({
      total: quotationRows.length,
      vendors: quotationRows.filter((row) => row.document.entity_type === 'vendor').length,
      companies: quotationRows.filter((row) => row.document.entity_type === 'company').length,
      recent: quotationRows.filter((row) => {
        const updatedAt = new Date(row.document.updated_at ?? row.document.created_at);
        return pageOpenedAt - updatedAt.getTime() <= 1000 * 60 * 60 * 24 * 30;
      }).length,
    }),
    [pageOpenedAt, quotationRows],
  );

  const selectedDirectoryEntry = useMemo(
    () => directoryOptions.find((option) => String(option.id) === resolvedUploadEntityId) ?? null,
    [directoryOptions, resolvedUploadEntityId],
  );

  const canCreate = hasPermissions(user?.role ?? 'viewer', ['documents:create']);

  useKeyboardShortcuts({
    'ctrl+n': () => {
      if (!canCreate) return;
      setServerMessage(null);
      setShowUpload(true);
    },
    '/': () => searchRef.current?.focus(),
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!uploadFile || !resolvedUploadEntityId || !uploadTitle.trim()) {
        throw new Error('Vendor/company, title, and file are required.');
      }

      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('entity_type', uploadEntityType);
      formData.append('entity_id', resolvedUploadEntityId);
      formData.append('title', uploadTitle.trim());
      formData.append('document_type', 'quotation');
      if (uploadRemarks.trim()) {
        formData.append('remarks', uploadRemarks.trim());
      }

      return uploadDocument(accessToken ?? '', formData);
    },
    onSuccess: (document) => {
      void queryClient.invalidateQueries({ queryKey: ['documents'] });
      setServerMessage(`${document.title} uploaded to the quotation register.`);
      setShowUpload(false);
      setUploadFile(null);
      setUploadTitle('');
      setUploadRemarks('');
    },
  });

  const downloadMutation = useMutation({
    mutationFn: async (row: QuotationRow) => downloadDocument(accessToken ?? '', row.document.id),
    onSuccess: (blob, row) => {
      saveBlob(blob, row.document.latest_file_name);
    },
  });

  if (documentsQuery.isLoading || vendorsQuery.isLoading || companiesQuery.isLoading) {
    return <PageSkeleton statCount={4} tableRows={8} tableColumns={6} />;
  }

  if (documentsQuery.error || vendorsQuery.error || companiesQuery.error) {
    return (
      <ErrorState
        description={getApiErrorMessage(documentsQuery.error ?? vendorsQuery.error ?? companiesQuery.error)}
        onRetry={() => {
          void documentsQuery.refetch();
          void vendorsQuery.refetch();
          void companiesQuery.refetch();
        }}
      />
    );
  }

  return (
    <PermissionGate permissions={['documents:read']}>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Quotations"
          title="Register supplier and company quotations without hiding the business context."
          description="Phase 1 keeps quotation intake safe: upload the PDF, link it to a vendor or company, and keep it searchable inside the live document platform."
          actions={
            <>
              <Link className={buttonVariants({ variant: 'secondary' })} to="/documents">
                <FolderOpen className="size-4" />
                Open documents
              </Link>
              <Button
                disabled={!canCreate}
                onClick={() => {
                  setServerMessage(null);
                  setShowUpload(true);
                }}
              >
                <Upload className="size-4" />
                Upload quotation
              </Button>
            </>
          }
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Quotations"
            value={formatCompactNumber(metrics.total)}
            caption="Quotation documents tagged in the live register"
            icon={FileText}
            tone="accent"
          />
          <StatCard
            label="Vendor linked"
            value={formatCompactNumber(metrics.vendors)}
            caption="Supplier-first quotation records"
            icon={Truck}
            tone="info"
          />
          <StatCard
            label="Company linked"
            value={formatCompactNumber(metrics.companies)}
            caption="Internal or company-level commercial documents"
            icon={Building2}
            tone="success"
          />
          <StatCard
            label="Recent updates"
            value={formatCompactNumber(metrics.recent)}
            caption="Touched in the last 30 days"
            icon={FolderOpen}
            tone="info"
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">
            <Card className="p-5">
              <div className="grid gap-4 lg:grid-cols-[0.75fr_1.25fr]">
                <label className="space-y-2">
                  <span className={labelClassName}>Entity scope</span>
                  <select
                    className={inputClassName}
                    value={scopeFilter}
                    onChange={(event) => setScopeFilter(event.target.value as QuotationScope)}
                  >
                    <option value="vendor">Vendor</option>
                    <option value="company">Company</option>
                    <option value="all">All quotation documents</option>
                  </select>
                </label>
                <label className="space-y-2">
                  <span className={labelClassName}>Search register</span>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[var(--surface-faint)]" />
                    <input
                      ref={searchRef}
                      className={`${inputClassName} pl-11`}
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search by title, vendor/company, file name, GST, phone, or remarks"
                    />
                  </div>
                </label>
              </div>
            </Card>

            <DataTable
              columns={[
                {
                  id: 'title',
                  header: 'Quotation',
                  minWidth: 260,
                  sortValue: (row) => row.document.title,
                  exportValue: (row) => row.document.title,
                  cell: (row) => (
                    <div className="space-y-1">
                      <p className="font-semibold text-[var(--surface-ink)]">{row.document.title}</p>
                      <p className="text-xs text-[var(--surface-faint)]">{row.document.latest_file_name}</p>
                    </div>
                  ),
                },
                {
                  id: 'linked_to',
                  header: 'Linked to',
                  minWidth: 220,
                  sortValue: (row) => row.entityLabel,
                  exportValue: (row) => `${row.entityLabel} | ${row.document.entity_type}`,
                  cell: (row) => (
                    <div className="space-y-2">
                      <p className="font-semibold text-[var(--surface-ink)]">{row.entityLabel}</p>
                      <Badge tone={row.document.entity_type === 'vendor' ? 'warning' : row.document.entity_type === 'company' ? 'info' : 'neutral'}>
                        {titleCase(row.document.entity_type)}
                      </Badge>
                    </div>
                  ),
                },
                {
                  id: 'context',
                  header: 'Context',
                  minWidth: 280,
                  sortValue: (row) => row.entitySummary,
                  exportValue: (row) => row.entitySummary,
                  cell: (row) => <p className="text-sm leading-6 text-[var(--surface-muted)]">{row.entitySummary || '-'}</p>,
                },
                {
                  id: 'version',
                  header: 'Version',
                  sortValue: (row) => row.document.current_version_number,
                  exportValue: (row) => `v${row.document.current_version_number}`,
                  cell: (row) => `v${row.document.current_version_number}`,
                },
                {
                  id: 'updated_at',
                  header: 'Updated',
                  sortValue: (row) => row.document.updated_at ?? row.document.created_at,
                  exportValue: (row) => row.document.updated_at ?? row.document.created_at,
                  cell: (row) => formatDate(row.document.updated_at ?? row.document.created_at),
                },
                {
                  header: 'Action',
                  hideable: false,
                  resizable: false,
                  cell: (row) => (
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" type="button" variant="secondary" onClick={() => setActiveQuotation(row)}>
                        View
                      </Button>
                      <Button
                        size="sm"
                        type="button"
                        variant="secondary"
                        onClick={() => downloadMutation.mutate(row)}
                      >
                        <Download className="size-4" />
                        Download
                      </Button>
                    </div>
                  ),
                },
              ]}
              rows={filteredRows}
              rowKey={(row) => row.document.id}
              exportFileName="m2n-quotations"
              stickyHeader
              manageColumns
              resizableColumns
              maxHeight="720px"
              emptyState={
                <EmptyState
                  title="No quotations match this view"
                  description="Upload the vendor quotation PDF here and it will stay visible in both the register and the generic documents archive."
                />
              }
            />
          </div>

          <Card className="h-fit p-6 xl:sticky xl:top-28">
            <div className="space-y-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--surface-faint)]">
                  Intake guide
                </p>
                <h3 className="mt-2 text-2xl text-[var(--surface-ink)]">Vendor first, company supported</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--surface-muted)]">
                  Use vendor linkage for most quotation PDFs. Use company linkage only when the document is internal or belongs to a company-level commercial record.
                </p>
              </div>

              <div className="rounded-[var(--radius)] border border-[color:var(--line)] bg-white/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--surface-faint)]">
                  Current upload target
                </p>
                <p className="mt-3 font-semibold text-[var(--surface-ink)]">
                  {selectedDirectoryEntry?.label ?? 'No vendor or company available'}
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--surface-muted)]">
                  {selectedDirectoryEntry?.caption ?? 'Create a vendor/company first, then return here to upload the quotation PDF.'}
                </p>
              </div>

              <div className="rounded-[var(--radius)] border border-[color:var(--line)] bg-white/70 p-4 text-sm text-[var(--surface-muted)]">
                <p className="font-semibold text-[var(--surface-ink)]">Best place for the Marco quotation</p>
                <p className="mt-2 leading-6">
                  Open the vendor-linked upload, choose the Marco vendor, keep the title human-readable, and the PDF will stay visible here plus inside the broader documents archive.
                </p>
              </div>

              {serverMessage ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  {serverMessage}
                </div>
              ) : null}
            </div>
          </Card>
        </div>

        <Drawer
          open={showUpload}
          title="Upload quotation"
          description="Upload the quotation PDF and link it directly to the vendor or company record that owns the commercial context."
          onClose={() => setShowUpload(false)}
        >
          <div className="space-y-4">
            <label className="space-y-2">
              <span className={labelClassName}>Linked entity</span>
              <select
                className={inputClassName}
                value={uploadEntityType}
                onChange={(event) => setUploadEntityType(event.target.value as QuotationEntityType)}
              >
                {quotationEntityOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className={labelClassName}>{uploadEntityType === 'vendor' ? 'Vendor' : 'Company'}</span>
              <select
                className={inputClassName}
                value={resolvedUploadEntityId}
                onChange={(event) => setUploadEntityId(event.target.value)}
              >
                {directoryOptions.length === 0 ? <option value="">No records available</option> : null}
                {directoryOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className={labelClassName}>Title</span>
              <input
                className={inputClassName}
                value={uploadTitle}
                onChange={(event) => setUploadTitle(event.target.value)}
                placeholder="01 April Quotation - Marco Group - Naini Prayagraj"
              />
            </label>
            <label className="space-y-2">
              <span className={labelClassName}>Remarks</span>
              <textarea
                className={`${inputClassName} min-h-24 resize-none`}
                value={uploadRemarks}
                onChange={(event) => setUploadRemarks(event.target.value)}
                placeholder="Optional follow-up notes, revision hints, or commercial context"
              />
            </label>
            <label className="space-y-2">
              <span className={labelClassName}>File</span>
              <input type="file" className="text-sm" onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)} />
            </label>
            {uploadMutation.error ? (
              <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
                {getApiErrorMessage(uploadMutation.error)}
              </div>
            ) : null}
            <Button
              disabled={uploadMutation.isPending || !uploadFile || !resolvedUploadEntityId || !uploadTitle.trim()}
              onClick={() => uploadMutation.mutate()}
            >
              {uploadMutation.isPending ? 'Uploading...' : 'Upload quotation'}
            </Button>
          </div>
        </Drawer>

        <Drawer
          open={Boolean(activeQuotation)}
          title={activeQuotation?.document.title ?? ''}
          description={
            activeQuotation
              ? `${titleCase(activeQuotation.document.entity_type)} quotation linked to ${activeQuotation.entityLabel}`
              : ''
          }
          onClose={() => setActiveQuotation(null)}
        >
          {activeQuotation ? (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--surface-faint)]">Linked record</p>
                  <p className="text-sm text-[var(--surface-ink)]">{activeQuotation.entityLabel}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--surface-faint)]">Document type</p>
                  <p className="text-sm text-[var(--surface-ink)]">{activeQuotation.document.document_type ?? 'quotation'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--surface-faint)]">Latest file</p>
                  <p className="text-sm text-[var(--surface-ink)]">{activeQuotation.document.latest_file_name}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--surface-faint)]">Updated</p>
                  <p className="text-sm text-[var(--surface-ink)]">
                    {formatDate(activeQuotation.document.updated_at ?? activeQuotation.document.created_at)}
                  </p>
                </div>
              </div>
              <div className="rounded-[var(--radius)] border border-[color:var(--line)] bg-white/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--surface-faint)]">Business context</p>
                <p className="mt-2 text-sm leading-6 text-[var(--surface-muted)]">{activeQuotation.entitySummary}</p>
              </div>
              {activeQuotation.document.remarks ? (
                <div className="rounded-[var(--radius)] border border-[color:var(--line)] bg-white/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--surface-faint)]">Remarks</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--surface-muted)]">{activeQuotation.document.remarks}</p>
                </div>
              ) : null}
              <div>
                <h4 className="mb-3 text-lg text-[var(--surface-ink)]">Version history</h4>
                <div className="space-y-2">
                  {activeQuotation.document.versions.map((version) => (
                    <div
                      key={version.id}
                      className="rounded-[var(--radius)] border border-[color:var(--line)] bg-white/75 p-3"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-[var(--surface-ink)]">
                            v{version.version_number} • {version.file_name}
                          </p>
                          <p className="text-xs text-[var(--surface-faint)]">{formatDate(version.created_at)}</p>
                        </div>
                        {version.remarks ? (
                          <p className="text-sm text-[var(--surface-muted)]">{version.remarks}</p>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </Drawer>
      </div>
    </PermissionGate>
  );
}
