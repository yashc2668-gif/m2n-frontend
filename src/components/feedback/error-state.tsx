import { AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface ErrorStateProps {
  title?: string;
  description: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = 'This panel needs attention',
  description,
  onRetry,
}: ErrorStateProps) {
  return (
    <Card className="p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-4">
          <span className="rounded-2xl bg-orange-100 p-3 text-orange-800">
            <AlertTriangle className="size-6" />
          </span>
          <div className="space-y-2">
            <h3 className="text-xl text-[var(--surface-ink)]">{title}</h3>
            <p className="max-w-2xl text-sm leading-6 text-[var(--surface-muted)]">{description}</p>
          </div>
        </div>
        {onRetry ? (
          <Button variant="secondary" onClick={onRetry}>
            Retry
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
