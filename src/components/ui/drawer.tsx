import type { ReactNode } from "react";
import { useEffect } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";

interface DrawerProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  widthClassName?: string;
}

export function Drawer({
  open,
  title,
  description,
  onClose,
  children,
  widthClassName,
}: DrawerProps) {
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/35 backdrop-blur-sm">
      <button
        aria-label="Close drawer"
        className="flex-1 cursor-default"
        onClick={onClose}
        type="button"
      />
      <Card
        className={cn(
          "flex h-full w-full max-w-2xl flex-col overflow-hidden rounded-none border-l border-[color:var(--line)] bg-[var(--surface)] shadow-[var(--shadow-xl)]",
          widthClassName,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[color:var(--line)] px-6 py-5">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--surface-faint)]">
              Review Drawer
            </p>
            <h2 className="text-2xl text-[var(--surface-ink)]">{title}</h2>
            {description ? (
              <p className="max-w-xl text-sm leading-6 text-[var(--surface-muted)]">{description}</p>
            ) : null}
          </div>
          <Button onClick={onClose} size="sm" type="button" variant="ghost">
            <X className="size-4" />
            Close
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-6">{children}</div>
      </Card>
    </div>
  );
}
