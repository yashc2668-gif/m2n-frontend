import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from '@tanstack/react-router';
import { HardHat, ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { forgotPasswordRequest } from '@/api/auth';
import { getApiErrorMessage } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const forgotSchema = z.object({
  email: z.string().email('Use a valid work email.'),
});

type ForgotValues = z.infer<typeof forgotSchema>;

export default function ForgotPasswordPage() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotValues>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await forgotPasswordRequest(values);
      setSubmitted(true);
    } catch (error) {
      setServerError(getApiErrorMessage(error));
    }
  });

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 md:px-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(217,119,6,0.14),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(47,133,90,0.14),_transparent_24%)]" />
      <div className="relative w-full max-w-md">
        <Card className="p-6 md:p-8">
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 text-[var(--accent)]">
                <HardHat className="size-5" />
                <span className="text-sm font-semibold">M2N Construction ERP</span>
              </div>
              <h2 className="text-2xl font-bold text-[var(--surface-ink)]">
                {submitted ? 'Check your email' : 'Forgot password'}
              </h2>
              <p className="text-sm leading-6 text-[var(--surface-muted)]">
                {submitted
                  ? 'If an account exists for that email, a 6-digit reset code has been sent. Check your inbox and spam folder.'
                  : "Enter the email address associated with your account. We'll send a one-time code to reset your password."}
              </p>
            </div>

            {submitted ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  Reset code sent. It expires in 10 minutes.
                </div>
                <Link
                  to="/reset-password"
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
                >
                  Enter reset code
                </Link>
                <Link
                  to="/login"
                  className="flex items-center justify-center gap-1.5 text-sm text-[var(--surface-muted)] hover:text-[var(--surface-ink)]"
                >
                  <ArrowLeft className="size-3.5" />
                  Back to sign in
                </Link>
              </div>
            ) : (
              <form className="space-y-4" onSubmit={onSubmit}>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-[var(--surface-ink)]" htmlFor="email">
                    Work email
                  </label>
                  <input
                    id="email"
                    type="email"
                    className="w-full rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-amber-100"
                    placeholder="site.lead@example.com"
                    {...register('email')}
                  />
                  {errors.email ? (
                    <p className="text-sm text-[var(--danger)]">{errors.email.message}</p>
                  ) : null}
                </div>

                {serverError ? (
                  <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
                    {serverError}
                  </div>
                ) : null}

                <Button className="w-full" size="lg" disabled={isSubmitting} type="submit">
                  {isSubmitting ? 'Sending...' : 'Send reset code'}
                </Button>

                <Link
                  to="/login"
                  className="flex items-center justify-center gap-1.5 text-sm text-[var(--surface-muted)] hover:text-[var(--surface-ink)]"
                >
                  <ArrowLeft className="size-3.5" />
                  Back to sign in
                </Link>
              </form>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
