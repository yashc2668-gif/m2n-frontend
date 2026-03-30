import { Link } from '@tanstack/react-router';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-10">
      <Card className="max-w-xl p-10 text-center">
        <div className="space-y-4">
          <span className="inline-flex rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
            Missing route
          </span>
          <h1 className="text-4xl text-[var(--surface-ink)]">This frontend route is not mapped yet.</h1>
          <p className="text-sm leading-6 text-[var(--surface-muted)]">
            The shell is ready, but this screen has not been wired into the ERP journey yet.
          </p>
          <Link to="/">
            <Button>Return to dashboard</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
