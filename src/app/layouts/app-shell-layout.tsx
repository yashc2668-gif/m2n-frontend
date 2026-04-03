import { useEffect, useState } from 'react';
import { Outlet, useNavigate } from '@tanstack/react-router';

import { useAuth } from '@/app/providers/auth-provider';
import { LoadingState } from '@/components/feedback/loading-state';
import { AppHeader } from '@/components/shell/app-header';
import { AppSidebar } from '@/components/shell/app-sidebar';

export function AppShellLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const { isAuthenticated, isBootstrapping } = useAuth();

  useEffect(() => {
    if (!isBootstrapping && !isAuthenticated) {
      void navigate({ to: '/login' });
    }
  }, [isAuthenticated, isBootstrapping, navigate]);

  if (isBootstrapping) {
    return (
      <div className="p-6 lg:p-10">
        <LoadingState title="Validating your session" description="Re-checking live access before we unlock the workspace." />
      </div>
    );
  }

  return (
    <div className="relative mx-auto flex h-screen max-w-[1720px] overflow-hidden">
      <AppSidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="min-w-0 flex h-screen flex-1 flex-col overflow-hidden lg:pl-0">
        <AppHeader onOpenMenu={() => setMobileOpen(true)} />
        <main className="min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
