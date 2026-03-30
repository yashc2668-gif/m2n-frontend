import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Coins,
  HandCoins,
  PlusCircle,
  Search,
  WalletCards,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";

import { useAuth } from "@/app/providers/auth-provider";
import {
  addLabourAdvanceRecovery,
  createLabourAdvance,
  fetchLabourAdvances,
  updateLabourAdvance,
} from "@/api/labour-advances";
import { fetchLabourBills } from "@/api/labour-bills";
import { getApiErrorMessage } from "@/api/client";
import { fetchLabourContractors } from "@/api/labour-contractors";
import { fetchProjects } from "@/api/projects";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { PermissionGate } from "@/components/shell/permission-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Drawer } from "@/components/ui/drawer";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import {
  buildAdvanceDefaults,
  buildAdvanceRecoveryDefaults,
  filterAdvances,
  getAdvanceMetrics,
  getAdvanceStatusOptions,
  labourWorkflowToneMap,
} from "@/features/labour-operations/labour-operations-helpers";
import {
  formatCompactNumber,
  formatCurrency,
  formatDate,
  titleCase,
} from "@/lib/format";
import { hasPermissions } from "@/lib/permissions";

const EMPTY_LIST: never[] = [];
const inputClassName =
  "w-full rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-amber-100";
const labelClassName = "text-sm font-semibold text-[var(--surface-ink)]";

const createSchema = z.object({
  advance_no: z.string().min(1, "Advance number is required."),
  project_id: z.string().min(1, "Select a project."),
  contractor_id: z.string().min(1, "Select a contractor."),
  advance_date: z.string().min(1, "Select an advance date."),
  amount: z.number().gt(0, "Amount must be greater than zero."),
  status: z.string().min(1, "Select a status."),
  remarks: z.string().optional(),
});

const recoverySchema = z.object({
  labour_bill_id: z.string().optional(),
  recovery_date: z.string().min(1, "Select a recovery date."),
  amount: z.number().gt(0, "Recovery amount must be greater than zero."),
  remarks: z.string().optional(),
});

type CreateValues = z.infer<typeof createSchema>;
type RecoveryValues = z.infer<typeof recoverySchema>;

