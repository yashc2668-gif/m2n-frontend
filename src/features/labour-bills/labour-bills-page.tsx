import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCheck,
  FileDown,
  ReceiptText,
  Search,
  Wallet,
  WalletCards,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";

import { useAuth } from "@/app/providers/auth-provider";
import {
  approveLabourBill,
  createLabourBill,
  downloadLabourBillPdf,
  fetchLabourBills,
  markLabourBillPaid,
  updateLabourBill,
} from "@/api/labour-bills";
import { getApiErrorMessage } from "@/api/client";
import { fetchContracts } from "@/api/contracts";
import { fetchLabourAttendances } from "@/api/labour-attendance";
import { fetchLabourContractors } from "@/api/labour-contractors";
import { fetchProjects } from "@/api/projects";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { PermissionGate } from "@/components/shell/permission-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { Drawer } from "@/components/ui/drawer";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import {
  buildBillDefaults,
  canApproveBill,
  canMarkBillPaid,
  filterBills,
  getBillMetrics,
  getBillStatusOptions,
  getSelectedAttendanceTotal,
  labourWorkflowToneMap,
} from "@/features/labour-operations/labour-operations-helpers";
import {
  formatCompactNumber,
  formatCurrency,
  formatDate,
  titleCase,
} from "@/lib/format";
import { hasPermissions } from "@/lib/permissions";
import { saveBlob } from "@/lib/download";

const EMPTY_LIST: never[] = [];
const inputClassName =
  "w-full rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-amber-100";
const labelClassName = "text-sm font-semibold text-[var(--surface-ink)]";

const billFormSchema = z.object({
  bill_no: z.string().min(1, "Bill number is required."),
  project_id: z.string().min(1, "Select a project."),
  requested_project_id: z.string().optional(),
  contractor_id: z.string().min(1, "Select a contractor."),
  contract_id: z.string().optional(),
  period_start: z.string().min(1, "Select period start."),
  period_end: z.string().min(1, "Select period end."),
  status: z.string().min(1, "Select a status."),
  deductions: z.number().min(0, "Deductions cannot be negative."),
  remarks: z.string().optional(),
  attendance_ids: z.array(z.string()),
});

type BillFormValues = z.infer<typeof billFormSchema>;

