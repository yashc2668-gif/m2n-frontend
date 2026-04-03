import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCheck, Eye, PackagePlus, Plus, ReceiptText, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";

import { useAuth } from "@/app/providers/auth-provider";
import { getApiErrorMessage } from "@/api/client";
import { fetchMaterialReceipts, createMaterialReceipt, updateMaterialReceipt } from "@/api/material-receipts";
import { fetchMaterials, fetchMaterialStockSummary } from "@/api/materials";
import { fetchProjects } from "@/api/projects";
import { fetchVendors } from "@/api/vendors";
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
  buildReceiptDefaults,
  getReceiptMetrics,
  getReceiptStatusOptions,
  operationStatusToneMap,
} from "@/features/material-operations/material-operations-helpers";

const EMPTY_LIST: never[] = [];
const inputClassName =
  "w-full rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-amber-100";
const labelClassName = "text-sm font-semibold text-[var(--surface-ink)]";

const receiptLineSchema = z.object({
  line_id: z.string().optional(),
  material_id: z.string().min(1, "Select a material."),
  qty: z.number().gt(0, "Quantity must be greater than zero."),
  unit_rate: z.number().min(0, "Rate cannot be negative."),
});

const receiptFormSchema = z.object({
  receipt_no: z.string().min(1, "Receipt number is required."),
  vendor_id: z.string().min(1, "Select a vendor."),
  project_id: z.string().min(1, "Select a project."),
  receipt_date: z.string().min(1, "Receipt date is required."),
  status: z.string().min(1, "Status is required."),
  remarks: z.string().optional(),
  items: z.array(receiptLineSchema).min(1, "Add at least one line."),
});

type ReceiptFormValues = z.infer<typeof receiptFormSchema>;