export default function LabourAdvancesPage() {
  const { accessToken, user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedAdvanceId, setSelectedAdvanceId] = useState<number | null>(
    null,
  );
  const [drawerMode, setDrawerMode] = useState<"create" | "review" | null>(
    null,
  );
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    status: "all",
    projectId: "all",
    contractorId: "all",
    balanceState: "all",
    search: "",
  });

  const advancesQuery = useQuery({
    queryKey: ["labour-advances"],
    queryFn: () => fetchLabourAdvances(accessToken ?? ""),
    enabled: Boolean(accessToken),
  });
  const billsQuery = useQuery({
    queryKey: ["labour-bills"],
    queryFn: () => fetchLabourBills(accessToken ?? ""),
    enabled: Boolean(accessToken),
  });
  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: () => fetchProjects(accessToken ?? ""),
    enabled: Boolean(accessToken),
  });
  const contractorsQuery = useQuery({
    queryKey: ["labour-contractors"],
    queryFn: () => fetchLabourContractors(accessToken ?? ""),
    enabled: Boolean(accessToken),
  });

  const advances = advancesQuery.data ?? EMPTY_LIST;
  const bills = billsQuery.data ?? EMPTY_LIST;
  const projects = projectsQuery.data ?? EMPTY_LIST;
  const contractors = contractorsQuery.data ?? EMPTY_LIST;

  const projectMap = useMemo(
    () => new Map(projects.map((project) => [project.id, project.name])),
    [projects],
  );
  const contractorMap = useMemo(
    () =>
      new Map(
        contractors.map((contractor) => [
          contractor.id,
          contractor.contractor_name,
        ]),
      ),
    [contractors],
  );
  const selectedAdvance = useMemo(
    () => advances.find((advance) => advance.id === selectedAdvanceId) ?? null,
    [advances, selectedAdvanceId],
  );
  const isDrawerOpen = drawerMode !== null;
  const isEditMode = drawerMode === "review" && Boolean(selectedAdvance);

  const createForm = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: buildAdvanceDefaults(),
  });
  const recoveryForm = useForm<RecoveryValues>({
    resolver: zodResolver(recoverySchema),
    defaultValues: buildAdvanceRecoveryDefaults(),
  });
  const advanceAmount = useWatch({
    control: createForm.control,
    name: "amount",
  });

  useEffect(() => {
    if (!isDrawerOpen || drawerMode === "create" || !selectedAdvance) {
      createForm.reset(buildAdvanceDefaults());
      recoveryForm.reset(buildAdvanceRecoveryDefaults());
      return;
    }

    createForm.reset({
      advance_no: selectedAdvance.advance_no,
      project_id: String(selectedAdvance.project_id),
      contractor_id: String(selectedAdvance.contractor_id),
      advance_date: selectedAdvance.advance_date,
      amount: selectedAdvance.amount,
      status: selectedAdvance.status,
      remarks: selectedAdvance.remarks ?? "",
    });
    recoveryForm.reset(buildAdvanceRecoveryDefaults());
  }, [createForm, drawerMode, isDrawerOpen, recoveryForm, selectedAdvance]);

  const recoveryBills = useMemo(
    () =>
      bills.filter((bill) => {
        if (!selectedAdvance) {
          return false;
        }
        return (
          bill.project_id === selectedAdvance.project_id &&
          bill.contractor_id === selectedAdvance.contractor_id
        );
      }),
    [bills, selectedAdvance],
  );

  const filteredAdvances = useMemo(
    () =>
      filterAdvances(advances, {
        status: filters.status,
        projectId: filters.projectId,
        contractorId: filters.contractorId,
        balanceState: filters.balanceState,
        search: filters.search,
      }),
    [advances, filters],
  );

  const metrics = getAdvanceMetrics(filteredAdvances);
  const canCreate = hasPermissions(user?.role ?? "viewer", [
    "labour_advances:create",
  ]);
  const canUpdate = hasPermissions(user?.role ?? "viewer", [
    "labour_advances:update",
  ]);
  const isRecoveryBlocked =
    !selectedAdvance ||
    selectedAdvance.status === "cancelled" ||
    selectedAdvance.balance_amount <= 0;

  const advanceMutation = useMutation({
    mutationFn: async (values: CreateValues) => {
      const payload = {
        advance_no: values.advance_no.trim(),
        project_id: Number(values.project_id),
        contractor_id: Number(values.contractor_id),
        advance_date: values.advance_date,
        amount: values.amount,
        status: values.status,
        remarks: values.remarks?.trim() || null,
      };

      if (selectedAdvance) {
        return updateLabourAdvance(accessToken ?? "", selectedAdvance.id, {
          advance_no: payload.advance_no,
          contractor_id: payload.contractor_id,
          advance_date: payload.advance_date,
          amount: payload.amount,
          status: payload.status,
          remarks: payload.remarks,
        });
      }

      return createLabourAdvance(accessToken ?? "", payload);
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["labour-advances"] });
      setServerMessage(
        selectedAdvance
          ? `${result.advance_no} updated.`
          : `${result.advance_no} created.`,
      );
      setDrawerMode("review");
      setSelectedAdvanceId(result.id);
    },
  });

  const recoveryMutation = useMutation({
    mutationFn: async (values: RecoveryValues) => {
      if (!selectedAdvance) {
        throw new Error("Select an advance first.");
      }
      return addLabourAdvanceRecovery(accessToken ?? "", selectedAdvance.id, {
        labour_bill_id: values.labour_bill_id
          ? Number(values.labour_bill_id)
          : null,
        recovery_date: values.recovery_date,
        amount: values.amount,
        remarks: values.remarks?.trim() || null,
      });
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["labour-advances"] });
      setServerMessage(`${result.advance_no} recovered.`);
      recoveryForm.reset(buildAdvanceRecoveryDefaults());
      setDrawerMode("review");
      setSelectedAdvanceId(result.id);
    },
  });

  const activeError = advanceMutation.error ?? recoveryMutation.error ?? null;

  function openCreateDrawer() {
    setDrawerMode("create");
    setSelectedAdvanceId(null);
    setServerMessage(null);
    createForm.reset(buildAdvanceDefaults());
    recoveryForm.reset(buildAdvanceRecoveryDefaults());
  }

  function openReviewDrawer(advanceId: number) {
    setDrawerMode("review");
    setSelectedAdvanceId(advanceId);
    setServerMessage(null);
  }

  function closeDrawer() {
    setDrawerMode(null);
    setSelectedAdvanceId(null);
    setServerMessage(null);
    createForm.reset(buildAdvanceDefaults());
    recoveryForm.reset(buildAdvanceRecoveryDefaults());
  }

  if (
    advancesQuery.isLoading ||
    billsQuery.isLoading ||
    projectsQuery.isLoading ||
    contractorsQuery.isLoading
  ) {
    return (
      <LoadingState
        title="Loading labour advances"
        description="Pulling advances, recoveries, contractor scope, projects, and bill references."
      />
    );
  }

  if (
    advancesQuery.error ||
    billsQuery.error ||
    projectsQuery.error ||
    contractorsQuery.error
  ) {
    return (
      <ErrorState
        description={getApiErrorMessage(
          advancesQuery.error ??
            billsQuery.error ??
            projectsQuery.error ??
            contractorsQuery.error,
        )}
        onRetry={() => {
          void advancesQuery.refetch();
          void billsQuery.refetch();
          void projectsQuery.refetch();
          void contractorsQuery.refetch();
        }}
      />
    );
  }

  return (
    <PermissionGate permissions={["labour_advances:read"]}>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Labour advances"
          title="Track advances, recoveries, and remaining labour exposure with drawer-based review."
          description="Advance control gets powerful when open balance, project scope, and bill-linked recovery stay visible in one operator flow."
          actions={
            <Button disabled={!canCreate} onClick={openCreateDrawer}>
              <PlusCircle className="size-4" />
              New advance
            </Button>
          }
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Visible advances"
            value={formatCompactNumber(metrics.total)}
            caption="Current filter result"
            icon={HandCoins}
            tone="info"
          />
          <StatCard
            label="Active"
            value={formatCompactNumber(metrics.active)}
            caption="Still carrying balance"
            icon={WalletCards}
            tone="accent"
          />
          <StatCard
            label="Closed"
            value={formatCompactNumber(metrics.closed)}
            caption="Fully recovered or closed"
            icon={PlusCircle}
            tone="success"
          />
          <StatCard
            label="Open balance"
            value={formatCurrency(metrics.balance)}
            caption={`Recovered ${formatCurrency(metrics.recovered)}`}
            icon={Coins}
            tone="accent"
          />
        </div>

        <Card className="p-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1.2fr_repeat(4,minmax(0,1fr))]">
            <label className="space-y-2 xl:col-span-1">
              <span className={labelClassName}>Search advance</span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[var(--surface-faint)]" />
                <input
                  className={`${inputClassName} pl-11`}
                  placeholder="Advance no, remarks, status"
                  value={filters.search}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      search: event.target.value,
                    }))
                  }
                />
              </div>
            </label>

            <label className="space-y-2">
              <span className={labelClassName}>Status</span>
              <select
                className={inputClassName}
                value={filters.status}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    status: event.target.value,
                  }))
                }
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="closed">Closed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </label>

            <label className="space-y-2">
              <span className={labelClassName}>Project</span>
              <select
                className={inputClassName}
                value={filters.projectId}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    projectId: event.target.value,
                  }))
                }
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
              <span className={labelClassName}>Contractor</span>
              <select
                className={inputClassName}
                value={filters.contractorId}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    contractorId: event.target.value,
                  }))
                }
              >
                <option value="all">All contractors</option>
                {contractors.map((contractor) => (
                  <option key={contractor.id} value={contractor.id}>
                    {contractor.contractor_name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className={labelClassName}>Balance state</span>
              <select
                className={inputClassName}
                value={filters.balanceState}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    balanceState: event.target.value,
                  }))
                }
              >
                <option value="all">All balances</option>
                <option value="open">Open balance</option>
                <option value="settled">Settled</option>
              </select>
            </label>
          </div>
        </Card>

        {filteredAdvances.length === 0 ? (
          <EmptyState
            title="No advances in this view"
            description="Create the first advance or widen the current search and balance controls."
          />
        ) : (
          <div className="grid gap-5">
            {filteredAdvances.map((advance) => (
              <Card key={advance.id} className="p-5">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-2xl text-[var(--surface-ink)]">
                        {advance.advance_no}
                      </h3>
                      <Badge
                        tone={
                          labourWorkflowToneMap[
                            advance.status as keyof typeof labourWorkflowToneMap
                          ] ?? "neutral"
                        }
                      >
                        {titleCase(advance.status)}
                      </Badge>
                      <Badge tone="neutral">
                        {advance.recoveries.length} recoveries
                      </Badge>
                    </div>
                    <div className="grid gap-2 text-sm text-[var(--surface-muted)] md:grid-cols-4">
                      <p>
                        Project:{" "}
                        <span className="font-semibold text-[var(--surface-ink)]">
                          {projectMap.get(advance.project_id) ??
                            `Project #${advance.project_id}`}
                        </span>
                      </p>
                      <p>
                        Contractor:{" "}
                        <span className="font-semibold text-[var(--surface-ink)]">
                          {contractorMap.get(advance.contractor_id) ??
                            `Contractor #${advance.contractor_id}`}
                        </span>
                      </p>
                      <p>
                        Issued:{" "}
                        <span className="font-semibold text-[var(--surface-ink)]">
                          {formatDate(advance.advance_date)}
                        </span>
                      </p>
                      <p>
                        Balance:{" "}
                        <span className="font-semibold text-[var(--surface-ink)]">
                          {formatCurrency(advance.balance_amount)}
                        </span>
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge tone="neutral">
                        Amount {formatCurrency(advance.amount)}
                      </Badge>
                      <Badge tone="neutral">
                        Recovered {formatCurrency(advance.recovered_amount)}
                      </Badge>
                    </div>
                    <p className="text-sm leading-6 text-[var(--surface-muted)]">
                      {advance.remarks || "No remarks added yet."}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => openReviewDrawer(advance.id)}
                    >
                      Review
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        <Drawer
          open={isDrawerOpen}
          title={
            selectedAdvance
              ? selectedAdvance.advance_no
              : "Create labour advance"
          }
          description={
            selectedAdvance
              ? "Review exposure, edit safe fields, and post recoveries against matching labour bills from the same project and contractor."
              : "Create a project-scoped labour advance and track future recovery against labour bills."
          }
          onClose={closeDrawer}
          widthClassName="max-w-4xl"
        >
          <div className="space-y-6">
            {selectedAdvance ? (
              <div className="grid gap-4 md:grid-cols-4">
                <Card className="p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--surface-faint)]">
                    Project
                  </p>
                  <p className="mt-2 text-lg text-[var(--surface-ink)]">
                    {projectMap.get(selectedAdvance.project_id) ??
                      `Project #${selectedAdvance.project_id}`}
                  </p>
                </Card>
                <Card className="p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--surface-faint)]">
                    Contractor
                  </p>
                  <p className="mt-2 text-lg text-[var(--surface-ink)]">
                    {contractorMap.get(selectedAdvance.contractor_id) ??
                      `Contractor #${selectedAdvance.contractor_id}`}
                  </p>
                </Card>
                <Card className="p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--surface-faint)]">
                    Recovered
                  </p>
                  <p className="mt-2 text-lg text-[var(--surface-ink)]">
                    {formatCurrency(selectedAdvance.recovered_amount)}
                  </p>
                </Card>
                <Card className="p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--surface-faint)]">
                    Balance
                  </p>
                  <p className="mt-2 text-lg text-[var(--surface-ink)]">
                    {formatCurrency(selectedAdvance.balance_amount)}
                  </p>
                </Card>
              </div>
            ) : null}

            <Card className="p-5">
              <p className="text-sm font-semibold text-[var(--surface-ink)]">
                Project lock and recovery guard
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--surface-muted)]">
                Project stays locked once the advance exists, and recovery
                remains limited to labour bills from the same contractor and
                project. Cancelled advances stay review-only for recovery.
              </p>
            </Card>

            <form
              className="space-y-6"
              onSubmit={createForm.handleSubmit(async (values) => {
                setServerMessage(null);
                await advanceMutation.mutateAsync(values);
              })}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className={labelClassName}>Advance number</span>
                  <input
                    className={inputClassName}
                    {...createForm.register("advance_no")}
                  />
                  {createForm.formState.errors.advance_no ? (
                    <p className="text-sm text-[var(--danger)]">
                      {createForm.formState.errors.advance_no.message}
                    </p>
                  ) : null}
                </label>
                <label className="space-y-2">
                  <span className={labelClassName}>Status</span>
                  <select
                    className={inputClassName}
                    disabled={isEditMode && !canUpdate}
                    {...createForm.register("status")}
                  >
                    {getAdvanceStatusOptions().map((status) => (
                      <option key={status} value={status}>
                        {titleCase(status)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <label className="space-y-2">
                  <span className={labelClassName}>Project</span>
                  <select
                    className={inputClassName}
                    disabled={isEditMode}
                    {...createForm.register("project_id")}
                  >
                    <option value="">Select project</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                  {createForm.formState.errors.project_id ? (
                    <p className="text-sm text-[var(--danger)]">
                      {createForm.formState.errors.project_id.message}
                    </p>
                  ) : null}
                </label>
                <label className="space-y-2">
                  <span className={labelClassName}>Contractor</span>
                  <select
                    className={inputClassName}
                    disabled={isEditMode ? !canUpdate : !canCreate}
                    {...createForm.register("contractor_id")}
                  >
                    <option value="">Select contractor</option>
                    {contractors.map((contractor) => (
                      <option key={contractor.id} value={contractor.id}>
                        {contractor.contractor_name}
                      </option>
                    ))}
                  </select>
                  {createForm.formState.errors.contractor_id ? (
                    <p className="text-sm text-[var(--danger)]">
                      {createForm.formState.errors.contractor_id.message}
                    </p>
                  ) : null}
                </label>
                <label className="space-y-2">
                  <span className={labelClassName}>Advance date</span>
                  <input
                    className={inputClassName}
                    type="date"
                    {...createForm.register("advance_date")}
                  />
                  {createForm.formState.errors.advance_date ? (
                    <p className="text-sm text-[var(--danger)]">
                      {createForm.formState.errors.advance_date.message}
                    </p>
                  ) : null}
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className={labelClassName}>Amount</span>
                  <input
                    className={inputClassName}
                    type="number"
                    step="0.01"
                    {...createForm.register("amount", { valueAsNumber: true })}
                  />
                  {createForm.formState.errors.amount ? (
                    <p className="text-sm text-[var(--danger)]">
                      {createForm.formState.errors.amount.message}
                    </p>
                  ) : null}
                </label>
                <label className="space-y-2">
                  <span className={labelClassName}>Remarks</span>
                  <textarea
                    className={`${inputClassName} min-h-24 resize-none`}
                    placeholder="Cash requirement note, supervisor context, or recovery plan"
                    {...createForm.register("remarks")}
                  />
                </label>
              </div>

              {selectedAdvance ? (
                <Card className="p-5">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[var(--surface-ink)]">
                        Recovery posting
                      </p>
                      <p className="text-sm leading-6 text-[var(--surface-muted)]">
                        Recoveries stay project and contractor scoped. If the
                        advance is cancelled or fully settled, recovery remains
                        disabled.
                      </p>
                    </div>
                    <Badge tone={isRecoveryBlocked ? "danger" : "success"}>
                      {isRecoveryBlocked
                        ? "Recovery blocked"
                        : "Recovery available"}
                    </Badge>
                  </div>

                  <div className="mt-4 space-y-4">
                    <div className="grid gap-4 md:grid-cols-3">
                      <label className="space-y-2 md:col-span-2">
                        <span className={labelClassName}>Labour bill link</span>
                        <select
                          className={inputClassName}
                          disabled={isRecoveryBlocked || !canUpdate}
                          {...recoveryForm.register("labour_bill_id")}
                        >
                          <option value="">Optional bill link</option>
                          {recoveryBills.map((bill) => (
                            <option key={bill.id} value={bill.id}>
                              {bill.bill_no} -{" "}
                              {formatCurrency(bill.net_payable)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-2">
                        <span className={labelClassName}>Recovery date</span>
                        <input
                          className={inputClassName}
                          type="date"
                          disabled={isRecoveryBlocked || !canUpdate}
                          {...recoveryForm.register("recovery_date")}
                        />
                      </label>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="space-y-2">
                        <span className={labelClassName}>Recovery amount</span>
                        <input
                          className={inputClassName}
                          type="number"
                          step="0.01"
                          disabled={isRecoveryBlocked || !canUpdate}
                          {...recoveryForm.register("amount", {
                            valueAsNumber: true,
                          })}
                        />
                        {recoveryForm.formState.errors.amount ? (
                          <p className="text-sm text-[var(--danger)]">
                            {recoveryForm.formState.errors.amount.message}
                          </p>
                        ) : null}
                      </label>
                      <label className="space-y-2">
                        <span className={labelClassName}>Recovery remarks</span>
                        <textarea
                          className={`${inputClassName} min-h-24 resize-none`}
                          disabled={isRecoveryBlocked || !canUpdate}
                          placeholder="Bill deduction note or recovery narrative"
                          {...recoveryForm.register("remarks")}
                        />
                      </label>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <Button
                        type="button"
                        disabled={
                          isRecoveryBlocked ||
                          !canUpdate ||
                          recoveryMutation.isPending
                        }
                        onClick={() => {
                          void recoveryForm.handleSubmit(async (values) => {
                            setServerMessage(null);
                            await recoveryMutation.mutateAsync(values);
                          })();
                        }}
                      >
                        {recoveryMutation.isPending
                          ? "Recovering..."
                          : "Add recovery"}
                      </Button>
                    </div>
                  </div>

                  {selectedAdvance.recoveries.length > 0 ? (
                    <div className="mt-5 grid gap-3 md:grid-cols-2">
                      {selectedAdvance.recoveries
                        .slice()
                        .reverse()
                        .map((recovery) => (
                          <Card
                            key={recovery.id}
                            className="border-dashed p-4 text-sm text-[var(--surface-muted)]"
                          >
                            <p className="font-semibold text-[var(--surface-ink)]">
                              {formatCurrency(recovery.amount)}
                            </p>
                            <p className="mt-1">
                              {formatDate(recovery.recovery_date)}
                            </p>
                            <p className="mt-1">
                              {recovery.labour_bill_id
                                ? `Bill #${recovery.labour_bill_id}`
                                : "No bill link"}
                            </p>
                            <p className="mt-2 leading-6">
                              {recovery.remarks || "No recovery remarks."}
                            </p>
                          </Card>
                        ))}
                    </div>
                  ) : null}
                </Card>
              ) : null}

              {serverMessage ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  {serverMessage}
                </div>
              ) : null}
              {activeError ? (
                <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
                  {getApiErrorMessage(activeError)}
                </div>
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[color:var(--line)] bg-white/80 px-4 py-3 text-sm text-[var(--surface-muted)]">
                <span>
                  {selectedAdvance ? "Current balance" : "Proposed amount"}{" "}
                  <span className="font-semibold text-[var(--surface-ink)]">
                    {selectedAdvance
                      ? formatCurrency(selectedAdvance.balance_amount)
                      : formatCurrency(advanceAmount || 0)}
                  </span>
                </span>
                <div className="flex flex-wrap gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={closeDrawer}
                  >
                    Close
                  </Button>
                  <Button
                    disabled={
                      createForm.formState.isSubmitting ||
                      advanceMutation.isPending ||
                      (isEditMode ? !canUpdate : !canCreate)
                    }
                    type="submit"
                  >
                    {advanceMutation.isPending
                      ? "Saving..."
                      : isEditMode
                        ? "Update advance"
                        : "Create advance"}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </Drawer>
      </div>
    </PermissionGate>
  );
}
