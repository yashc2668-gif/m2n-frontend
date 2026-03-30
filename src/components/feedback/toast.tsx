import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

import { cn } from '@/lib/cn';

interface Toast {
  id: string;
  message: string;
  tone: 'success' | 'danger' | 'info';
}

interface ToastContextValue {
  toast: (message: string, tone?: Toast['tone']) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const toneConfig: Record<Toast['tone'], { bg: string; icon: typeof Info }> = {
  success: { bg: 'border-emerald-200 bg-emerald-50 text-emerald-800', icon: CheckCircle2 },
  danger: { bg: 'border-orange-200 bg-orange-50 text-orange-800', icon: AlertTriangle },
  info: { bg: 'border-sky-200 bg-sky-50 text-sky-800', icon: Info },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, tone: Toast['tone'] = 'success') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  /* Listen for global 409 conflict events dispatched by MutationCache */
  useEffect(() => {
    function onConflict(e: Event) {
      const detail = (e as CustomEvent<string>).detail;
      addToast(detail || 'Record was modified by another user. Please reload.', 'danger');
    }
    window.addEventListener('api:conflict', onConflict);
    return () => window.removeEventListener('api:conflict', onConflict);
  }, [addToast]);

  const value = useMemo<ToastContextValue>(() => ({ toast: addToast }), [addToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-6 right-6 z-[60] flex flex-col gap-3">
        {toasts.map((t) => {
          const config = toneConfig[t.tone];
          const Icon = config.icon;
          return (
            <div
              key={t.id}
              className={cn(
                'flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm shadow-[var(--shadow-lg)] animate-in slide-in-from-right duration-300',
                config.bg,
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span className="flex-1">{t.message}</span>
              <button type="button" onClick={() => dismiss(t.id)} className="shrink-0 opacity-60 hover:opacity-100">
                <X className="size-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used inside ToastProvider');
  }
  return context;
}
