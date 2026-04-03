import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from '@tanstack/react-router';
import { ArrowLeft, HardHat, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import { resetPasswordRequest } from '@/api/auth';
import { getApiErrorMessage } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PasswordStrengthIndicator } from '@/components/ui/password-strength-indicator';
import { isPasswordValid, passwordContainsEmail } from '@/lib/password-validation';

const resetSchema = z.object({
  email: z.string().email('Use a valid work email.'),
  otp_code: z
    .string()
    .min(4, 'Code must be at least 4 characters.')
    .max(10, 'Code must be at most 10 characters.'),
  new_password: z.string().min(8, 'Minimum 8 characters required.').max(128),
});

type ResetValues = z.infer<typeof resetSchema>;

export default function ResetPasswordPage() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ResetValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { email: '', otp_code: '', new_password: '' },
  });

  const watchedPassword = useWatch({ control, name: 'new_password' });
  const watchedEmail = useWatch({ control, name: 'email' });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);

    if (!isPasswordValid(values.new_password)) {
      setServerError('Password does not meet all requirements.');
      return;
    }
    if (passwordContainsEmail(values.new_password, values.email)) {
      setServerError('Password must not contain your email address.');
      return;
    }

    try {
      await resetPasswordRequest(values);
      setSuccess(true);
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
                {success ? 'Password reset successful' : 'Reset your password'}
              </h2>
              <p className="text-sm leading-6 text-[var(--surface-muted)]">
                {success
                  ? 'Your password has been updated and all previous sessions have been revoked. You can now sign in with your new password.'
                  : 'Enter the 6-digit code from your email along with your new password.'}
              </p>
            </div>

            {success ? (
              <div className="space-y-4">
                <div className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0" />
                  All active sessions have been securely terminated.
                </div>
                <Link
                  to="/login"
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
                >
                  Sign in with new password
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

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-[var(--surface-ink)]" htmlFor="otp_code">
                    Reset code
                  </label>
                  <input
                    id="otp_code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    className="w-full rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 text-center text-lg font-mono tracking-[0.4em] outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-amber-100"
                    placeholder="------"
                    maxLength={10}
                    {...register('otp_code')}
                  />
                  {errors.otp_code ? (
                    <p className="text-sm text-[var(--danger)]">{errors.otp_code.message}</p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-[var(--surface-ink)]" htmlFor="new_password">
                    New password
                  </label>
                  <input
                    id="new_password"
                    type="password"
                    className="w-full rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-amber-100"
                    placeholder="Minimum 8 characters"
                    {...register('new_password')}
                  />
                  {errors.new_password ? (
                    <p className="text-sm text-[var(--danger)]">{errors.new_password.message}</p>
                  ) : null}
                  <PasswordStrengthIndicator password={watchedPassword} email={watchedEmail} />
                </div>

                {serverError ? (
                  <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
                    {serverError}
                  </div>
                ) : null}

                <Button className="w-full" size="lg" disabled={isSubmitting} type="submit">
                  {isSubmitting ? 'Resetting...' : 'Reset password'}
                </Button>

                <Link
                  to="/forgot-password"
                  className="flex items-center justify-center gap-1.5 text-sm text-[var(--surface-muted)] hover:text-[var(--surface-ink)]"
                >
                  <ArrowLeft className="size-3.5" />
                  Resend code
                </Link>
              </form>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
