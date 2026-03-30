import { useQuery } from '@tanstack/react-query';
import { Link, useRouterState } from '@tanstack/react-router';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CircleDollarSign,
  ReceiptText,
  ShieldAlert,
} from 'lucide-react';
import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { useAuth } from '@/app/providers/auth-provider';
import { getApiErrorMessage } from '@/api/client';
import { fetchContractDashboard } from '@/api/dashboard';
import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { PageSkeleton } from '@/components/feedback/skeleton';
import { PermissionGate } from '@/components/shell/permission-gate';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { formatCompactNumber, formatCurrency, formatDate, formatDecimal, titleCase } from '@/lib/format';

function getStatusTone(status: string) {
  if (status === 'completed' || status === 'paid' || status === 'released') return 'success' as const;
  if (status === 'on_hold' || status === 'draft' || status === 'approved' || status === 'partially_paid') {
    return 'warning' as const;
  }
  if (status === 'cancelled' || status === 'terminated' || status === 'rejected') return 'danger' as const;
  return 'info' as const;
}

export default function ContractDrilldownPage() {
  const { accessToken } = useAuth();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const contractId = Number(pathname.split('/').filter(Boolean).at(-1) ?? '');

  const contractQuery = useQuery({
    queryKey: ['dashboard', 'contract-drilldown', contractId],
    queryFn: () => fetchContractDashboard(accessToken ?? '', contractId),
    enabled: Boolean(accessToken) && Number.isFinite(contractId) && contractId > 0,
  });

  const contract = contractQuery.data;
  const trendData = useMemo(() => {
    if (!contract) return [];

    const monthMap = new Map<string, { month: string; billed_amount: number; paid_amount: number }>();
    contract.monthly_billing_trend.forEach((point) => {
      monthMap.set(point.month, {
        month: point.month,
        billed_amount: point.amount,
        paid_amount: monthMap.get(point.month)?.paid_amount ?? 0,
      });
    });
    contract.monthly_payment_trend.forEach((point) => {
      monthMap.set(point.month, {
        month: point.month,
        billed_amount: monthMap.get(point.month)?.billed_amount ?? 0,
        paid_amount: point.amount,
      });
    });

    return [...monthMap.values()].sort((left, right) => left.month.localeCompare(right.month));
  }, [contract]);
  const pendingRaCount = useMemo(
    () => contract?.pending_ra_bills_by_status.reduce((total, item) => total + item.count, 0) ?? 0,
    [contract],
  );
  const pendingPaymentCount = useMemo(
    () => contract?.pending_payments_by_status.reduce((total, item) => total + item.count, 0) ?? 0,
    [contract],
  );
  const commercialStack = useMemo(() => {
    if (!contract) return [];
    const baseline = contract.revised_value > 0 ? contract.revised_value : 1;
    return [
      {
        label: 'Revenue billed',
        amount: contract.total_billed_amount,
        percent: (contract.total_billed_amount * 100) / baseline,
      },
      {
        label: 'Released payments',
        amount: contract.total_paid_amount,
        percent: (contract.total_paid_amount * 100) / baseline,
      },
      {
        label: 'Material cost',
        amount: contract.material_cost_amount,
        percent: (contract.material_cost_amount * 100) / baseline,
      },
      {
        label: 'Labour cost',
        amount: contract.labour_cost_amount,
        percent: (contract.labour_cost_amount * 100) / baseline,
      },
      {
        label: 'Retention held',
        amount: contract.retention_outstanding_amount,
        percent: (contract.retention_outstanding_amount * 100) / baseline,
      },
    ];
  }, [contract]);

  if (!Number.isFinite(contractId) || contractId <= 0) {
    return <ErrorState description="Invalid contract link." />;
  }

  if (contractQuery.isLoading) {
    return <PageSkeleton statCount={6} tableRows={6} tableColumns={6} />;
  }

  if (contractQuery.error || !contract) {
    return (
      <ErrorState
        description={getApiErrorMessage(contractQuery.error)}
        onRetry={() => {
          void contractQuery.refetch();
        }}
      />
    );
  }

  return (
    <PermissionGate permissions={['dashboard:read']}>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Contract intelligence"
          title={`${contract.contract_no} / ${contract.contract_title}`}
          description={`${contract.project_name}${contract.project_code ? ` (${contract.project_code})` : ''} with ${contract.vendor_name}. Commercial performance, billing movement, payment exposure, and retention controls are consolidated here.`}
          breadcrumbs={[
            { label: 'Dashboard', to: '/' },
            { label: 'Reports', to: '/reports' },
            { label: contract.contract_no },
          ]}
          actions={
            <>
              <Link className={buttonVariants({ variant: 'secondary' })} to="/reports">
                <ArrowLeft className="size-4" />
                Back to reports
              </Link>
              <Link className={buttonVariants({ variant: 'primary' })} to="/contracts">
                Contract register
                <ArrowRight className="size-4" />
              </Link>
            </>
          }
        />

        <Card className="p-5">
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone={getStatusTone(contract.status)}>{titleCase(contract.status)}</Badge>
            <Badge tone="info">{contract.company_name}</Badge>
            <Badge tone="accent">{contract.vendor_name}</Badge>
            <Badge tone="neutral">
              {contract.start_date ? formatDate(contract.start_date) : 'No start'} to{' '}
              {contract.end_date ? formatDate(contract.end_date) : 'Open ended'}
            </Badge>
          </div>
          <p className="mt-4 text-sm leading-6 text-[var(--surface-muted)]">
            Actual cost is calculated as released payments plus issued material and approved labour against this contract.
            Headroom and billed margin reuse the same commercial logic as the P&amp;L report so drill-down numbers stay consistent.
          </p>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <StatCard
            label="Contract value"
            value={formatCurrency(contract.revised_value)}
            caption={`Original ${formatCurrency(contract.original_value)}`}
            icon={BarChart3}
            tone="info"
          />
          <StatCard
            label="Revenue billed"
            value={formatCurrency(contract.total_billed_amount)}
            caption={`${formatDecimal((contract.total_billed_amount * 100) / (contract.revised_value || 1))}% of current contract value`}
            icon={ReceiptText}
            tone="accent"
          />
          <StatCard
            label="Actual cost"
            value={formatCurrency(contract.actual_cost_amount)}
            caption={`Material ${formatCurrency(contract.material_cost_amount)} + labour ${formatCurrency(contract.labour_cost_amount)}`}
            icon={CircleDollarSign}
            tone="accent"
          />
          <StatCard
            label="Outstanding payable"
            value={formatCurrency(contract.outstanding_payable)}
            caption={`${pendingPaymentCount} pending payment approvals or releases`}
            icon={ArrowRight}
            tone="info"
          />
          <StatCard
            label="Retention held"
            value={formatCurrency(contract.retention_outstanding_amount)}
            caption={`${formatDecimal(contract.retention_percentage)}% contractual retention setting`}
            icon={ShieldAlert}
            tone="success"
          />
          <StatCard
            label="Headroom"
            value={formatCurrency(contract.commercial_headroom_amount)}
            caption={`${formatDecimal(contract.headroom_pct)}% of contract value remaining`}
            icon={AlertTriangle}
            tone={contract.commercial_headroom_amount < 0 ? 'info' : 'success'}
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <Card className="p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-2xl text-[var(--surface-ink)]">Billing vs release trend</h3>
                <p className="mt-1 text-sm text-[var(--surface-muted)]">
                  Month-wise billed value against released payment movement for this contract.
                </p>
              </div>
              <Badge tone="info">{trendData.length} months</Badge>
            </div>
            {trendData.length === 0 ? (
              <EmptyState
                title="No commercial trend yet"
                description="RA bills and released payments will build the trend as soon as the contract starts moving."
              />
            ) : (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trendData} margin={{ top: 10, right: 0, left: -18, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(104, 83, 47, 0.14)" vertical={false} />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} />
                    <YAxis tickFormatter={(value) => formatCompactNumber(Number(value))} tickLine={false} axisLine={false} />
                    <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0))} />
                    <Bar dataKey="billed_amount" name="Billed" fill="#d97706" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="paid_amount" name="Released" fill="#059669" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          <Card className="p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-2xl text-[var(--surface-ink)]">Commercial controls</h3>
                <p className="mt-1 text-sm text-[var(--surface-muted)]">
                  Cost stack, workflow pressure, and deduction exposure for this single contract.
                </p>
              </div>
              <Badge tone="warning">{pendingRaCount + pendingPaymentCount} live workflow items</Badge>
            </div>

            <div className="space-y-4">
              {commercialStack.map((item) => (
                <div key={item.label} className="space-y-2">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-semibold text-[var(--surface-ink)]">{item.label}</span>
                    <span className="text-[var(--surface-muted)]">{formatCurrency(item.amount)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-[color:var(--line)]">
                    <div
                      className="h-2 rounded-full bg-[var(--accent)]"
                      style={{ width: `${Math.max(0, Math.min(item.percent, 100))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-[var(--radius)] border border-[color:var(--line)] bg-white/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--surface-faint)]">Pending RA bills</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {contract.pending_ra_bills_by_status.length === 0 ? (
                    <Badge tone="success">No pending bills</Badge>
                  ) : (
                    contract.pending_ra_bills_by_status.map((item) => (
                      <Badge key={item.status} tone="warning">
                        {titleCase(item.status)} {item.count}
                      </Badge>
                    ))
                  )}
                </div>
              </div>
              <div className="rounded-[var(--radius)] border border-[color:var(--line)] bg-white/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--surface-faint)]">Pending payments</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {contract.pending_payments_by_status.length === 0 ? (
                    <Badge tone="success">No pending payments</Badge>
                  ) : (
                    contract.pending_payments_by_status.map((item) => (
                      <Badge key={item.status} tone="warning">
                        {titleCase(item.status)} {item.count}
                      </Badge>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-[var(--radius)] border border-[color:var(--line)] bg-white/70 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--surface-faint)]">Deduction mix</p>
                <Badge tone="accent">{formatCurrency(contract.billed_margin_amount)} billed margin</Badge>
              </div>
              <div className="space-y-3">
                {contract.deductions_summary.length === 0 ? (
                  <EmptyState
                    title="No deductions posted yet"
                    description="Retention, TDS, penalty, and recovery deductions will appear here once bills start carrying them."
                  />
                ) : (
                  contract.deductions_summary.map((item) => (
                    <div key={item.deduction_type} className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-semibold text-[var(--surface-ink)]">{titleCase(item.deduction_type)}</span>
                      <span className="text-[var(--surface-muted)]">{formatCurrency(item.amount)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-2xl text-[var(--surface-ink)]">Recent RA bills</h3>
                <p className="mt-1 text-sm text-[var(--surface-muted)]">
                  Latest certified billing events, outstanding balance, and retention held.
                </p>
              </div>
              <Link className={buttonVariants({ variant: 'secondary', size: 'sm' })} to="/ra-bills">
                Review bills
              </Link>
            </div>
            <div className="space-y-3">
              {contract.recent_ra_bills.length === 0 ? (
                <EmptyState
                  title="No RA bills yet"
                  description="Billing history will appear here once the contract starts certifying work."
                />
              ) : (
                contract.recent_ra_bills.map((bill) => (
                  <div
                    key={bill.bill_id}
                    className="rounded-[var(--radius)] border border-[color:var(--line)] bg-white/75 p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-[var(--surface-ink)]">Bill #{bill.bill_no}</p>
                        <p className="text-sm text-[var(--surface-muted)]">{formatDate(bill.bill_date)}</p>
                      </div>
                      <Badge tone={getStatusTone(bill.status)}>{titleCase(bill.status)}</Badge>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-[var(--surface-muted)] md:grid-cols-2">
                      <p>
                        Net payable:{' '}
                        <span className="font-semibold text-[var(--surface-ink)]">{formatCurrency(bill.net_payable)}</span>
                      </p>
                      <p>
                        Outstanding:{' '}
                        <span className="font-semibold text-[var(--surface-ink)]">
                          {formatCurrency(bill.outstanding_amount)}
                        </span>
                      </p>
                      <p>
                        Paid:{' '}
                        <span className="font-semibold text-[var(--surface-ink)]">{formatCurrency(bill.paid_amount)}</span>
                      </p>
                      <p>
                        Retention:{' '}
                        <span className="font-semibold text-[var(--surface-ink)]">
                          {formatCurrency(bill.retention_amount)}
                        </span>
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card className="p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-2xl text-[var(--surface-ink)]">Recent payments</h3>
                <p className="mt-1 text-sm text-[var(--surface-muted)]">
                  Latest outgoing movement, allocation usage, and release state for this contract.
                </p>
              </div>
              <Link className={buttonVariants({ variant: 'secondary', size: 'sm' })} to="/payments">
                Review payments
              </Link>
            </div>
            <div className="space-y-3">
              {contract.recent_payments.length === 0 ? (
                <EmptyState
                  title="No payments yet"
                  description="Payment history and release trail will appear here once finance starts processing the contract."
                />
              ) : (
                contract.recent_payments.map((payment) => (
                  <div
                    key={payment.payment_id}
                    className="rounded-[var(--radius)] border border-[color:var(--line)] bg-white/75 p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-[var(--surface-ink)]">{formatDate(payment.payment_date)}</p>
                        <p className="text-sm text-[var(--surface-muted)]">
                          {payment.reference_no || `Payment #${payment.payment_id}`}
                        </p>
                      </div>
                      <Badge tone={getStatusTone(payment.status)}>{titleCase(payment.status)}</Badge>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-[var(--surface-muted)] md:grid-cols-2">
                      <p>
                        Amount:{' '}
                        <span className="font-semibold text-[var(--surface-ink)]">{formatCurrency(payment.amount)}</span>
                      </p>
                      <p>
                        Allocated:{' '}
                        <span className="font-semibold text-[var(--surface-ink)]">
                          {formatCurrency(payment.allocated_amount)}
                        </span>
                      </p>
                      <p>
                        Available:{' '}
                        <span className="font-semibold text-[var(--surface-ink)]">
                          {formatCurrency(payment.available_amount)}
                        </span>
                      </p>
                      <p>
                        Linked bill:{' '}
                        <span className="font-semibold text-[var(--surface-ink)]">
                          {payment.ra_bill_id ? `#${payment.ra_bill_id}` : 'Unallocated'}
                        </span>
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </PermissionGate>
  );
}
