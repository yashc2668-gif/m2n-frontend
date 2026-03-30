import { Menu, ShieldCheck } from 'lucide-react';
import { useRouterState } from '@tanstack/react-router';

import { useAuth } from '@/app/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { findNavigationItem } from '@/components/shell/navigation';
import { getApiBaseHost } from '@/api/client';
import { getRoleLabel } from '@/lib/permissions';

interface AppHeaderProps {
  onOpenMenu: () => void;
}

export function AppHeader({ onOpenMenu }: AppHeaderProps) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { logout, user } = useAuth();
  const currentItem = findNavigationItem(pathname);

  return (
    <header className="sticky top-0 z-20 border-b border-[color:var(--line)] bg-[rgba(255,252,245,0.78)] px-4 py-4 backdrop-blur md:px-6 lg:px-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="sm" className="lg:hidden" onClick={onOpenMenu}>
            <Menu className="size-4" />
            Menu
          </Button>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--surface-faint)]">
              {currentItem.label}
            </p>
            <div className="space-y-1">
              <h2 className="text-2xl text-[var(--surface-ink)]">{currentItem.description}</h2>
              <p className="text-sm text-[var(--surface-muted)]">
                Connected to backend at {getApiBaseHost()} and ready to follow live RBAC constraints.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Badge tone="info">
            <ShieldCheck className="mr-1 size-3.5" />
            {getRoleLabel(user?.role ?? 'viewer')}
          </Badge>
          <div className="rounded-full border border-[color:var(--line)] bg-white/70 px-4 py-2 text-sm text-[var(--surface-muted)]">
            {user?.full_name ?? 'Guest'}
          </div>
          <Button variant="secondary" onClick={logout}>
            Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}
