import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  Building2,
  ClipboardList,
  Download,
  FileText,
  MapPinned,
  PencilLine,
  Trash2,
  Search,
  WalletCards,
} from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useAuth } from "@/app/providers/auth-provider";
import { fetchCompanies } from "@/api/companies";
import { getApiErrorMessage } from "@/api/client";
import { fetchContracts } from "@/api/contracts";
import {
  createProject,
  deleteProject,
  exportProjects,
  fetchProjects,
  fetchProjectsPage,
  updateProject,
} from "@/api/projects";
import type { Project } from "@/api/types";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { PageSkeleton } from "@/components/feedback/skeleton";
import { PermissionGate } from "@/components/shell/permission-gate";
import { Badge } from "@/components/ui/badge";
import { buttonVariants, Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable, downloadTableRowsAsCsv, type DataTableColumn } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import {
  buildProjectDefaults,
  filterProjects,
  getProjectAttention,
  getProjectMetrics,
} from "@/features/masters/masters-helpers";
import {
  formatCompactNumber,
  formatCurrency,
  formatDate,
  titleCase,
} from "@/lib/format";
import { saveBlob } from "@/lib/download";
import { hasPermissions } from "@/lib/permissions";
import { useKeyboardShortcuts } from "@/lib/use-keyboard-shortcuts";

const inputClassName =
  "w-full rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-amber-100";
const labelClassName = "text-sm font-semibold text-[var(--surface-ink)]";
const EMPTY_LIST: never[] = [];
const attentionToneMap: Record<
  string,
  "danger" | "warning" | "info" | "success"
> = {
  danger: "danger",
  warning: "warning",
  info: "info",
  success: "success",
};

const projectFormSchema = z.object({
  company_id: z.string().min(1, "Select a company."),
  name: z.string().min(2, "Project name is required."),
  code: z.string().optional(),
  description: z.string().optional(),
  client_name: z.string().optional(),
  location: z.string().optional(),
  original_value: z.number().min(0),
  revised_value: z.number().min(0),
  start_date: z.string().optional(),
  expected_end_date: z.string().optional(),
  actual_end_date: z.string().optional(),
  status: z.string().min(1, "Select a status."),
});

type ProjectFormValues = z.infer<typeof projectFormSchema>;

