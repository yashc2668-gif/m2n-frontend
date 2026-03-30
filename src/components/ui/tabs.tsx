import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

interface TabItem {
  value: string;
  label: string;
  icon?: ReactNode;
}

interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
}

export function Tabs({ items, value, onChange }: TabsProps) {
  return (
    <div className="flex gap-1 rounded-full border border-[color:var(--line)] bg-white/70 p-1">
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          onClick={() => onChange(item.value)}
          className={cn(
            'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition',
            value === item.value
              ? 'bg-[var(--accent)] text-white shadow-[var(--shadow-lg)]'
              : 'text-[var(--surface-muted)] hover:text-[var(--surface-ink)]',
          )}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  );
}
