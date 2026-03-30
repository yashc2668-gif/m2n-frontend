import { LoaderCircle } from 'lucide-react';

import { Card } from '@/components/ui/card';

interface LoadingStateProps {
  title?: string;
  description?: string;
}

export function LoadingState({
  title = 'Syncing the control room',
  description = 'Pulling the latest backend signals and workflow data.',
}: LoadingStateProps) {
  return (
    <Card className="flex min-h-64 items-center justify-center p-8">
      <div className="space-y-3 text-center">
        <LoaderCircle className="mx-auto size-10 animate-spin text-[var(--accent)]" />
        <h3 className="text-xl text-[var(--surface-ink)]">{title}</h3>
        <p className="max-w-md text-sm leading-6 text-[var(--surface-muted)]">{description}</p>
      </div>
    </Card>
  );
}
