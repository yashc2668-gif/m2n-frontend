import { useMutation, useQuery } from "@tanstack/react-query";
import { ActivitySquare, Download } from "lucide-react";
import { useEffect, useEffectEvent, useMemo, useState } from "react";

import { useAuth } from "@/app/providers/auth-provider";
import { exportAuditLogs, fetchAuditLogsPage } from "@/api/audit";
import { getApiErrorMessage } from "@/api/client";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { PageSkeleton } from "@/components/feedback/skeleton";
import { PermissionGate } from "@/components/shell/permission-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { DatePicker } from "@/components/ui/date-picker";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { saveBlob } from "@/lib/download";
import { formatDate, titleCase } from "@/lib/format";

const inputClassName =
  "w-full rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-amber-100";
const labelClassName = "text-sm font-semibold text-[var(--surface-ink)]";

const entityOptions = [
  "project",
  "contract",
  "vendor",
  "material",
  "material_issue",
  "material_receipt",
  "material_requisition",
  "labour",
  "labour_attendance",
  "labour_bill",
  "labour_advance",
  "labour_productivity",
  "measurement",
  "ra_bill",
  "payment",
  "document",
  "secured_advance",
  "user",
];
const actionOptions = [
  "create",
  "update",
  "delete",
  "approve",
  "submit",
  "issue",
  "release",
  "archive",
];

