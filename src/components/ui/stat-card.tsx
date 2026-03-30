import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

import { Card } from '@/components/ui/card';

interface StatCardProps {
  label: string;
  value: string;
  caption: string;
  icon: LucideIcon;
  tone?: 'accent' | 'success' | 'info';
  rightSlot?: ReactNode;
}

const toneClasses: Record<NonNullable<StatCardProps['tone']>, string> = {
  accent: 'bg-[var(--accent-soft)] text-[var(--accent-strong)]',
  success: 'bg-emerald-100 text-emerald-800',
  info: 'bg-sky-100 text-sky-800',
};

export function StatCard({ label, value, caption, icon: Icon, tone = 'accent', rightSlot }: StatCardProps) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-3">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--surface-faint)]">
            {label}
          </span>
          <div className="space-y-1">
            <p className="text-3xl font-semibold text-[var(--surface-ink)]">{value}</p>
            <p className="text-sm text-[var(--surface-muted)]">{caption}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-3">
          <span className={`rounded-2xl p-3 ${toneClasses[tone]}`}>
            <Icon className="size-5" />
          </span>
          {rightSlot}
        </div>
      </div>
    </Card>
  );
}
