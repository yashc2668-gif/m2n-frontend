import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardCheck, FileDown, FileStack, Ruler, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

import { useAuth } from '@/app/providers/auth-provider';
import { getApiErrorMessage } from '@/api/client';
import { fetchContracts } from '@/api/contracts';
import { approveMeasurement, deleteMeasurement, downloadMeasurementPdf, fetchMeasurements, submitMeasurement } from '@/api/measurements';
import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { PageSkeleton } from '@/components/feedback/skeleton';
import { PermissionGate } from '@/components/shell/permission-gate';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Dialog } from '@/components/ui/dialog';
import { Drawer } from '@/components/ui/drawer';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import type { Measurement } from '@/api/types';
import { formatCurrency, formatDate, formatDecimal, titleCase } from '@/lib/format';
import { hasPermissions } from '@/lib/permissions';
import { saveBlob } from '@/lib/download';

const inputClassName =
  'w-full rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-amber-100';
const labelClassName = 'text-sm font-semibold text-[var(--surface-ink)]';

const statusToneMap: Record<string, 'neutral' | 'warning' | 'success' | 'info'> = {
  draft: 'neutral',
  submitted: 'warning',
  approved: 'success',
};

export default function MeasurementsPage() {
  const { accessToken, user } = useAuth();
  const queryClient = useQueryClient();
  const [contractFilter, setContractFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [drawerMeasurement, setDrawerMeasurement] = useState<Measurement | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: 'submit' | 'approve' | 'delete'; measurement: Measurement } | null>(null);

  const contractsQuery = useQuery({
    queryKey: ['contracts'],
    queryFn: () => fetchContracts(accessToken ?? ''),
    enabled: Boolean(accessToken),
  });

  const measurementsQuery = useQuery({
    queryKey: ['measurements', contractFilter],
    queryFn: () => fetchMeasurements(accessToken ?? '', contractFilter ? { contract_id: Number(contractFilter) } : undefined),
    enabled: Boolean(accessToken),
  });

  const contracts = useMemo(
    () => (Array.isArray(contractsQuery.data) ? contractsQuery.data : []),
    [contractsQuery.data],
  );
  const measurements = useMemo(
    () => (Array.isArray(measurementsQuery.data) ? measurementsQuery.data : []),
    [measurementsQuery.data],
  );

  const filtered = useMemo(() => {
    let result = measurements;
    if (statusFilter !== 'all') {
      result = result.filter((m) => m.status === statusFilter);
    }
    if (search) {
      const lower = search.toLowerCase();
      result = result.filter(
        (m) =>
          m.measurement_no.toLowerCase().includes(lower) ||
          (m.remarks ?? '').toLowerCase().includes(lower),
      );
    }
    return result;
  }, [measurements, statusFilter, search]);

  const metrics = useMemo(() => {
    const total = measurements.length;
    const draft = measurements.filter((m) => m.status === 'draft').length;
    const submitted = measurements.filter((m) => m.status === 'submitted').length;
    const approved = measurements.filter((m) => m.status === 'approved').length;
    return { total, draft, submitted, approved };
  }, [measurements]);

  const canSubmit = hasPermissions(user?.role ?? 'viewer', ['measurements:submit']);
  const canApprove = hasPermissions(user?.role ?? 'viewer', ['measurements:approve']);
  const canUpdate = hasPermissions(user?.role ?? 'viewer', ['measurements:update']);

  const actionMutation = useMutation({
    mutationFn: async ({ type, measurement }: { type: 'submit' | 'approve' | 'delete'; measurement: Measurement }) => {
      if (type === 'submit') return submitMeasurement(accessToken ?? '', measurement.id);
      if (type === 'approve') return approveMeasurement(accessToken ?? '', measurement.id);
      return deleteMeasurement(accessToken ?? '', measurement.id);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['measurements'] });
      setConfirmAction(null);
      setDrawerMeasurement(null);
    },
  });

  if (contractsQuery.isLoading || measurementsQuery.isLoading) {
    return <PageSkeleton statCount={4} tableRows={8} tableColumns={7} />;
  }

  if (contractsQuery.error || measurementsQuery.error) {
    return (
      <ErrorState
        description={getApiErrorMessage(contractsQuery.error ?? measurementsQuery.error)}
        onRetry={() => { void contractsQuery.refetch(); void measurementsQuery.refetch(); }}
      />
    );
  }

  return (
    <PermissionGate permissions={['measurements:read']}>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Measurements"
          title="Record, submit, and approve field measurements against BOQ items."
          description="Measurements drive work-done records and RA bill generation. Submit draft measurements for review and track approval progress."
        />

        <div className="grid gap-4 md:grid-cols-4">
          <StatCard label="Total" value={String(metrics.total)} caption="Measurement records" icon={Ruler} tone="info" />
          <StatCard label="Draft" value={String(metrics.draft)} caption="Pending submission" icon={FileStack} tone="accent" />
          <StatCard label="Submitted" value={String(metrics.submitted)} caption="Awaiting approval" icon={ClipboardCheck} tone="info" />
          <StatCard label="Approved" value={String(metrics.approved)} caption="Ready for billing" icon={ClipboardCheck} tone="success" />
        </div>

        <Card className="p-5">
          <div className="grid gap-4 lg:grid-cols-3">
            <label className="space-y-2">
              <span className={labelClassName}>Contract</span>
              <select className={inputClassName} value={contractFilter} onChange={(e) => setContractFilter(e.target.value)}>
                <option value="">All contracts</option>
                {contracts.map((c) => (
                  <option key={c.id} value={c.id}>{c.contract_no} — {c.title}</option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className={labelClassName}>Status</span>
              <select className={inputClassName} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">All statuses</option>
                <option value="draft">Draft</option>
                <option value="submitted">Submitted</option>
                <option value="approved">Approved</option>
              </select>
            </label>
            <label className="space-y-2">
              <span className={labelClassName}>Search</span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[var(--surface-faint)]" />
                <input className={`${inputClassName} pl-11`} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Measurement no. or remarks" />
              </div>
            </label>
          </div>
        </Card>

        <DataTable
          columns={[
            { id: 'MeasurementNo', header: 'Measurement No', cell: (row) => <span className="font-semibold text-[var(--surface-ink)]">{row.measurement_no}</span>, sortValue: (row) => row.measurement_no, exportValue: (row) => row.measurement_no },
            { id: 'Date', header: 'Date', cell: (row) => formatDate(row.measurement_date), sortValue: (row) => row.measurement_date, exportValue: (row) => row.measurement_date },
            { id: 'Contract', header: 'Contract', cell: (row) => { const c = contracts.find((ct) => ct.id === row.contract_id); return c ? c.contract_no : `#${row.contract_id}`; }, sortValue: (row) => { const c = contracts.find((ct) => ct.id === row.contract_id); return c?.contract_no ?? ''; }, exportValue: (row) => { const c = contracts.find((ct) => ct.id === row.contract_id); return c?.contract_no ?? ''; } },
            { id: 'Items', header: 'Items', cell: (row) => row.items.length, sortValue: (row) => row.items.length, exportValue: (row) => String(row.items.length) },
            { id: 'Total', header: 'Total', cell: (row) => formatCurrency(row.items.reduce((s, i) => s + i.amount, 0)), sortValue: (row) => row.items.reduce((s, i) => s + i.amount, 0), exportValue: (row) => String(row.items.reduce((s, i) => s + i.amount, 0)) },
            { id: 'Status', header: 'Status', cell: (row) => <Badge tone={statusToneMap[row.status] ?? 'neutral'}>{titleCase(row.status)}</Badge>, sortValue: (row) => row.status, exportValue: (row) => titleCase(row.status) },
            {
              header: 'Actions',
              cell: (row) => (
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setDrawerMeasurement(row)}>View</Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      const blob = await downloadMeasurementPdf(accessToken ?? '', row.id);
                      saveBlob(blob, `Measurement_${row.measurement_no}.pdf`);
                    }}
                  >
                    <FileDown className="size-4" />PDF
                  </Button>
                  {row.status === 'draft' && canSubmit ? (
                    <Button size="sm" variant="primary" onClick={() => setConfirmAction({ type: 'submit', measurement: row })}>Submit</Button>
                  ) : null}
                  {row.status === 'submitted' && canApprove ? (
                    <Button size="sm" variant="primary" onClick={() => setConfirmAction({ type: 'approve', measurement: row })}>Approve</Button>
                  ) : null}
                </div>
              ),
            },
          ]}
          rows={filtered}
          rowKey={(row) => row.id}
          exportFileName="m2n-measurements"
          stickyHeader
          defaultSortId="Date"
          defaultSortDir="desc"
          emptyState={<EmptyState title="No measurements found" description="Adjust your filters or create a measurement from the backend." />}
        />

        <Drawer open={Boolean(drawerMeasurement)} title={drawerMeasurement?.measurement_no ?? ''} description={`Date: ${drawerMeasurement ? formatDate(drawerMeasurement.measurement_date) : ''} · Status: ${titleCase(drawerMeasurement?.status ?? '')}`} onClose={() => setDrawerMeasurement(null)}>
          {drawerMeasurement ? (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--surface-faint)]">Contract</p>
                  <p className="text-sm text-[var(--surface-ink)]">{contracts.find((c) => c.id === drawerMeasurement.contract_id)?.title ?? `#${drawerMeasurement.contract_id}`}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--surface-faint)]">Remarks</p>
                  <p className="text-sm text-[var(--surface-ink)]">{drawerMeasurement.remarks || 'None'}</p>
                </div>
              </div>

              <div>
                <h4 className="mb-3 text-lg text-[var(--surface-ink)]">Line Items ({drawerMeasurement.items.length})</h4>
                <div className="space-y-3">
                  {drawerMeasurement.items.map((item) => (
                    <div key={item.id} className="rounded-[var(--radius)] border border-[color:var(--line)] bg-white/75 p-4">
                      <p className="font-semibold text-[var(--surface-ink)]">{item.description_snapshot}</p>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-[var(--surface-muted)] md:grid-cols-4">
                        <p>Unit: <span className="font-semibold text-[var(--surface-ink)]">{item.unit_snapshot}</span></p>
                        <p>Prev Qty: <span className="font-semibold text-[var(--surface-ink)]">{formatDecimal(item.previous_quantity)}</span></p>
                        <p>Curr Qty: <span className="font-semibold text-[var(--surface-ink)]">{formatDecimal(item.current_quantity)}</span></p>
                        <p>Amount: <span className="font-semibold text-[var(--surface-ink)]">{formatCurrency(item.amount)}</span></p>
                      </div>
                      {item.warning_message ? <p className="mt-2 text-sm text-[var(--danger)]">{item.warning_message}</p> : null}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                {drawerMeasurement.status === 'draft' && canSubmit ? (
                  <Button onClick={() => setConfirmAction({ type: 'submit', measurement: drawerMeasurement })}>Submit for review</Button>
                ) : null}
                {drawerMeasurement.status === 'submitted' && canApprove ? (
                  <Button onClick={() => setConfirmAction({ type: 'approve', measurement: drawerMeasurement })}>Approve</Button>
                ) : null}
                {drawerMeasurement.status === 'draft' && canUpdate ? (
                  <Button variant="danger" onClick={() => setConfirmAction({ type: 'delete', measurement: drawerMeasurement })}>Delete</Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </Drawer>

        <Dialog
          open={Boolean(confirmAction)}
          title={confirmAction ? `${titleCase(confirmAction.type)} measurement?` : ''}
          description={confirmAction ? `This will ${confirmAction.type} measurement "${confirmAction.measurement.measurement_no}". This action follows backend workflow rules.` : ''}
          confirmLabel={confirmAction ? titleCase(confirmAction.type) : ''}
          confirmVariant={confirmAction?.type === 'delete' ? 'danger' : 'primary'}
          loading={actionMutation.isPending}
          onConfirm={() => { if (confirmAction) actionMutation.mutate(confirmAction); }}
          onCancel={() => setConfirmAction(null)}
        />
      </div>
    </PermissionGate>
  );
}
