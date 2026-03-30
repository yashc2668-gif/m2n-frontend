import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface DialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  confirmVariant?: 'primary' | 'danger';
  cancelLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}

export function Dialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  confirmVariant = 'primary',
  cancelLabel = 'Cancel',
  loading,
  onConfirm,
  onCancel,
  children,
}: DialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 backdrop-blur-sm">
      <button
        aria-label="Close dialog"
        className="fixed inset-0 cursor-default"
        onClick={onCancel}
        type="button"
      />
      <Card className="relative z-10 w-full max-w-lg p-6 shadow-[var(--shadow-xl)]">
        <div className="space-y-2">
          <h3 className="text-2xl text-[var(--surface-ink)]">{title}</h3>
          {description ? (
            <p className="text-sm leading-6 text-[var(--surface-muted)]">{description}</p>
          ) : null}
        </div>
        {children ? <div className="mt-4">{children}</div> : null}
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={confirmVariant} onClick={onConfirm} disabled={loading}>
            {loading ? 'Processing...' : confirmLabel}
          </Button>
        </div>
      </Card>
    </div>
  );
}