export default function ProjectsPage() {
  const { accessToken, user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [statusFilter, setStatusFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [tablePage, setTablePage] = useState(1);
  const [tablePageSize, setTablePageSize] = useState(25);
  const [tableSort, setTableSort] = useState<{ id: string; direction: "asc" | "desc" }>({
    id: "name",
    direction: "asc",
  });
  const [selectedProjectKeys, setSelectedProjectKeys] = useState<Set<string | number>>(new Set());
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null);
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: () => fetchProjects(accessToken ?? ""),
    enabled: Boolean(accessToken),
  });
  const projectsTableQuery = useQuery({
    queryKey: [
      "projects",
      "table",
      deferredSearch,
      statusFilter,
      companyFilter,
      tablePage,
      tablePageSize,
      tableSort.id,
      tableSort.direction,
    ],
    queryFn: () =>
      fetchProjectsPage(accessToken ?? "", {
        search: deferredSearch || undefined,
        status_filter: statusFilter === "all" ? undefined : statusFilter,
        company_id: companyFilter === "all" ? undefined : Number(companyFilter),
        page: tablePage,
        limit: tablePageSize,
        sort_by: tableSort.id,
        sort_dir: tableSort.direction,
      }),
    enabled: Boolean(accessToken),
    placeholderData: (previous) => previous,
  });
  const companiesQuery = useQuery({
    queryKey: ["companies"],
    queryFn: () => fetchCompanies(accessToken ?? ""),
    enabled: Boolean(accessToken),
  });
  const contractsQuery = useQuery({
    queryKey: ["contracts"],
    queryFn: () => fetchContracts(accessToken ?? ""),
    enabled: Boolean(accessToken),
  });

  const projects = projectsQuery.data ?? EMPTY_LIST;
  const companies = companiesQuery.data ?? EMPTY_LIST;
  const contracts = contractsQuery.data ?? EMPTY_LIST;
  const tableProjects = projectsTableQuery.data?.items ?? EMPTY_LIST;
  const tableProjectTotal = projectsTableQuery.data?.total ?? 0;

  const companyMap = useMemo(
    () => new Map(companies.map((company) => [company.id, company.name])),
    [companies],
  );

  const contractCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const contract of contracts) {
      counts.set(
        contract.project_id,
        (counts.get(contract.project_id) ?? 0) + 1,
      );
    }
    return counts;
  }, [contracts]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === editingProjectId) ?? null,
    [editingProjectId, projects],
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: buildProjectDefaults(),
  });

  useEffect(() => {
    if (!selectedProject) {
      reset(buildProjectDefaults());
      return;
    }

    reset({
      company_id: String(selectedProject.company_id),
      name: selectedProject.name,
      code: selectedProject.code ?? "",
      description: selectedProject.description ?? "",
      client_name: selectedProject.client_name ?? "",
      location: selectedProject.location ?? "",
      original_value: selectedProject.original_value,
      revised_value: selectedProject.revised_value,
      start_date: selectedProject.start_date ?? "",
      expected_end_date: selectedProject.expected_end_date ?? "",
      actual_end_date: selectedProject.actual_end_date ?? "",
      status: selectedProject.status,
    });
  }, [reset, selectedProject]);

  useEffect(() => {
    setTablePage(1);
    setSelectedProjectKeys(new Set());
  }, [companyFilter, deferredSearch, statusFilter]);

  const filteredProjects = useMemo(
    () =>
      filterProjects(projects, {
        search,
        status: statusFilter,
        companyId: companyFilter,
      }),
    [companyFilter, projects, search, statusFilter],
  );

  const metrics = getProjectMetrics(filteredProjects, contracts);
  const watchlistProjects = useMemo(
    () =>
      filteredProjects
        .map((project) => ({
          project,
          attention: getProjectAttention(
            project,
            contractCounts.get(project.id) ?? 0,
          ),
        }))
        .filter((entry) => entry.attention !== "success")
        .slice(0, 5),
    [contractCounts, filteredProjects],
  );

  const canCreate = hasPermissions(user?.role ?? "viewer", ["projects:create"]);
  const canUpdate = hasPermissions(user?.role ?? "viewer", ["projects:update"]);

  useKeyboardShortcuts({
    'ctrl+n': () => {
      if (!canCreate) return;
      setEditingProjectId(null);
      setServerMessage(null);
      reset(buildProjectDefaults());
    },
    'escape': () => setEditingProjectId(null),
    '/': () => searchRef.current?.focus(),
  });

  const projectMutation = useMutation({
    mutationFn: async (values: ProjectFormValues) => {
      const payload = {
        company_id: Number(values.company_id),
        name: values.name.trim(),
        code: values.code?.trim() || null,
        description: values.description?.trim() || null,
        client_name: values.client_name?.trim() || null,
        location: values.location?.trim() || null,
        original_value: values.original_value,
        revised_value: values.revised_value,
        start_date: values.start_date || null,
        expected_end_date: values.expected_end_date || null,
        status: values.status,
      };

      if (selectedProject) {
        return updateProject(accessToken ?? "", selectedProject.id, {
          lock_version: selectedProject.lock_version,
          ...payload,
          actual_end_date: values.actual_end_date || null,
        });
      }

      return createProject(accessToken ?? "", payload);
    },
    onSuccess: (project) => {
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
      setServerMessage(
        selectedProject
          ? `${project.name} updated.`
          : `${project.name} created and ready for contract linkage.`,
      );
      setEditingProjectId(null);
      reset(buildProjectDefaults());
    },
  });
  const exportMutation = useMutation({
    mutationFn: async () =>
      exportProjects(accessToken ?? "", {
        search: deferredSearch || undefined,
        status_filter: statusFilter === "all" ? undefined : statusFilter,
        company_id: companyFilter === "all" ? undefined : Number(companyFilter),
        sort_by: tableSort.id,
        sort_dir: tableSort.direction,
      }),
    onSuccess: (blob) => {
      saveBlob(blob, "m2n-projects.csv");
    },
  });
  const bulkDeleteMutation = useMutation({
    mutationFn: async (projectIds: number[]) => {
      const results = await Promise.allSettled(
        projectIds.map((projectId) => deleteProject(accessToken ?? "", projectId)),
      );
      const failedCount = results.filter((result) => result.status === "rejected").length;
      return {
        deletedCount: results.length - failedCount,
        failedCount,
      };
    },
    onSuccess: ({ deletedCount, failedCount }) => {
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
      setSelectedProjectKeys(new Set());
      setServerMessage(
        failedCount > 0
          ? `${deletedCount} projects deleted. ${failedCount} could not be deleted because they are already linked to downstream records.`
          : `${deletedCount} projects deleted.`,
      );
    },
  });

  const projectColumns = useMemo<DataTableColumn<Project>[]>(
    () => [
      {
        id: "name",
        header: "Project",
        sortKey: "name",
        exportValue: (row) => `${row.name} (${row.code || "N/A"})`,
        minWidth: 220,
        cell: (row) => (
          <div className="space-y-1">
            <p className="font-semibold text-[var(--surface-ink)]">
              {row.name}
            </p>
            <p className="text-xs uppercase tracking-[0.15em] text-[var(--surface-faint)]">
              {row.code || "No code"}
            </p>
          </div>
        ),
      },
      {
        id: "company_name",
        header: "Company",
        sortKey: "company_name",
        exportValue: (row) => companyMap.get(row.company_id) ?? "",
        minWidth: 180,
        cell: (row) =>
          companyMap.get(row.company_id) ?? `Company #${row.company_id}`,
      },
      {
        id: "client_name",
        header: "Client / location",
        sortKey: "client_name",
        exportValue: (row) => `${row.client_name || "-"} / ${row.location || "-"}`,
        minWidth: 220,
        cell: (row) => (
          <div className="space-y-1 text-sm">
            <p>{row.client_name || "Client not captured"}</p>
            <p className="text-[var(--surface-faint)]">
              {row.location || "Location not captured"}
            </p>
          </div>
        ),
      },
      {
        id: "revised_value",
        header: "Commercial",
        sortKey: "revised_value",
        exportValue: (row) => `${row.original_value} / ${row.revised_value}`,
        minWidth: 200,
        cell: (row) => (
          <div className="space-y-1 text-sm">
            <p>Original {formatCurrency(row.original_value)}</p>
            <p className="text-[var(--surface-faint)]">
              Revised {formatCurrency(row.revised_value)}
            </p>
          </div>
        ),
      },
      {
        id: "start_date",
        header: "Timeline",
        sortKey: "start_date",
        exportValue: (row) => `${row.start_date || "-"} / ${row.expected_end_date || "-"}`,
        minWidth: 190,
        cell: (row) => (
          <div className="space-y-1 text-sm">
            <p>Start {formatDate(row.start_date ?? "")}</p>
            <p className="text-[var(--surface-faint)]">
              Target {formatDate(row.expected_end_date ?? "")}
            </p>
          </div>
        ),
      },
      {
        id: "contracts",
        header: "Contracts",
        exportValue: (row) => String(contractCounts.get(row.id) ?? 0),
        cell: (row) => contractCounts.get(row.id) ?? 0,
        hideable: true,
      },
      {
        id: "status",
        header: "Status",
        sortKey: "status",
        exportValue: (row) => titleCase(row.status),
        cell: (row) => (
          <Badge
            tone={
              attentionToneMap[
                getProjectAttention(
                  row,
                  contractCounts.get(row.id) ?? 0,
                )
              ]
            }
          >
            {titleCase(row.status)}
          </Badge>
        ),
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
              setEditingProjectId(row.id);
              setServerMessage(null);
            }}
          >
            <PencilLine className="size-4" />
            Edit
          </Button>
        ),
      },
    ],
    [canUpdate, companyMap, contractCounts],
  );

  if (
    projectsQuery.isLoading ||
    projectsTableQuery.isLoading ||
    companiesQuery.isLoading ||
    contractsQuery.isLoading
  ) {
    return <PageSkeleton statCount={4} tableRows={6} tableColumns={7} />;
  }

  if (projectsQuery.error || projectsTableQuery.error || companiesQuery.error || contractsQuery.error) {
    return (
      <ErrorState
        description={getApiErrorMessage(
          projectsQuery.error ?? projectsTableQuery.error ?? companiesQuery.error ?? contractsQuery.error,
        )}
        onRetry={() => {
          void projectsQuery.refetch();
          void projectsTableQuery.refetch();
          void companiesQuery.refetch();
          void contractsQuery.refetch();
        }}
      />
    );
  }

  return (
    <PermissionGate permissions={["projects:read"]}>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Project masters"
          title="Keep project control polished, linked, and ready for execution modules."
          description="Projects are the anchor for contracts, materials, labour, and billing. This workspace makes that linkage visible instead of hiding it inside isolated forms."
          actions={
            <>
              <Link
                className={buttonVariants({ variant: "secondary" })}
                to="/contracts"
              >
                <FileText className="size-4" />
                Open contracts
              </Link>
              <Link
                className={buttonVariants({ variant: "secondary" })}
                to="/materials"
              >
                <ClipboardList className="size-4" />
                Material desk
              </Link>
              <Button
                disabled={!canCreate}
                onClick={() => {
                  setEditingProjectId(null);
                  setServerMessage(null);
                  reset(buildProjectDefaults());
                }}
              >
                New project
              </Button>
            </>
          }
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Projects"
            value={formatCompactNumber(metrics.total)}
            caption="Visible projects in the current control view"
            icon={Building2}
            tone="info"
          />
          <StatCard
            label="Active"
            value={formatCompactNumber(metrics.active)}
            caption="Execution-ready live projects"
            icon={MapPinned}
            tone="success"
          />
          <StatCard
            label="Contract-linked"
            value={formatCompactNumber(metrics.linked)}
            caption="Projects already linked to contracts"
            icon={FileText}
            tone="accent"
          />
          <StatCard
            label="Revised portfolio"
            value={formatCurrency(metrics.revisedValue)}
            caption={`${formatCompactNumber(metrics.completed)} completed projects in view`}
            icon={WalletCards}
            tone="accent"
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">
            <Card className="p-5">
              <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr_1fr]">
                <label className="space-y-2">
                  <span className={labelClassName}>Search project</span>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[var(--surface-faint)]" />
                    <input
                      ref={searchRef}
                      className={`${inputClassName} pl-11`}
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search by name, code, client, or location"
                    />
                  </div>
                </label>
                <label className="space-y-2">
                  <span className={labelClassName}>Status</span>
                  <select
                    className={inputClassName}
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                  >
                    <option value="all">All statuses</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="on_hold">On hold</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </label>
                <label className="space-y-2">
                  <span className={labelClassName}>Company</span>
                  <select
                    className={inputClassName}
                    value={companyFilter}
                    onChange={(event) => setCompanyFilter(event.target.value)}
                  >
                    <option value="all">All companies</option>
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </Card>

            <div className="grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
              <Card className="p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl text-[var(--surface-ink)]">
                      Project watchlist
                    </h3>
                    <p className="mt-1 text-sm text-[var(--surface-muted)]">
                      Projects needing contract action, commercial review, or
                      planning attention.
                    </p>
                  </div>
                  <Badge tone="warning">Top 5</Badge>
                </div>
                <div className="space-y-3">
                  {watchlistProjects.length === 0 ? (
                    <EmptyState
                      title="Project posture looks clean"
                      description="No projects are currently sitting in the watch band."
                    />
                  ) : (
                    watchlistProjects.map(({ project, attention }) => (
                      <div
                        key={project.id}
                        className="rounded-[var(--radius)] border border-[color:var(--line)] bg-white/75 p-4"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-semibold text-[var(--surface-ink)]">
                              {project.name}
                            </p>
                            <p className="text-xs uppercase tracking-[0.15em] text-[var(--surface-faint)]">
                              {project.code || "No project code"}
                            </p>
                          </div>
                          <Badge tone={attentionToneMap[attention]}>
                            {titleCase(attention)}
                          </Badge>
                        </div>
                        <div className="mt-3 grid gap-2 text-sm text-[var(--surface-muted)]">
                          <p>
                            Company:{" "}
                            <span className="font-semibold text-[var(--surface-ink)]">
                              {companyMap.get(project.company_id) ??
                                `Company #${project.company_id}`}
                            </span>
                          </p>
                          <p>
                            Contracts linked:{" "}
                            <span className="font-semibold text-[var(--surface-ink)]">
                              {contractCounts.get(project.id) ?? 0}
                            </span>
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>

              <div className="grid gap-4 md:grid-cols-2">
                {filteredProjects.slice(0, 4).map((project) => {
                  const contractCount = contractCounts.get(project.id) ?? 0;
                  return (
                    <div
                      key={project.id}
                      className="rounded-[var(--radius)] border border-[color:var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-lg)]"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--surface-faint)]">
                            Project pulse
                          </p>
                          <h3 className="mt-2 text-2xl text-[var(--surface-ink)]">
                            {project.name}
                          </h3>
                        </div>
                        <Badge
                          tone={
                            attentionToneMap[
                              getProjectAttention(project, contractCount)
                            ]
                          }
                        >
                          {titleCase(project.status)}
                        </Badge>
                      </div>
                      <p className="mt-4 text-sm leading-6 text-[var(--surface-muted)]">
                        Client {project.client_name || "Not captured"} �
                        Location {project.location || "Not captured"}
                      </p>
                      <p className="mt-3 text-sm text-[var(--surface-muted)]">
                        Contracts linked:{" "}
                        <span className="font-semibold text-[var(--surface-ink)]">
                          {contractCount}
                        </span>
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            <DataTable
              columns={projectColumns}
              rows={tableProjects}
              rowKey={(row) => row.id}
              loading={projectsTableQuery.isFetching}
              selectable
              selectedKeys={selectedProjectKeys}
              onSelectionChange={setSelectedProjectKeys}
              bulkActions={(selectedKeys) => {
                const selectedRows = tableProjects.filter((project) => selectedKeys.has(project.id));
                return (
                  <>
                    <Button
                      size="sm"
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        downloadTableRowsAsCsv({
                          columns: projectColumns.filter((column) => column.id !== "action"),
                          rows: selectedRows,
                          filename: "m2n-projects-selected",
                        });
                      }}
                    >
                      <Download className="size-3.5" />
                      Export selected
                    </Button>
                    <Button
                      size="sm"
                      type="button"
                      variant="danger"
                      disabled={!canUpdate || bulkDeleteMutation.isPending}
                      onClick={() => {
                        void bulkDeleteMutation.mutateAsync(
                          selectedRows.map((project) => project.id),
                        );
                      }}
                    >
                      <Trash2 className="size-3.5" />
                      {bulkDeleteMutation.isPending ? "Deleting..." : "Delete selected"}
                    </Button>
                  </>
                );
              }}
              paginationMode="server"
              page={tablePage}
              pageSize={tablePageSize}
              totalRows={tableProjectTotal}
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
                  title="No projects match these filters"
                  description="Try widening the current company or status filter."
                />
              }
            />
          </div>

          <Card className="h-fit p-6 xl:sticky xl:top-28">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--surface-faint)]">
                  {selectedProject ? "Edit project" : "Create project"}
                </p>
                <h3 className="mt-2 text-2xl text-[var(--surface-ink)]">
                  {selectedProject
                    ? selectedProject.name
                    : "Open a new project anchor"}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[var(--surface-muted)]">
                  This form keeps the project master ready for contracts,
                  materials, labour attendance, and billing flow.
                </p>
              </div>
              {selectedProject ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditingProjectId(null);
                    setServerMessage(null);
                    reset(buildProjectDefaults());
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
                await projectMutation.mutateAsync(values);
              })}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className={labelClassName}>Company</span>
                  <select
                    className={inputClassName}
                    {...register("company_id")}
                  >
                    <option value="">Select company</option>
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                  {errors.company_id ? (
                    <p className="text-sm text-[var(--danger)]">
                      {errors.company_id.message}
                    </p>
                  ) : null}
                </label>
                <label className="space-y-2">
                  <span className={labelClassName}>Status</span>
                  <select className={inputClassName} {...register("status")}>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="on_hold">On hold</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className={labelClassName}>Project name</span>
                  <input
                    className={inputClassName}
                    {...register("name")}
                    placeholder="Metro viaduct package"
                  />
                  {errors.name ? (
                    <p className="text-sm text-[var(--danger)]">
                      {errors.name.message}
                    </p>
                  ) : null}
                </label>
                <label className="space-y-2">
                  <span className={labelClassName}>Project code</span>
                  <input
                    className={inputClassName}
                    {...register("code")}
                    placeholder="PJT-METRO-01"
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className={labelClassName}>Client name</span>
                  <input
                    className={inputClassName}
                    {...register("client_name")}
                    placeholder="Urban Transit Corp"
                  />
                </label>
                <label className="space-y-2">
                  <span className={labelClassName}>Location</span>
                  <input
                    className={inputClassName}
                    {...register("location")}
                    placeholder="Pune corridor"
                  />
                </label>
              </div>

              <label className="space-y-2">
                <span className={labelClassName}>Description</span>
                <textarea
                  className={`${inputClassName} min-h-24 resize-none`}
                  {...register("description")}
                  placeholder="High-level scope, client commitments, and execution note"
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className={labelClassName}>Original value</span>
                  <input
                    className={inputClassName}
                    type="number"
                    step="0.01"
                    {...register("original_value", { valueAsNumber: true })}
                  />
                </label>
                <label className="space-y-2">
                  <span className={labelClassName}>Revised value</span>
                  <input
                    className={inputClassName}
                    type="number"
                    step="0.01"
                    {...register("revised_value", { valueAsNumber: true })}
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <label className="space-y-2">
                  <span className={labelClassName}>Start date</span>
                  <input
                    className={inputClassName}
                    type="date"
                    {...register("start_date")}
                  />
                </label>
                <label className="space-y-2">
                  <span className={labelClassName}>Expected end</span>
                  <input
                    className={inputClassName}
                    type="date"
                    {...register("expected_end_date")}
                  />
                </label>
                <label className="space-y-2">
                  <span className={labelClassName}>Actual end</span>
                  <input
                    className={inputClassName}
                    type="date"
                    {...register("actual_end_date")}
                  />
                </label>
              </div>

              {serverMessage ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  {serverMessage}
                </div>
              ) : null}
              {projectMutation.error ? (
                <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
                  {getApiErrorMessage(projectMutation.error)}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <Button
                  disabled={
                    isSubmitting ||
                    projectMutation.isPending ||
                    (!canCreate && !selectedProject) ||
                    (!canUpdate && Boolean(selectedProject))
                  }
                  type="submit"
                >
                  {projectMutation.isPending
                    ? "Saving..."
                    : selectedProject
                      ? "Update project"
                      : "Create project"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setEditingProjectId(null);
                    setServerMessage(null);
                    reset(buildProjectDefaults());
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
