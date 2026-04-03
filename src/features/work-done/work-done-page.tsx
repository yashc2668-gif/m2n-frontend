import { useQuery } from '@tanstack/react-query';
import { FileStack, Layers, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

import { useAuth } from '@/app/providers/auth-provider';
import { getApiErrorMessage } from '@/api/client';
import { fetchContracts } from '@/api/contracts';
import { fetchWorkDone } from '@/api/work-done';
import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { PageSkeleton } from '@/components/feedback/skeleton';
import { PermissionGate } from '@/components/shell/permission-gate';
import { Card } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { formatCurrency, formatCompactNumber, formatDate, formatDecimal } from '@/lib/format';

const inputClassName =
  'w-full rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-amber-100';
const labelClassName = 'text-sm font-semibold text-[var(--surface-ink)]';

export default function WorkDonePage() {
  const { accessToken } = useAuth();
  const [contractFilter, setContractFilter] = useState<string>('');
  const [search, setSearch] = useState('');

  const contractsQuery = useQuery({
    queryKey: ['contracts'],
    queryFn: () => fetchContracts(accessToken ?? ''),
    enabled: Boolean(accessToken),
  });

  const workDoneQuery = useQuery({
    queryKey: ['work-done', contractFilter],
    queryFn: () => fetchWorkDone(accessToken ?? '', contractFilter ? { contract_id: Number(contractFilter) } : undefined),
    enabled: Boolean(accessToken),
  });

  const contracts = useMemo(
    () => (Array.isArray(contractsQuery.data) ? contractsQuery.data : []),
    [contractsQuery.data],
  );
  const records = useMemo(() => (Array.isArray(workDoneQuery.data) ? workDoneQuery.data : []), [workDoneQuery.data]);

  const filtered = useMemo(() => {
    if (!search) return records;
    const lower = search.toLowerCase();
    return records.filter(
      (r) => (r.remarks ?? '').toLowerCase().includes(lower) || String(r.boq_item_id).includes(lower),
    );
  }, [records, search]);

  const totalAmount = useMemo(() => records.reduce((s, r) => s + r.amount, 0), [records]);
  const uniqueMeasurements = useMemo(() => new Set(records.map((r) => r.measurement_id)).size, [records]);

  if (contractsQuery.isLoading || workDoneQuery.isLoading) {
    return <PageSkeleton statCount={3} tableRows={8} tableColumns={8} />;
  }

  if (contractsQuery.error || workDoneQuery.error) {
    return (
      <ErrorState
        description={getApiErrorMessage(contractsQuery.error ?? workDoneQuery.error)}
        onRetry={() => { void contractsQuery.refetch(); void workDoneQuery.refetch(); }}
      />
    );
  }

  return (
    <PermissionGate permissions={['work_done:read']}>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Work Done"
          title="Approved measurement quantities rolled into work-done progress."
          description="Work done records are auto-generated from approved measurements. They feed into RA bill generation for cumulative billing."
        />

        <div className="grid gap-4 md:grid-cols-3">
          <StatCard label="Records" value={formatCompactNumber(records.length)} caption="Work done line items" icon={FileStack} tone="info" />
          <StatCard label="Total Amount" value={formatCurrency(totalAmount)} caption="Cumulative work value" icon={Layers} tone="accent" />
          <StatCard label="Measurements" value={String(uniqueMeasurements)} caption="Source measurements linked" icon={Layers} tone="success" />
        </div>

        <Card className="p-5">
          <div className="grid gap-4 lg:grid-cols-2">
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
              <span className={labelClassName}>Search</span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[var(--surface-faint)]" />
                <input className={`${inputClassName} pl-11`} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Remarks or BOQ item ID" />
              </div>
            </label>
          </div>
        </Card>

        <DataTable
          columns={[
            { id: 'BOQItem', header: 'BOQ Item', cell: (row) => <span className="font-semibold text-[var(--surface-ink)]">#{row.boq_item_id}</span>, sortValue: (row) => row.boq_item_id, exportValue: (row) => String(row.boq_item_id) },
            { id: 'Date', header: 'Date', cell: (row) => formatDate(row.recorded_date), sortValue: (row) => row.recorded_date, exportValue: (row) => row.recorded_date },
            { id: 'PrevQty', header: 'Prev Qty', cell: (row) => formatDecimal(row.previous_quantity), sortValue: (row) => row.previous_quantity, exportValue: (row) => String(row.previous_quantity) },
            { id: 'CurrQty', header: 'Curr Qty', cell: (row) => formatDecimal(row.current_quantity), sortValue: (row) => row.current_quantity, exportValue: (row) => String(row.current_quantity) },
            { id: 'CumulQty', header: 'Cumul Qty', cell: (row) => <span className="font-semibold">{formatDecimal(row.cumulative_quantity)}</span>, sortValue: (row) => row.cumulative_quantity, exportValue: (row) => String(row.cumulative_quantity) },
            { id: 'Rate', header: 'Rate', cell: (row) => formatCurrency(row.rate), sortValue: (row) => row.rate, exportValue: (row) => String(row.rate) },
            { id: 'Amount', header: 'Amount', cell: (row) => <span className="font-semibold">{formatCurrency(row.amount)}</span>, sortValue: (row) => row.amount, exportValue: (row) => String(row.amount) },
            { id: 'Remarks', header: 'Remarks', cell: (row) => <span className="text-sm text-[var(--surface-muted)]">{row.remarks || '-'}</span>, exportValue: (row) => row.remarks || '' },
          ]}
          rows={filtered}
          rowKey={(row) => row.id}
          exportFileName="m2n-work-done"
          stickyHeader
          defaultSortId="Date"
          defaultSortDir="desc"
          emptyState={<EmptyState title="No work done records" description="Work done records appear when measurements are approved." />}
        />
      </div>
    </PermissionGate>
  );
}
