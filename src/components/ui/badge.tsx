import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

const badgeVariants = cva('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold', {
  variants: {
    tone: {
      neutral: 'bg-white/70 text-[var(--surface-ink)] ring-1 ring-[color:var(--line)]',
      success: 'bg-emerald-100 text-emerald-800',
      warning: 'bg-amber-100 text-amber-800',
      danger: 'bg-orange-100 text-orange-800',
      info: 'bg-sky-100 text-sky-800',
      accent: 'bg-[var(--accent-soft)] text-[var(--accent-strong)]',
    },
  },
  defaultVariants: {
    tone: 'neutral',
  },
});

interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