export default function MaterialReceiptsPage() {
  const { accessToken, user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedReceiptId, setSelectedReceiptId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [serverMessage, setServerMessage] = useState<string | null>(null);

  const receiptsQuery = useQuery({
    queryKey: ["material-receipts"],
    queryFn: () => fetchMaterialReceipts(accessToken ?? ""),
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
  const vendorsQuery = useQuery({
    queryKey: ["vendors", "suppliers"],
    queryFn: () => fetchVendors(accessToken ?? ""),
    enabled: Boolean(accessToken),
  });
  const stockSummaryQuery = useQuery({
    queryKey: ["materials", "stock-summary"],
    queryFn: () => fetchMaterialStockSummary(accessToken ?? ""),
    enabled: Boolean(accessToken),
  });

  const receipts = Array.isArray(receiptsQuery.data) ? receiptsQuery.data : EMPTY_LIST;
  const materials = Array.isArray(materialsQuery.data) ? materialsQuery.data : EMPTY_LIST;
  const projects = Array.isArray(projectsQuery.data) ? projectsQuery.data : EMPTY_LIST;
  const vendors = Array.isArray(vendorsQuery.data) ? vendorsQuery.data : EMPTY_LIST;
  const stockSummary = Array.isArray(stockSummaryQuery.data) ? stockSummaryQuery.data : EMPTY_LIST;

  const projectMap = useMemo(() => new Map(projects.map((project) => [project.id, project.name])), [projects]);
  const vendorMap = useMemo(() => new Map(vendors.map((vendor) => [vendor.id, vendor.name])), [vendors]);
  const materialMap = useMemo(() => new Map(materials.map((material) => [material.id, material])), [materials]);
  const selectedReceipt = useMemo(
    () => receipts.find((receipt) => receipt.id === selectedReceiptId) ?? null,
    [receipts, selectedReceiptId],
  );
  const isEditMode = Boolean(selectedReceipt);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ReceiptFormValues>({
    resolver: zodResolver(receiptFormSchema),
    defaultValues: buildReceiptDefaults(),
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  });

  useEffect(() => {
    if (!selectedReceipt) {
      reset(buildReceiptDefaults());
      return;
    }

    reset({
      receipt_no: selectedReceipt.receipt_no,
      vendor_id: String(selectedReceipt.vendor_id),
      project_id: String(selectedReceipt.project_id),
      receipt_date: selectedReceipt.receipt_date,
      status: selectedReceipt.status,
      remarks: selectedReceipt.remarks ?? "",
      items: selectedReceipt.items.map((item) => ({
        line_id: String(item.id),
        material_id: String(item.material_id),
        qty: item.received_qty,
        unit_rate: item.unit_rate,
      })),
    });
  }, [reset, selectedReceipt]);

  const receiptMutation = useMutation({
    mutationFn: async (values: ReceiptFormValues) => {
      if (selectedReceipt && values.items.some((item) => !item.line_id)) {
        throw new Error("Existing receipts only support updating current lines. Create a new receipt for additional items.");
      }

      const payload = {
        receipt_no: values.receipt_no.trim(),
        vendor_id: Number(values.vendor_id),
        project_id: Number(values.project_id),
        receipt_date: values.receipt_date,
        status: values.status,
        remarks: values.remarks?.trim() || null,
      };

      if (selectedReceipt) {
        return updateMaterialReceipt(accessToken ?? "", selectedReceipt.id, {
          ...payload,
          items: values.items.map((item) => ({
            id: Number(item.line_id),
            received_qty: item.qty,
            unit_rate: item.unit_rate,
          })),
        });
      }

      return createMaterialReceipt(accessToken ?? "", {
        ...payload,
        items: values.items.map((item) => ({
          material_id: Number(item.material_id),
          received_qty: item.qty,
          unit_rate: item.unit_rate,
        })),
      });
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["material-receipts"] });
      void queryClient.invalidateQueries({ queryKey: ["materials"] });
      void queryClient.invalidateQueries({ queryKey: ["materials", "stock-summary"] });
      void queryClient.invalidateQueries({ queryKey: ["stock-ledger"] });
      setServerMessage(
        selectedReceipt
          ? `${result.receipt_no} updated and stock posture refreshed.`
          : `${result.receipt_no} created successfully.`,
      );
      setSelectedReceiptId(null);
      reset(buildReceiptDefaults());
    },
  });

  const filteredReceipts = useMemo(() => {
    return receipts.filter((receipt) => {
      const matchesStatus = statusFilter === "all" || receipt.status === statusFilter;
      const matchesProject = projectFilter === "all" || receipt.project_id === Number(projectFilter);
      return matchesStatus && matchesProject;
    });
  }, [projectFilter, receipts, statusFilter]);

  const metrics = getReceiptMetrics(receipts);
  const canCreate = hasPermissions(user?.role ?? "viewer", ["receipts:create"]);
  const canUpdate = hasPermissions(user?.role ?? "viewer", ["material_receipts:update"]);

  if (
    receiptsQuery.isLoading ||
    materialsQuery.isLoading ||
    projectsQuery.isLoading ||
    vendorsQuery.isLoading ||
    stockSummaryQuery.isLoading
  ) {
    return (
      <LoadingState
        title="Loading inward stock workspace"
        description="Pulling suppliers, projects, material master, and receipt history from the backend."
      />
    );
  }

  if (
    receiptsQuery.error ||
    materialsQuery.error ||
    projectsQuery.error ||
    vendorsQuery.error ||
    stockSummaryQuery.error
  ) {
    return (
      <ErrorState
        description={getApiErrorMessage(
          receiptsQuery.error ??
            materialsQuery.error ??
            projectsQuery.error ??
            vendorsQuery.error ??
            stockSummaryQuery.error,
        )}
        onRetry={() => {
          void receiptsQuery.refetch();
          void materialsQuery.refetch();
          void projectsQuery.refetch();
          void vendorsQuery.refetch();
          void stockSummaryQuery.refetch();
        }}
      />
    );
  }

  return (
    <PermissionGate permissions={["material_receipts:read"]}>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Material receipts"
          title="Capture inward stock with supplier, project, and line-level rate context."
          description="A strong material system gets real when inward stock is recorded cleanly. This page gives us that operational grip, while still respecting backend workflow and stock rules."
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Receipts" value={formatCompactNumber(metrics.total)} caption="Total records in the current control view" icon={ReceiptText} tone="info" />
          <StatCard label="Received" value={formatCompactNumber(metrics.received)} caption="Receipts already affecting live stock" icon={CheckCheck} tone="success" />
          <StatCard label="Draft" value={formatCompactNumber(metrics.draft)} caption="Inward records still under preparation" icon={Eye} tone="accent" />
          <StatCard label="Receipt value" value={formatCurrency(metrics.value)} caption={`Current stock across visible scopes ${formatDecimal(stockSummary.reduce((sum, item) => sum + item.total_stock, 0))}`} icon={PackagePlus} tone="accent" />
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
                    <option value="received">Received</option>
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

            {filteredReceipts.length === 0 ? (
              <EmptyState title="No receipts in this view" description="Create the first inward stock record or widen the current filters." />
            ) : (
              filteredReceipts.map((receipt) => (
                <Card key={receipt.id} className="p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-2xl text-[var(--surface-ink)]">{receipt.receipt_no}</h3>
                        <Badge tone={operationStatusToneMap[receipt.status as keyof typeof operationStatusToneMap] ?? "neutral"}>
                          {titleCase(receipt.status)}
                        </Badge>
                      </div>
                      <div className="grid gap-2 text-sm text-[var(--surface-muted)] md:grid-cols-3">
                        <p>Vendor: <span className="font-semibold text-[var(--surface-ink)]">{vendorMap.get(receipt.vendor_id) ?? `Vendor #${receipt.vendor_id}`}</span></p>
                        <p>Project: <span className="font-semibold text-[var(--surface-ink)]">{projectMap.get(receipt.project_id) ?? `Project #${receipt.project_id}`}</span></p>
                        <p>Total: <span className="font-semibold text-[var(--surface-ink)]">{formatCurrency(receipt.total_amount)}</span></p>
                      </div>
                      <p className="text-sm leading-6 text-[var(--surface-muted)]">
                        {receipt.remarks || "No remarks added yet."}
                      </p>
                    </div>
                    <div className="space-y-3 text-sm text-[var(--surface-muted)]">
                      <p>Dated {formatDate(receipt.receipt_date)}</p>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={!canUpdate}
                        onClick={() => {
                          setSelectedReceiptId(receipt.id);
                          setServerMessage(null);
                        }}
                      >
                        <Eye className="size-4" />
                        Review
                      </Button>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {receipt.items.map((item) => {
                      const material = materialMap.get(item.material_id);
                      return (
                        <div key={item.id} className="rounded-[var(--radius)] border border-[color:var(--line)] bg-white/75 p-4">
                          <p className="font-semibold text-[var(--surface-ink)]">{material?.item_name ?? `Material #${item.material_id}`}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.15em] text-[var(--surface-faint)]">{material?.item_code ?? `ID-${item.material_id}`}</p>
                          <div className="mt-3 grid gap-2 text-sm text-[var(--surface-muted)]">
                            <p>Qty: <span className="font-semibold text-[var(--surface-ink)]">{formatDecimal(item.received_qty)}</span></p>
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
                  {selectedReceipt ? "Review receipt" : "Create receipt"}
                </p>
                <h3 className="mt-2 text-2xl text-[var(--surface-ink)]">
                  {selectedReceipt ? selectedReceipt.receipt_no : "Capture inward stock"}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[var(--surface-muted)]">
                  Every line here can move stock and ledger position, so this panel stays tightly aligned with backend validation.
                </p>
              </div>
              {selectedReceipt ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSelectedReceiptId(null);
                    setServerMessage(null);
                    reset(buildReceiptDefaults());
                  }}
                >
                  New receipt
                </Button>
              ) : null}
            </div>

            <form
              className="space-y-4"
              onSubmit={handleSubmit(async (values) => {
                setServerMessage(null);
                await receiptMutation.mutateAsync(values);
              })}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className={labelClassName}>Receipt number</span>
                  <input className={inputClassName} {...register("receipt_no")} />
                  {errors.receipt_no ? <p className="text-sm text-[var(--danger)]">{errors.receipt_no.message}</p> : null}
                </label>
                <label className="space-y-2">
                  <span className={labelClassName}>Status</span>
                  <select className={inputClassName} {...register("status")}>
                    {getReceiptStatusOptions(selectedReceipt?.status).map((status) => (
                      <option key={status} value={status}>
                        {titleCase(status)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className={labelClassName}>Vendor</span>
                  <select className={inputClassName} {...register("vendor_id")}>
                    <option value="">Select vendor</option>
                    {vendors.map((vendor) => (
                      <option key={vendor.id} value={vendor.id}>
                        {vendor.name}
                      </option>
                    ))}
                  </select>
                  {errors.vendor_id ? <p className="text-sm text-[var(--danger)]">{errors.vendor_id.message}</p> : null}
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
              </div>

              <label className="space-y-2">
                <span className={labelClassName}>Receipt date</span>
                <input className={inputClassName} type="date" {...register("receipt_date")} />
              </label>

              <label className="space-y-2">
                <span className={labelClassName}>Remarks</span>
                <textarea className={`${inputClassName} min-h-24 resize-none`} {...register("remarks")} placeholder="Transport note, supplier dispatch, or receiving context" />
              </label>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className={labelClassName}>Receipt lines</span>
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
                    Existing receipts can adjust quantity, rate, and status. Line addition or removal stays locked because the current backend update contract only accepts existing receipt items.
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
                              {material.item_name} ({material.item_code})
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
              {receiptMutation.error ? (
                <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
                  {getApiErrorMessage(receiptMutation.error)}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <Button disabled={isSubmitting || receiptMutation.isPending || (!selectedReceipt && !canCreate) || (Boolean(selectedReceipt) && !canUpdate)} type="submit">
                  {receiptMutation.isPending ? "Saving..." : selectedReceipt ? "Update receipt" : "Create receipt"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setSelectedReceiptId(null);
                    setServerMessage(null);
                    reset(buildReceiptDefaults());
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
