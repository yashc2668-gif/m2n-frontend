import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Plus, ScanSearch, ShieldAlert, Trash2, Wrench } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";

import { useAuth } from "@/app/providers/auth-provider";
import { getApiErrorMessage } from "@/api/client";
import {
  fetchMaterialStockAdjustments,
  createMaterialStockAdjustment,
  updateMaterialStockAdjustment,
} from "@/api/material-stock-adjustments";
import { fetchMaterials } from "@/api/materials";
import { fetchProjects } from "@/api/projects";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { PermissionGate } from "@/components/shell/permission-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { formatCompactNumber, formatCurrency, formatDate, formatDecimal, titleCase } from "@/lib/format";
import { hasPermissions } from "@/lib/permissions";
import {
  buildAdjustmentDefaults,
  getAdjustmentMetrics,
  getAdjustmentStatusOptions,
  operationStatusToneMap,
} from "@/features/material-operations/material-operations-helpers";

const EMPTY_LIST: never[] = [];
const inputClassName =
  "w-full rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-amber-100";
const labelClassName = "text-sm font-semibold text-[var(--surface-ink)]";

const adjustmentLineSchema = z.object({
  line_id: z.string().optional(),
  material_id: z.string().min(1, "Select a material."),
  qty_change: z.number().refine((value) => value !== 0, "Quantity change cannot be zero."),
  unit_rate: z.number().min(0, "Rate cannot be negative."),
});

const adjustmentFormSchema = z.object({
  adjustment_no: z.string().min(1, "Adjustment number is required."),
  project_id: z.string().min(1, "Select a project."),
  adjustment_date: z.string().min(1, "Adjustment date is required."),
  status: z.string().min(1, "Status is required."),
  reason: z.string().optional(),
  remarks: z.string().optional(),
  items: z.array(adjustmentLineSchema).min(1, "Add at least one line."),
});

type AdjustmentFormValues = z.infer<typeof adjustmentFormSchema>;

