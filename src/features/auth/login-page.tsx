import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "@tanstack/react-router";
import { HardHat, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useAuth } from "@/app/providers/auth-provider";
import { getApiBaseHost, getApiErrorMessage } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const loginSchema = z.object({
  email: z.string().email("Use a valid work email."),
  password: z.string().min(8, "Minimum 8 characters required."),
});

type LoginValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await login(values);
      await navigate({ to: "/" });
    } catch (error) {
      setServerError(getApiErrorMessage(error));
    }
  });

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 md:px-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(217,119,6,0.14),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(47,133,90,0.14),_transparent_24%)]" />
      <div className="relative grid w-full max-w-6xl gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <Card className="overflow-hidden border-transparent bg-[linear-gradient(160deg,_rgba(28,36,31,0.97),_rgba(37,49,42,0.92))] p-8 text-white shadow-[var(--shadow-xl)] md:p-10">
          <div className="flex h-full flex-col justify-between gap-10">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm text-white/90">
                <HardHat className="size-4 text-[var(--accent)]" />
                Construction ERP frontend
              </div>
              <div className="space-y-4">
                <h1 className="max-w-xl text-4xl leading-tight text-white md:text-6xl">
                  Build a control room that feels alive, not another generic admin panel.
                </h1>
                <p className="max-w-2xl text-base leading-7 text-white/72 md:text-lg">
                  This starter is aligned to your live backend: auth, RBAC, dashboard,
                  materials, labour, payments, audit visibility, and AI boundary controls.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {[
                ["Backend-first", "Route guard and permission logic mirror backend intent."],
                ["Operational UX", "Tables, summaries, and approval surfaces built for scanning."],
                ["Future-safe", "Typed API layer and shell foundation ready for next modules."],
              ].map(([title, description]) => (
                <div key={title} className="rounded-[var(--radius)] border border-white/10 bg-white/6 p-4">
                  <p className="text-sm font-semibold text-white">{title}</p>
                  <p className="mt-2 text-sm leading-6 text-white/68">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card className="p-6 md:p-8">
          <div className="space-y-6">
            <div className="space-y-3">
              <span className="inline-flex rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
                Sign in
              </span>
              <div className="space-y-2">
                <h2 className="text-3xl text-[var(--surface-ink)]">Open the command center.</h2>
                <p className="text-sm leading-6 text-[var(--surface-muted)]">
                  Connected to {getApiBaseHost()}. Use a backend account to unlock the ERP workspace.
                </p>
              </div>
            </div>

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
                  {...register("email")}
                />
                {errors.email ? <p className="text-sm text-[var(--danger)]">{errors.email.message}</p> : null}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-[var(--surface-ink)]" htmlFor="password">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  className="w-full rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-amber-100"
                  placeholder="Minimum 8 characters"
                  {...register("password")}
                />
                {errors.password ? (
                  <p className="text-sm text-[var(--danger)]">{errors.password.message}</p>
                ) : null}
              </div>

              {serverError ? (
                <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
                  {serverError}
                </div>
              ) : null}

              <Button className="w-full" size="lg" disabled={isSubmitting} type="submit">
                {isSubmitting ? "Authorizing..." : "Enter workspace"}
              </Button>

              <div className="text-center">
                <Link
                  to="/forgot-password"
                  className="text-sm text-[var(--surface-muted)] hover:text-[var(--accent)] transition"
                >
                  Forgot your password?
                </Link>
              </div>
            </form>

            <div className="rounded-[var(--radius)] border border-[color:var(--line)] bg-white/70 p-4 text-sm leading-6 text-[var(--surface-muted)]">
              <div className="mb-2 flex items-center gap-2 font-semibold text-[var(--surface-ink)]">
                <ShieldCheck className="size-4 text-[var(--info)]" />
                Backend rule reminder
              </div>
              Final access, workflow actions, and data safety are still enforced by the backend.
              The frontend is helping operators move faster without bypassing those controls.
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
