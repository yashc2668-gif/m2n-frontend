import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Boxes,
  CircleDollarSign,
  ClipboardCheck,
  FolderKanban,
  ShieldAlert,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useAuth } from "@/app/providers/auth-provider";
import { fetchDashboardFinance, fetchDashboardSummary } from "@/api/dashboard";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { PermissionGate } from "@/components/shell/permission-gate";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { formatCompactNumber, formatCurrency, titleCase } from "@/lib/format";

export default function DashboardPage() {
  const { accessToken } = useAuth();
  const summaryQuery = useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: () => fetchDashboardSummary(accessToken ?? ""),
    enabled: Boolean(accessToken),
  });
  const financeQuery = useQuery({
    queryKey: ["dashboard", "finance"],
    queryFn: () => fetchDashboardFinance(accessToken ?? ""),
    enabled: Boolean(accessToken),
  });

  if (summaryQuery.isLoading || financeQuery.isLoading) {
    return <LoadingState />;
  }

  if (summaryQuery.error || financeQuery.error || !summaryQuery.data || !financeQuery.data) {
    return (
      <ErrorState
        description={
          (summaryQuery.error ?? financeQuery.error)?.message ??
          "Dashboard data could not be loaded."
        }
        onRetry={() => {
          void summaryQuery.refetch();
          void financeQuery.refetch();
        }}
      />
    );
  }

  const summary = summaryQuery.data;
  const finance = financeQuery.data;
  const queueItems = [
    ...summary.pending_ra_bills_by_status.map((item) => ({ ...item, family: "RA Bills" })),
    ...summary.pending_payments_by_status.map((item) => ({ ...item, family: "Payments" })),
  ];

  return (
    <PermissionGate permissions={["dashboard:read"]}>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Portfolio command"
          title="See what needs attention before the site calls start."
          description="Live metrics from billing, payment, and project operations now sit in one scanning layer. This is the command deck we can keep extending module by module."
          actions={
            <>
              <Link className={buttonVariants({ variant: "secondary" })} to="/materials">
                Materials pulse
              </Link>
              <Link className={buttonVariants({ variant: "primary" })} to="/payments">
                Review payments
                <ArrowRight className="size-4" />
              </Link>
            </>
          }
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Active contracts"
            value={formatCompactNumber(summary.active_contracts)}
            caption={`${summary.total_projects} projects currently tracked`}
            icon={FolderKanban}
            tone="info"
          />
          <StatCard
            label="Total billed"
            value={formatCurrency(summary.total_billed_amount)}
            caption={`Paid so far ${formatCurrency(summary.total_paid_amount)}`}
            icon={CircleDollarSign}
            tone="accent"
          />
          <StatCard
            label="Outstanding"
            value={formatCurrency(summary.outstanding_payable)}
            caption={`Secured advance outstanding ${formatCurrency(summary.secured_advance_outstanding)}`}
            icon={ShieldAlert}
            tone="success"
          />
          <StatCard
            label="Projects"
            value={formatCompactNumber(summary.total_projects)}
            caption="Delivery footprint across the portfolio"
            icon={Boxes}
            tone="accent"
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <Card className="p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="text-2xl text-[var(--surface-ink)]">Billing vs payment trend</h3>
                <p className="mt-1 text-sm text-[var(--surface-muted)]">
                  Month-on-month finance momentum from the backend.
                </p>
              </div>
              <Badge tone="info">Finance pulse</Badge>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={finance.monthly_billing_trend}
                  margin={{ top: 10, right: 0, left: -10, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="billing-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#d97706" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#d97706" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(104, 83, 47, 0.14)" vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} />
                  <YAxis
                    tickFormatter={(value) => formatCompactNumber(Number(value))}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0))} />
                  <Area
                    type="monotone"
                    dataKey="amount"
                    stroke="#d97706"
                    strokeWidth={3}
                    fill="url(#billing-fill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="text-2xl text-[var(--surface-ink)]">Pending workload</h3>
                <p className="mt-1 text-sm text-[var(--surface-muted)]">
                  Items stacked by workflow status.
                </p>
              </div>
              <Badge tone="warning">Action queue</Badge>
            </div>
            <div className="space-y-4">
              {queueItems.map((item) => (
                <div
                  key={`${item.family}-${item.status}-${item.count}`}
                  className="rounded-[var(--radius)] border border-[color:var(--line)] bg-white/70 p-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-[var(--surface-ink)]">
                        {titleCase(item.status)}
                      </p>
                      <p className="text-xs uppercase tracking-[0.15em] text-[var(--surface-faint)]">
                        {item.family}
                      </p>
                    </div>
                    <Badge tone={item.count > 5 ? "warning" : "neutral"}>{item.count}</Badge>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-amber-50">
                    <div
                      className="h-2 rounded-full bg-[var(--accent)]"
                      style={{ width: `${Math.min(item.count * 12, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <Card className="p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="text-2xl text-[var(--surface-ink)]">Deductions mix</h3>
                <p className="mt-1 text-sm text-[var(--surface-muted)]">
                  Where recoveries are accumulating.
                </p>
              </div>
              <Badge tone="accent">Risk lens</Badge>
            </div>
            <div className="space-y-3">
              {finance.deductions_summary.map((item) => (
                <div
                  key={item.deduction_type}
                  className="rounded-[var(--radius)] border border-[color:var(--line)] bg-white/75 p-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <p className="font-semibold text-[var(--surface-ink)]">
                      {titleCase(item.deduction_type)}
                    </p>
                    <p className="text-sm font-semibold text-[var(--accent-strong)]">
                      {formatCurrency(item.amount)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="text-2xl text-[var(--surface-ink)]">Project billed vs paid</h3>
                <p className="mt-1 text-sm text-[var(--surface-muted)]">
                  Which projects need finance follow-through.
                </p>
              </div>
              <Badge tone="info">Project split</Badge>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={finance.project_wise_billed_vs_paid.slice(0, 6)}
                  margin={{ top: 10, right: 0, left: -18, bottom: 0 }}
                >
                  <CartesianGrid stroke="rgba(104, 83, 47, 0.14)" vertical={false} />
                  <XAxis
                    dataKey="project_name"
                    tickLine={false}
                    axisLine={false}
                    interval={0}
                    angle={-12}
                    height={60}
                  />
                  <YAxis
                    tickFormatter={(value) => formatCompactNumber(Number(value))}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0))} />
                  <Bar dataKey="billed_amount" fill="#d97706" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="paid_amount" fill="#2f855a" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {[
            {
              title: "Material desk",
              description: "Jump into stock master, reorder watchlist, and scope-linked material control.",
              to: "/materials",
              icon: Boxes,
            },
            {
              title: "Requisition queue",
              description: "Raise demand, submit drafts, and move approvals without leaving the workspace.",
              to: "/materials/requisitions",
              icon: ClipboardCheck,
            },
            {
              title: "Finance cockpit",
              description: "Check payment pressure and outstanding RA bill exposure before release calls.",
              to: "/payments",
              icon: CircleDollarSign,
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                className="rounded-[calc(var(--radius)+4px)] border border-[color:var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-lg)] transition hover:-translate-y-0.5 hover:bg-white/90"
                to={item.to}
              >
                <div className="space-y-4">
                  <span className="inline-flex rounded-2xl bg-[var(--accent-soft)] p-3 text-[var(--accent-strong)]">
                    <Icon className="size-5" />
                  </span>
                  <div className="space-y-2">
                    <h3 className="text-2xl text-[var(--surface-ink)]">{item.title}</h3>
                    <p className="text-sm leading-6 text-[var(--surface-muted)]">
                      {item.description}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </PermissionGate>
  );
}
