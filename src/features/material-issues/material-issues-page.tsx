import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, PackageMinus, Plus, ScrollText, ShieldAlert, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";

import { useAuth } from "@/app/providers/auth-provider";
import { getApiErrorMessage } from "@/api/client";
import { fetchMaterialIssues, createMaterialIssue, updateMaterialIssue } from "@/api/material-issues";
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
  buildIssueDefaults,
  getIssueMetrics,
  getIssueStatusOptions,
  operationStatusToneMap,
} from "@/features/material-operations/material-operations-helpers";

const EMPTY_LIST: never[] = [];
const inputClassName =
  "w-full rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-amber-100";
const labelClassName = "text-sm font-semibold text-[var(--surface-ink)]";

const issueLineSchema = z.object({
  line_id: z.string().optional(),
  material_id: z.string().min(1, "Select a material."),
  qty: z.number().gt(0, "Quantity must be greater than zero."),
  unit_rate: z.number().min(0, "Rate cannot be negative."),
});

const issueFormSchema = z.object({
  issue_no: z.string().min(1, "Issue number is required."),
  project_id: z.string().min(1, "Select a project."),
  issue_date: z.string().min(1, "Issue date is required."),
  status: z.string().min(1, "Status is required."),
  site_name: z.string().optional(),
  activity_name: z.string().optional(),
  remarks: z.string().optional(),
  items: z.array(issueLineSchema).min(1, "Add at least one line."),
});

type IssueFormValues = z.infer<typeof issueFormSchema>;

