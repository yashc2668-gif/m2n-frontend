import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type ButtonHTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition duration-200 disabled:cursor-not-allowed disabled:opacity-55',
  {
    variants: {
      variant: {
        primary:
          'border-transparent bg-[var(--accent)] text-white shadow-[var(--shadow-lg)] hover:bg-[var(--accent-strong)]',
        secondary:
          'border-[color:var(--line)] bg-white/70 text-[var(--surface-ink)] hover:bg-white',
        ghost:
          'border-transparent bg-transparent text-[var(--surface-ink)] hover:bg-white/70',
        danger: 'border-transparent bg-[var(--danger)] text-white hover:brightness-110',
      },
      size: {
        sm: 'px-3 py-1.5 text-xs',
        md: 'px-4 py-2 text-sm',
        lg: 'px-5 py-3 text-sm',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, size, variant, ...props },
  ref,
) {
  return <button ref={ref} className={cn(buttonVariants({ size, variant }), className)} {...props} />;
});