export default function LabourBillsPage() {
  const { accessToken, user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedBillId, setSelectedBillId] = useState<number | null>(null);
  const [drawerMode, setDrawerMode] = useState<"create" | "review" | null>(
    null,
  );
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    status: "all",
    projectId: "all",
    contractorId: "all",
    fromDate: "",
    toDate: "",
    search: "",
  });

  const billsQuery = useQuery({
    queryKey: ["labour-bills"],
    queryFn: () => fetchLabourBills(accessToken ?? ""),
    enabled: Boolean(accessToken),
  });
  const attendancesQuery = useQuery({
    queryKey: ["labour-attendance"],
    queryFn: () => fetchLabourAttendances(accessToken ?? ""),
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
  const contractsQuery = useQuery({
    queryKey: ["contracts"],
    queryFn: () => fetchContracts(accessToken ?? ""),
    enabled: Boolean(accessToken),
  });

  const bills = Array.isArray(billsQuery.data) ? billsQuery.data : EMPTY_LIST;
  const attendances = Array.isArray(attendancesQuery.data) ? attendancesQuery.data : EMPTY_LIST;
  const projects = Array.isArray(projectsQuery.data) ? projectsQuery.data : EMPTY_LIST;
  const contractors = Array.isArray(contractorsQuery.data) ? contractorsQuery.data : EMPTY_LIST;
  const contracts = Array.isArray(contractsQuery.data) ? contractsQuery.data : EMPTY_LIST;

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
  const contractMap = useMemo(
    () =>
      new Map(
        contracts.map((contract) => [
          contract.id,
          `${contract.contract_no} - ${contract.title}`,
        ]),
      ),
    [contracts],
  );
  const selectedBill = useMemo(
    () => bills.find((bill) => bill.id === selectedBillId) ?? null,
    [bills, selectedBillId],
  );
  const isDrawerOpen = drawerMode !== null;
  const isEditMode = drawerMode === "review" && Boolean(selectedBill);
  const isImmutableBill =
    selectedBill?.status === "paid" || selectedBill?.status === "cancelled";

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<BillFormValues>({
    resolver: zodResolver(billFormSchema),
    defaultValues: buildBillDefaults(),
  });

  const projectId = useWatch({ control, name: "project_id" });
  const contractorId = useWatch({ control, name: "contractor_id" });
  const periodStart = useWatch({ control, name: "period_start" });
  const periodEnd = useWatch({ control, name: "period_end" });
  const selectedIds = useWatch({ control, name: "attendance_ids" }) ?? [];
  const deductions = useWatch({ control, name: "deductions" }) ?? 0;

  useEffect(() => {
    if (!isDrawerOpen || drawerMode === "create" || !selectedBill) {
      reset(buildBillDefaults());
      return;
    }

    reset({
      bill_no: selectedBill.bill_no,
      project_id: String(selectedBill.project_id),
      requested_project_id: String(selectedBill.project_id),
      contractor_id: String(selectedBill.contractor_id),
      contract_id: selectedBill.contract_id
        ? String(selectedBill.contract_id)
        : "",
      period_start: selectedBill.period_start,
      period_end: selectedBill.period_end,
      status: selectedBill.status,
      deductions: selectedBill.deductions,
      remarks: selectedBill.remarks ?? "",
      attendance_ids: selectedBill.items
        .filter((item) => item.attendance_id !== null)
        .map((item) => String(item.attendance_id)),
    });
  }, [drawerMode, isDrawerOpen, reset, selectedBill]);

  const eligibleAttendances = useMemo(
    () =>
      attendances.filter((attendance) => {
        if (attendance.status !== "approved") {
          return false;
        }
        if (projectId && attendance.project_id !== Number(projectId)) {
          return false;
        }
        if (contractorId && attendance.contractor_id !== Number(contractorId)) {
          return false;
        }
        if (periodStart && attendance.attendance_date < periodStart) {
          return false;
        }
        if (periodEnd && attendance.attendance_date > periodEnd) {
          return false;
        }
        return true;
      }),
    [attendances, contractorId, periodEnd, periodStart, projectId],
  );

  const grossPreview = getSelectedAttendanceTotal(
    eligibleAttendances,
    selectedIds,
  );
  const filteredBills = useMemo(
    () =>
      filterBills(bills, {
        status: filters.status,
        projectId: filters.projectId,
        contractorId: filters.contractorId,
        fromDate: filters.fromDate,
        toDate: filters.toDate,
        search: filters.search,
      }),
    [bills, filters],
  );

  const metrics = getBillMetrics(filteredBills);
  const canCreate = hasPermissions(user?.role ?? "viewer", [
    "labour_bills:create",
  ]);
  const canApprove = hasPermissions(user?.role ?? "viewer", [
    "labour_bills:approve",
  ]);

  const billMutation = useMutation({
    mutationFn: async (values: BillFormValues) => {
      if (values.attendance_ids.length === 0) {
        throw new Error(
          "Select at least one approved attendance line to generate the bill.",
        );
      }

      const payload = {
        bill_no: values.bill_no.trim(),
        project_id: Number(values.project_id),
        contractor_id: Number(values.contractor_id),
        contract_id: values.contract_id ? Number(values.contract_id) : null,
        period_start: values.period_start,
        period_end: values.period_end,
        status: values.status,
        deductions: values.deductions,
        remarks: values.remarks?.trim() || null,
        attendance_ids: values.attendance_ids.map(Number),
      };

      if (selectedBill) {
        return updateLabourBill(accessToken ?? "", selectedBill.id, payload);
      }

      return createLabourBill(accessToken ?? "", payload);
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["labour-bills"] });
      setServerMessage(
        selectedBill
          ? `${result.bill_no} updated.`
          : `${result.bill_no} created.`,
      );
      setDrawerMode("review");
      setSelectedBillId(result.id);
    },
  });

  const approveMutation = useMutation({
    mutationFn: (billId: number) =>
      approveLabourBill(accessToken ?? "", billId),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["labour-bills"] });
      setServerMessage(`${result.bill_no} approved.`);
      setDrawerMode("review");
      setSelectedBillId(result.id);
    },
  });

  const paidMutation = useMutation({
    mutationFn: (billId: number) =>
      markLabourBillPaid(accessToken ?? "", billId),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["labour-bills"] });
      setServerMessage(`${result.bill_no} marked paid.`);
      setDrawerMode("review");
      setSelectedBillId(result.id);
    },
  });

  const activeError =
    billMutation.error ?? approveMutation.error ?? paidMutation.error ?? null;

  function openCreateDrawer() {
    setDrawerMode("create");
    setSelectedBillId(null);
    setServerMessage(null);
    reset(buildBillDefaults());
  }

  function openReviewDrawer(billId: number) {
    setDrawerMode("review");
    setSelectedBillId(billId);
    setServerMessage(null);
  }

  function closeDrawer() {
    setDrawerMode(null);
    setSelectedBillId(null);
    setServerMessage(null);
    reset(buildBillDefaults());
  }

  if (
    billsQuery.isLoading ||
    attendancesQuery.isLoading ||
    projectsQuery.isLoading ||
    contractorsQuery.isLoading ||
    contractsQuery.isLoading
  ) {
    return (
      <LoadingState
        title="Loading labour bills"
        description="Pulling approved attendance, contractors, projects, contracts, and bill history."
      />
    );
  }

  if (
    billsQuery.error ||
    attendancesQuery.error ||
    projectsQuery.error ||
    contractorsQuery.error ||
    contractsQuery.error
  ) {
    return (
      <ErrorState
        description={getApiErrorMessage(
          billsQuery.error ??
            attendancesQuery.error ??
            projectsQuery.error ??
            contractorsQuery.error ??
            contractsQuery.error,
        )}
        onRetry={() => {
          void billsQuery.refetch();
          void attendancesQuery.refetch();
          void projectsQuery.refetch();
          void contractorsQuery.refetch();
          void contractsQuery.refetch();
        }}
      />
    );
  }

  return (
    <PermissionGate permissions={["labour_bills:read"]}>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Labour bills"
          title="Generate contractor bills from approved attendance with finance-grade review control."
          description="This workspace stays attendance-driven on purpose. That keeps labour billing aligned with the backend rule that approved attendance must remain the source of truth."
          actions={
            <Button disabled={!canCreate} onClick={openCreateDrawer}>
              <ReceiptText className="size-4" />
              New labour bill
            </Button>
          }
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Visible bills"
            value={formatCompactNumber(metrics.total)}
            caption="Current filter result"
            icon={ReceiptText}
            tone="info"
          />
          <StatCard
            label="Submitted"
            value={formatCompactNumber(metrics.submitted)}
            caption="Awaiting approval"
            icon={Wallet}
            tone="accent"
          />
          <StatCard
            label="Approved"
            value={formatCompactNumber(metrics.approved)}
            caption="Ready for finance release"
            icon={CheckCheck}
            tone="success"
          />
          <StatCard
            label="Visible payable"
            value={formatCurrency(metrics.payable)}
            caption={`${formatCompactNumber(metrics.paid)} paid in this view`}
            icon={WalletCards}
            tone="accent"
          />
        </div>

        <Card className="p-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1.2fr_repeat(5,minmax(0,1fr))]">
            <label className="space-y-2 xl:col-span-1">
              <span className={labelClassName}>Search bill</span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[var(--surface-faint)]" />
                <input
                  className={`${inputClassName} pl-11`}
                  placeholder="Bill no, remarks, status"
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
                <option value="draft">Draft</option>
                <option value="submitted">Submitted</option>
                <option value="approved">Approved</option>
                <option value="paid">Paid</option>
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
              <span className={labelClassName}>From date</span>
              <DatePicker
                value={filters.fromDate}
                onChange={(v) =>
                  setFilters((current) => ({
                    ...current,
                    fromDate: v,
                  }))
                }
                placeholder="Start date"
              />
            </label>

            <label className="space-y-2">
              <span className={labelClassName}>To date</span>
              <DatePicker
                value={filters.toDate}
                onChange={(v) =>
                  setFilters((current) => ({
                    ...current,
                    toDate: v,
                  }))
                }
                placeholder="End date"
              />
            </label>
          </div>
        </Card>

        {filteredBills.length === 0 ? (
          <EmptyState
            title="No labour bills in this view"
            description="Create the first attendance-backed bill or widen the current filter controls."
          />
        ) : (
          <div className="grid gap-5">
            {filteredBills.map((bill) => (
              <Card key={bill.id} className="p-5">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-2xl text-[var(--surface-ink)]">
                        {bill.bill_no}
                      </h3>
                      <Badge
                        tone={
                          labourWorkflowToneMap[
                            bill.status as keyof typeof labourWorkflowToneMap
                          ] ?? "neutral"
                        }
                      >
                        {titleCase(bill.status)}
                      </Badge>
                      <Badge tone="neutral">
                        {bill.items.filter((item) => item.attendance_id).length}{" "}
                        attendance lines
                      </Badge>
                    </div>
                    <div className="grid gap-2 text-sm text-[var(--surface-muted)] md:grid-cols-4">
                      <p>
                        Project:{" "}
                        <span className="font-semibold text-[var(--surface-ink)]">
                          {projectMap.get(bill.project_id) ??
                            `Project #${bill.project_id}`}
                        </span>
                      </p>
                      <p>
                        Contractor:{" "}
                        <span className="font-semibold text-[var(--surface-ink)]">
                          {contractorMap.get(bill.contractor_id) ??
                            `Contractor #${bill.contractor_id}`}
                        </span>
                      </p>
                      <p>
                        Period:{" "}
                        <span className="font-semibold text-[var(--surface-ink)]">
                          {formatDate(bill.period_start)} to{" "}
                          {formatDate(bill.period_end)}
                        </span>
                      </p>
                      <p>
                        Net payable:{" "}
                        <span className="font-semibold text-[var(--surface-ink)]">
                          {formatCurrency(bill.net_payable)}
                        </span>
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {bill.contract_id ? (
                        <Badge tone="neutral">
                          {contractMap.get(bill.contract_id) ??
                            `Contract #${bill.contract_id}`}
                        </Badge>
                      ) : null}
                      <Badge tone="neutral">
                        Gross {formatCurrency(bill.gross_amount)}
                      </Badge>
                      <Badge tone="neutral">
                        Deductions {formatCurrency(bill.deductions)}
                      </Badge>
                    </div>
                    <p className="text-sm leading-6 text-[var(--surface-muted)]">
                      {bill.remarks || "No remarks added yet."}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => openReviewDrawer(bill.id)}
                    >
                      Review
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={async () => {
                        const blob = await downloadLabourBillPdf(accessToken ?? "", bill.id);
                        saveBlob(blob, `Labour_Bill_${bill.bill_no}.pdf`);
                      }}
                    >
                      <FileDown className="size-4" />
                      PDF
                    </Button>
                    <Button
                      size="sm"
                      disabled={
                        !canApprove ||
                        !canApproveBill(bill) ||
                        approveMutation.isPending
                      }
                      onClick={() => {
                        setServerMessage(null);
                        approveMutation.mutate(bill.id);
                      }}
                    >
                      <CheckCheck className="size-4" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={
                        !canApprove ||
                        !canMarkBillPaid(bill) ||
                        paidMutation.isPending
                      }
                      onClick={() => {
                        setServerMessage(null);
                        paidMutation.mutate(bill.id);
                      }}
                    >
                      Mark paid
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        <Drawer
          open={isDrawerOpen}
          title={selectedBill ? selectedBill.bill_no : "Create labour bill"}
          description={
            selectedBill
              ? "Review, refine, and transition the labour bill while keeping attendance as the only billing source."
              : "Create a new labour bill from approved attendance only. This keeps finance aligned with backend workflow rules."
          }
          onClose={closeDrawer}
          widthClassName="max-w-4xl"
        >
          <div className="space-y-6">
            {selectedBill ? (
              <div className="grid gap-4 md:grid-cols-4">
                <Card className="p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--surface-faint)]">
                    Project
                  </p>
                  <p className="mt-2 text-lg text-[var(--surface-ink)]">
                    {projectMap.get(selectedBill.project_id) ??
                      `Project #${selectedBill.project_id}`}
                  </p>
                </Card>
                <Card className="p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--surface-faint)]">
                    Contractor
                  </p>
                  <p className="mt-2 text-lg text-[var(--surface-ink)]">
                    {contractorMap.get(selectedBill.contractor_id) ??
                      `Contractor #${selectedBill.contractor_id}`}
                  </p>
                </Card>
                <Card className="p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--surface-faint)]">
                    Gross
                  </p>
                  <p className="mt-2 text-lg text-[var(--surface-ink)]">
                    {formatCurrency(selectedBill.gross_amount)}
                  </p>
                </Card>
                <Card className="p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--surface-faint)]">
                    Net payable
                  </p>
                  <p className="mt-2 text-lg text-[var(--surface-ink)]">
                    {formatCurrency(selectedBill.net_payable)}
                  </p>
                </Card>
              </div>
            ) : null}

            <Card className="p-5">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-[var(--surface-ink)]">
                    Attendance-driven billing guard
                  </p>
                  <p className="text-sm leading-6 text-[var(--surface-muted)]">
                    Approved and paid labour bills must stay attendance-backed.
                    The drawer keeps that truth visible, and immutable bills
                    stay review-only.
                  </p>
                </div>
                {selectedBill ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      disabled={
                        !canApprove ||
                        !canApproveBill(selectedBill) ||
                        approveMutation.isPending
                      }
                      onClick={() => {
                        setServerMessage(null);
                        approveMutation.mutate(selectedBill.id);
                      }}
                    >
                      <CheckCheck className="size-4" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={
                        !canApprove ||
                        !canMarkBillPaid(selectedBill) ||
                        paidMutation.isPending
                      }
                      onClick={() => {
                        setServerMessage(null);
                        paidMutation.mutate(selectedBill.id);
                      }}
                    >
                      Mark paid
                    </Button>
                  </div>
                ) : null}
              </div>
            </Card>

            <form
              className="space-y-6"
              onSubmit={handleSubmit(async (values) => {
                setServerMessage(null);
                await billMutation.mutateAsync(values);
              })}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className={labelClassName}>Bill number</span>
                  <input className={inputClassName} {...register("bill_no")} />
                  {errors.bill_no ? (
                    <p className="text-sm text-[var(--danger)]">
                      {errors.bill_no.message}
                    </p>
                  ) : null}
                </label>
                <label className="space-y-2">
                  <span className={labelClassName}>Status</span>
                  <select
                    className={inputClassName}
                    disabled={
                      isImmutableBill || (isEditMode ? !canApprove : !canCreate)
                    }
                    {...register("status")}
                  >
                    {getBillStatusOptions(selectedBill?.status).map(
                      (status) => (
                        <option key={status} value={status}>
                          {titleCase(status)}
                        </option>
                      ),
                    )}
                  </select>
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <label className="space-y-2">
                  <span className={labelClassName}>Project</span>
                  <select
                    className={inputClassName}
                    disabled={isImmutableBill}
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
                  <span className={labelClassName}>Contractor</span>
                  <select
                    className={inputClassName}
                    disabled={isImmutableBill}
                    {...register("contractor_id")}
                  >
                    <option value="">Select contractor</option>
                    {contractors.map((contractor) => (
                      <option key={contractor.id} value={contractor.id}>
                        {contractor.contractor_name}
                      </option>
                    ))}
                  </select>
                  {errors.contractor_id ? (
                    <p className="text-sm text-[var(--danger)]">
                      {errors.contractor_id.message}
                    </p>
                  ) : null}
                </label>
                <label className="space-y-2">
                  <span className={labelClassName}>Contract</span>
                  <select
                    className={inputClassName}
                    disabled={isImmutableBill}
                    {...register("contract_id")}
                  >
                    <option value="">Optional contract</option>
                    {contracts
                      .filter(
                        (contract) =>
                          !projectId ||
                          contract.project_id === Number(projectId),
                      )
                      .map((contract) => (
                        <option key={contract.id} value={contract.id}>
                          {contractMap.get(contract.id)}
                        </option>
                      ))}
                  </select>
                </label>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <label className="space-y-2">
                  <span className={labelClassName}>Period start</span>
                  <input
                    className={inputClassName}
                    type="date"
                    disabled={isImmutableBill}
                    {...register("period_start")}
                  />
                  {errors.period_start ? (
                    <p className="text-sm text-[var(--danger)]">
                      {errors.period_start.message}
                    </p>
                  ) : null}
                </label>
                <label className="space-y-2">
                  <span className={labelClassName}>Period end</span>
                  <input
                    className={inputClassName}
                    type="date"
                    disabled={isImmutableBill}
                    {...register("period_end")}
                  />
                  {errors.period_end ? (
                    <p className="text-sm text-[var(--danger)]">
                      {errors.period_end.message}
                    </p>
                  ) : null}
                </label>
                <label className="space-y-2">
                  <span className={labelClassName}>Deductions</span>
                  <input
                    className={inputClassName}
                    type="number"
                    step="0.01"
                    disabled={isImmutableBill}
                    {...register("deductions", { valueAsNumber: true })}
                  />
                </label>
              </div>

              <label className="space-y-2">
                <span className={labelClassName}>Remarks</span>
                <textarea
                  className={`${inputClassName} min-h-24 resize-none`}
                  disabled={isImmutableBill}
                  placeholder="Cycle note, deduction reason, or finance handoff context"
                  {...register("remarks")}
                />
              </label>

              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-[var(--surface-ink)]">
                      Approved attendance
                    </p>
                    <p className="text-sm text-[var(--surface-muted)]">
                      Visible gross preview {formatCurrency(grossPreview)} and
                      net preview{" "}
                      {formatCurrency(grossPreview - Number(deductions || 0))}.
                    </p>
                  </div>
                  <Badge tone="neutral">{selectedIds.length} selected</Badge>
                </div>

                {eligibleAttendances.length === 0 ? (
                  <Card className="border-dashed p-5 text-sm text-[var(--surface-muted)]">
                    No approved attendance matches the selected project,
                    contractor, and billing window.
                  </Card>
                ) : (
                  <div className="grid gap-3">
                    {eligibleAttendances.map((attendance) => (
                      <label
                        key={attendance.id}
                        className="flex items-start gap-3 rounded-[var(--radius)] border border-[color:var(--line)] bg-white/75 p-4"
                      >
                        <input
                          type="checkbox"
                          className="mt-1 size-4 rounded border-[color:var(--line)]"
                          disabled={isImmutableBill}
                          value={attendance.id}
                          {...register("attendance_ids")}
                        />
                        <span className="space-y-1 text-sm text-[var(--surface-muted)]">
                          <span className="block font-semibold text-[var(--surface-ink)]">
                            {attendance.muster_no}
                          </span>
                          <span className="block">
                            {formatDate(attendance.attendance_date)} �{" "}
                            {projectMap.get(attendance.project_id)} �{" "}
                            {formatCurrency(attendance.total_wage)}
                          </span>
                          <span className="block">
                            {attendance.items.length} crew lines �{" "}
                            {attendance.contractor_id
                              ? contractorMap.get(attendance.contractor_id)
                              : "Auto scoped"}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

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
              {errors.attendance_ids ? (
                <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
                  {errors.attendance_ids.message}
                </div>
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[color:var(--line)] bg-white/80 px-4 py-3 text-sm text-[var(--surface-muted)]">
                <span>
                  Current net payable{" "}
                  <span className="font-semibold text-[var(--surface-ink)]">
                    {selectedBill
                      ? formatCurrency(selectedBill.net_payable)
                      : formatCurrency(grossPreview - Number(deductions || 0))}
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
                      isSubmitting ||
                      billMutation.isPending ||
                      isImmutableBill ||
                      (isEditMode ? !canApprove : !canCreate)
                    }
                    type="submit"
                  >
                    {billMutation.isPending
                      ? "Saving..."
                      : isEditMode
                        ? "Update bill"
                        : "Create bill"}
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
