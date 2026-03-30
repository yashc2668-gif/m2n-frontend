import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-[calc(var(--radius)+4px)] border border-[color:var(--line)] bg-[var(--surface)] shadow-[var(--shadow-lg)] backdrop-blur',
        className,
      )}
      {...props}
    />
  );
}
