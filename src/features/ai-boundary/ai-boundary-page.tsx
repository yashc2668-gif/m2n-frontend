import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { BrainCircuit, ShieldCheck, ShieldOff } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useAuth } from "@/app/providers/auth-provider";
import { evaluateAiBoundary, fetchAiBoundaryPolicy } from "@/api/ai-boundary";
import { getApiErrorMessage } from "@/api/client";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { PermissionGate } from "@/components/shell/permission-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { titleCase } from "@/lib/format";

const evaluationSchema = z.object({
  operation_type: z.string().min(1, "Operation type is required."),
  affects_state: z.boolean(),
});

type EvaluationValues = z.infer<typeof evaluationSchema>;

export default function AiBoundaryPage() {
  const { accessToken } = useAuth();
  const policyQuery = useQuery({
    queryKey: ["ai-boundary", "policy"],
    queryFn: () => fetchAiBoundaryPolicy(accessToken ?? ""),
    enabled: Boolean(accessToken),
  });
  const evaluationMutation = useMutation({
    mutationFn: (values: EvaluationValues) => evaluateAiBoundary(accessToken ?? "", values),
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EvaluationValues>({
    resolver: zodResolver(evaluationSchema),
    defaultValues: {
      operation_type: "reorder_suggestion",
      affects_state: false,
    },
  });

  if (policyQuery.isLoading) {
    return (
      <LoadingState
        title="Reading AI guardrails"
        description="Loading the admin-only policy boundary from the backend."
      />
    );
  }

  if (policyQuery.error || !policyQuery.data) {
    return (
      <ErrorState
        description={policyQuery.error?.message ?? "AI boundary policy could not be loaded."}
        onRetry={() => void policyQuery.refetch()}
      />
    );
  }

  const policy = policyQuery.data;

  return (
    <PermissionGate roles={["admin"]}>
      <div className="space-y-6">
        <PageHeader
          eyebrow="AI guardrail"
          title="Keep AI suggestion-only until the backend explicitly says otherwise."
          description="This page proves the architecture direction: AI can assist operators, but it still cannot bypass backend rules, validations, or human approval."
        />

        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <Card className="p-6">
            <div className="mb-5 flex items-center gap-3">
              <span className="rounded-2xl bg-[var(--accent-soft)] p-3 text-[var(--accent-strong)]">
                <BrainCircuit className="size-5" />
              </span>
              <div>
                <h3 className="text-2xl text-[var(--surface-ink)]">Current policy</h3>
                <p className="text-sm text-[var(--surface-muted)]">Live policy returned by the backend.</p>
              </div>
            </div>

            <div className="space-y-4 text-sm">
              <div className="flex flex-wrap gap-2">
                <Badge tone={policy.ai_enabled ? "info" : "neutral"}>{policy.ai_enabled ? "AI enabled" : "AI disabled"}</Badge>
                <Badge tone={policy.allow_state_changing_execution ? "danger" : "success"}>
                  {policy.allow_state_changing_execution ? "Write execution enabled" : "Write execution blocked"}
                </Badge>
              </div>
              <p className="text-[var(--surface-muted)]">Mode: <span className="font-semibold text-[var(--surface-ink)]">{titleCase(policy.ai_mode)}</span></p>
              <p className="text-[var(--surface-muted)]">Human review required: <span className="font-semibold text-[var(--surface-ink)]">{policy.require_human_review ? "Yes" : "No"}</span></p>
              <p className="text-[var(--surface-muted)]">Backend validation required: <span className="font-semibold text-[var(--surface-ink)]">{policy.require_backend_validation ? "Yes" : "No"}</span></p>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--surface-faint)]">Required guards</p>
                <div className="flex flex-wrap gap-2">
                  {policy.required_guards.map((guard) => (
                    <Badge key={guard} tone="accent">{titleCase(guard)}</Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--surface-faint)]">Notes</p>
                <div className="space-y-2">
                  {policy.notes.map((note) => (
                    <div key={note} className="rounded-[var(--radius)] border border-[color:var(--line)] bg-white/70 p-4 text-[var(--surface-muted)]">
                      {note}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="mb-5 space-y-2">
              <h3 className="text-2xl text-[var(--surface-ink)]">Evaluate a proposed AI operation</h3>
              <p className="text-sm leading-6 text-[var(--surface-muted)]">
                This form stays read-only to prove the architectural boundary. We can test operation intent without allowing AI to mutate business state.
              </p>
            </div>

            <form
              className="space-y-4"
              onSubmit={handleSubmit(async (values) => {
                await evaluationMutation.mutateAsync(values);
              })}
            >
              <div className="space-y-2">
                <label className="text-sm font-semibold text-[var(--surface-ink)]" htmlFor="operation_type">
                  Operation type
                </label>
                <input
                  id="operation_type"
                  className="w-full rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-amber-100"
                  {...register("operation_type")}
                />
                {errors.operation_type ? <p className="text-sm text-[var(--danger)]">{errors.operation_type.message}</p> : null}
              </div>

              <label className="flex items-center gap-3 rounded-2xl border border-[color:var(--line)] bg-white/70 px-4 py-3 text-sm text-[var(--surface-ink)]">
                <input type="checkbox" {...register("affects_state")} />
                Mark this operation as state-changing
              </label>

              <Button disabled={isSubmitting || evaluationMutation.isPending} type="submit">
                {evaluationMutation.isPending ? "Evaluating..." : "Evaluate boundary"}
              </Button>
            </form>

            {evaluationMutation.error ? (
              <div className="mt-4 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
                {getApiErrorMessage(evaluationMutation.error)}
              </div>
            ) : null}

            {evaluationMutation.data ? (
              <div className="mt-6 space-y-4 rounded-[var(--radius)] border border-[color:var(--line)] bg-white/75 p-5">
                <div className="flex items-center gap-3">
                  <span className={`rounded-2xl p-3 ${evaluationMutation.data.allowed ? "bg-emerald-100 text-emerald-800" : "bg-orange-100 text-orange-800"}`}>
                    {evaluationMutation.data.allowed ? <ShieldCheck className="size-5" /> : <ShieldOff className="size-5" />}
                  </span>
                  <div>
                    <p className="font-semibold text-[var(--surface-ink)]">
                      {evaluationMutation.data.allowed ? "Allowed by current boundary" : "Blocked by current boundary"}
                    </p>
                    <p className="text-sm text-[var(--surface-muted)]">
                      Normalized operation: {titleCase(evaluationMutation.data.normalized_operation_type)}
                    </p>
                  </div>
                </div>

                <div className="space-y-2 text-sm text-[var(--surface-muted)]">
                  <p>Affects state: <span className="font-semibold text-[var(--surface-ink)]">{evaluationMutation.data.affects_state ? "Yes" : "No"}</span></p>
                  <div>
                    <p className="mb-2 font-semibold text-[var(--surface-ink)]">Reasons</p>
                    <ul className="space-y-2 pl-5">
                      {evaluationMutation.data.reasons.map((reason) => (
                        <li key={reason} className="list-disc">{reason}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ) : null}
          </Card>
        </div>
      </div>
    </PermissionGate>
  );
}
