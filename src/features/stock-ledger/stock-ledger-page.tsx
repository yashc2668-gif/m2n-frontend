import { useQuery } from "@tanstack/react-query";
import { ArrowDownToLine, ArrowUpFromLine, Scale } from "lucide-react";

import { useAuth } from "@/app/providers/auth-provider";
import { fetchStockLedger } from "@/api/stock-ledger";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { PermissionGate } from "@/components/shell/permission-gate";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { formatDate, formatDecimal, titleCase } from "@/lib/format";

export default function StockLedgerPage() {
  const { accessToken } = useAuth();
  const ledgerQuery = useQuery({
    queryKey: ["stock-ledger"],
    queryFn: () => fetchStockLedger(accessToken ?? ""),
    enabled: Boolean(accessToken),
  });

  if (ledgerQuery.isLoading) {
    return (
      <LoadingState
        title="Opening the ledger"
        description="Tracing every inventory movement from the backend ledger."
      />
    );
  }

  if (ledgerQuery.error || !Array.isArray(ledgerQuery.data)) {
    return (
      <ErrorState
        description={ledgerQuery.error?.message ?? "Stock ledger could not be loaded."}
        onRetry={() => void ledgerQuery.refetch()}
      />
    );
  }

  const transactions = ledgerQuery.data;
  const totalIn = transactions.reduce((total, row) => total + row.qty_in, 0);
  const totalOut = transactions.reduce((total, row) => total + row.qty_out, 0);
  const latestBalance = transactions[0]?.balance_after ?? 0;

  return (
    <PermissionGate permissions={["stock_ledger:read"]}>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Movement trace"
          title="Follow every receipt, issue, and adjustment without losing the story."
          description="The ledger view turns backend inventory events into an operator-readable trail. That is where auditability starts feeling practical."
        />

        <div className="grid gap-4 md:grid-cols-3">
          <StatCard
            label="Total inward"
            value={formatDecimal(totalIn)}
            caption="All incoming quantity in current query window"
            icon={ArrowDownToLine}
            tone="success"
          />
          <StatCard
            label="Total outward"
            value={formatDecimal(totalOut)}
            caption="All issued or adjusted-out quantity"
            icon={ArrowUpFromLine}
            tone="accent"
          />
          <StatCard
            label="Latest balance"
            value={formatDecimal(latestBalance)}
            caption="Balance after the latest ledger event"
            icon={Scale}
            tone="info"
          />
        </div>

        <DataTable
          columns={[
            {
              header: "Transaction",
              cell: (row) => (
                <div className="space-y-1">
                  <p className="font-semibold text-[var(--surface-ink)]">
                    {titleCase(row.transaction_type)}
                  </p>
                  <p className="text-xs uppercase tracking-[0.15em] text-[var(--surface-faint)]">
                    Material #{row.material_id}
                  </p>
                </div>
              ),
            },
            {
              header: "In / Out",
              cell: (row) => (
                <div className="space-y-1 text-sm">
                  <p>In: {formatDecimal(row.qty_in)}</p>
                  <p>Out: {formatDecimal(row.qty_out)}</p>
                </div>
              ),
            },
            {
              header: "Balance",
              cell: (row) => formatDecimal(row.balance_after),
            },
            {
              header: "Reference",
              cell: (row) => `${row.reference_type ?? "Manual"} ${row.reference_id ?? ""}`.trim(),
            },
            {
              header: "Date",
              cell: (row) => formatDate(row.transaction_date),
            },
            {
              header: "Status",
              cell: (row) => (
                <Badge tone={row.qty_out > 0 ? "warning" : "success"}>
                  {row.qty_out > 0 ? "Outgoing" : "Incoming"}
                </Badge>
              ),
            },
          ]}
          rows={transactions}
          rowKey={(row) => row.id}
          emptyState={
            <EmptyState
              title="No ledger movement yet"
              description="Receipts, issues, and stock adjustments will populate the append-only trail here."
            />
          }
        />
      </div>
    </PermissionGate>
  );
}
