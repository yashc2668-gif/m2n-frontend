import { cn } from "@/lib/cn";
import { Card } from "@/components/ui/card";

/* ── Base shimmer bar ──────────────────────────────────────────── */

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-xl bg-[var(--line)]",
        className,
      )}
    />
  );
}

/* ── Row-level table skeleton ─────────────────────────────────── */

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

export function TableSkeleton({ rows = 8, columns = 5 }: TableSkeletonProps) {
  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="flex gap-4 border-b border-[color:var(--line)] bg-white/70 px-4 py-3">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-24" />
        ))}
      </div>
      {/* Rows */}
      <div className="divide-y divide-[color:var(--line)] bg-[var(--surface)]">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center gap-4 px-4 py-3.5">
            {Array.from({ length: columns }).map((_, c) => (
              <Skeleton
                key={c}
                className={cn(
                  "h-4",
                  c === 0 ? "w-36" : c === columns - 1 ? "w-16" : "w-24",
                )}
              />
            ))}
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ── Stat card skeleton ───────────────────────────────────────── */

export function StatCardSkeleton() {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-3">
          <Skeleton className="h-3 w-16" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-3.5 w-40" />
          </div>
        </div>
        <Skeleton className="size-11 rounded-2xl" />
      </div>
    </Card>
  );
}

/* ── Grid of stat card skeletons ──────────────────────────────── */

export function StatGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  );
}

/* ── Full page skeleton (stats + filters + table) ─────────────── */

interface PageSkeletonProps {
  statCount?: number;
  tableRows?: number;
  tableColumns?: number;
}

export function PageSkeleton({
  statCount = 4,
  tableRows = 8,
  tableColumns = 5,
}: PageSkeletonProps) {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="space-y-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-7 w-72" />
        <Skeleton className="h-4 w-96" />
      </div>

      {/* Stats */}
      <StatGridSkeleton count={statCount} />

      {/* Filters */}
      <Card className="p-5">
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-11 w-full rounded-2xl" />
          <Skeleton className="h-11 w-full rounded-2xl" />
          <Skeleton className="h-11 w-full rounded-2xl" />
        </div>
      </Card>

      {/* Table */}
      <TableSkeleton rows={tableRows} columns={tableColumns} />
    </div>
  );
}
