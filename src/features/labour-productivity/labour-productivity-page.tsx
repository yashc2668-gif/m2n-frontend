import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, BarChart3, HardHat, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import { useAuth } from '@/app/providers/auth-provider';
import { getApiErrorMessage } from '@/api/client';
import { fetchLabourProductivities, createLabourProductivity, updateLabourProductivity } from '@/api/labour-productivities';
import { fetchContracts } from '@/api/contracts';
import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { PageSkeleton } from '@/components/feedback/skeleton';
import { PermissionGate } from '@/components/shell/permission-gate';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Drawer } from '@/components/ui/drawer';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import type { LabourProductivity, LabourProductivityCreateInput } from '@/api/types';
import { formatDate, titleCase, formatNumber } from '@/lib/format';
import { hasPermissions } from '@/lib/permissions';

const inputClassName =
  'w-full rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-amber-100';
const labelClassName = 'text-sm font-semibold text-[var(--surface-ink)]';
const errorClassName = 'text-xs text-orange-600';

const formSchema = z.object({
  project_id: z.number().min(1, 'Project required'),
  contract_id: z.number().optional(),
  labour_id: z.number().optional(),
  date: z.string().min(1, 'Date required'),
  trade: z.string().min(1, 'Trade required'),
  quantity_done: z.number().min(0, 'Must be ≥ 0'),
  labour_count: z.number().int().min(1, 'At least 1'),
  unit: z.string().min(1, 'Unit required'),
  remarks: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function LabourProductivityPage() {
  const { accessToken, user } = useAuth();
  const queryClient = useQueryClient();
  const [contractFilter, setContractFilter] = useState('');
  const [tradeFilter, setTradeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editRow, setEditRow] = useState<LabourProductivity | null>(null);
  const [serverMessage, setServerMessage] = useState<string | null>(null);

  const prodQuery = useQuery({
    queryKey: ['labour-productivities', contractFilter],
    queryFn: () =>
      fetchLabourProductivities(
        accessToken ?? '',
        contractFilter ? { contract_id: Number(contractFilter) } : undefined,
      ),
    enabled: Boolean(accessToken),
  });

  const contractsQuery = useQuery({
    queryKey: ['contracts'],
    queryFn: () => fetchContracts(accessToken ?? ''),
    enabled: Boolean(accessToken),
  });

  const rows = useMemo(() => prodQuery.data ?? [], [prodQuery.data]);
  const contracts = useMemo(() => contractsQuery.data ?? [], [contractsQuery.data]);

  const trades = useMemo(() => [...new Set(rows.map((r) => r.trade))].sort(), [rows]);

  const filtered = useMemo(() => {
    let result = rows;
    if (tradeFilter) result = result.filter((r) => r.trade === tradeFilter);
    if (search) {
      const lower = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.trade.toLowerCase().includes(lower) ||
          (r.unit ?? '').toLowerCase().includes(lower) ||
          (r.remarks ?? '').toLowerCase().includes(lower),
      );
    }
    return result;
  }, [rows, tradeFilter, search]);

  const metrics = useMemo(() => {
    const totalQty = rows.reduce((s, r) => s + Number(r.quantity_done), 0);
    const totalLabour = rows.reduce((s, r) => s + r.labour_count, 0);
    return {
      records: rows.length,
      totalQty,
      totalLabour,
      avgProductivity: totalLabour > 0 ? (totalQty / totalLabour).toFixed(2) : '-',
    };
  }, [rows]);

  const canCreate = hasPermissions(user?.role ?? 'viewer', ['labour_productivity:create']);

  const form = useForm<FormValues>({ resolver: zodResolver(formSchema) });

  const openNew = () => {
    setEditRow(null);
    setServerMessage(null);
    form.reset({ project_id: undefined, contract_id: undefined, labour_id: undefined, date: '', trade: '', quantity_done: 0, labour_count: 1, unit: '', remarks: '' });
    setShowForm(true);
  };

  const openEdit = (row: LabourProductivity) => {
    setEditRow(row);
    setServerMessage(null);
    form.reset({
      project_id: row.project_id,
      contract_id: row.contract_id ?? undefined,
      labour_id: row.labour_id ?? undefined,
      date: row.date,
      trade: row.trade,
      quantity_done: Number(row.quantity_done),
      labour_count: row.labour_count,
      unit: row.unit,
      remarks: row.remarks ?? '',
    });
    setShowForm(true);
  };

  const saveMutation = useMutation({
    mutationFn: (data: FormValues) => {
      const payload: LabourProductivityCreateInput = {
        ...data,
        contract_id: data.contract_id ?? null,
        labour_id: data.labour_id ?? null,
        remarks: data.remarks ?? null,
      };
      if (editRow) return updateLabourProductivity(accessToken ?? '', editRow.id, payload);
      return createLabourProductivity(accessToken ?? '', payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['labour-productivities'] });
      setServerMessage(editRow ? 'Record updated.' : 'Record created.');
      setShowForm(false);
    },
  });

  if (prodQuery.isLoading) return <PageSkeleton statCount={4} tableRows={8} tableColumns={8} />;
  if (prodQuery.error) return <ErrorState description={getApiErrorMessage(prodQuery.error)} onRetry={() => void prodQuery.refetch()} />;

  return (
    <PermissionGate permissions={['labour_productivity:read']}>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Labour Productivity"
          title="Track daily output per trade and crew."
          description="Monitor productivity across trades to identify bottlenecks and compare against benchmarks."
          actions={
            <Button disabled={!canCreate} onClick={openNew}>
              <Activity className="size-4" /> Log productivity
            </Button>
          }
        />

        <div className="grid gap-4 md:grid-cols-4">
          <StatCard label="Records" value={String(metrics.records)} caption="Entries" icon={BarChart3} tone="info" />
          <StatCard label="Total Qty" value={formatNumber(metrics.totalQty)} caption="Cumulative output" icon={Activity} tone="success" />
          <StatCard label="Labour" value={formatNumber(metrics.totalLabour)} caption="Total crew days" icon={HardHat} tone="accent" />
          <StatCard label="Avg Productivity" value={String(metrics.avgProductivity)} caption="Output / crew-day" icon={BarChart3} tone="info" />
        </div>

        <Card className="p-5">
          <div className="grid gap-4 lg:grid-cols-3">
            <label className="space-y-2">
              <span className={labelClassName}>Contract</span>
              <select className={inputClassName} value={contractFilter} onChange={(e) => setContractFilter(e.target.value)}>
                <option value="">All contracts</option>
                {contracts.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </label>
            <label className="space-y-2">
              <span className={labelClassName}>Trade</span>
              <select className={inputClassName} value={tradeFilter} onChange={(e) => setTradeFilter(e.target.value)}>
                <option value="">All trades</option>
                {trades.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}
              </select>
            </label>
            <label className="space-y-2">
              <span className={labelClassName}>Search</span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[var(--surface-faint)]" />
                <input className={`${inputClassName} pl-11`} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Trade, unit, or remarks" />
              </div>
            </label>
          </div>
        </Card>

        {serverMessage ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{serverMessage}</div> : null}

        <DataTable
          columns={[
            { id: 'Date', header: 'Date', cell: (row) => formatDate(row.date), sortValue: (row) => row.date, exportValue: (row) => row.date },
            { id: 'Trade', header: 'Trade', cell: (row) => <Badge tone="info">{titleCase(row.trade)}</Badge>, sortValue: (row) => row.trade, exportValue: (row) => titleCase(row.trade) },
            { id: 'QtyDone', header: 'Qty Done', cell: (row) => formatNumber(Number(row.quantity_done)), sortValue: (row) => Number(row.quantity_done), exportValue: (row) => String(row.quantity_done) },
            { id: 'Unit', header: 'Unit', cell: (row) => row.unit, sortValue: (row) => row.unit, exportValue: (row) => row.unit },
            { id: 'Crew', header: 'Crew', cell: (row) => String(row.labour_count), sortValue: (row) => row.labour_count, exportValue: (row) => String(row.labour_count) },
            { id: 'Productivity', header: 'Productivity', cell: (row) => (Number(row.quantity_done) / row.labour_count).toFixed(2), sortValue: (row) => Number(row.quantity_done) / row.labour_count, exportValue: (row) => (Number(row.quantity_done) / row.labour_count).toFixed(2) },
            { id: 'Remarks', header: 'Remarks', cell: (row) => <span className="truncate text-xs text-[var(--surface-faint)]">{row.remarks || '-'}</span>, exportValue: (row) => row.remarks || '' },
            {
              header: 'Action',
              cell: (row) => canCreate ? <Button size="sm" variant="secondary" onClick={() => openEdit(row)}>Edit</Button> : null,
            },
          ]}
          rows={filtered}
          rowKey={(row) => row.id}
          exportFileName="m2n-labour-productivity"
          stickyHeader
          defaultSortId="Date"
          defaultSortDir="desc"
          emptyState={<EmptyState title="No records" description="Log the first productivity entry for this contract." />}
        />

        <Drawer open={showForm} title={editRow ? 'Edit Productivity' : 'Log Productivity'} description="Record daily output for a trade and crew." onClose={() => setShowForm(false)}>
          <form className="space-y-4" onSubmit={form.handleSubmit((d: FormValues) => saveMutation.mutate(d))}>
            <label className="space-y-2"><span className={labelClassName}>Date</span><input className={inputClassName} type="date" {...form.register('date')} />{form.formState.errors.date ? <p className={errorClassName}>{form.formState.errors.date.message}</p> : null}</label>
            <label className="space-y-2"><span className={labelClassName}>Project ID</span><input className={inputClassName} type="number" {...form.register('project_id')} />{form.formState.errors.project_id ? <p className={errorClassName}>{form.formState.errors.project_id.message}</p> : null}</label>
            <label className="space-y-2">
              <span className={labelClassName}>Contract (optional)</span>
              <select className={inputClassName} {...form.register('contract_id')}>
                <option value="">None</option>
                {contracts.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </label>
            <label className="space-y-2"><span className={labelClassName}>Trade</span><input className={inputClassName} {...form.register('trade')} placeholder="Mason, Carpenter, etc." />{form.formState.errors.trade ? <p className={errorClassName}>{form.formState.errors.trade.message}</p> : null}</label>
            <div className="grid grid-cols-2 gap-4">
              <label className="space-y-2"><span className={labelClassName}>Quantity</span><input className={inputClassName} type="number" step="0.01" {...form.register('quantity_done')} />{form.formState.errors.quantity_done ? <p className={errorClassName}>{form.formState.errors.quantity_done.message}</p> : null}</label>
              <label className="space-y-2"><span className={labelClassName}>Unit</span><input className={inputClassName} {...form.register('unit')} placeholder="m³, m², etc." />{form.formState.errors.unit ? <p className={errorClassName}>{form.formState.errors.unit.message}</p> : null}</label>
            </div>
            <label className="space-y-2"><span className={labelClassName}>Labour count</span><input className={inputClassName} type="number" {...form.register('labour_count')} />{form.formState.errors.labour_count ? <p className={errorClassName}>{form.formState.errors.labour_count.message}</p> : null}</label>
            <label className="space-y-2"><span className={labelClassName}>Remarks</span><textarea className={inputClassName} rows={2} {...form.register('remarks')} /></label>
            {saveMutation.error ? <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">{getApiErrorMessage(saveMutation.error)}</div> : null}
            <Button type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending ? 'Saving...' : editRow ? 'Save changes' : 'Create record'}</Button>
          </form>
        </Drawer>
      </div>
    </PermissionGate>
  );
}