export default function AuditPage() {
  const { accessToken } = useAuth();
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");
  const [performedBy, setPerformedBy] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [tablePage, setTablePage] = useState(1);
  const [tablePageSize, setTablePageSize] = useState(25);

  const resetTablePage = useEffectEvent(() => {
    setTablePage(1);
  });

  useEffect(() => {
    resetTablePage();
  }, [action, dateFrom, dateTo, entityType, performedBy]);

  const auditQuery = useQuery({
    queryKey: [
      "audit-logs",
      entityType,
      action,
      performedBy,
      dateFrom,
      dateTo,
      tablePage,
      tablePageSize,
    ],
    queryFn: () =>
      fetchAuditLogsPage(accessToken ?? "", {
        entity_type: entityType || undefined,
        action: action || undefined,
        performed_by: performedBy ? Number(performedBy) : undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        page: tablePage,
        limit: tablePageSize,
      }),
    enabled: Boolean(accessToken),
    placeholderData: (previous) => previous,
  });

  const exportMutation = useMutation({
    mutationFn: async () =>
      exportAuditLogs(accessToken ?? "", {
        entity_type: entityType || undefined,
        action: action || undefined,
        performed_by: performedBy ? Number(performedBy) : undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      }),
    onSuccess: (blob) => {
      saveBlob(blob, "m2n-audit-trail-report.csv");
    },
  });

  const logs = useMemo(() => auditQuery.data?.items ?? [], [auditQuery.data]);
  const totalLogs = auditQuery.data?.total ?? 0;
  const stats = useMemo(
    () => ({
      entities: new Set(logs.map((log) => log.entity_type)).size,
      actors: new Set(logs.map((log) => log.performed_by)).size,
      requests: new Set(logs.map((log) => log.request_id).filter(Boolean)).size,
    }),
    [logs],
  );

  if (auditQuery.isLoading) {
    return <PageSkeleton statCount={4} tableRows={8} tableColumns={6} />;
  }

  if (auditQuery.error || !auditQuery.data) {
    return (
      <ErrorState
        description={getApiErrorMessage(auditQuery.error)}
        onRetry={() => void auditQuery.refetch()}
      />
    );
  }

  return (
    <PermissionGate permissions={["audit_logs:read"]}>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Audit visibility"
          title="Filter and export operational evidence without touching raw tables."
          description="This report-first audit workspace lets finance, operations, and leadership isolate actions by entity, actor, and date window, then export the trace for review."
          actions={
            <Button
              disabled={exportMutation.isPending}
              onClick={() => {
                void exportMutation.mutateAsync();
              }}
              variant="secondary"
            >
              <Download className="size-4" />
              {exportMutation.isPending ? "Exporting..." : "Export trail"}
            </Button>
          }
        />

        <div className="grid gap-4 md:grid-cols-4">
          <StatCard
            label="Events"
            value={`${totalLogs}`}
            caption="Filtered events across the current report window"
            icon={ActivitySquare}
            tone="info"
          />
          <StatCard
            label="Entities"
            value={`${stats.entities}`}
            caption="Distinct entity types on the active page"
            icon={ActivitySquare}
            tone="accent"
          />
          <StatCard
            label="Actors"
            value={`${stats.actors}`}
            caption="Unique users on the active page"
            icon={ActivitySquare}
            tone="success"
          />
          <StatCard
            label="Requests"
            value={`${stats.requests}`}
            caption="Correlated request IDs visible in the slice"
            icon={ActivitySquare}
            tone="accent"
          />
        </div>

        <div className="grid gap-4 rounded-[calc(var(--radius)+4px)] border border-[color:var(--line)] bg-[var(--surface)] p-5 lg:grid-cols-5">
          <label className="space-y-2">
            <span className={labelClassName}>Entity type</span>
            <select
              className={inputClassName}
              value={entityType}
              onChange={(event) => setEntityType(event.target.value)}
            >
              <option value="">All entities</option>
              {entityOptions.map((option) => (
                <option key={option} value={option}>
                  {titleCase(option)}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className={labelClassName}>Action</span>
            <select
              className={inputClassName}
              value={action}
              onChange={(event) => setAction(event.target.value)}
            >
              <option value="">All actions</option>
              {actionOptions.map((option) => (
                <option key={option} value={option}>
                  {titleCase(option)}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className={labelClassName}>User ID</span>
            <input
              className={inputClassName}
              type="number"
              value={performedBy}
              onChange={(event) => setPerformedBy(event.target.value)}
              placeholder="Any actor"
            />
          </label>
          <label className="space-y-2">
            <span className={labelClassName}>From</span>
            <DatePicker
              value={dateFrom}
              onChange={(v) => setDateFrom(v)}
              placeholder="Start date"
            />
          </label>
          <label className="space-y-2">
            <span className={labelClassName}>To</span>
            <DatePicker
              value={dateTo}
              onChange={(v) => setDateTo(v)}
              placeholder="End date"
            />
          </label>
        </div>

        <DataTable
          columns={[
            {
              id: "entity",
              header: "Entity",
              minWidth: 200,
              exportValue: (row) => `${row.entity_type} #${row.entity_id}`,
              cell: (row) => (
                <div className="space-y-1">
                  <p className="font-semibold text-[var(--surface-ink)]">{titleCase(row.entity_type)}</p>
                  <p className="text-xs uppercase tracking-[0.15em] text-[var(--surface-faint)]">#{row.entity_id}</p>
                </div>
              ),
            },
            {
              id: "action",
              header: "Action",
              exportValue: (row) => row.action,
              cell: (row) => <Badge tone="info">{titleCase(row.action)}</Badge>,
            },
            {
              id: "performed_by",
              header: "By",
              exportValue: (row) => String(row.performed_by),
              cell: (row) => `User #${row.performed_by}`,
            },
            {
              id: "performed_at",
              header: "When",
              minWidth: 160,
              exportValue: (row) => row.performed_at,
              cell: (row) => formatDate(row.performed_at),
            },
            {
              id: "request_id",
              header: "Request",
              minWidth: 180,
              exportValue: (row) => row.request_id ?? "",
              cell: (row) => row.request_id ?? "-",
            },
            {
              id: "remarks",
              header: "Remarks",
              minWidth: 240,
              exportValue: (row) => row.remarks ?? "",
              cell: (row) => row.remarks ?? "-",
            },
          ]}
          rows={logs}
          rowKey={(row) => row.id}
          loading={auditQuery.isFetching}
          paginationMode="server"
          page={tablePage}
          pageSize={tablePageSize}
          totalRows={totalLogs}
          onPageChange={setTablePage}
          onPageSizeChange={setTablePageSize}
          onExport={async () => {
            await exportMutation.mutateAsync();
          }}
          exporting={exportMutation.isPending}
          stickyHeader
          manageColumns
          resizableColumns
          maxHeight="720px"
          emptyState={
            <EmptyState
              title="No audit logs in this window"
              description="Widen the filters or wait for more business actions to be recorded."
            />
          }
        />
      </div>
    </PermissionGate>
  );
}
