import { useNavigate, useRouterState } from '@tanstack/react-router';
import { HardHat, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef } from 'react';

import { useAuth } from '@/app/providers/auth-provider';
import { navigationSections } from '@/components/shell/navigation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { hasPermissions, hasRole } from '@/lib/permissions';

interface AppSidebarProps {
  mobileOpen: boolean;
  onClose: () => void;
}

const SIDEBAR_SCROLL_STORAGE_KEY = 'm2n:sidebar-scroll-top';

export function AppSidebar({ mobileOpen, onClose }: AppSidebarProps) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { user } = useAuth();
  const currentRole = user?.role ?? 'viewer';
  const navRef = useRef<HTMLElement | null>(null);
  const sidebarScrollTopRef = useRef(0);
  const restoreSidebarScroll = () => {
    const navElement = navRef.current;
    if (!navElement) {
      return;
    }
    if (sidebarScrollTopRef.current > 0) {
      navElement.scrollTop = sidebarScrollTopRef.current;
      return;
    }
    const savedScrollTop = window.sessionStorage.getItem(SIDEBAR_SCROLL_STORAGE_KEY);
    if (savedScrollTop) {
      const parsedScrollTop = Number(savedScrollTop);
      sidebarScrollTopRef.current = parsedScrollTop;
      navElement.scrollTop = parsedScrollTop;
    }
  };

  const persistSidebarScroll = () => {
    const navElement = navRef.current;
    if (!navElement) {
      return;
    }
    sidebarScrollTopRef.current = navElement.scrollTop;
    window.sessionStorage.setItem(
      SIDEBAR_SCROLL_STORAGE_KEY,
      String(sidebarScrollTopRef.current),
    );
  };

  useEffect(() => {
    const navElement = navRef.current;
    if (!navElement) {
      return;
    }

    restoreSidebarScroll();
    navElement.addEventListener('scroll', persistSidebarScroll, { passive: true });
    return () => {
      persistSidebarScroll();
      navElement.removeEventListener('scroll', persistSidebarScroll);
    };
  }, []);

  useLayoutEffect(() => {
    restoreSidebarScroll();
    const firstFrame = window.requestAnimationFrame(() => {
      restoreSidebarScroll();
    });
    const secondFrame = window.requestAnimationFrame(() => {
      restoreSidebarScroll();
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
    };
  }, [pathname]);

  const filteredSections = navigationSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        const allowedByPermissions = item.permissions
          ? hasPermissions(currentRole, item.permissions)
          : true;
        const allowedByRoles = item.roles ? hasRole(currentRole, item.roles) : true;
        return allowedByPermissions && allowedByRoles;
      }),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-30 bg-[rgba(12,18,15,0.48)] backdrop-blur-sm transition lg:hidden',
          mobileOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onClose}
      />
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex h-screen w-[320px] flex-col overflow-hidden border-r border-[color:var(--sidebar-line)] bg-[var(--sidebar)] px-5 py-6 text-white shadow-[var(--shadow-xl)] transition lg:static lg:z-auto lg:w-[300px] lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="mb-8 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="rounded-2xl bg-[rgba(255,255,255,0.08)] p-3 text-[var(--accent)]">
              <HardHat className="size-6" />
            </span>
            <div>
              <h1 className="text-xl text-white">M2N Command Center</h1>
              <p className="text-sm text-[var(--sidebar-muted)]">Construction ERP frontend foundation</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="text-white lg:hidden" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        <div className="mb-8 rounded-[var(--radius)] border border-[color:var(--sidebar-line)] bg-white/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--sidebar-muted)]">
            Mission focus
          </p>
          <p className="mt-2 text-sm leading-6 text-white/90">
            Fast scanning, role-aware navigation, and backend-first workflow integrity.
          </p>
        </div>

        <nav ref={navRef} className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto pr-1">
          {filteredSections.map((section) => (
            <div key={section.title} className="space-y-2">
              <p className="px-3 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--sidebar-muted)]">
                {section.title}
              </p>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const active = item.to === '/'
                    ? pathname === '/'
                    : pathname === item.to || pathname.startsWith(`${item.to}/`);
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.to}
                      type="button"
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'group flex w-full rounded-[var(--radius)] border px-3 py-3 text-left transition',
                        active
                          ? 'border-white/10 bg-white text-[var(--sidebar)]'
                          : 'border-transparent bg-transparent text-white/82 hover:border-white/8 hover:bg-white/6',
                      )}
                      onPointerDown={(event) => {
                        event.preventDefault();
                      }}
                      onClick={() => {
                        persistSidebarScroll();
                        if (pathname !== item.to) {
                          void navigate({ to: item.to, resetScroll: false });
                        }
                        onClose();
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={cn(
                            'rounded-xl p-2 transition',
                            active ? 'bg-[var(--accent-soft)] text-[var(--accent-strong)]' : 'bg-white/7 text-[var(--accent)]',
                          )}
                        >
                          <Icon className="size-4" />
                        </span>
                        <div className="space-y-1">
                          <p className="text-sm font-semibold">{item.label}</p>
                          <p className={cn('text-xs leading-5', active ? 'text-slate-600' : 'text-[var(--sidebar-muted)]')}>
                            {item.description}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
