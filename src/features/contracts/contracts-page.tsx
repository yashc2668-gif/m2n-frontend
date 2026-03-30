import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ClipboardList,
  FileText,
  Landmark,
  PencilLine,
  Search,
  WalletCards,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useAuth } from "@/app/providers/auth-provider";
import { getApiErrorMessage } from "@/api/client";
import {
  createContract,
  fetchContracts,
  updateContract,
} from "@/api/contracts";
import { fetchProjects } from "@/api/projects";
import { fetchVendors } from "@/api/vendors";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { PageSkeleton } from "@/components/feedback/skeleton";
import { PermissionGate } from "@/components/shell/permission-gate";
import { Badge } from "@/components/ui/badge";
import { buttonVariants, Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import {
  buildContractDefaults,
  filterContracts,
  getContractAttention,
  getContractMetrics,
} from "@/features/masters/masters-helpers";
import {
  formatCompactNumber,
  formatCurrency,
  formatDate,
  titleCase,
} from "@/lib/format";
import { hasPermissions } from "@/lib/permissions";
import { useKeyboardShortcuts } from "@/lib/use-keyboard-shortcuts";

const inputClassName =
  "w-full rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-amber-100";
const labelClassName = "text-sm font-semibold text-[var(--surface-ink)]";
const EMPTY_LIST: never[] = [];
const attentionToneMap: Record<
  string,
  "danger" | "warning" | "neutral" | "success"
> = {
  danger: "danger",
  warning: "warning",
  neutral: "neutral",
  success: "success",
};

const contractFormSchema = z.object({
  project_id: z.string().min(1, "Select a project."),
  vendor_id: z.string().min(1, "Select a vendor."),
  contract_no: z.string().min(2, "Contract number is required."),
  title: z.string().min(2, "Contract title is required."),
  scope_of_work: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  original_value: z.number().min(0),
  revised_value: z.number().min(0),
  retention_percentage: z.number().min(0),
  status: z.string().min(1, "Select a status."),
});

type ContractFormValues = z.infer<typeof contractFormSchema>;

export default function ContractsPage() {
  const { accessToken, user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [vendorFilter, setVendorFilter] = useState("all");
  const [editingContractId, setEditingContractId] = useState<number | null>(
    null,
  );
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const contractsQuery = useQuery({
    queryKey: ["contracts"],
    queryFn: () => fetchContracts(accessToken ?? ""),
    enabled: Boolean(accessToken),
  });
  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: () => fetchProjects(accessToken ?? ""),
    enabled: Boolean(accessToken),
  });
  const vendorsQuery = useQuery({
    queryKey: ["vendors", "masters"],
    queryFn: () => fetchVendors(accessToken ?? "", { vendorType: null }),
    enabled: Boolean(accessToken),
  });

  const contracts = contractsQuery.data ?? EMPTY_LIST;
  const projects = projectsQuery.data ?? EMPTY_LIST;
  const vendors = vendorsQuery.data ?? EMPTY_LIST;

  const projectMap = useMemo(
    () => new Map(projects.map((project) => [project.id, project.name])),
    [projects],
  );
  const vendorMap = useMemo(
    () => new Map(vendors.map((vendor) => [vendor.id, vendor.name])),
    [vendors],
  );
  const selectedContract = useMemo(
    () =>
      contracts.find((contract) => contract.id === editingContractId) ?? null,
    [contracts, editingContractId],
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContractFormValues>({
    resolver: zodResolver(contractFormSchema),
    defaultValues: buildContractDefaults(),
  });

  useEffect(() => {
    if (!selectedContract) {
      reset(buildContractDefaults());
      return;
    }

    reset({
      project_id: String(selectedContract.project_id),
      vendor_id: String(selectedContract.vendor_id),
      contract_no: selectedContract.contract_no,
      title: selectedContract.title,
      scope_of_work: selectedContract.scope_of_work ?? "",
      start_date: selectedContract.start_date ?? "",
      end_date: selectedContract.end_date ?? "",
      original_value: selectedContract.original_value,
      revised_value: selectedContract.revised_value,
      retention_percentage: selectedContract.retention_percentage,
      status: selectedContract.status,
    });
  }, [reset, selectedContract]);

  const filteredContracts = useMemo(
    () =>
      filterContracts(contracts, {
        search,
        status: statusFilter,
        projectId: projectFilter,
        vendorId: vendorFilter,
      }),
    [contracts, projectFilter, search, statusFilter, vendorFilter],
  );

  const metrics = getContractMetrics(filteredContracts);
  const watchlistContracts = useMemo(
    () =>
      filteredContracts
        .map((contract) => ({
          contract,
          attention: getContractAttention(contract),
        }))
        .filter(
          (entry) =>
            entry.attention === "danger" || entry.attention === "warning",
        )
        .slice(0, 5),
    [filteredContracts],
  );

  const canCreate = hasPermissions(user?.role ?? "viewer", [
    "contracts:create",
  ]);
  const canUpdate = hasPermissions(user?.role ?? "viewer", [
    "contracts:update",
  ]);

  useKeyboardShortcuts({
    'ctrl+n': () => {
      if (!canCreate) return;
      setEditingContractId(null);
      setServerMessage(null);
      reset(buildContractDefaults());
    },
    'escape': () => setEditingContractId(null),
    '/': () => searchRef.current?.focus(),
  });

  const contractMutation = useMutation({
    mutationFn: async (values: ContractFormValues) => {
      const payload = {
        project_id: Number(values.project_id),
        vendor_id: Number(values.vendor_id),
        contract_no: values.contract_no.trim(),
        title: values.title.trim(),
        scope_of_work: values.scope_of_work?.trim() || null,
        start_date: values.start_date || null,
        end_date: values.end_date || null,
        original_value: values.original_value,
        revised_value: values.revised_value,
        retention_percentage: values.retention_percentage,
        status: values.status,
      };

      if (selectedContract) {
        return updateContract(accessToken ?? "", selectedContract.id, {
          lock_version: selectedContract.lock_version,
          vendor_id: payload.vendor_id,
          contract_no: payload.contract_no,
          title: payload.title,
          scope_of_work: payload.scope_of_work,
          start_date: payload.start_date,
          end_date: payload.end_date,
          original_value: payload.original_value,
          revised_value: payload.revised_value,
          retention_percentage: payload.retention_percentage,
          status: payload.status,
        });
      }

      return createContract(accessToken ?? "", payload);
    },
    onSuccess: (contract) => {
      void queryClient.invalidateQueries({ queryKey: ["contracts"] });
      setServerMessage(
        selectedContract
          ? `${contract.contract_no} updated.`
          : `${contract.contract_no} created.`,
      );
      setEditingContractId(null);
      reset(buildContractDefaults());
    },
  });

  if (
    contractsQuery.isLoading ||
    projectsQuery.isLoading ||
    vendorsQuery.isLoading
  ) {
    return (
      <PageSkeleton statCount={4} tableRows={8} tableColumns={8} />
    );
  }

  if (contractsQuery.error || projectsQuery.error || vendorsQuery.error) {
    return (
      <ErrorState
        description={getApiErrorMessage(
          contractsQuery.error ?? projectsQuery.error ?? vendorsQuery.error,
        )}
        onRetry={() => {
          void contractsQuery.refetch();
          void projectsQuery.refetch();
          void vendorsQuery.refetch();
        }}
      />
    );
  }

  return (
    <PermissionGate permissions={["contracts:read"]}>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Contract masters"
          title="See project-vendor commitments with commercial context, not isolated records."
          description="Contracts connect project scope, vendors, retention, and downstream payment posture. This page keeps those signals in one place so commercial drift is easy to spot."
          actions={
            <>
              <Link
                className={buttonVariants({ variant: "secondary" })}
                to="/vendors"
              >
                <Landmark className="size-4" />
                Open vendors
              </Link>
              <Link
                className={buttonVariants({ variant: "secondary" })}
                to="/payments"
              >
                <WalletCards className="size-4" />
                Open payments
              </Link>
              <Button
                disabled={!canCreate}
                onClick={() => {
                  setEditingContractId(null);
                  setServerMessage(null);
                  reset(buildContractDefaults());
                }}
              >
                New contract
              </Button>
            </>
          }
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Contracts"
            value={formatCompactNumber(metrics.total)}
            caption="Visible commitments in this view"
            icon={FileText}
            tone="info"
          />
          <StatCard
            label="Active"
            value={formatCompactNumber(metrics.active)}
            caption="Execution-live contracts"
            icon={ClipboardList}
            tone="success"
          />
          <StatCard
            label="Retention pool"
            value={formatCurrency(metrics.retentionPool)}
            caption="Indicative retention held across visible contracts"
            icon={Landmark}
            tone="accent"
          />
          <StatCard
            label="Revised value"
            value={formatCurrency(metrics.value)}
            caption={`${formatCompactNumber(metrics.expiringSoon)} contracts expiring soon`}
            icon={WalletCards}
            tone="accent"
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">
            <Card className="p-5">
              <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
                <label className="space-y-2">
                  <span className={labelClassName}>Search contract</span>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[var(--surface-faint)]" />
                    <input
                      ref={searchRef}
                      className={`${inputClassName} pl-11`}
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Contract no, title, scope"
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
                    <option value="closed">Closed</option>
                    <option value="on_hold">On hold</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </label>
                <label className="space-y-2">
                  <span className={labelClassName}>Project</span>
                  <select
                    className={inputClassName}
                    value={projectFilter}
                    onChange={(event) => setProjectFilter(event.target.value)}
                  >
                    <option value="all">All projects</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2">
                  <span className={labelClassName}>Vendor</span>
                  <select
                    className={inputClassName}
                    value={vendorFilter}
                    onChange={(event) => setVendorFilter(event.target.value)}
                  >
                    <option value="all">All vendors</option>
                    {vendors.map((vendor) => (
                      <option key={vendor.id} value={vendor.id}>
                        {vendor.name}
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
                      Contract watchlist
                    </h3>
                    <p className="mt-1 text-sm text-[var(--surface-muted)]">
                      Commercial drift, expiring commitments, or contracts
                      needing closer action.
                    </p>
                  </div>
                  <Badge tone="warning">Top 5</Badge>
                </div>
                <div className="space-y-3">
                  {watchlistContracts.length === 0 ? (
                    <EmptyState
                      title="Contract posture looks clean"
                      description="No visible contracts are in the watch band right now."
                    />
                  ) : (
                    watchlistContracts.map(({ contract, attention }) => (
                      <div
                        key={contract.id}
                        className="rounded-[var(--radius)] border border-[color:var(--line)] bg-white/75 p-4"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-semibold text-[var(--surface-ink)]">
                              {contract.contract_no}
                            </p>
                            <p className="text-xs uppercase tracking-[0.15em] text-[var(--surface-faint)]">
                              {contract.title}
                            </p>
                          </div>
                          <Badge tone={attentionToneMap[attention]}>
                            {titleCase(attention)}
                          </Badge>
                        </div>
                        <div className="mt-3 grid gap-2 text-sm text-[var(--surface-muted)]">
                          <p>
                            Project:{" "}
                            <span className="font-semibold text-[var(--surface-ink)]">
                              {projectMap.get(contract.project_id) ??
                                `Project #${contract.project_id}`}
                            </span>
                          </p>
                          <p>
                            Vendor:{" "}
                            <span className="font-semibold text-[var(--surface-ink)]">
                              {vendorMap.get(contract.vendor_id) ??
                                `Vendor #${contract.vendor_id}`}
                            </span>
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>

              <div className="grid gap-4 md:grid-cols-2">
                {filteredContracts.slice(0, 4).map((contract) => (
                  <div
                    key={contract.id}
                    className="rounded-[var(--radius)] border border-[color:var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-lg)]"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--surface-faint)]">
                          Contract pulse
                        </p>
                        <h3 className="mt-2 text-2xl text-[var(--surface-ink)]">
                          {contract.contract_no}
                        </h3>
                      </div>
                      <Badge
                        tone={attentionToneMap[getContractAttention(contract)]}
                      >
                        {titleCase(contract.status)}
                      </Badge>
                    </div>
                    <p className="mt-4 text-sm leading-6 text-[var(--surface-muted)]">
                      {contract.title}
                    </p>
                    <p className="mt-3 text-sm text-[var(--surface-muted)]">
                      Retention {contract.retention_percentage}% - Revised{" "}
                      {formatCurrency(contract.revised_value)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <DataTable
              columns={[
                {
                  id: "Contract",
                  header: "Contract",
                  cell: (row) => (
                    <div className="space-y-1">
                      <p className="font-semibold text-[var(--surface-ink)]">
                        {row.contract_no}
                      </p>
                      <p className="text-xs uppercase tracking-[0.15em] text-[var(--surface-faint)]">
                        {row.title}
                      </p>
                    </div>
                  ),
                  sortValue: (row) => row.contract_no,
                  exportValue: (row) => `${row.contract_no} — ${row.title}`,
                },
                {
                  id: "Project",
                  header: "Project",
                  cell: (row) =>
                    projectMap.get(row.project_id) ??
                    `Project #${row.project_id}`,
                  sortValue: (row) => projectMap.get(row.project_id) ?? "",
                  exportValue: (row) => projectMap.get(row.project_id) ?? "",
                },
                {
                  id: "Vendor",
                  header: "Vendor",
                  cell: (row) =>
                    vendorMap.get(row.vendor_id) ?? `Vendor #${row.vendor_id}`,
                  sortValue: (row) => vendorMap.get(row.vendor_id) ?? "",
                  exportValue: (row) => vendorMap.get(row.vendor_id) ?? "",
                },
                {
                  id: "Timeline",
                  header: "Timeline",
                  cell: (row) => (
                    <div className="space-y-1 text-sm">
                      <p>Start {formatDate(row.start_date ?? "")}</p>
                      <p className="text-[var(--surface-faint)]">
                        End {formatDate(row.end_date ?? "")}
                      </p>
                    </div>
                  ),
                  sortValue: (row) => row.start_date ?? "",
                  exportValue: (row) => `${row.start_date ?? ""} – ${row.end_date ?? ""}`,
                },
                {
                  id: "Commercial",
                  header: "Commercial",
                  cell: (row) => (
                    <div className="space-y-1 text-sm">
                      <p>Original {formatCurrency(row.original_value)}</p>
                      <p className="text-[var(--surface-faint)]">
                        Revised {formatCurrency(row.revised_value)}
                      </p>
                    </div>
                  ),
                  sortValue: (row) => row.revised_value,
                  exportValue: (row) => String(row.revised_value),
                },
                {
                  id: "Retention",
                  header: "Retention",
                  cell: (row) => `${row.retention_percentage}%`,
                  sortValue: (row) => row.retention_percentage,
                  exportValue: (row) => `${row.retention_percentage}%`,
                },
                {
                  id: "Status",
                  header: "Status",
                  cell: (row) => (
                    <Badge tone={attentionToneMap[getContractAttention(row)]}>
                      {titleCase(row.status)}
                    </Badge>
                  ),
                  sortValue: (row) => row.status,
                  exportValue: (row) => titleCase(row.status),
                },
                {
                  header: "Action",
                  cell: (row) => (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={!canUpdate}
                      onClick={() => {
                        setEditingContractId(row.id);
                        setServerMessage(null);
                      }}
                    >
                      <PencilLine className="size-4" />
                      Edit
                    </Button>
                  ),
                },
              ]}
              rows={filteredContracts}
              rowKey={(row) => row.id}
              exportFileName="m2n-contracts"
              stickyHeader
              defaultSortId="Contract"
              defaultSortDir="asc"
              emptyState={
                <EmptyState
                  title="No contracts match these filters"
                  description="Try widening the current search, project, or vendor filter."
                />
              }
            />
          </div>

          <Card className="h-fit p-6 xl:sticky xl:top-28">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--surface-faint)]">
                  {selectedContract ? "Edit contract" : "Create contract"}
                </p>
                <h3 className="mt-2 text-2xl text-[var(--surface-ink)]">
                  {selectedContract
                    ? selectedContract.contract_no
                    : "Open a new commercial linkage"}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[var(--surface-muted)]">
                  Keep contract masters tight here so billing, payments, and
                  retention flows inherit clean commercial context.
                </p>
              </div>
              {selectedContract ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditingContractId(null);
                    setServerMessage(null);
                    reset(buildContractDefaults());
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
                await contractMutation.mutateAsync(values);
              })}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className={labelClassName}>Project</span>
                  <select
                    className={inputClassName}
                    disabled={Boolean(selectedContract)}
                    {...register("project_id")}
                  >
                    <option value="">Select project</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                  {errors.project_id ? (
                    <p className="text-sm text-[var(--danger)]">
                      {errors.project_id.message}
                    </p>
                  ) : null}
                </label>
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
                  {errors.vendor_id ? (
                    <p className="text-sm text-[var(--danger)]">
                      {errors.vendor_id.message}
                    </p>
                  ) : null}
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className={labelClassName}>Contract number</span>
                  <input
                    className={inputClassName}
                    {...register("contract_no")}
                    placeholder="CTR-2026-001"
                  />
                  {errors.contract_no ? (
                    <p className="text-sm text-[var(--danger)]">
                      {errors.contract_no.message}
                    </p>
                  ) : null}
                </label>
                <label className="space-y-2">
                  <span className={labelClassName}>Status</span>
                  <select className={inputClassName} {...register("status")}>
                    <option value="active">Active</option>
                    <option value="closed">Closed</option>
                    <option value="on_hold">On hold</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </label>
              </div>

              <label className="space-y-2">
                <span className={labelClassName}>Title</span>
                <input
                  className={inputClassName}
                  {...register("title")}
                  placeholder="Civil structure package"
                />
                {errors.title ? (
                  <p className="text-sm text-[var(--danger)]">
                    {errors.title.message}
                  </p>
                ) : null}
              </label>

              <label className="space-y-2">
                <span className={labelClassName}>Scope of work</span>
                <textarea
                  className={`${inputClassName} min-h-24 resize-none`}
                  {...register("scope_of_work")}
                  placeholder="Package scope, exclusions, and execution boundary"
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className={labelClassName}>Start date</span>
                  <input
                    className={inputClassName}
                    type="date"
                    {...register("start_date")}
                  />
                </label>
                <label className="space-y-2">
                  <span className={labelClassName}>End date</span>
                  <input
                    className={inputClassName}
                    type="date"
                    {...register("end_date")}
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
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
                <label className="space-y-2">
                  <span className={labelClassName}>Retention %</span>
                  <input
                    className={inputClassName}
                    type="number"
                    step="0.01"
                    {...register("retention_percentage", {
                      valueAsNumber: true,
                    })}
                  />
                </label>
              </div>

              {serverMessage ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  {serverMessage}
                </div>
              ) : null}
              {contractMutation.error ? (
                <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
                  {getApiErrorMessage(contractMutation.error)}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <Button
                  disabled={
                    isSubmitting ||
                    contractMutation.isPending ||
                    (!canCreate && !selectedContract) ||
                    (!canUpdate && Boolean(selectedContract))
                  }
                  type="submit"
                >
                  {contractMutation.isPending
                    ? "Saving..."
                    : selectedContract
                      ? "Update contract"
                      : "Create contract"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setEditingContractId(null);
                    setServerMessage(null);
                    reset(buildContractDefaults());
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
