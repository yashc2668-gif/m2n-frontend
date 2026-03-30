import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Boxes, CheckCheck, ClipboardCheck, ListFilter, Plus, Send, Trash2, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { z } from "zod";

import { useAuth } from "@/app/providers/auth-provider";
import {
  approveMaterialRequisition,
  createMaterialRequisition,
  fetchMaterialRequisitions,
  rejectMaterialRequisition,
  submitMaterialRequisition,
} from "@/api/material-requisitions";
import { getApiErrorMessage } from "@/api/client";
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
import { formatCompactNumber, formatDate, formatDecimal, titleCase } from "@/lib/format";
import { hasPermissions } from "@/lib/permissions";
import {
  buildRequisitionDefaults,
  canApproveRequisition,
  canSubmitRequisition,
  getRequisitionCounts,
} from "@/features/materials/materials-helpers";

const requisitionFormSchema = z.object({
  requisition_no: z.string().min(1, "Requisition number is required."),
  project_id: z.string().min(1, "Select a project."),
  remarks: z.string().optional(),
  items: z.array(
    z.object({
      material_id: z.string().min(1, "Select a material."),
      requested_qty: z.number().gt(0, "Quantity must be greater than zero."),
    }),
  ).min(1, "Add at least one material line."),
});

type RequisitionFormValues = z.infer<typeof requisitionFormSchema>;

const inputClassName =
  "w-full rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-amber-100";
const labelClassName = "text-sm font-semibold text-[var(--surface-ink)]";
const statusToneMap = {
  draft: "neutral",
  submitted: "info",
  approved: "success",
  partially_issued: "warning",
  issued: "accent",
  rejected: "danger",
  cancelled: "neutral",
} as const;
const EMPTY_LIST: never[] = [];