export default function MaterialAdjustmentsPage() {
  const { accessToken, user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedAdjustmentId, setSelectedAdjustmentId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [serverMessage, setServerMessage] = useState<string | null>(null);

  const adjustmentsQuery = useQuery({
    queryKey: ["material-stock-adjustments"],
    queryFn: () => fetchMaterialStockAdjustments(accessToken ?? ""),
    enabled: Boolean(accessToken),
  });
  const materialsQuery = useQuery({
    queryKey: ["materials"],
    queryFn: () => fetchMaterials(accessToken ?? ""),
    enabled: Boolean(accessToken),
  });
  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: () => fetchProjects(accessToken ?? ""),
    enabled: Boolean(accessToken),
  });

  const adjustments = Array.isArray(adjustmentsQuery.data) ? adjustmentsQuery.data : EMPTY_LIST;
  const materials = Array.isArray(materialsQuery.data) ? materialsQuery.data : EMPTY_LIST;
  const projects = Array.isArray(projectsQuery.data) ? projectsQuery.data : EMPTY_LIST;
  const projectMap = useMemo(() => new Map(projects.map((project) => [project.id, project.name])), [projects]);
  const materialMap = useMemo(() => new Map(materials.map((material) => [material.id, material])), [materials]);
  const selectedAdjustment = useMemo(() => adjustments.find((adjustment) => adjustment.id === selectedAdjustmentId) ?? null, [adjustments, selectedAdjustmentId]);
  const isEditMode = Boolean(selectedAdjustment);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AdjustmentFormValues>({
    resolver: zodResolver(adjustmentFormSchema),
    defaultValues: buildAdjustmentDefaults(),
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  });

  useEffect(() => {
    if (!selectedAdjustment) {
      reset(buildAdjustmentDefaults());
      return;
    }

    reset({
      adjustment_no: selectedAdjustment.adjustment_no,
      project_id: String(selectedAdjustment.project_id),
      adjustment_date: selectedAdjustment.adjustment_date,
      status: selectedAdjustment.status,
      reason: selectedAdjustment.reason ?? "",
      remarks: selectedAdjustment.remarks ?? "",
      items: selectedAdjustment.items.map((item) => ({
        line_id: String(item.id),
        material_id: String(item.material_id),
        qty_change: item.qty_change,
        unit_rate: item.unit_rate,
      })),
    });
  }, [reset, selectedAdjustment]);

  const adjustmentMutation = useMutation({
    mutationFn: async (values: AdjustmentFormValues) => {
      if (selectedAdjustment && values.items.some((item) => !item.line_id)) {
        throw new Error("Existing adjustments only support updating current lines. Create a new adjustment for additional items.");
      }

      const payload = {
        adjustment_no: values.adjustment_no.trim(),
        project_id: Number(values.project_id),
        adjustment_date: values.adjustment_date,
        status: values.status,
        reason: values.reason?.trim() || null,
        remarks: values.remarks?.trim() || null,
      };

      if (selectedAdjustment) {
        return updateMaterialStockAdjustment(accessToken ?? "", selectedAdjustment.id, {
          ...payload,
          items: values.items.map((item) => ({
            id: Number(item.line_id),
            qty_change: item.qty_change,
            unit_rate: item.unit_rate,
          })),
        });
      }

      return createMaterialStockAdjustment(accessToken ?? "", {
        ...payload,
        items: values.items.map((item) => ({
          material_id: Number(item.material_id),
          qty_change: item.qty_change,
          unit_rate: item.unit_rate,
        })),
      });
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["material-stock-adjustments"] });
      void queryClient.invalidateQueries({ queryKey: ["materials"] });
      void queryClient.invalidateQueries({ queryKey: ["materials", "stock-summary"] });
      void queryClient.invalidateQueries({ queryKey: ["stock-ledger"] });
      setServerMessage(
        selectedAdjustment
          ? `${result.adjustment_no} updated and stock correction posture refreshed.`
          : `${result.adjustment_no} created successfully.`,
      );
      setSelectedAdjustmentId(null);
      reset(buildAdjustmentDefaults());
    },
  });

  const filteredAdjustments = useMemo(() => {
    return adjustments.filter((adjustment) => {
      const matchesStatus = statusFilter === "all" || adjustment.status === statusFilter;
      const matchesProject = projectFilter === "all" || adjustment.project_id === Number(projectFilter);
      return matchesStatus && matchesProject;
    });
  }, [adjustments, projectFilter, statusFilter]);

  const metrics = getAdjustmentMetrics(adjustments);
  const canCreate = hasPermissions(user?.role ?? "viewer", ["stock:adjust"]);

  if (adjustmentsQuery.isLoading || materialsQuery.isLoading || projectsQuery.isLoading) {
    return (
      <LoadingState
        title="Loading adjustment workspace"
        description="Pulling correction, damage, and wastage records from the backend."
      />
    );
  }

  if (adjustmentsQuery.error || materialsQuery.error || projectsQuery.error) {
    return (
      <ErrorState
        description={getApiErrorMessage(adjustmentsQuery.error ?? materialsQuery.error ?? projectsQuery.error)}
        onRetry={() => {
          void adjustmentsQuery.refetch();
          void materialsQuery.refetch();
          void projectsQuery.refetch();
        }}
      />
    );
  }

  return (
    <PermissionGate permissions={["material_stock_adjustments:read"]}>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Stock adjustments"
          title="Post corrections, damage, and wastage with full stock impact visibility."
          description="Corrections deserve the same clarity as normal inflow and outflow. This workspace makes sure adjustments stay visible, reviewable, and clearly reasoned."
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Adjustments" value={formatCompactNumber(metrics.total)} caption="All correction records in the current view" icon={Wrench} tone="info" />
          <StatCard label="Posted" value={formatCompactNumber(metrics.posted)} caption="Adjustments already affecting live stock" icon={ScanSearch} tone="success" />
          <StatCard label="Draft" value={formatCompactNumber(metrics.draft)} caption="Corrections still under review" icon={Eye} tone="accent" />
          <StatCard label="Adjustment value" value={formatCurrency(metrics.value)} caption={`Materials under stock stress: ${materials.filter((material) => material.current_stock <= 0).length}`} icon={ShieldAlert} tone="accent" />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
          <div className="space-y-6">
            <Card className="p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className={labelClassName}>Status filter</span>
                  <select className={inputClassName} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                    <option value="all">All statuses</option>
                    <option value="draft">Draft</option>
                    <option value="posted">Posted</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </label>
                <label className="space-y-2">
                  <span className={labelClassName}>Project filter</span>
                  <select className={inputClassName} value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
                    <option value="all">All projects</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </Card>

            {filteredAdjustments.length === 0 ? (
              <EmptyState title="No adjustments in this view" description="Create the first correction record or widen the active filters." />
            ) : (
              filteredAdjustments.map((adjustment) => (
                <Card key={adjustment.id} className="p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-2xl text-[var(--surface-ink)]">{adjustment.adjustment_no}</h3>
                        <Badge tone={operationStatusToneMap[adjustment.status as keyof typeof operationStatusToneMap] ?? "neutral"}>
                          {titleCase(adjustment.status)}
                        </Badge>
                      </div>
                      <div className="grid gap-2 text-sm text-[var(--surface-muted)] md:grid-cols-3">
                        <p>Project: <span className="font-semibold text-[var(--surface-ink)]">{projectMap.get(adjustment.project_id) ?? `Project #${adjustment.project_id}`}</span></p>
                        <p>Reason: <span className="font-semibold text-[var(--surface-ink)]">{adjustment.reason || "Not specified"}</span></p>
                        <p>Total: <span className="font-semibold text-[var(--surface-ink)]">{formatCurrency(adjustment.total_amount)}</span></p>
                      </div>
                      <p className="text-sm leading-6 text-[var(--surface-muted)]">
                        {adjustment.remarks || "No additional remarks yet."}
                      </p>
                    </div>
                    <div className="space-y-3 text-sm text-[var(--surface-muted)]">
                      <p>Dated {formatDate(adjustment.adjustment_date)}</p>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={!canCreate}
                        onClick={() => {
                          setSelectedAdjustmentId(adjustment.id);
                          setServerMessage(null);
                        }}
                      >
                        <Eye className="size-4" />
                        Review
                      </Button>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {adjustment.items.map((item) => {
                      const material = materialMap.get(item.material_id);
                      return (
                        <div key={item.id} className="rounded-[var(--radius)] border border-[color:var(--line)] bg-white/75 p-4">
                          <p className="font-semibold text-[var(--surface-ink)]">{material?.item_name ?? `Material #${item.material_id}`}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.15em] text-[var(--surface-faint)]">{material?.item_code ?? `ID-${item.material_id}`}</p>
                          <div className="mt-3 grid gap-2 text-sm text-[var(--surface-muted)]">
                            <p>Change: <span className="font-semibold text-[var(--surface-ink)]">{item.qty_change > 0 ? "+" : ""}{formatDecimal(item.qty_change)}</span></p>
                            <p>Rate: <span className="font-semibold text-[var(--surface-ink)]">{formatCurrency(item.unit_rate)}</span></p>
                            <p>Amount: <span className="font-semibold text-[var(--surface-ink)]">{formatCurrency(item.line_amount)}</span></p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              ))
            )}
          </div>

          <Card className="h-fit p-6 xl:sticky xl:top-28">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--surface-faint)]">
                  {selectedAdjustment ? "Review adjustment" : "Create adjustment"}
                </p>
                <h3 className="mt-2 text-2xl text-[var(--surface-ink)]">
                  {selectedAdjustment ? selectedAdjustment.adjustment_no : "Post stock correction"}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[var(--surface-muted)]">
                  Positive changes add stock, negative changes reduce it. Backend validation still blocks zero-value changes and negative resulting stock.
                </p>
              </div>
              {selectedAdjustment ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSelectedAdjustmentId(null);
                    setServerMessage(null);
                    reset(buildAdjustmentDefaults());
                  }}
                >
                  New adjustment
                </Button>
              ) : null}
            </div>

            <form
              className="space-y-4"
              onSubmit={handleSubmit(async (values) => {
                setServerMessage(null);
                await adjustmentMutation.mutateAsync(values);
              })}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className={labelClassName}>Adjustment number</span>
                  <input className={inputClassName} {...register("adjustment_no")} />
                  {errors.adjustment_no ? <p className="text-sm text-[var(--danger)]">{errors.adjustment_no.message}</p> : null}
                </label>
                <label className="space-y-2">
                  <span className={labelClassName}>Status</span>
                  <select className={inputClassName} {...register("status")}>
                    {getAdjustmentStatusOptions(selectedAdjustment?.status).map((status) => (
                      <option key={status} value={status}>
                        {titleCase(status)}
                      </option>
                    ))}
                  </select>
                  {errors.status ? <p className="text-sm text-[var(--danger)]">{errors.status.message}</p> : null}
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className={labelClassName}>Project</span>
                  <select className={inputClassName} {...register("project_id")}>
                    <option value="">Select project</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                  {errors.project_id ? <p className="text-sm text-[var(--danger)]">{errors.project_id.message}</p> : null}
                </label>
                <label className="space-y-2">
                  <span className={labelClassName}>Adjustment date</span>
                  <input className={inputClassName} type="date" {...register("adjustment_date")} />
                  {errors.adjustment_date ? <p className="text-sm text-[var(--danger)]">{errors.adjustment_date.message}</p> : null}
                </label>
              </div>

                <label className="space-y-2">
                  <span className={labelClassName}>Reason</span>
                  <input className={inputClassName} {...register("reason")} placeholder="Damage / wastage / count correction / return" />
                  {errors.reason ? <p className="text-sm text-[var(--danger)]">{errors.reason.message}</p> : null}
                </label>

              <label className="space-y-2">
                <span className={labelClassName}>Remarks</span>
                <textarea className={`${inputClassName} min-h-24 resize-none`} {...register("remarks")} placeholder="Supervisor note, investigation detail, or approval context" />
              </label>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className={labelClassName}>Adjustment lines</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={isEditMode}
                    onClick={() => append({ line_id: undefined, material_id: "", qty_change: 1, unit_rate: 0 })}
                  >
                    <Plus className="size-4" />
                    Add line
                  </Button>
                </div>
                {isEditMode ? (
                  <p className="text-sm text-[var(--surface-muted)]">
                    Existing adjustments can update quantity change, rate, and workflow state. Adding or removing lines is locked because the backend update contract accepts existing adjustment items only.
                  </p>
                ) : null}
                {errors.items?.message ? <p className="text-sm text-[var(--danger)]">{errors.items.message}</p> : null}

                {fields.map((field, index) => (
                  <div key={field.id} className="rounded-[var(--radius)] border border-[color:var(--line)] bg-white/75 p-4">
                    <input type="hidden" {...register(`items.${index}.line_id`)} />
                    <div className="grid gap-3 md:grid-cols-[1fr_120px_140px_auto] md:items-end">
                      <label className="space-y-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--surface-faint)]">Material</span>
                        <select className={inputClassName} disabled={isEditMode} {...register(`items.${index}.material_id`)}>
                          <option value="">Select material</option>
                          {materials.map((material) => (
                            <option key={material.id} value={material.id}>
                              {material.item_name} ({material.item_code}) - stock {formatDecimal(material.current_stock)}
                            </option>
                          ))}
                        </select>
                        {errors.items?.[index]?.material_id ? (
                          <p className="text-sm text-[var(--danger)]">{errors.items[index]?.material_id?.message}</p>
                        ) : null}
                      </label>
                      <label className="space-y-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--surface-faint)]">Change</span>
                        <input className={inputClassName} type="number" step="0.01" {...register(`items.${index}.qty_change`, { valueAsNumber: true })} />
                        {errors.items?.[index]?.qty_change ? (
                          <p className="text-sm text-[var(--danger)]">{errors.items[index]?.qty_change?.message}</p>
                        ) : null}
                      </label>
                      <label className="space-y-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--surface-faint)]">Rate</span>
                        <input className={inputClassName} type="number" step="0.01" {...register(`items.${index}.unit_rate`, { valueAsNumber: true })} />
                        {errors.items?.[index]?.unit_rate ? (
                          <p className="text-sm text-[var(--danger)]">{errors.items[index]?.unit_rate?.message}</p>
                        ) : null}
                      </label>
                      <Button type="button" variant="ghost" size="sm" disabled={isEditMode || fields.length === 1} onClick={() => remove(index)}>
                        <Trash2 className="size-4" />
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {serverMessage ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  {serverMessage}
                </div>
              ) : null}
              {adjustmentMutation.error ? (
                <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
                  {getApiErrorMessage(adjustmentMutation.error)}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <Button disabled={isSubmitting || adjustmentMutation.isPending || !canCreate} type="submit">
                  {adjustmentMutation.isPending ? "Saving..." : selectedAdjustment ? "Update adjustment" : "Create adjustment"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setSelectedAdjustmentId(null);
                    setServerMessage(null);
                    reset(buildAdjustmentDefaults());
                  }}
                >
                  Reset form
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </PermissionGate>
  );
}
