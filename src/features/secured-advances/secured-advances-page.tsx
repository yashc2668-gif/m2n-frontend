import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Banknote, Search, Shield, TrendingDown } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { useAuth } from '@/app/providers/auth-provider';
import { getApiErrorMessage } from '@/api/client';
import { fetchContracts } from '@/api/contracts';
import { fetchSecuredAdvances, issueSecuredAdvance, updateSecuredAdvance } from '@/api/secured-advances';
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
import type { SecuredAdvance } from '@/api/types';
import { formatCurrency, formatDate, titleCase } from '@/lib/format';
import { hasPermissions } from '@/lib/permissions';

const inputClassName =
  'w-full rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-amber-100';
const labelClassName = 'text-sm font-semibold text-[var(--surface-ink)]';

const statusToneMap: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  active: 'warning',
  fully_recovered: 'success',
  written_off: 'danger',
};

const issueSchema = z.object({
  contract_id: z.number().min(1, 'Contract is required.'),
  advance_date: z.string().min(1, 'Date is required.'),
  description: z.string().optional(),
  advance_amount: z.number().positive('Amount must be positive.'),
});

type IssueFormValues = z.infer<typeof issueSchema>;

export default function SecuredAdvancesPage() {
  const { accessToken, user } = useAuth();
  const queryClient = useQueryClient();
  const [contractFilter, setContractFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [drawerAdvance, setDrawerAdvance] = useState<SecuredAdvance | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [serverMessage, setServerMessage] = useState<string | null>(null);

  const contractsQuery = useQuery({
    queryKey: ['contracts'],
    queryFn: () => fetchContracts(accessToken ?? ''),
    enabled: Boolean(accessToken),
  });

  const advancesQuery = useQuery({
    queryKey: ['secured-advances', contractFilter],
    queryFn: () => fetchSecuredAdvances(accessToken ?? '', contractFilter ? { contract_id: Number(contractFilter) } : undefined),
    enabled: Boolean(accessToken),
  });

  const contracts = useMemo(() => contractsQuery.data ?? [], [contractsQuery.data]);
  const advances = useMemo(() => advancesQuery.data ?? [], [advancesQuery.data]);

  const filtered = useMemo(() => {
    if (!search) return advances;
    const lower = search.toLowerCase();
    return advances.filter((a) => (a.description ?? '').toLowerCase().includes(lower) || String(a.id).includes(lower));
  }, [advances, search]);

  const metrics = useMemo(() => ({
    total: advances.length,
    totalAdvanced: advances.reduce((s, a) => s + a.advance_amount, 0),
    totalRecovered: advances.reduce((s, a) => s + a.recovered_amount, 0),
    totalBalance: advances.reduce((s, a) => s + a.balance, 0),
  }), [advances]);

  const canCreate = hasPermissions(user?.role ?? 'viewer', ['secured_advances:create']);
  const canUpdate = hasPermissions(user?.role ?? 'viewer', ['secured_advances:update']);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<IssueFormValues>({
    resolver: zodResolver(issueSchema),
    defaultValues: { contract_id: 0, advance_date: '', description: '', advance_amount: 0 },
  });

  const issueMutation = useMutation({
    mutationFn: (values: IssueFormValues) =>
      issueSecuredAdvance(accessToken ?? '', {
        contract_id: values.contract_id,
        advance_date: values.advance_date,
        description: values.description?.trim() || null,
        advance_amount: values.advance_amount,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['secured-advances'] });
      setServerMessage('Secured advance issued.');
      setShowForm(false);
      reset();
    },
  });

  const writeOffMutation = useMutation({
    mutationFn: (id: number) => updateSecuredAdvance(accessToken ?? '', id, { status: 'written_off' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['secured-advances'] });
      setDrawerAdvance(null);
    },
  });

  if (contractsQuery.isLoading || advancesQuery.isLoading) {
    return <PageSkeleton statCount={4} tableRows={8} tableColumns={9} />;
  }

  if (contractsQuery.error || advancesQuery.error) {
    return (
      <ErrorState
        description={getApiErrorMessage(contractsQuery.error ?? advancesQuery.error)}
        onRetry={() => { void contractsQuery.refetch(); void advancesQuery.refetch(); }}
      />
    );
  }

  return (
    <PermissionGate permissions={['secured_advances:read']}>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Secured Advances"
          title="Track material advances issued against contracts and their recovery through RA bills."
          description="Secured advances are issued to vendors/contractors and automatically recovered via deductions in subsequent RA bills."
          actions={
            <Button disabled={!canCreate} onClick={() => { setShowForm(true); setServerMessage(null); reset(); }}>
              Issue advance
            </Button>
          }
        />

        <div className="grid gap-4 md:grid-cols-4">
          <StatCard label="Advances" value={String(metrics.total)} caption="Total issued" icon={Banknote} tone="info" />
          <StatCard label="Advanced" value={formatCurrency(metrics.totalAdvanced)} caption="Total amount issued" icon={Shield} tone="accent" />
          <StatCard label="Recovered" value={formatCurrency(metrics.totalRecovered)} caption="Recovered through bills" icon={TrendingDown} tone="success" />
          <StatCard label="Outstanding" value={formatCurrency(metrics.totalBalance)} caption="Balance to recover" icon={Banknote} tone="info" />
        </div>

        <Card className="p-5">
          <div className="grid gap-4 lg:grid-cols-2">
            <label className="space-y-2">
              <span className={labelClassName}>Contract</span>
              <select className={inputClassName} value={contractFilter} onChange={(e) => setContractFilter(e.target.value)}>
                <option value="">All contracts</option>
                {contracts.map((c) => (<option key={c.id} value={c.id}>{c.contract_no} — {c.title}</option>))}
              </select>
            </label>
            <label className="space-y-2">
              <span className={labelClassName}>Search</span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[var(--surface-faint)]" />
                <input className={`${inputClassName} pl-11`} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Description or ID" />
              </div>
            </label>
          </div>
        </Card>

        <DataTable
          columns={[
            { id: 'ID', header: 'ID', cell: (row) => <span className="font-semibold text-[var(--surface-ink)]">SA-{row.id}</span>, sortValue: (row) => row.id, exportValue: (row) => `SA-${row.id}` },
            { id: 'Date', header: 'Date', cell: (row) => formatDate(row.advance_date), sortValue: (row) => row.advance_date, exportValue: (row) => row.advance_date },
            { id: 'Contract', header: 'Contract', cell: (row) => { const c = contracts.find((ct) => ct.id === row.contract_id); return c ? c.contract_no : `#${row.contract_id}`; }, sortValue: (row) => { const c = contracts.find((ct) => ct.id === row.contract_id); return c?.contract_no ?? ''; }, exportValue: (row) => { const c = contracts.find((ct) => ct.id === row.contract_id); return c?.contract_no ?? ''; } },
            { id: 'Description', header: 'Description', cell: (row) => <span className="text-sm">{row.description || '-'}</span>, sortValue: (row) => row.description ?? '', exportValue: (row) => row.description ?? '' },
            { id: 'Amount', header: 'Amount', cell: (row) => formatCurrency(row.advance_amount), sortValue: (row) => row.advance_amount, exportValue: (row) => String(row.advance_amount) },
            { id: 'Recovered', header: 'Recovered', cell: (row) => formatCurrency(row.recovered_amount), sortValue: (row) => row.recovered_amount, exportValue: (row) => String(row.recovered_amount) },
            { id: 'Balance', header: 'Balance', cell: (row) => <span className="font-semibold">{formatCurrency(row.balance)}</span>, sortValue: (row) => row.balance, exportValue: (row) => String(row.balance) },
            { id: 'Status', header: 'Status', cell: (row) => <Badge tone={statusToneMap[row.status] ?? 'neutral'}>{titleCase(row.status)}</Badge>, sortValue: (row) => row.status, exportValue: (row) => titleCase(row.status) },
            { header: 'Action', cell: (row) => <Button size="sm" variant="secondary" onClick={() => setDrawerAdvance(row)}>View</Button> },
          ]}
          rows={filtered}
          rowKey={(row) => row.id}
          exportFileName="m2n-secured-advances"
          stickyHeader
          defaultSortId="Date"
          defaultSortDir="desc"
          emptyState={<EmptyState title="No secured advances" description="Issue an advance against a contract to get started." />}
        />

        <Drawer open={showForm} title="Issue Secured Advance" description="Issue a new material advance against a contract." onClose={() => setShowForm(false)}>
          <form className="space-y-4" onSubmit={handleSubmit(async (values: IssueFormValues) => { setServerMessage(null); await issueMutation.mutateAsync(values); })}>
            <label className="space-y-2">
              <span className={labelClassName}>Contract</span>
              <select className={inputClassName} {...register('contract_id')}>
                <option value="">Select contract</option>
                {contracts.map((c) => (<option key={c.id} value={c.id}>{c.contract_no} — {c.title}</option>))}
              </select>
              {errors.contract_id ? <p className="text-sm text-[var(--danger)]">{errors.contract_id.message}</p> : null}
            </label>
            <label className="space-y-2">
              <span className={labelClassName}>Advance date</span>
              <input className={inputClassName} type="date" {...register('advance_date')} />
              {errors.advance_date ? <p className="text-sm text-[var(--danger)]">{errors.advance_date.message}</p> : null}
            </label>
            <label className="space-y-2">
              <span className={labelClassName}>Amount</span>
              <input className={inputClassName} type="number" step="0.01" {...register('advance_amount')} placeholder="500000" />
              {errors.advance_amount ? <p className="text-sm text-[var(--danger)]">{errors.advance_amount.message}</p> : null}
            </label>
            <label className="space-y-2">
              <span className={labelClassName}>Description</span>
              <textarea className={`${inputClassName} min-h-20 resize-none`} {...register('description')} placeholder="Material advance for steel procurement" />
            </label>
            {serverMessage ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{serverMessage}</div> : null}
            {issueMutation.error ? <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">{getApiErrorMessage(issueMutation.error)}</div> : null}
            <Button disabled={isSubmitting || issueMutation.isPending} type="submit">
              {issueMutation.isPending ? 'Issuing...' : 'Issue advance'}
            </Button>
          </form>
        </Drawer>

        <Drawer open={Boolean(drawerAdvance)} title={`Secured Advance SA-${drawerAdvance?.id ?? ''}`} description={drawerAdvance ? `${formatDate(drawerAdvance.advance_date)} · ${titleCase(drawerAdvance.status)}` : ''} onClose={() => setDrawerAdvance(null)}>
          {drawerAdvance ? (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--surface-faint)]">Advanced</p><p className="text-2xl font-semibold text-[var(--surface-ink)]">{formatCurrency(drawerAdvance.advance_amount)}</p></div>
                <div className="space-y-1"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--surface-faint)]">Recovered</p><p className="text-2xl font-semibold text-emerald-800">{formatCurrency(drawerAdvance.recovered_amount)}</p></div>
                <div className="space-y-1"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--surface-faint)]">Balance</p><p className="text-2xl font-semibold text-[var(--accent)]">{formatCurrency(drawerAdvance.balance)}</p></div>
                <div className="space-y-1"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--surface-faint)]">Recoveries</p><p className="text-2xl font-semibold text-[var(--surface-ink)]">{drawerAdvance.recovery_count}</p></div>
              </div>
              {drawerAdvance.description ? <p className="text-sm leading-6 text-[var(--surface-muted)]">{drawerAdvance.description}</p> : null}
              {drawerAdvance.recoveries.length > 0 ? (
                <div>
                  <h4 className="mb-3 text-lg text-[var(--surface-ink)]">Recovery History</h4>
                  <div className="space-y-2">
                    {drawerAdvance.recoveries.map((r) => (
                      <div key={r.id} className="flex items-center justify-between rounded-[var(--radius)] border border-[color:var(--line)] bg-white/75 p-3">
                        <div><p className="text-sm font-semibold text-[var(--surface-ink)]">{formatCurrency(r.amount)}</p><p className="text-xs text-[var(--surface-faint)]">{formatDate(r.recovery_date)}</p></div>
                        {r.remarks ? <p className="text-sm text-[var(--surface-muted)]">{r.remarks}</p> : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {drawerAdvance.status === 'active' && canUpdate ? (
                <Button variant="danger" disabled={writeOffMutation.isPending} onClick={() => writeOffMutation.mutate(drawerAdvance.id)}>
                  {writeOffMutation.isPending ? 'Processing...' : 'Write off'}
                </Button>
              ) : null}
            </div>
          ) : null}
        </Drawer>
      </div>
    </PermissionGate>
  );
}
