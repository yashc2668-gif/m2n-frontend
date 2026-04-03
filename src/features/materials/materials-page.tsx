import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  Boxes,
  Building2,
  ClipboardCheck,
  Package,
  PencilLine,
  Search,
  Sparkles,
  WalletCards,
} from "lucide-react";
import { useDeferredValue, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useAuth } from "@/app/providers/auth-provider";
import { fetchCompanies } from "@/api/companies";
import { getApiErrorMessage } from "@/api/client";
import {
  createMaterial,
  exportMaterials,
  fetchMaterials,
  fetchMaterialsPage,
  fetchMaterialStockSummary,
  updateMaterial,
} from "@/api/materials";
import { fetchProjects } from "@/api/projects";
import type { Company, Material } from "@/api/types";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { PageSkeleton } from "@/components/feedback/skeleton";
import { PermissionGate } from "@/components/shell/permission-gate";
import { Badge } from "@/components/ui/badge";
import { buttonVariants, Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { formatCompactNumber, formatCurrency, formatDecimal, titleCase } from "@/lib/format";
import { saveBlob } from "@/lib/download";
import { hasPermissions } from "@/lib/permissions";
import { useKeyboardShortcuts } from "@/lib/use-keyboard-shortcuts";
import { buildMaterialFormDefaults, getMaterialAttention } from "@/features/materials/materials-helpers";

const materialFormSchema = z.object({
  item_code: z.string().min(1, "Item code is required."),
  item_name: z.string().min(2, "Material name is required."),
  category: z.string().optional(),
  unit: z.string().min(1, "Unit is required."),
  reorder_level: z.number().min(0),
  default_rate: z.number().min(0),
  current_stock: z.number().min(0),
  is_active: z.boolean(),
  company_id: z.string().optional(),
  project_id: z.string().optional(),
});

type MaterialFormValues = z.infer<typeof materialFormSchema>;

const inputClassName =
  "w-full rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-amber-100";
const labelClassName = "text-sm font-semibold text-[var(--surface-ink)]";

const attentionToneMap = {
  critical: "danger",
  watch: "warning",
  healthy: "success",
  inactive: "neutral",
} as const;
const EMPTY_LIST: never[] = [];

export default function MaterialsPage() {
  const { accessToken, user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [attentionFilter, setAttentionFilter] = useState<"all" | keyof typeof attentionToneMap>("all");
  const [tablePage, setTablePage] = useState(1);
  const [tablePageSize, setTablePageSize] = useState(25);
  const [tableSort, setTableSort] = useState<{ id: string; direction: "asc" | "desc" }>({
    id: "item_name",
    direction: "asc",
  });
  const [editingMaterialId, setEditingMaterialId] = useState<number | null>(null);
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const materialsQuery = useQuery({
    queryKey: ["materials"],
    queryFn: () => fetchMaterials(accessToken ?? ""),
    enabled: Boolean(accessToken),
  });
  const materialsTableQuery = useQuery({
    queryKey: [
      "materials",
      "table",
      deferredSearch,
      categoryFilter,
      attentionFilter,
      tablePage,
      tablePageSize,
      tableSort.id,
      tableSort.direction,
    ],
    queryFn: () =>
      fetchMaterialsPage(accessToken ?? "", {
        search: deferredSearch || undefined,
        category: categoryFilter === "all" ? undefined : categoryFilter,
        attention: attentionFilter === "all" ? undefined : attentionFilter,
        page: tablePage,
        limit: tablePageSize,
        sort_by: tableSort.id,
        sort_dir: tableSort.direction,
      }),
    enabled: Boolean(accessToken),
    placeholderData: (previous) => previous,
  });
  const summaryQuery = useQuery({
    queryKey: ["materials", "stock-summary"],
    queryFn: () => fetchMaterialStockSummary(accessToken ?? ""),
    enabled: Boolean(accessToken),
  });
  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: () => fetchProjects(accessToken ?? ""),
    enabled: Boolean(accessToken),
  });
  const companiesQuery = useQuery({
    queryKey: ["companies"],
    queryFn: () => fetchCompanies(accessToken ?? ""),
    enabled: Boolean(accessToken),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<MaterialFormValues>({
    resolver: zodResolver(materialFormSchema),
    defaultValues: buildMaterialFormDefaults(),
  });

  const materials = Array.isArray(materialsQuery.data) ? materialsQuery.data : EMPTY_LIST;
  const tableMaterials = materialsTableQuery.data?.items ?? EMPTY_LIST;
  const tableMaterialTotal = materialsTableQuery.data?.total ?? 0;
  const summary = Array.isArray(summaryQuery.data) ? summaryQuery.data : EMPTY_LIST;
  const projects = Array.isArray(projectsQuery.data) ? projectsQuery.data : EMPTY_LIST;
  const companies = Array.isArray(companiesQuery.data) ? companiesQuery.data : EMPTY_LIST;
  const companyMap = useMemo(
    () => new Map<number, Company>(companies.map((company) => [company.id, company])),
    [companies],
  );
  const projectMap = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);

  const selectedMaterial = useMemo(
    () => materials.find((material) => material.id === editingMaterialId) ?? null,
    [editingMaterialId, materials],
  );

  const resetTablePage = useEffectEvent(() => {
    setTablePage(1);
  });

  useEffect(() => {
    resetTablePage();
  }, [attentionFilter, categoryFilter, deferredSearch]);

  useEffect(() => {
    if (!selectedMaterial) {
      reset(buildMaterialFormDefaults());
      return;
    }

    reset({
      item_code: selectedMaterial.item_code,
      item_name: selectedMaterial.item_name,
      category: selectedMaterial.category ?? "",
      unit: selectedMaterial.unit,
      reorder_level: selectedMaterial.reorder_level,
      default_rate: selectedMaterial.default_rate,
      current_stock: selectedMaterial.current_stock,
      is_active: selectedMaterial.is_active,
      company_id: selectedMaterial.company_id ? String(selectedMaterial.company_id) : "",
      project_id: selectedMaterial.project_id ? String(selectedMaterial.project_id) : "",
    });
  }, [reset, selectedMaterial]);

  const materialMutation = useMutation({
    mutationFn: async (values: MaterialFormValues) => {
      const payload = {
        item_code: values.item_code.trim(),
        item_name: values.item_name.trim(),
        category: values.category?.trim() || null,
        unit: values.unit.trim(),
        reorder_level: values.reorder_level,
        default_rate: values.default_rate,
        current_stock: values.current_stock,
        is_active: values.is_active,
        company_id: values.company_id ? Number(values.company_id) : null,
        project_id: values.project_id ? Number(values.project_id) : null,
      };

      if (selectedMaterial) {
        return updateMaterial(accessToken ?? "", selectedMaterial.id, {
          ...payload,
          lock_version: selectedMaterial.lock_version,
        });
      }
      return createMaterial(accessToken ?? "", payload);
    },
    onSuccess: (_, values) => {
      void queryClient.invalidateQueries({ queryKey: ["materials"] });
      void queryClient.invalidateQueries({ queryKey: ["materials", "stock-summary"] });
      setServerMessage(
        selectedMaterial
          ? `${values.item_name.trim()} updated and synced with the stock board.`
          : `${values.item_name.trim()} added to the material master.`,
      );
      setEditingMaterialId(null);
      reset(buildMaterialFormDefaults());
    },
  });
  const exportMutation = useMutation({
    mutationFn: async () =>
      exportMaterials(accessToken ?? "", {
        search: deferredSearch || undefined,
        category: categoryFilter === "all" ? undefined : categoryFilter,
        attention: attentionFilter === "all" ? undefined : attentionFilter,
        page: tablePage,
        limit: tablePageSize,
        sort_by: tableSort.id,
        sort_dir: tableSort.direction,
      }),
    onSuccess: (blob) => {
      saveBlob(blob, "m2n-materials.csv");
    },
  });

  const categories = useMemo(
    () => Array.from(new Set(materials.map((item) => item.category).filter(Boolean))).sort(),
    [materials],
  );

  const lowStockMaterials = useMemo(
    () => materials.filter((material) => getMaterialAttention(material) !== "healthy").slice(0, 5),
    [materials],
  );

  const canCreate = hasPermissions(user?.role ?? "viewer", ["materials:create"]);
  const canUpdate = hasPermissions(user?.role ?? "viewer", ["materials:update"]);
  useKeyboardShortcuts({
    'ctrl+n': () => {
      if (!canCreate) return;
      setEditingMaterialId(null);
      setServerMessage(null);
      reset(buildMaterialFormDefaults());
    },
    '/': () => searchRef.current?.focus(),
  });
  const materialColumns = useMemo<DataTableColumn<Material>[]>(
    () => [
      {
        id: "item_name",
        header: "Material",
        sortKey: "item_name",
        minWidth: 220,
        exportValue: (row) => `${row.item_name} (${row.item_code})`,
        cell: (row) => (
          <div className="space-y-1">
            <p className="font-semibold text-[var(--surface-ink)]">{row.item_name}</p>
            <p className="text-xs uppercase tracking-[0.15em] text-[var(--surface-faint)]">{row.item_code}</p>
          </div>
        ),
      },
      {
        id: "scope_name",
        header: "Scope",
        sortKey: "scope_name",
        minWidth: 220,
        exportValue: (row) => {
          const project = row.project_id ? projectMap.get(row.project_id) : null;
          const company = row.company_id ? companyMap.get(row.company_id) : null;
          return [
            project?.name ?? "No project link",
            company?.name ?? "No company link",
            company?.gst_number ? `GST ${company.gst_number}` : null,
            company?.phone ?? company?.email ?? null,
          ]
            .filter(Boolean)
            .join(" | ");
        },
        cell: (row) => {
          const project = row.project_id ? projectMap.get(row.project_id) : null;
          const company = row.company_id ? companyMap.get(row.company_id) : null;
          return (
            <div className="space-y-1 text-sm">
              <p>{project?.name ?? "No project link"}</p>
              <p className="font-semibold text-[var(--surface-ink)]">
                {company?.name ?? "No company link"}
              </p>
              <p className="text-[var(--surface-faint)]">
                {company?.gst_number
                  ? `GST ${company.gst_number}`
                  : company?.phone ?? company?.email ?? "Company details not captured"}
              </p>
            </div>
          );
        },
      },
      {
        id: "category",
        header: "Category",
        minWidth: 160,
        exportValue: (row) => row.category ?? "",
        cell: (row) => row.category || "Uncategorized",
      },
      {
        id: "current_stock",
        header: "Stock",
        sortKey: "current_stock",
        exportValue: (row) => `${row.current_stock} ${row.unit}`,
        cell: (row) => `${formatDecimal(row.current_stock)} ${row.unit}`,
      },
      {
        id: "reorder_level",
        header: "Reorder",
        sortKey: "reorder_level",
        exportValue: (row) => `${row.reorder_level} ${row.unit}`,
        cell: (row) => `${formatDecimal(row.reorder_level)} ${row.unit}`,
      },
      {
        id: "default_rate",
        header: "Rate",
        sortKey: "default_rate",
        exportValue: (row) => String(row.default_rate),
        cell: (row) => formatCurrency(row.default_rate),
      },
      {
        id: "attention",
        header: "Status",
        sortKey: "attention",
        exportValue: (row) => titleCase(getMaterialAttention(row)),
        cell: (row) => {
          const attention = getMaterialAttention(row);
          return <Badge tone={attentionToneMap[attention]}>{titleCase(attention)}</Badge>;
        },
      },
      {
        id: "action",
        header: "Action",
        hideable: false,
        resizable: false,
        cell: (row) => (
          <Button
            size="sm"
            variant="secondary"
            disabled={!canUpdate}
            onClick={() => {
              setEditingMaterialId(row.id);
              setServerMessage(null);
            }}
          >
            <PencilLine className="size-4" />
            Edit
          </Button>
        ),
      },
    ],
    [canUpdate, companyMap, projectMap],
  );

  if (
    materialsQuery.isLoading ||
    materialsTableQuery.isLoading ||
    summaryQuery.isLoading ||
    projectsQuery.isLoading ||
    companiesQuery.isLoading
  ) {
    return <PageSkeleton statCount={4} tableRows={8} tableColumns={7} />;
  }

  if (materialsQuery.error || materialsTableQuery.error || summaryQuery.error || projectsQuery.error || companiesQuery.error) {
    return (
      <ErrorState
        description={getApiErrorMessage(
          materialsQuery.error ??
            materialsTableQuery.error ??
            summaryQuery.error ??
            projectsQuery.error ??
            companiesQuery.error,
        )}
        onRetry={() => {
          void materialsQuery.refetch();
          void materialsTableQuery.refetch();
          void summaryQuery.refetch();
          void projectsQuery.refetch();
          void companiesQuery.refetch();
        }}
      />
    );
  }

  return (
    <PermissionGate permissions={["materials:read"]}>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Material control"
          title="Run the material desk like an operations room, not a plain CRUD table."
          description="This step moves us from a static list into a live stock workspace: filters, risk watchlist, project and company context, and create-edit flow that actually helps site teams move faster."
          actions={
            <>
              <Link className={buttonVariants({ variant: "secondary" })} to="/materials/requisitions">
                <ClipboardCheck className="size-4" />
                Open requisitions
              </Link>
              <Link className={buttonVariants({ variant: "secondary" })} to="/companies">
                <Building2 className="size-4" />
                Open companies
              </Link>
              <Button
                disabled={!canCreate}
                onClick={() => {
                  setEditingMaterialId(null);
                  setServerMessage(null);
                  reset(buildMaterialFormDefaults());
                }}
              >
                New material
              </Button>
            </>
          }
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Material master"
            value={formatCompactNumber(materials.length)}
            caption="Active records available for requisition and issue"
            icon={Boxes}
          />
          <StatCard
            label="Total stock"
            value={formatDecimal(summary.reduce((total, item) => total + item.total_stock, 0))}
            caption="Combined quantity across visible scopes"
            icon={Package}
            tone="success"
          />
          <StatCard
            label="Reorder risk"
            value={formatCompactNumber(materials.filter((item) => getMaterialAttention(item) !== "healthy").length)}
            caption="Materials needing immediate or near-term attention"
            icon={AlertTriangle}
            tone="info"
          />
          <StatCard
            label="Inventory value"
            value={formatCurrency(materials.reduce((sum, item) => sum + item.current_stock * item.default_rate, 0))}
            caption="Indicative value based on current stock and default rate"
            icon={WalletCards}
            tone="accent"
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">
            <Card className="p-5">
              <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr_1fr]">
                <label className="space-y-2">
                  <span className={labelClassName}>Search material</span>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[var(--surface-faint)]" />
                    <input
                      ref={searchRef}
                      className={`${inputClassName} pl-11`}
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search by code, name, or category"
                    />
                  </div>
                </label>

                <label className="space-y-2">
                  <span className={labelClassName}>Category</span>
                  <select
                    className={inputClassName}
                    value={categoryFilter}
                    onChange={(event) => setCategoryFilter(event.target.value)}
                  >
                    <option value="all">All categories</option>
                    {categories.map((category) => (
                      <option key={category} value={category ?? ""}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className={labelClassName}>Attention band</span>
                  <select
                    className={inputClassName}
                    value={attentionFilter}
                    onChange={(event) => setAttentionFilter(event.target.value as typeof attentionFilter)}
                  >
                    <option value="all">All materials</option>
                    <option value="critical">Critical</option>
                    <option value="watch">Watchlist</option>
                    <option value="inactive">Inactive</option>
                    <option value="healthy">Healthy</option>
                  </select>
                </label>
              </div>
            </Card>

            <div className="grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
              <Card className="p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl text-[var(--surface-ink)]">Reorder watchlist</h3>
                    <p className="mt-1 text-sm text-[var(--surface-muted)]">Materials that deserve an operator call or purchase trigger.</p>
                  </div>
                  <Badge tone="warning">Top 5</Badge>
                </div>

                <div className="space-y-3">
                  {lowStockMaterials.length === 0 ? (
                    <EmptyState title="Stock looks healthy" description="Nothing is sitting on the current watchlist. Keep it that way." />
                  ) : (
                    lowStockMaterials.map((material) => {
                      const attention = getMaterialAttention(material);
                      const company = material.company_id ? companyMap.get(material.company_id) : null;
                      return (
                        <div key={material.id} className="rounded-[var(--radius)] border border-[color:var(--line)] bg-white/75 p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="font-semibold text-[var(--surface-ink)]">{material.item_name}</p>
                              <p className="text-xs uppercase tracking-[0.15em] text-[var(--surface-faint)]">{material.item_code}</p>
                            </div>
                            <Badge tone={attentionToneMap[attention]}>{titleCase(attention)}</Badge>
                          </div>
                          <div className="mt-3 grid gap-2 text-sm text-[var(--surface-muted)] md:grid-cols-2">
                            <p>Stock: <span className="font-semibold text-[var(--surface-ink)]">{formatDecimal(material.current_stock)} {material.unit}</span></p>
                            <p>Reorder: <span className="font-semibold text-[var(--surface-ink)]">{formatDecimal(material.reorder_level)} {material.unit}</span></p>
                            <p>Company: <span className="font-semibold text-[var(--surface-ink)]">{company?.name ?? "No company link"}</span></p>
                            <p>GST / Contact: <span className="font-semibold text-[var(--surface-ink)]">{company?.gst_number ?? company?.phone ?? company?.email ?? "Not captured"}</span></p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </Card>

              <div className="space-y-4">
                {summary.map((scope) => (
                  <div
                    key={`${scope.scope_type}-${scope.scope_id ?? "all"}`}
                    className="rounded-[var(--radius)] border border-[color:var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-lg)]"
                  >
                    {(() => {
                      const company =
                        scope.scope_type === "company" && scope.scope_id
                          ? companyMap.get(scope.scope_id)
                          : null;
                      return (
                        <>
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--surface-faint)]">
                                {titleCase(scope.scope_type)} scope
                              </p>
                              <h3 className="mt-2 text-2xl text-[var(--surface-ink)]">{scope.scope_name ?? "Global stock"}</h3>
                            </div>
                            <Badge tone="accent">{scope.material_count} items</Badge>
                          </div>
                          <p className="mt-4 text-sm leading-6 text-[var(--surface-muted)]">
                            Combined stock: <span className="font-semibold text-[var(--surface-ink)]">{formatDecimal(scope.total_stock)}</span>
                          </p>
                          {company ? (
                            <div className="mt-4 grid gap-2 text-sm text-[var(--surface-muted)]">
                              <p>
                                GST / PAN:{" "}
                                <span className="font-semibold text-[var(--surface-ink)]">
                                  {company.gst_number ?? company.pan_number ?? "Not captured"}
                                </span>
                              </p>
                              <p>
                                Phone / Email:{" "}
                                <span className="font-semibold text-[var(--surface-ink)]">
                                  {company.phone ?? company.email ?? "Not captured"}
                                </span>
                              </p>
                              <p>
                                Address:{" "}
                                <span className="font-semibold text-[var(--surface-ink)]">
                                  {company.address ?? "Not captured"}
                                </span>
                              </p>
                            </div>
                          ) : null}
                        </>
                      );
                    })()}
                  </div>
                ))}
              </div>
            </div>

            <DataTable
              columns={materialColumns}
              rows={tableMaterials}
              rowKey={(row) => row.id}
              loading={materialsTableQuery.isFetching}
              paginationMode="server"
              page={tablePage}
              pageSize={tablePageSize}
              totalRows={tableMaterialTotal}
              onPageChange={setTablePage}
              onPageSizeChange={setTablePageSize}
              sortingMode="server"
              sortId={tableSort.id}
              sortDir={tableSort.direction}
              onSortChange={(sort) => {
                if (!sort) return;
                setTableSort(sort);
              }}
              onExport={async () => {
                await exportMutation.mutateAsync();
              }}
              exporting={exportMutation.isPending}
              stickyHeader
              manageColumns
              resizableColumns
              maxHeight="720px"
              emptyState={
                <EmptyState
                  title="No materials match these filters"
                  description="Try widening the search, switching category, or clearing the attention band."
                />
              }
            />
          </div>

          <Card className="h-fit p-6 xl:sticky xl:top-28">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--surface-faint)]">
                  {selectedMaterial ? "Edit material" : "Create material"}
                </p>
                <h3 className="mt-2 text-2xl text-[var(--surface-ink)]">
                  {selectedMaterial ? selectedMaterial.item_name : "Add a new stock master"}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[var(--surface-muted)]">
                  Keep master data clean here so receipts, issues, and requisitions inherit reliable stock context.
                </p>
              </div>
              {selectedMaterial ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditingMaterialId(null);
                    setServerMessage(null);
                    reset(buildMaterialFormDefaults());
                  }}
                >
                  New instead
                </Button>
              ) : null}
            </div>

            <form
              className="space-y-4"
              onSubmit={handleSubmit(async (values) => {
                setServerMessage(null);
                await materialMutation.mutateAsync(values);
              })}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className={labelClassName}>Item code</span>
                  <input className={inputClassName} {...register("item_code")} placeholder="CEM-43-GRADE" />
                  {errors.item_code ? <p className="text-sm text-[var(--danger)]">{errors.item_code.message}</p> : null}
                </label>
                <label className="space-y-2">
                  <span className={labelClassName}>Unit</span>
                  <input className={inputClassName} {...register("unit")} placeholder="Bag / Kg / Nos" />
                  {errors.unit ? <p className="text-sm text-[var(--danger)]">{errors.unit.message}</p> : null}
                </label>
              </div>

              <label className="space-y-2">
                <span className={labelClassName}>Material name</span>
                <input className={inputClassName} {...register("item_name")} placeholder="OPC Cement 43 Grade" />
                {errors.item_name ? <p className="text-sm text-[var(--danger)]">{errors.item_name.message}</p> : null}
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className={labelClassName}>Category</span>
                  <input className={inputClassName} {...register("category")} placeholder="Civil / Electrical / Finishing" />
                </label>
                <label className="space-y-2">
                  <span className={labelClassName}>Company</span>
                  <select className={inputClassName} {...register("company_id")}>
                    <option value="">No company scope</option>
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="space-y-2">
                <span className={labelClassName}>Project</span>
                <select className={inputClassName} {...register("project_id")}>
                  <option value="">No project scope</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-4 md:grid-cols-3">
                <label className="space-y-2">
                  <span className={labelClassName}>Reorder level</span>
                  <input className={inputClassName} type="number" step="0.01" {...register("reorder_level", { valueAsNumber: true })} />
                </label>
                <label className="space-y-2">
                  <span className={labelClassName}>Default rate</span>
                  <input className={inputClassName} type="number" step="0.01" {...register("default_rate", { valueAsNumber: true })} />
                </label>
                <label className="space-y-2">
                  <span className={labelClassName}>Current stock</span>
                  <input className={inputClassName} type="number" step="0.01" {...register("current_stock", { valueAsNumber: true })} />
                </label>
              </div>

              <label className="flex items-center gap-3 rounded-2xl border border-[color:var(--line)] bg-white/70 px-4 py-3 text-sm text-[var(--surface-ink)]">
                <input type="checkbox" {...register("is_active")} />
                Keep this material active for operational use
              </label>

              {serverMessage ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  {serverMessage}
                </div>
              ) : null}
              {materialMutation.error ? (
                <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
                  {getApiErrorMessage(materialMutation.error)}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <Button disabled={isSubmitting || materialMutation.isPending || (!canCreate && !selectedMaterial) || (!canUpdate && Boolean(selectedMaterial))} type="submit">
                  <Sparkles className="size-4" />
                  {materialMutation.isPending ? "Saving..." : selectedMaterial ? "Update material" : "Create material"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setEditingMaterialId(null);
                    setServerMessage(null);
                    reset(buildMaterialFormDefaults());
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
