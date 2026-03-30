import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type InputHTMLAttributes,
} from 'react';

import { cn } from '@/lib/cn';

/* ── helpers ──────────────────────────────────────────────────────── */

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as const;

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function firstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function toIso(year: number, month: number, day: number): string {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function parseIso(iso: string): { year: number; month: number; day: number } | null {
  if (!iso) return null;
  const parts = iso.split('-');
  if (parts.length !== 3) return null;
  const year = Number(parts[0]);
  const month = Number(parts[1]) - 1;
  const day = Number(parts[2]);
  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) return null;
  return { year, month, day };
}

function formatDisplay(iso: string): string {
  const d = parseIso(iso);
  if (!d) return '';
  return `${pad(d.day)} ${MONTH_NAMES[d.month].slice(0, 3)} ${d.year}`;
}

function isSame(a: string, b: string): boolean {
  return a === b;
}

function isToday(year: number, month: number, day: number): boolean {
  const now = new Date();
  return now.getFullYear() === year && now.getMonth() === month && now.getDate() === day;
}

/* ── component ────────────────────────────────────────────────────── */

export interface DatePickerProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> {
  /** Current value in ISO format (YYYY-MM-DD) */
  value?: string;
  /** Fires with ISO date string */
  onChange?: (value: string) => void;
  /** Placeholder text */
  placeholder?: string;
}

/**
 * Custom calendar date picker matching the M2N design system.
 * Drop-in replacement for `<input type="date" />`.
 *
 * Compatible with React Hook Form via `forwardRef` — spread `register(...)` props directly.
 */
export const DatePicker = forwardRef<HTMLInputElement, DatePickerProps>(function DatePicker(
  { value = '', onChange, placeholder = 'Select date', className, name, onBlur, disabled, ...rest },
  ref,
) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calendar view state
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  // Reset view to current value (or today) whenever calendar opens
  function openCalendar() {
    const p = parseIso(value);
    setViewYear(p?.year ?? new Date().getFullYear());
    setViewMonth(p?.month ?? new Date().getMonth());
    setOpen(true);
  }

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  function prevMonth() {
    setViewMonth((m) => {
      if (m === 0) {
        setViewYear((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
  }

  function nextMonth() {
    setViewMonth((m) => {
      if (m === 11) {
        setViewYear((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
  }

  function selectDay(day: number) {
    const iso = toIso(viewYear, viewMonth, day);
    onChange?.(iso);
    // Also fire native-like event for RHF compatibility
    if (ref && typeof ref === 'object' && ref.current) {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )?.set;
      nativeInputValueSetter?.call(ref.current, iso);
      ref.current.dispatchEvent(new Event('input', { bubbles: true }));
      ref.current.dispatchEvent(new Event('change', { bubbles: true }));
    }
    setOpen(false);
  }

  const totalDays = daysInMonth(viewYear, viewMonth);
  const startDay = firstDayOfMonth(viewYear, viewMonth);

  return (
    <div ref={containerRef} className="relative">
      {/* Hidden native input for form compatibility */}
      <input
        ref={ref}
        type="hidden"
        name={name}
        value={value}
        onBlur={onBlur}
        {...rest}
      />
      {/* Visible trigger */}
      <button
        type="button"
        disabled={disabled}
        className={cn(
          'flex w-full items-center gap-3 rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 text-left text-sm outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-amber-100 disabled:cursor-not-allowed disabled:opacity-55',
          className,
        )}
        onClick={() => (open ? setOpen(false) : openCalendar())}
      >
        <Calendar className="size-4 shrink-0 text-[var(--surface-muted)]" />
        <span className={value ? 'text-[var(--surface-ink)]' : 'text-[var(--surface-muted)]'}>
          {value ? formatDisplay(value) : placeholder}
        </span>
      </button>

      {/* Calendar popover */}
      {open && (
        <div className="absolute z-50 mt-2 w-72 rounded-2xl border border-[color:var(--line)] bg-white p-4 shadow-xl">
          {/* Month/Year header */}
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              className="rounded-full p-1.5 text-[var(--surface-muted)] transition hover:bg-[var(--canvas)] hover:text-[var(--surface-ink)]"
              onClick={prevMonth}
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-sm font-semibold text-[var(--surface-ink)]">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              className="rounded-full p-1.5 text-[var(--surface-muted)] transition hover:bg-[var(--canvas)] hover:text-[var(--surface-ink)]"
              onClick={nextMonth}
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          {/* Day-of-week labels */}
          <div className="mb-1 grid grid-cols-7 text-center text-xs font-medium text-[var(--surface-muted)]">
            {DAY_LABELS.map((d) => (
              <span key={d} className="py-1">{d}</span>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {/* leading blanks */}
            {Array.from({ length: startDay }, (_, i) => (
              <span key={`blank-${i}`} />
            ))}
            {/* day buttons */}
            {Array.from({ length: totalDays }, (_, i) => {
              const day = i + 1;
              const iso = toIso(viewYear, viewMonth, day);
              const selected = isSame(iso, value);
              const today = isToday(viewYear, viewMonth, day);
              return (
                <button
                  key={day}
                  type="button"
                  className={cn(
                    'mx-auto flex size-8 items-center justify-center rounded-full text-xs transition',
                    selected
                      ? 'bg-[var(--accent)] font-semibold text-white'
                      : today
                        ? 'font-semibold text-[var(--accent)] ring-1 ring-[var(--accent)]'
                        : 'text-[var(--surface-ink)] hover:bg-[var(--canvas)]',
                  )}
                  onClick={() => selectDay(day)}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Today shortcut */}
          <div className="mt-3 border-t border-[color:var(--line)] pt-2 text-center">
            <button
              type="button"
              className="text-xs font-semibold text-[var(--accent)] transition hover:underline"
              onClick={() => {
                const today = new Date();
                setViewYear(today.getFullYear());
                setViewMonth(today.getMonth());
                selectDay(today.getDate());
              }}
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

/* ── date range picker ────────────────────────────────────────────── */

export interface DateRangePickerProps {
  /** Start date in ISO format */
  startDate: string;
  /** End date in ISO format */
  endDate: string;
  /** Fires when either date changes */
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  /** Labels */
  startLabel?: string;
  endLabel?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * Two-field date range picker using the DatePicker calendar.
 */
export function DateRangePicker({
  startDate,
  endDate,
  onStartChange,
  onEndChange,
  startLabel = 'From',
  endLabel = 'To',
  className,
  disabled,
}: DateRangePickerProps) {
  return (
    <div className={cn('flex items-end gap-3', className)}>
      <div className="flex-1 space-y-2">
        <span className="text-sm font-semibold text-[var(--surface-ink)]">{startLabel}</span>
        <DatePicker value={startDate} onChange={onStartChange} disabled={disabled} placeholder="Start date" />
      </div>
      <span className="pb-3 text-sm text-[var(--surface-muted)]">–</span>
      <div className="flex-1 space-y-2">
        <span className="text-sm font-semibold text-[var(--surface-ink)]">{endLabel}</span>
        <DatePicker value={endDate} onChange={onEndChange} disabled={disabled} placeholder="End date" />
      </div>
    </div>
  );
}
