import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { HardHat, Sparkles, Users } from "lucide-react";

import { useAuth } from "@/app/providers/auth-provider";
import { fetchLabours } from "@/api/labour";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { PermissionGate } from "@/components/shell/permission-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { formatCompactNumber, formatCurrency, titleCase } from "@/lib/format";

export default function LabourPage() {
  const { accessToken } = useAuth();
  const labourQuery = useQuery({
    queryKey: ["labour"],
    queryFn: () => fetchLabours(accessToken ?? ""),
    enabled: Boolean(accessToken),
  });

  if (labourQuery.isLoading) {
    return (
      <LoadingState
        title="Loading crew strength"
        description="Reading labour master records from the backend."
      />
    );
  }

  if (labourQuery.error || !labourQuery.data) {
    return (
      <ErrorState
        description={labourQuery.error?.message ?? "Labour data could not be loaded."}
        onRetry={() => void labourQuery.refetch()}
      />
    );
  }

  const labours = labourQuery.data;
  const activeWorkers = labours.filter((worker) => worker.is_active).length;
  const uniqueTrades = new Set(
    labours.map((worker) => worker.trade ?? worker.skill_type ?? "Unassigned"),
  ).size;
  const avgDailyRate = labours.length
    ? labours.reduce((total, worker) => total + worker.daily_rate, 0) / labours.length
    : 0;

  return (
    <PermissionGate permissions={["labour:read"]}>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Crew control"
          title="Give labour planning the same clarity as stock control."
          description="This first labour workspace keeps master records visible, rate posture readable, and trade mix easy to scan before we layer attendance and billing actions on top."
          actions={
            <>
              <Link to="/labour/attendance">
                <Button variant="secondary">Attendance</Button>
              </Link>
              <Link to="/labour/bills">
                <Button variant="secondary">Bills</Button>
              </Link>
              <Link to="/labour/advances">
                <Button>Advances</Button>
              </Link>
            </>
          }
        />

        <div className="grid gap-4 md:grid-cols-3">
          <StatCard
            label="Active workers"
            value={formatCompactNumber(activeWorkers)}
            caption="Current active labour records"
            icon={Users}
            tone="success"
          />
          <StatCard
            label="Trade mix"
            value={formatCompactNumber(uniqueTrades)}
            caption="Distinct trades represented in the current list"
            icon={Sparkles}
            tone="info"
          />
          <StatCard
            label="Average daily rate"
            value={formatCurrency(avgDailyRate)}
            caption="Average rate across loaded labour records"
            icon={HardHat}
            tone="accent"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-5">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--surface-faint)]">Attendance</p>
              <h3 className="text-xl text-[var(--surface-ink)]">Mark daily muster and approval flow.</h3>
              <p className="text-sm text-[var(--surface-muted)]">Capture crew presence, overtime, and wage posture before billing starts.</p>
              <Link to="/labour/attendance">
                <Button variant="secondary">Open Attendance</Button>
              </Link>
            </div>
          </Card>
          <Card className="p-5">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--surface-faint)]">Bills</p>
              <h3 className="text-xl text-[var(--surface-ink)]">Generate contractor bills from approved attendance.</h3>
              <p className="text-sm text-[var(--surface-muted)]">Keep labour billing tied to approved muster instead of free-form numbers.</p>
              <Link to="/labour/bills">
                <Button variant="secondary">Open Bills</Button>
              </Link>
            </div>
          </Card>
          <Card className="p-5">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--surface-faint)]">Advances</p>
              <h3 className="text-xl text-[var(--surface-ink)]">Track advance balance and recoveries.</h3>
              <p className="text-sm text-[var(--surface-muted)]">See what remains open, what is recovered, and which bills were linked.</p>
              <Link to="/labour/advances">
                <Button>Open Advances</Button>
              </Link>
            </div>
          </Card>
        </div>

        <DataTable
          columns={[
            {
              header: "Labour",
              cell: (row) => (
                <div className="space-y-1">
                  <p className="font-semibold text-[var(--surface-ink)]">{row.full_name}</p>
                  <p className="text-xs uppercase tracking-[0.15em] text-[var(--surface-faint)]">
                    {row.labour_code}
                  </p>
                </div>
              ),
            },
            {
              header: "Trade",
              cell: (row) => titleCase(row.trade ?? row.skill_type ?? "unassigned"),
            },
            {
              header: "Skill level",
              cell: (row) => row.skill_level ?? "-",
            },
            {
              header: "Daily rate",
              cell: (row) => formatCurrency(row.daily_rate),
            },
            {
              header: "Contractor",
              cell: (row) => (row.contractor_id ? `Contractor #${row.contractor_id}` : "Direct crew"),
            },
            {
              header: "Status",
              cell: (row) => (
                <Badge tone={row.is_active ? "success" : "neutral"}>
                  {row.is_active ? "Active" : "Inactive"}
                </Badge>
              ),
            },
          ]}
          rows={labours}
          rowKey={(row) => row.id}
          emptyState={
            <EmptyState
              title="No labour records found"
              description="Once labour master is seeded in the backend, this page becomes the base for attendance, productivity, and bill flows."
            />
          }
        />
      </div>
    </PermissionGate>
  );
}
