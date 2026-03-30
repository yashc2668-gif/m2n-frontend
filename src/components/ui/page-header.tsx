import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { Link, useRouterState } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface BreadcrumbItem {
  label: string;
  to?: string;
}

interface PageHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  showBreadcrumbs?: boolean;
}

const breadcrumbLabels: Record<string, string> = {
  admin: 'Admin',
  adjustments: 'Adjustments',
  advances: 'Advances',
  attendance: 'Attendance',
  'ai-boundary': 'AI Boundary',
  'audit-logs': 'Audit Logs',
  bills: 'Bills',
  boq: 'BOQ',
  contracts: 'Contracts',
  dashboard: 'Dashboard',
  documents: 'Documents',
  issues: 'Issues',
  labour: 'Labour',
  materials: 'Materials',
  measurements: 'Measurements',
  payments: 'Payments',
  productivity: 'Productivity',
  projects: 'Projects',
  reports: 'Reports',
  'ra-bills': 'RA Bills',
  receipts: 'Receipts',
  requisitions: 'Requisitions',
  'secured-advances': 'Secured Advances',
  'stock-ledger': 'Stock Ledger',
  users: 'Users',
  vendors: 'Vendors',
  'work-done': 'Work Done',
};

const linkableBreadcrumbs = new Set([
  '/',
  '/admin/users',
  '/ai-boundary',
  '/audit-logs',
  '/boq',
  '/contracts',
  '/documents',
  '/labour',
  '/labour/advances',
  '/labour/attendance',
  '/labour/bills',
  '/labour/productivity',
  '/materials',
  '/materials/adjustments',
  '/materials/issues',
  '/materials/receipts',
  '/materials/requisitions',
  '/measurements',
  '/payments',
  '/projects',
  '/reports',
  '/ra-bills',
  '/secured-advances',
  '/stock-ledger',
  '/vendors',
  '/work-done',
]);

function humanizeSegment(segment: string) {
  return (
    breadcrumbLabels[segment] ??
    segment
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
  );
}

function buildAutoBreadcrumbs(pathname: string): BreadcrumbItem[] {
  if (pathname === '/') {
    return [{ label: 'Dashboard', to: '/' }];
  }

  const segments = pathname.split('/').filter(Boolean);
  const items: BreadcrumbItem[] = [{ label: 'Dashboard', to: '/' }];

  segments.forEach((segment, index) => {
    const target = `/${segments.slice(0, index + 1).join('/')}`;
    items.push({
      label: humanizeSegment(segment),
      to: linkableBreadcrumbs.has(target) ? target : undefined,
    });
  });

  return items;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  breadcrumbs,
  showBreadcrumbs = true,
}: PageHeaderProps) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const breadcrumbItems = useMemo(
    () => breadcrumbs ?? buildAutoBreadcrumbs(pathname),
    [breadcrumbs, pathname],
  );

  return (
    <div className="flex flex-col gap-4 rounded-[calc(var(--radius)+8px)] border border-[color:var(--line)] bg-[var(--surface-strong)] p-6 shadow-[var(--shadow-xl)] lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-3">
        {showBreadcrumbs ? (
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-[var(--surface-faint)]">
            {breadcrumbItems.map((item, index) => {
              const isLast = index === breadcrumbItems.length - 1;
              return (
                <span key={`${item.label}-${index}`} className="inline-flex items-center gap-1.5">
                  {item.to && !isLast ? (
                    <Link
                      className="transition hover:text-[var(--accent-strong)]"
                      to={item.to}
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <span className={isLast ? 'text-[var(--surface-muted)]' : undefined}>
                      {item.label}
                    </span>
                  )}
                  {!isLast ? <ChevronRight className="size-3" /> : null}
                </span>
              );
            })}
          </nav>
        ) : null}
        <span className="inline-flex rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
          {eyebrow}
        </span>
        <div className="space-y-2">
          <h1 className="text-3xl text-[var(--surface-ink)] md:text-4xl">{title}</h1>
          <p className="max-w-2xl text-sm leading-6 text-[var(--surface-muted)] md:text-base">
            {description}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">{actions ?? <Button variant="secondary">Review Workflow</Button>}</div>
    </div>
  );
}