export default function MaterialIssuesPage() {
  const { accessToken, user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedIssueId, setSelectedIssueId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [serverMessage, setServerMessage] = useState<string | null>(null);

  const issuesQuery = useQuery({
    queryKey: ["material-issues"],
    queryFn: () => fetchMaterialIssues(accessToken ?? ""),
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

  const issues = Array.isArray(issuesQuery.data) ? issuesQuery.data : EMPTY_LIST;
  const materials = Array.isArray(materialsQuery.data) ? materialsQuery.data : EMPTY_LIST;
  const projects = Array.isArray(projectsQuery.data) ? projectsQuery.data : EMPTY_LIST;
  const projectMap = useMemo(() => new Map(projects.map((project) => [project.id, project.name])), [projects]);
  const materialMap = useMemo(() => new Map(materials.map((material) => [material.id, material])), [materials]);
  const selectedIssue = useMemo(() => issues.find((issue) => issue.id === selectedIssueId) ?? null, [issues, selectedIssueId]);
  const isEditMode = Boolean(selectedIssue);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<IssueFormValues>({
    resolver: zodResolver(issueFormSchema),
    defaultValues: buildIssueDefaults(),
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  });

  useEffect(() => {
    if (!selectedIssue) {
      reset(buildIssueDefaults());
      return;
    }

    reset({
      issue_no: selectedIssue.issue_no,
      project_id: String(selectedIssue.project_id),
      issue_date: selectedIssue.issue_date,
      status: selectedIssue.status,
      site_name: selectedIssue.site_name ?? "",
      activity_name: selectedIssue.activity_name ?? "",
      remarks: selectedIssue.remarks ?? "",
      items: selectedIssue.items.map((item) => ({
        line_id: String(item.id),
        material_id: String(item.material_id),
        qty: item.issued_qty,
        unit_rate: item.unit_rate,
      })),
    });
  }, [reset, selectedIssue]);

  const issueMutation = useMutation({
    mutationFn: async (values: IssueFormValues) => {
      if (selectedIssue && values.items.some((item) => !item.line_id)) {
        throw new Error("Existing issues only support updating current lines. Create a new issue note for additional items.");
      }

      const payload = {
        issue_no: values.issue_no.trim(),
        project_id: Number(values.project_id),
        issue_date: values.issue_date,
        status: values.status,
        site_name: values.site_name?.trim() || null,
        activity_name: values.activity_name?.trim() || null,
        remarks: values.remarks?.trim() || null,
      };

      if (selectedIssue) {
        return updateMaterialIssue(accessToken ?? "", selectedIssue.id, {
          ...payload,
          items: values.items.map((item) => ({
            id: Number(item.line_id),
            issued_qty: item.qty,
            unit_rate: item.unit_rate,
          })),
        });
      }

      return createMaterialIssue(accessToken ?? "", {
        ...payload,
        items: values.items.map((item) => ({
          material_id: Number(item.material_id),
          issued_qty: item.qty,
          unit_rate: item.unit_rate,
        })),
      });
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["material-issues"] });
      void queryClient.invalidateQueries({ queryKey: ["materials"] });
      void queryClient.invalidateQueries({ queryKey: ["materials", "stock-summary"] });
      void queryClient.invalidateQueries({ queryKey: ["stock-ledger"] });
      setServerMessage(
        selectedIssue
          ? `${result.issue_no} updated and stock issue posture refreshed.`
          : `${result.issue_no} created successfully.`,
      );
      setSelectedIssueId(null);
      reset(buildIssueDefaults());
    },
  });

  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      const matchesStatus = statusFilter === "all" || issue.status === statusFilter;
      const matchesProject = projectFilter === "all" || issue.project_id === Number(projectFilter);
      return matchesStatus && matchesProject;
    });
  }, [issues, projectFilter, statusFilter]);

  const metrics = getIssueMetrics(issues);
  const canCreate = hasPermissions(user?.role ?? "viewer", ["stock:issue"]);

  if (issuesQuery.isLoading || materialsQuery.isLoading || projectsQuery.isLoading) {
    return (
      <LoadingState
        title="Loading issue workspace"
        description="Pulling project, material, and issue consumption data from the backend."
      />
    );
  }

  if (issuesQuery.error || materialsQuery.error || projectsQuery.error) {
    return (
      <ErrorState
        description={getApiErrorMessage(issuesQuery.error ?? materialsQuery.error ?? projectsQuery.error)}
        onRetry={() => {
          void issuesQuery.refetch();
          void materialsQuery.refetch();
          void projectsQuery.refetch();
        }}
      />
    );
  }

  return (
    <PermissionGate permissions={["material_issues:read"]}>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Material issues"
          title="Push stock to site consumption with clear operational context."
          description="Issue flow should feel deliberate: where material went, why it moved, and how much value left the store. This workspace keeps those answers visible."
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Issues" value={formatCompactNumber(metrics.total)} caption="Total outward records in the current view" icon={ScrollText} tone="info" />
          <StatCard label="Issued" value={formatCompactNumber(metrics.issued)} caption="Stock already consumed from stores" icon={PackageMinus} tone="success" />
          <StatCard label="Draft" value={formatCompactNumber(metrics.draft)} caption="Planned issues awaiting final post" icon={Eye} tone="accent" />
          <StatCard label="Issue value" value={formatCurrency(metrics.value)} caption={`Materials at zero or below reorder: ${materials.filter((material) => material.current_stock <= material.reorder_level && material.reorder_level > 0).length}`} icon={ShieldAlert} tone="accent" />
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
                    <option value="issued">Issued</option>
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

            {filteredIssues.length === 0 ? (
              <EmptyState title="No issues in this view" description="Create the first issue note or widen the current filters." />
            ) : (
              filteredIssues.map((issue) => (
                <Card key={issue.id} className="p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-2xl text-[var(--surface-ink)]">{issue.issue_no}</h3>
                        <Badge tone={operationStatusToneMap[issue.status as keyof typeof operationStatusToneMap] ?? "neutral"}>
                          {titleCase(issue.status)}
                        </Badge>
                      </div>
                      <div className="grid gap-2 text-sm text-[var(--surface-muted)] md:grid-cols-3">
                        <p>Project: <span className="font-semibold text-[var(--surface-ink)]">{projectMap.get(issue.project_id) ?? `Project #${issue.project_id}`}</span></p>
                        <p>Site: <span className="font-semibold text-[var(--surface-ink)]">{issue.site_name || "Not tagged"}</span></p>
                        <p>Total: <span className="font-semibold text-[var(--surface-ink)]">{formatCurrency(issue.total_amount)}</span></p>
                      </div>
                      <p className="text-sm leading-6 text-[var(--surface-muted)]">
                        {issue.activity_name ? `Activity: ${issue.activity_name}` : issue.remarks || "No additional remarks yet."}
                      </p>
                    </div>
                    <div className="space-y-3 text-sm text-[var(--surface-muted)]">
                      <p>Dated {formatDate(issue.issue_date)}</p>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={!canCreate}
                        onClick={() => {
                          setSelectedIssueId(issue.id);
                          setServerMessage(null);
                        }}
                      >
                        <Eye className="size-4" />
                        Review
                      </Button>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {issue.items.map((item) => {
                      const material = materialMap.get(item.material_id);
                      return (
                        <div key={item.id} className="rounded-[var(--radius)] border border-[color:var(--line)] bg-white/75 p-4">
                          <p className="font-semibold text-[var(--surface-ink)]">{material?.item_name ?? `Material #${item.material_id}`}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.15em] text-[var(--surface-faint)]">{material?.item_code ?? `ID-${item.material_id}`}</p>
                          <div className="mt-3 grid gap-2 text-sm text-[var(--surface-muted)]">
                            <p>Qty: <span className="font-semibold text-[var(--surface-ink)]">{formatDecimal(item.issued_qty)}</span></p>
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
                  {selectedIssue ? "Review issue" : "Create issue"}
                </p>
                <h3 className="mt-2 text-2xl text-[var(--surface-ink)]">
                  {selectedIssue ? selectedIssue.issue_no : "Issue stock to site"}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[var(--surface-muted)]">
                  Use draft for preparation and issued for live stock movement. Backend rules still block negative stock and invalid transitions.
                </p>
              </div>
              {selectedIssue ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSelectedIssueId(null);
                    setServerMessage(null);
                    reset(buildIssueDefaults());
                  }}
                >
                  New issue
                </Button>
              ) : null}
            </div>

            <form
              className="space-y-4"
              onSubmit={handleSubmit(async (values) => {
                setServerMessage(null);
                await issueMutation.mutateAsync(values);
              })}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className={labelClassName}>Issue number</span>
                  <input className={inputClassName} {...register("issue_no")} />
                  {errors.issue_no ? <p className="text-sm text-[var(--danger)]">{errors.issue_no.message}</p> : null}
                </label>
                <label className="space-y-2">
                  <span className={labelClassName}>Status</span>
                  <select className={inputClassName} {...register("status")}>
                    {getIssueStatusOptions(selectedIssue?.status).map((status) => (
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
                  <span className={labelClassName}>Issue date</span>
                  <input className={inputClassName} type="date" {...register("issue_date")} />
                  {errors.issue_date ? <p className="text-sm text-[var(--danger)]">{errors.issue_date.message}</p> : null}
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className={labelClassName}>Site name</span>
                  <input className={inputClassName} {...register("site_name")} placeholder="Tower A / Block B / Basement" />
                </label>
                <label className="space-y-2">
                  <span className={labelClassName}>Activity</span>
                  <input className={inputClassName} {...register("activity_name")} placeholder="Slab casting / shuttering / finishing" />
                </label>
              </div>

              <label className="space-y-2">
                <span className={labelClassName}>Remarks</span>
                <textarea className={`${inputClassName} min-h-24 resize-none`} {...register("remarks")} placeholder="Consumption note, crew request, or supervisor context" />
              </label>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className={labelClassName}>Issue lines</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={isEditMode}
                    onClick={() => append({ line_id: undefined, material_id: "", qty: 1, unit_rate: 0 })}
                  >
                    <Plus className="size-4" />
                    Add line
                  </Button>
                </div>
                {isEditMode ? (
                  <p className="text-sm text-[var(--surface-muted)]">
                    Existing issues can update quantity, rate, and workflow state. Adding or removing lines is locked because the backend update contract accepts existing issue items only.
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
                        <span className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--surface-faint)]">Qty</span>
                        <input className={inputClassName} type="number" step="0.01" {...register(`items.${index}.qty`, { valueAsNumber: true })} />
                        {errors.items?.[index]?.qty ? (
                          <p className="text-sm text-[var(--danger)]">{errors.items[index]?.qty?.message}</p>
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
              {issueMutation.error ? (
                <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
                  {getApiErrorMessage(issueMutation.error)}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <Button disabled={isSubmitting || issueMutation.isPending || !canCreate} type="submit">
                  {issueMutation.isPending ? "Saving..." : selectedIssue ? "Update issue" : "Create issue"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setSelectedIssueId(null);
                    setServerMessage(null);
                    reset(buildIssueDefaults());
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