export default function MaterialRequisitionsPage() {
  const { accessToken, user } = useAuth();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [serverMessage, setServerMessage] = useState<string | null>(null);

  const requisitionsQuery = useQuery({
    queryKey: ["material-requisitions"],
    queryFn: () => fetchMaterialRequisitions(accessToken ?? ""),
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

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RequisitionFormValues>({
    resolver: zodResolver(requisitionFormSchema),
    defaultValues: buildRequisitionDefaults(),
  });
  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  });

  const requisitions = requisitionsQuery.data ?? EMPTY_LIST;
  const materials = materialsQuery.data ?? EMPTY_LIST;
  const projects = projectsQuery.data ?? EMPTY_LIST;
  const projectMap = useMemo(() => new Map(projects.map((project) => [project.id, project.name])), [projects]);
  const materialMap = useMemo(() => new Map(materials.map((material) => [material.id, material])), [materials]);

  const createMutation = useMutation({
    mutationFn: (values: RequisitionFormValues) =>
      createMaterialRequisition(accessToken ?? "", {
        requisition_no: values.requisition_no.trim(),
        project_id: Number(values.project_id),
        remarks: values.remarks?.trim() || null,
        items: values.items.map((item) => ({
          material_id: Number(item.material_id),
          requested_qty: item.requested_qty,
        })),
      }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["material-requisitions"] });
      setServerMessage(`${result.requisition_no} created successfully.`);
      reset(buildRequisitionDefaults());
    },
  });

  const submitMutation = useMutation({
    mutationFn: (requisitionId: number) => submitMaterialRequisition(accessToken ?? "", requisitionId),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["material-requisitions"] });
      setServerMessage(`${result.requisition_no} moved to submitted.`);
    },
  });

  const approveMutation = useMutation({
    mutationFn: (requisitionId: number) => {
      const requisition = requisitions.find((item) => item.id === requisitionId);
      if (!requisition) {
        throw new Error("Requisition not found.");
      }
      return approveMaterialRequisition(accessToken ?? "", requisitionId, {
        items: requisition.items.map((item) => ({
          id: item.id,
          approved_qty: item.requested_qty,
        })),
      });
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["material-requisitions"] });
      setServerMessage(`${result.requisition_no} approved as requested.`);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (requisitionId: number) => rejectMaterialRequisition(accessToken ?? "", requisitionId),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["material-requisitions"] });
      setServerMessage(`${result.requisition_no} rejected.`);
    },
  });

  const filteredRequisitions = useMemo(() => {
    return requisitions.filter((requisition) => {
      const matchesStatus = statusFilter === "all" || requisition.status === statusFilter;
      const matchesProject = projectFilter === "all" || requisition.project_id === Number(projectFilter);
      return matchesStatus && matchesProject;
    });
  }, [projectFilter, requisitions, statusFilter]);

  const counts = getRequisitionCounts(requisitions);
  const canCreate = hasPermissions(user?.role ?? "viewer", ["requisitions:create"]);
  const canApprove = hasPermissions(user?.role ?? "viewer", ["requisitions:approve"]);

  if (requisitionsQuery.isLoading || materialsQuery.isLoading || projectsQuery.isLoading) {
    return <LoadingState title="Loading requisition workflow" description="Pulling projects, materials, and requisition workflow state from the backend." />;
  }

  if (requisitionsQuery.error || materialsQuery.error || projectsQuery.error) {
    return (
      <ErrorState
        description={getApiErrorMessage(requisitionsQuery.error ?? materialsQuery.error ?? projectsQuery.error)}
        onRetry={() => {
          void requisitionsQuery.refetch();
          void materialsQuery.refetch();
          void projectsQuery.refetch();
        }}
      />
    );
  }

  return (
    <PermissionGate permissions={["material_requisitions:read"]}>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Material requisitions"
          title="Run request, submit, and approval flow from one focused workspace."
          description="This is the first workflow surface after material master. Site demand can be raised, reviewed, and pushed forward here without breaking backend status rules."
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total requisitions" value={formatCompactNumber(counts.total ?? 0)} caption="All requests currently visible" icon={ClipboardCheck} tone="info" />
          <StatCard label="Draft" value={formatCompactNumber(counts.draft ?? 0)} caption="Requests still being prepared" icon={ListFilter} tone="accent" />
          <StatCard label="Submitted" value={formatCompactNumber(counts.submitted ?? 0)} caption="Waiting on approval review" icon={Send} tone="success" />
          <StatCard label="Approved + issued" value={formatCompactNumber((counts.approved ?? 0) + (counts.partially_issued ?? 0) + (counts.issued ?? 0))} caption="Requests already flowing into stock issue" icon={CheckCheck} tone="accent" />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
          <div className="space-y-6">
            <Card className="p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className={labelClassName}>Status filter</span>
                  <select className={inputClassName} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                    <option value="all">All statuses</option>
                    {Object.keys(statusToneMap).map((status) => (
                      <option key={status} value={status}>
                        {titleCase(status)}
                      </option>
                    ))}
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

            {filteredRequisitions.length === 0 ? (
              <EmptyState title="No requisitions in this view" description="Create the first request or widen the filters to see more workflow activity." />
            ) : (
              filteredRequisitions.map((requisition) => {
                const totalRequested = requisition.items.reduce((sum, item) => sum + item.requested_qty, 0);
                return (
                  <Card key={requisition.id} className="p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="text-2xl text-[var(--surface-ink)]">{requisition.requisition_no}</h3>
                          <Badge tone={statusToneMap[requisition.status as keyof typeof statusToneMap] ?? "neutral"}>
                            {titleCase(requisition.status)}
                          </Badge>
                        </div>
                        <div className="grid gap-2 text-sm text-[var(--surface-muted)] md:grid-cols-3">
                          <p>Project: <span className="font-semibold text-[var(--surface-ink)]">{projectMap.get(requisition.project_id) ?? `Project #${requisition.project_id}`}</span></p>
                          <p>Items: <span className="font-semibold text-[var(--surface-ink)]">{requisition.items.length}</span></p>
                          <p>Requested qty: <span className="font-semibold text-[var(--surface-ink)]">{formatDecimal(totalRequested)}</span></p>
                        </div>
                        <p className="text-sm leading-6 text-[var(--surface-muted)]">
                          {requisition.remarks || "No remarks added yet."}
                        </p>
                      </div>
                      <div className="space-y-3 text-sm text-[var(--surface-muted)]">
                        <p>Created {formatDate(requisition.created_at)}</p>
                        <div className="flex flex-wrap gap-2 lg:justify-end">
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={!canCreate || !canSubmitRequisition(requisition) || submitMutation.isPending}
                            onClick={() => {
                              setServerMessage(null);
                              submitMutation.mutate(requisition.id);
                            }}
                          >
                            <Send className="size-4" />
                            Submit
                          </Button>
                          <Button
                            size="sm"
                            disabled={!canApprove || !canApproveRequisition(requisition) || approveMutation.isPending}
                            onClick={() => {
                              setServerMessage(null);
                              approveMutation.mutate(requisition.id);
                            }}
                          >
                            <CheckCheck className="size-4" />
                            Approve as requested
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={!canApprove || !canApproveRequisition(requisition) || rejectMutation.isPending}
                            onClick={() => {
                              setServerMessage(null);
                              rejectMutation.mutate(requisition.id);
                            }}
                          >
                            <XCircle className="size-4" />
                            Reject
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {requisition.items.map((item) => {
                        const material = materialMap.get(item.material_id);
                        return (
                          <div key={item.id} className="rounded-[var(--radius)] border border-[color:var(--line)] bg-white/75 p-4">
                            <p className="font-semibold text-[var(--surface-ink)]">{material?.item_name ?? `Material #${item.material_id}`}</p>
                            <p className="mt-1 text-xs uppercase tracking-[0.15em] text-[var(--surface-faint)]">{material?.item_code ?? `ID-${item.material_id}`}</p>
                            <div className="mt-3 grid gap-2 text-sm text-[var(--surface-muted)]">
                              <p>Requested: <span className="font-semibold text-[var(--surface-ink)]">{formatDecimal(item.requested_qty)}</span></p>
                              <p>Approved: <span className="font-semibold text-[var(--surface-ink)]">{formatDecimal(item.approved_qty)}</span></p>
                              <p>Issued: <span className="font-semibold text-[var(--surface-ink)]">{formatDecimal(item.issued_qty)}</span></p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                );
              })
            )}
          </div>

          <Card className="h-fit p-6 xl:sticky xl:top-28">
            <div className="mb-5 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--surface-faint)]">Create requisition</p>
              <h3 className="text-2xl text-[var(--surface-ink)]">Raise site demand with proper material lines.</h3>
              <p className="text-sm leading-6 text-[var(--surface-muted)]">
                The backend still validates project scope, duplicate materials, and workflow state. This panel keeps the operator flow fast without bypassing those rules.
              </p>
            </div>

            <form
              className="space-y-4"
              onSubmit={handleSubmit(async (values) => {
                setServerMessage(null);
                await createMutation.mutateAsync(values);
              })}
            >
              <label className="space-y-2">
                <span className={labelClassName}>Requisition number</span>
                <input className={inputClassName} {...register("requisition_no")} />
                {errors.requisition_no ? <p className="text-sm text-[var(--danger)]">{errors.requisition_no.message}</p> : null}
              </label>

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
                <span className={labelClassName}>Remarks</span>
                <textarea className={`${inputClassName} min-h-24 resize-none`} {...register("remarks")} placeholder="Site need, urgency, or activity context" />
              </label>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className={labelClassName}>Material lines</span>
                  <Button type="button" size="sm" variant="secondary" onClick={() => append({ material_id: "", requested_qty: 1 })}>
                    <Plus className="size-4" />
                    Add line
                  </Button>
                </div>

                {fields.map((field, index) => (
                  <div key={field.id} className="rounded-[var(--radius)] border border-[color:var(--line)] bg-white/75 p-4">
                    <div className="grid gap-3 md:grid-cols-[1fr_150px_auto] md:items-end">
                      <label className="space-y-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--surface-faint)]">Material</span>
                        <select className={inputClassName} {...register(`items.${index}.material_id`)}>
                          <option value="">Select material</option>
                          {materials.map((material) => (
                            <option key={material.id} value={material.id}>
                              {material.item_name} ({material.item_code})
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--surface-faint)]">Qty</span>
                        <input className={inputClassName} type="number" step="0.01" {...register(`items.${index}.requested_qty`, { valueAsNumber: true })} />
                      </label>
                      <Button type="button" variant="ghost" size="sm" disabled={fields.length === 1} onClick={() => remove(index)}>
                        <Trash2 className="size-4" />
                        Remove
                      </Button>
                    </div>
                    {errors.items?.[index]?.material_id ? <p className="mt-2 text-sm text-[var(--danger)]">{errors.items[index]?.material_id?.message}</p> : null}
                    {errors.items?.[index]?.requested_qty ? <p className="mt-2 text-sm text-[var(--danger)]">{errors.items[index]?.requested_qty?.message}</p> : null}
                  </div>
                ))}
              </div>

              {serverMessage ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  {serverMessage}
                </div>
              ) : null}
              {createMutation.error || submitMutation.error || approveMutation.error || rejectMutation.error ? (
                <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
                  {getApiErrorMessage(createMutation.error ?? submitMutation.error ?? approveMutation.error ?? rejectMutation.error)}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <Button disabled={!canCreate || isSubmitting || createMutation.isPending} type="submit">
                  <Boxes className="size-4" />
                  {createMutation.isPending ? "Creating..." : "Create requisition"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setServerMessage(null);
                    reset(buildRequisitionDefaults());
                  }}
                >
                  Reset draft
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </PermissionGate>
  );
}
