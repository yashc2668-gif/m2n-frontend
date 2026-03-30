import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, Hash, PencilLine, Search, ShieldCheck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import { useAuth } from '@/app/providers/auth-provider';
import { getApiErrorMessage } from '@/api/client';
import { fetchContracts } from '@/api/contracts';
import { createBOQItem, fetchBOQItems, updateBOQItem } from '@/api/boq';
import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { PageSkeleton, TableSkeleton } from '@/components/feedback/skeleton';
import { PermissionGate } from '@/components/shell/permission-gate';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { formatCurrency, formatCompactNumber, formatDecimal } from '@/lib/format';
import { hasPermissions } from '@/lib/permissions';

const inputClassName =
  'w-full rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-amber-100';
const labelClassName = 'text-sm font-semibold text-[var(--surface-ink)]';

const boqFormSchema = z.object({
  item_code: z.string().optional(),
  description: z.string().min(2, 'Description is required.'),
  unit: z.string().min(1, 'Unit is required.'),
  quantity: z.number().min(0),
  rate: z.number().min(0),
  amount: z.number().min(0),
  category: z.string().optional(),
});

type BOQFormValues = z.infer<typeof boqFormSchema>;

export default function BOQPage() {
  const { accessToken, user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedContractId, setSelectedContractId] = useState<number | null>(null);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [serverMessage, setServerMessage] = useState<string | null>(null);

  const contractsQuery = useQuery({
    queryKey: ['contracts'],
    queryFn: () => fetchContracts(accessToken ?? ''),
    enabled: Boolean(accessToken),
  });

  const boqQuery = useQuery({
    queryKey: ['boq-items', selectedContractId],
    queryFn: () => fetchBOQItems(accessToken ?? '', selectedContractId!),
    enabled: Boolean(accessToken && selectedContractId),
  });

  const contracts = useMemo(() => contractsQuery.data ?? [], [contractsQuery.data]);
  const boqItems = useMemo(() => boqQuery.data ?? [], [boqQuery.data]);

  const filteredItems = useMemo(() => {
    if (!search) return boqItems;
    const lower = search.toLowerCase();
    return boqItems.filter(
      (item) =>
        item.description.toLowerCase().includes(lower) ||
        (item.item_code ?? '').toLowerCase().includes(lower) ||
        (item.category ?? '').toLowerCase().includes(lower),
    );
  }, [boqItems, search]);

  const selectedItem = useMemo(
    () => boqItems.find((item) => item.id === editingItemId) ?? null,
    [boqItems, editingItemId],
  );

  const totalAmount = useMemo(() => boqItems.reduce((sum, item) => sum + item.amount, 0), [boqItems]);
  const categories = useMemo(() => new Set(boqItems.map((item) => item.category).filter(Boolean)), [boqItems]);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<BOQFormValues>({
    resolver: zodResolver(boqFormSchema),
    defaultValues: { item_code: '', description: '', unit: '', quantity: 0, rate: 0, amount: 0, category: '' },
  });

  const [qty = 0, rate = 0] = useWatch({
    control,
    name: ['quantity', 'rate'],
  });
  useEffect(() => {
    setValue('amount', Math.round(qty * rate * 100) / 100);
  }, [qty, rate, setValue]);

  useEffect(() => {
    if (!selectedItem) {
      reset({ item_code: '', description: '', unit: '', quantity: 0, rate: 0, amount: 0, category: '' });
      return;
    }
    reset({
      item_code: selectedItem.item_code ?? '',
      description: selectedItem.description,
      unit: selectedItem.unit,
      quantity: selectedItem.quantity,
      rate: selectedItem.rate,
      amount: selectedItem.amount,
      category: selectedItem.category ?? '',
    });
  }, [reset, selectedItem]);

  const canCreate = hasPermissions(user?.role ?? 'viewer', ['boq:create']);
  const canUpdate = hasPermissions(user?.role ?? 'viewer', ['boq:update']);

  const boqMutation = useMutation({
    mutationFn: async (values: BOQFormValues) => {
      const payload = {
        item_code: values.item_code?.trim() || null,
        description: values.description.trim(),
        unit: values.unit.trim(),
        quantity: values.quantity,
        rate: values.rate,
        amount: values.amount,
        category: values.category?.trim() || null,
      };
      if (selectedItem) {
        return updateBOQItem(accessToken ?? '', selectedContractId!, selectedItem.id, payload);
      }
      return createBOQItem(accessToken ?? '', selectedContractId!, payload);
    },
    onSuccess: (item) => {
      void queryClient.invalidateQueries({ queryKey: ['boq-items', selectedContractId] });
      setServerMessage(selectedItem ? `${item.description} updated.` : `${item.description} created.`);
      setEditingItemId(null);
      reset({ item_code: '', description: '', unit: '', quantity: 0, rate: 0, amount: 0, category: '' });
    },
  });

  if (contractsQuery.isLoading) {
    return <PageSkeleton statCount={3} tableRows={8} tableColumns={7} />;
  }

  if (contractsQuery.error) {
    return <ErrorState description={getApiErrorMessage(contractsQuery.error)} onRetry={() => void contractsQuery.refetch()} />;
  }

  return (
    <PermissionGate permissions={['boq:read']}>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Bill of Quantities"
          title="Define line-item scope, rates, and quantities for each contract."
          description="BOQ items form the backbone of measurements, work done, and RA bill generation. Keep them accurate and current."
          actions={
            <Button disabled={!canCreate || !selectedContractId} onClick={() => { setEditingItemId(null); setServerMessage(null); }}>
              New BOQ item
            </Button>
          }
        />

        <Card className="p-5">
          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <label className="space-y-2">
              <span className={labelClassName}>Contract</span>
              <select
                className={inputClassName}
                value={selectedContractId ?? ''}
                onChange={(e) => {
                  setSelectedContractId(e.target.value ? Number(e.target.value) : null);
                  setEditingItemId(null);
                  setSearch('');
                }}
              >
                <option value="">Select a contract</option>
                {contracts.map((c) => (
                  <option key={c.id} value={c.id}>{c.contract_no} — {c.title}</option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className={labelClassName}>Search BOQ</span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[var(--surface-faint)]" />
                <input className={`${inputClassName} pl-11`} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by description, code, or category" />
              </div>
            </label>
          </div>
        </Card>

        {selectedContractId ? (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <StatCard label="BOQ Items" value={formatCompactNumber(boqItems.length)} caption="Line items in this contract" icon={ClipboardList} tone="info" />
              <StatCard label="Total Amount" value={formatCurrency(totalAmount)} caption="Sum of all BOQ line amounts" icon={Hash} tone="accent" />
              <StatCard label="Categories" value={String(categories.size)} caption="Distinct work categories" icon={ShieldCheck} tone="success" />
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <div className="space-y-6">
                {boqQuery.isLoading ? (
                  <TableSkeleton rows={6} columns={7} />
                ) : boqQuery.error ? (
                  <ErrorState description={getApiErrorMessage(boqQuery.error)} onRetry={() => void boqQuery.refetch()} />
                ) : (
                  <DataTable
                    columns={[
                      { id: 'Code', header: 'Code', cell: (row) => <span className="font-semibold text-[var(--surface-ink)]">{row.item_code || '-'}</span>, sortValue: (row) => row.item_code ?? '', exportValue: (row) => row.item_code ?? '' },
                      { id: 'Description', header: 'Description', cell: (row) => <div className="max-w-xs"><p className="font-semibold text-[var(--surface-ink)]">{row.description}</p>{row.category ? <p className="text-xs text-[var(--surface-faint)]">{row.category}</p> : null}</div>, sortValue: (row) => row.description, exportValue: (row) => row.description },
                      { id: 'Unit', header: 'Unit', cell: (row) => row.unit, sortValue: (row) => row.unit, exportValue: (row) => row.unit },
                      { id: 'Qty', header: 'Qty', cell: (row) => formatDecimal(row.quantity), sortValue: (row) => row.quantity, exportValue: (row) => String(row.quantity) },
                      { id: 'Rate', header: 'Rate', cell: (row) => formatCurrency(row.rate), sortValue: (row) => row.rate, exportValue: (row) => String(row.rate) },
                      { id: 'Amount', header: 'Amount', cell: (row) => <span className="font-semibold">{formatCurrency(row.amount)}</span>, sortValue: (row) => row.amount, exportValue: (row) => String(row.amount) },
                      { header: 'Action', cell: (row) => (
                        <Button size="sm" variant="secondary" disabled={!canUpdate} onClick={() => { setEditingItemId(row.id); setServerMessage(null); }}>
                          <PencilLine className="size-4" /> Edit
                        </Button>
                      )},
                    ]}
                    rows={filteredItems}
                    rowKey={(row) => row.id}
                    exportFileName="m2n-boq-items"
                    stickyHeader
                    defaultSortId="Description"
                    defaultSortDir="asc"
                    emptyState={<EmptyState title="No BOQ items yet" description="Create BOQ items to define the scope and rates for this contract." />}
                  />
                )}
              </div>

              <Card className="h-fit p-6 xl:sticky xl:top-28">
                <div className="mb-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--surface-faint)]">
                    {selectedItem ? 'Edit BOQ item' : 'Create BOQ item'}
                  </p>
                  <h3 className="mt-2 text-2xl text-[var(--surface-ink)]">
                    {selectedItem ? selectedItem.description : 'Add a new line item'}
                  </h3>
                </div>

                <form className="space-y-4" onSubmit={handleSubmit(async (values: BOQFormValues) => { setServerMessage(null); await boqMutation.mutateAsync(values); })}>
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="space-y-2">
                      <span className={labelClassName}>Item code</span>
                      <input className={inputClassName} {...register('item_code')} placeholder="A.1.1" />
                    </label>
                    <label className="space-y-2">
                      <span className={labelClassName}>Category</span>
                      <input className={inputClassName} {...register('category')} placeholder="Earthwork" />
                    </label>
                  </div>
                  <label className="space-y-2">
                    <span className={labelClassName}>Description</span>
                    <textarea className={`${inputClassName} min-h-20 resize-none`} {...register('description')} placeholder="Excavation in all types of soil" />
                    {errors.description ? <p className="text-sm text-[var(--danger)]">{errors.description.message}</p> : null}
                  </label>
                  <div className="grid gap-4 md:grid-cols-3">
                    <label className="space-y-2">
                      <span className={labelClassName}>Unit</span>
                      <input className={inputClassName} {...register('unit')} placeholder="cum" />
                      {errors.unit ? <p className="text-sm text-[var(--danger)]">{errors.unit.message}</p> : null}
                    </label>
                    <label className="space-y-2">
                      <span className={labelClassName}>Quantity</span>
                      <input className={inputClassName} type="number" step="0.01" {...register('quantity')} />
                    </label>
                    <label className="space-y-2">
                      <span className={labelClassName}>Rate</span>
                      <input className={inputClassName} type="number" step="0.01" {...register('rate')} />
                    </label>
                  </div>
                  <label className="space-y-2">
                    <span className={labelClassName}>Amount (auto-calculated)</span>
                    <input className={`${inputClassName} bg-white/50`} type="number" step="0.01" {...register('amount')} readOnly />
                  </label>

                  {serverMessage ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{serverMessage}</div> : null}
                  {boqMutation.error ? <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">{getApiErrorMessage(boqMutation.error)}</div> : null}

                  <div className="flex flex-wrap gap-3">
                    <Button disabled={isSubmitting || boqMutation.isPending || (!canCreate && !selectedItem) || (!canUpdate && Boolean(selectedItem))} type="submit">
                      {boqMutation.isPending ? 'Saving...' : selectedItem ? 'Update item' : 'Create item'}
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => { setEditingItemId(null); setServerMessage(null); }}>
                      Reset form
                    </Button>
                  </div>
                </form>
              </Card>
            </div>
          </>
        ) : (
          <EmptyState title="Select a contract" description="Choose a contract above to view and manage its Bill of Quantities." />
        )}
      </div>
    </PermissionGate>
  );
}
