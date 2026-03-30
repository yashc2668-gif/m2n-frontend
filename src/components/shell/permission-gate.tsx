import type { ReactNode } from 'react';

import { useAuth } from '@/app/providers/auth-provider';
import { Card } from '@/components/ui/card';
import { getRoleLabel, hasPermissions, hasRole, type AppRole } from '@/lib/permissions';

interface PermissionGateProps {
  children: ReactNode;
  permissions?: string[];
  roles?: AppRole[];
}

export function PermissionGate({ children, permissions, roles }: PermissionGateProps) {
  const { user } = useAuth();
  const role = user?.role ?? 'viewer';
  const allowedByPermission = permissions ? hasPermissions(role, permissions) : true;
  const allowedByRole = roles ? hasRole(role, roles) : true;

  if (allowedByPermission && allowedByRole) {
    return <>{children}</>;
  }

  return (
    <Card className="p-8">
      <div className="space-y-3">
        <span className="inline-flex rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-orange-800">
          Access boundary
        </span>
        <h2 className="text-2xl text-[var(--surface-ink)]">Your current role cannot open this workspace.</h2>
        <p className="max-w-2xl text-sm leading-6 text-[var(--surface-muted)]">
          You are signed in as {getRoleLabel(role)}. The backend remains the final authority, and the
          frontend is mirroring that access model for a safer user flow.
        </p>
      </div>
    </Card>
  );
}
