import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Banknote,
  CheckCheck,
  FileDown,
  PauseCircle,
  Plus,
  ReceiptText,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wallet,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";

import { useAuth } from "@/app/providers/auth-provider";
import {
  approveRABill,
  cancelRABill,
  createRABill,
  downloadRABillPdf,
  fetchRABills,
  generateRABill,
  holdRABill,
  markRABillPaid,
  markRABillPartiallyPaid,
  rejectRABill,
  submitRABill,
  verifyRABill,
} from "@/api/ra-bills";
import { getApiErrorMessage } from "@/api/client";
import { fetchContracts } from "@/api/contracts";
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
  buildRABillDefaults,
  buildRABillGenerateDefaults,
  canApproveRABill,
  canCancelRABill,
  canGenerateRABill,
  canHoldRABill,
  canMarkRABillPaid,
  canMarkRABillPartiallyPaid,
  canRejectRABill,
  canSubmitRABill,
  canVerifyRABill,
  filterRABills,
  financeWorkflowToneMap,
  getRABillMetrics,
} from "@/features/finance-operations/finance-operations-helpers";
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

const createSchema = z.object({
  contract_id: z.string().min(1, "Select a contract."),
  bill_date: z.string().min(1, "Select bill date."),
  bill_no: z.string().optional(),
  period_from: z.string().optional(),
  period_to: z.string().optional(),
  remarks: z.string().optional(),
});

const generateSchema = z.object({
  tds_percentage: z.string().optional(),
  apply_contract_retention: z.boolean(),
  deductions: z.array(
    z.object({
      deduction_type: z.string().min(1, "Type required."),
      amount: z.number().min(0, "Amount cannot be negative."),
      reason: z.string().optional(),
    }),
  ),
});

type CreateValues = z.infer<typeof createSchema>;
type GenerateValues = z.infer<typeof generateSchema>;
type WorkflowAction =
  | "submit"
  | "verify"
  | "approve"
  | "reject"
  | "cancel"
  | "finance_hold"
  | "partially_paid"
  | "paid";

const actionLabels: Record<WorkflowAction, string> = {
  submit: "submitted",
  verify: "verified",
  approve: "approved",
  reject: "rejected",
  cancel: "cancelled",
  finance_hold: "moved to finance hold",
  partially_paid: "marked partially paid",
  paid: "marked paid",
};

export default function RABillsPage() {
  const { accessToken, user } = useAuth();
  const queryClient = useQueryClient();
  const [drawerMode, setDrawerMode] = useState<"create" | "review" | null>(null);
  const [selectedBillId, setSelectedBillId] = useState<number | null>(null);
  const [workflowRemarks, setWorkflowRemarks] = useState("");
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    status: "all",
    contractId: "all",
    search: "",
  });

  const billsQuery = useQuery({
    queryKey: ["ra-bills"],
    queryFn: () => fetchRABills(accessToken ?? ""),
    enabled: Boolean(accessToken),
  });
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

  const bills = billsQuery.data ?? EMPTY_LIST;
  const contracts = contractsQuery.data ?? EMPTY_LIST;
  const projects = projectsQuery.data ?? EMPTY_LIST;
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
  const projectMap = useMemo(
    () => new Map(projects.map((project) => [project.id, project.name])),
    [projects],
  );
  const selectedBill = useMemo(
    () => bills.find((bill) => bill.id === selectedBillId) ?? null,
    [bills, selectedBillId],
  );
  const statusLogs = useMemo(
    () =>
      selectedBill
        ? [...selectedBill.status_logs].sort((left, right) =>
            right.created_at.localeCompare(left.created_at),
          )
        : EMPTY_LIST,
    [selectedBill],
  );

  const createForm = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: buildRABillDefaults(),
  });
  const generateForm = useForm<GenerateValues>({
    resolver: zodResolver(generateSchema),
    defaultValues: buildRABillGenerateDefaults(),
  });
  const deductionArray = useFieldArray({
    control: generateForm.control,
    name: "deductions",
  });

  useEffect(() => {
    generateForm.reset(buildRABillGenerateDefaults());
  }, [generateForm, selectedBillId]);

  const filteredBills = useMemo(
    () => filterRABills(bills, filters),
    [bills, filters],
  );
  const metrics = getRABillMetrics(filteredBills);
  const canCreate = hasPermissions(user?.role ?? "viewer", ["ra_bills:create"]);
  const canSubmit = hasPermissions(user?.role ?? "viewer", ["ra_bills:submit"]);
  const canVerify = hasPermissions(user?.role ?? "viewer", ["ra_bills:verify"]);
  const canApprove = hasPermissions(user?.role ?? "viewer", ["ra_bills:approve"]);
  const canReject = hasPermissions(user?.role ?? "viewer", ["ra_bills:reject"]);
  const canCancel = hasPermissions(user?.role ?? "viewer", ["ra_bills:cancel"]);
  const canHold = hasPermissions(user?.role ?? "viewer", ["ra_bills:finance_hold"]);
  const canMarkPartial = hasPermissions(user?.role ?? "viewer", ["ra_bills:partially_paid"]);
  const canMarkPaid = hasPermissions(user?.role ?? "viewer", ["ra_bills:paid"]);

  const createMutation = useMutation({
    mutationFn: (values: CreateValues) =>
      createRABill(accessToken ?? "", {
        contract_id: Number(values.contract_id),
        bill_date: values.bill_date,
        bill_no: values.bill_no?.trim() ? Number(values.bill_no) : undefined,
        period_from: values.period_from || null,
        period_to: values.period_to || null,
        remarks: values.remarks?.trim() || null,
      }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["ra-bills"] });
      setServerMessage(`Bill #${result.bill_no} draft created.`);
      setLocalError(null);
      setSelectedBillId(result.id);
      setWorkflowRemarks(result.remarks ?? "");
      setDrawerMode("review");
      createForm.reset(buildRABillDefaults());
    },
  });
  const generateMutation = useMutation({
    mutationFn: (values: GenerateValues) => {
      if (!selectedBill) {
        throw new Error("Select a bill first.");
      }
      return generateRABill(accessToken ?? "", selectedBill.id, {
        lock_version: selectedBill.lock_version,
        tds_percentage: values.tds_percentage?.trim() ? Number(values.tds_percentage) : null,
        apply_contract_retention: values.apply_contract_retention,
        deductions: values.deductions
          .filter((item) => Number.isFinite(item.amount) && item.amount > 0)
          .map((item) => ({
            deduction_type: item.deduction_type.trim(),
            amount: item.amount,
            reason: item.reason?.trim() || null,
          })),
      });
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["ra-bills"] });
      setServerMessage(`Bill #${result.bill_no} generated.`);
      setLocalError(null);
      setSelectedBillId(result.id);
    },
  });

  const actionMutation = useMutation({
    mutationFn: async ({ action, billId, remarks }: { action: WorkflowAction; billId: number; remarks?: string | null }) => {
      switch (action) {
        case "submit":
          return submitRABill(accessToken ?? "", billId, {
            remarks,
            lock_version: selectedBill?.lock_version,
          });
        case "verify":
          return verifyRABill(accessToken ?? "", billId, {
            remarks,
            lock_version: selectedBill?.lock_version,
          });
        case "approve":
          return approveRABill(accessToken ?? "", billId, {
            remarks,
            lock_version: selectedBill?.lock_version,
          });
        case "reject":
          return rejectRABill(accessToken ?? "", billId, {
            remarks,
            lock_version: selectedBill?.lock_version,
          });
        case "cancel":
          return cancelRABill(accessToken ?? "", billId, {
            remarks,
            lock_version: selectedBill?.lock_version,
          });
        case "finance_hold":
          return holdRABill(accessToken ?? "", billId, {
            remarks,
            lock_version: selectedBill?.lock_version,
          });
        case "partially_paid":
          return markRABillPartiallyPaid(accessToken ?? "", billId, {
            remarks,
            lock_version: selectedBill?.lock_version,
          });
        case "paid":
          return markRABillPaid(accessToken ?? "", billId, {
            remarks,
            lock_version: selectedBill?.lock_version,
          });
      }
    },
    onSuccess: (result, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["ra-bills"] });
      setServerMessage(`Bill #${result.bill_no} ${actionLabels[variables.action]}.`);
      setLocalError(null);
      setSelectedBillId(result.id);
    },
  });

  function openCreateDrawer() {
    setDrawerMode("create");
    setSelectedBillId(null);
    setWorkflowRemarks("");
    setServerMessage(null);
    setLocalError(null);
    createForm.reset(buildRABillDefaults());
    generateForm.reset(buildRABillGenerateDefaults());
  }

  function openReviewDrawer(billId: number) {
    const bill = bills.find((item) => item.id === billId);
    setDrawerMode("review");
    setSelectedBillId(billId);
    setWorkflowRemarks(bill?.remarks ?? "");
    setServerMessage(null);
    setLocalError(null);
  }

  function closeDrawer() {
    setDrawerMode(null);
    setSelectedBillId(null);
    setWorkflowRemarks("");
    setServerMessage(null);
    setLocalError(null);
  }

  async function runAction(action: WorkflowAction, billId: number) {
    setServerMessage(null);
    setLocalError(null);
    const remarks = workflowRemarks.trim() || null;
    if (action === "reject" && !remarks) {
      setLocalError("Reject action needs remarks.");
      return;
    }
    await actionMutation.mutateAsync({ action, billId, remarks });
  }

  const activeError =
    createMutation.error ?? generateMutation.error ?? actionMutation.error ?? null;

  if (billsQuery.isLoading || contractsQuery.isLoading || projectsQuery.isLoading) {
    return (
      <LoadingState
        title="Loading RA bill operator board"
        description="Pulling billing workflow, contract context, and project context from the backend."
      />
    );
  }

  if (billsQuery.error || contractsQuery.error || projectsQuery.error) {
    return (
      <ErrorState
        description={getApiErrorMessage(
          billsQuery.error ?? contractsQuery.error ?? projectsQuery.error,
        )}
        onRetry={() => {
          void billsQuery.refetch();
          void contractsQuery.refetch();
          void projectsQuery.refetch();
        }}
      />
    );
  }

  return (
    <PermissionGate permissions={["ra_bills:read"]}>
      <div className="space-y-6">
        <PageHeader
          eyebrow="RA bills"
          title="Move commercial bills from draft to finance-ready approval in one operator desk."
          description="Drafts, regeneration, verification, approval, and exception payment state all stay close to the same bill record."
          actions={
            <Button disabled={!canCreate} onClick={openCreateDrawer}>
              <ReceiptText className="size-4" />
              New RA bill draft
            </Button>
          }
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Visible bills" value={formatCompactNumber(metrics.total)} caption="Current filtered view" icon={ReceiptText} tone="info" />
          <StatCard label="Submitted + verified" value={formatCompactNumber(metrics.submitted + metrics.verified)} caption="Bills in review lanes" icon={ShieldCheck} tone="accent" />
          <StatCard label="Approved" value={formatCompactNumber(metrics.approved)} caption="Ready for payment planning" icon={CheckCheck} tone="success" />
          <StatCard label="Outstanding" value={formatCurrency(metrics.outstanding)} caption="Open dues in this slice" icon={Wallet} tone="accent" />
        </div>

        <Card className="p-5">
          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-[1.2fr_repeat(2,minmax(0,1fr))]">
            <label className="space-y-2 xl:col-span-1">
              <span className={labelClassName}>Search bill</span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[var(--surface-faint)]" />
                <input
                  className={`${inputClassName} pl-11`}
                  placeholder="Bill no, remarks, status"
                  value={filters.search}
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, search: event.target.value }))
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
                  setFilters((current) => ({ ...current, status: event.target.value }))
                }
              >
                <option value="all">All statuses</option>
                <option value="draft">Draft</option>
                <option value="submitted">Submitted</option>
                <option value="verified">Verified</option>
                <option value="approved">Approved</option>
                <option value="finance_hold">Finance hold</option>
                <option value="partially_paid">Partially paid</option>
                <option value="paid">Paid</option>
              </select>
            </label>
            <label className="space-y-2">
              <span className={labelClassName}>Contract</span>
              <select
                className={inputClassName}
                value={filters.contractId}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, contractId: event.target.value }))
                }
              >
                <option value="all">All contracts</option>
                {contracts.map((contract) => (
                  <option key={contract.id} value={contract.id}>
                    {contractMap.get(contract.id)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </Card>

        {filteredBills.length === 0 ? (
          <EmptyState
            title="No RA bills in this view"
            description="Open a draft or widen the filters to inspect another billing cycle."
          />
        ) : (
          <div className="grid gap-5">
            {filteredBills.map((bill) => {
              const contract = contracts.find((item) => item.id === bill.contract_id);
              return (
                <Card key={bill.id} className="p-5">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-2xl text-[var(--surface-ink)]">Bill #{bill.bill_no}</h3>
                        <Badge tone={financeWorkflowToneMap[bill.status as keyof typeof financeWorkflowToneMap] ?? "neutral"}>
                          {titleCase(bill.status)}
                        </Badge>
                        <Badge tone="neutral">{bill.items.length} items</Badge>
                      </div>
                      <div className="grid gap-2 text-sm text-[var(--surface-muted)] md:grid-cols-4">
                        <p>Contract: <span className="font-semibold text-[var(--surface-ink)]">{contractMap.get(bill.contract_id) ?? `Contract #${bill.contract_id}`}</span></p>
                        <p>Project: <span className="font-semibold text-[var(--surface-ink)]">{contract ? projectMap.get(contract.project_id) ?? `Project #${contract.project_id}` : "-"}</span></p>
                        <p>Bill date: <span className="font-semibold text-[var(--surface-ink)]">{formatDate(bill.bill_date)}</span></p>
                        <p>Net: <span className="font-semibold text-[var(--surface-ink)]">{formatCurrency(bill.net_payable)}</span></p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge tone="neutral">Gross {formatCurrency(bill.gross_amount)}</Badge>
                        <Badge tone="neutral">Deductions {formatCurrency(bill.total_deductions)}</Badge>
                        <Badge tone={bill.outstanding_amount > 0 ? "warning" : "success"}>Outstanding {formatCurrency(bill.outstanding_amount)}</Badge>
                      </div>
                      <p className="text-sm leading-6 text-[var(--surface-muted)]">
                        {bill.remarks || "No remarks yet. Open review for actions and generation."}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      <Button size="sm" variant="secondary" onClick={() => openReviewDrawer(bill.id)}>Review</Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={async () => {
                          const blob = await downloadRABillPdf(accessToken ?? "", bill.id);
                          saveBlob(blob, `RA_Bill_${bill.bill_no}.pdf`);
                        }}
                      >
                        <FileDown className="size-4" />PDF
                      </Button>
                      {canSubmit && canSubmitRABill(bill) ? (
                        <Button size="sm" disabled={actionMutation.isPending} onClick={() => { void runAction("submit", bill.id); }}>
                          <Send className="size-4" />Submit
                        </Button>
                      ) : null}
                      {canVerify && canVerifyRABill(bill) ? (
                        <Button size="sm" disabled={actionMutation.isPending} onClick={() => { void runAction("verify", bill.id); }}>
                          <ShieldCheck className="size-4" />Verify
                        </Button>
                      ) : null}
                      {canApprove && canApproveRABill(bill) ? (
                        <Button size="sm" disabled={actionMutation.isPending} onClick={() => { void runAction("approve", bill.id); }}>
                          <CheckCheck className="size-4" />Approve
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
        <Drawer
          open={drawerMode !== null}
          title={selectedBill ? `Bill #${selectedBill.bill_no}` : "Create RA bill draft"}
          description={
            selectedBill
              ? "Generate, review, and transition the bill without breaking backend workflow truth."
              : "Create the draft first. Item generation happens after the bill header exists."
          }
          onClose={closeDrawer}
          widthClassName="max-w-5xl"
        >
          {drawerMode === "create" ? (
            <form
              className="space-y-6"
              onSubmit={createForm.handleSubmit(async (values) => {
                setServerMessage(null);
                setLocalError(null);
                await createMutation.mutateAsync(values);
              })}
            >
              <Card className="p-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className={labelClassName}>Contract</span>
                    <select className={inputClassName} {...createForm.register("contract_id")}>
                      <option value="">Select contract</option>
                      {contracts.map((contract) => (
                        <option key={contract.id} value={contract.id}>{contractMap.get(contract.id)}</option>
                      ))}
                    </select>
                    {createForm.formState.errors.contract_id ? <p className="text-sm text-[var(--danger)]">{createForm.formState.errors.contract_id.message}</p> : null}
                  </label>
                  <label className="space-y-2">
                    <span className={labelClassName}>Bill date</span>
                    <input className={inputClassName} type="date" {...createForm.register("bill_date")} />
                    {createForm.formState.errors.bill_date ? <p className="text-sm text-[var(--danger)]">{createForm.formState.errors.bill_date.message}</p> : null}
                  </label>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <label className="space-y-2">
                    <span className={labelClassName}>Bill number</span>
                    <input className={inputClassName} placeholder="Optional" {...createForm.register("bill_no")} />
                  </label>
                  <label className="space-y-2">
                    <span className={labelClassName}>Period from</span>
                    <input className={inputClassName} type="date" {...createForm.register("period_from")} />
                  </label>
                  <label className="space-y-2">
                    <span className={labelClassName}>Period to</span>
                    <input className={inputClassName} type="date" {...createForm.register("period_to")} />
                  </label>
                </div>
                <label className="mt-4 block space-y-2">
                  <span className={labelClassName}>Remarks</span>
                  <textarea className={`${inputClassName} min-h-28 resize-none`} {...createForm.register("remarks")} />
                </label>
              </Card>
              <div className="flex flex-wrap justify-between gap-3 rounded-2xl border border-[color:var(--line)] bg-white/80 px-4 py-3">
                <Button type="button" variant="secondary" onClick={closeDrawer}>Close</Button>
                <Button disabled={!canCreate || createForm.formState.isSubmitting || createMutation.isPending} type="submit">
                  {createMutation.isPending ? "Creating..." : "Create draft"}
                </Button>
              </div>
            </form>
          ) : selectedBill ? (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <StatCard label="Status" value={titleCase(selectedBill.status)} caption="Current bill workflow state" icon={ShieldCheck} tone="info" />
                <StatCard label="Net payable" value={formatCurrency(selectedBill.net_payable)} caption="After deduction impact" icon={Wallet} tone="accent" />
                <StatCard label="Outstanding" value={formatCurrency(selectedBill.outstanding_amount)} caption="Normal settlement should use payments" icon={Banknote} tone="accent" />
                <StatCard label="Items" value={formatCompactNumber(selectedBill.items.length)} caption={`${formatCompactNumber(selectedBill.deductions.length)} deductions on bill`} icon={ReceiptText} tone="success" />
              </div>

              {canGenerateRABill(selectedBill) ? (
                <form
                  className="space-y-4"
                  onSubmit={generateForm.handleSubmit(async (values) => {
                    setServerMessage(null);
                    setLocalError(null);
                    await generateMutation.mutateAsync(values);
                  })}
                >
                  <Card className="p-5">
                    <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-[var(--surface-ink)]">Generate from work done</p>
                        <p className="text-sm text-[var(--surface-muted)]">Draft-only generation keeps billing aligned with measured work and deduction rules.</p>
                      </div>
                      <Button disabled={!canCreate || generateMutation.isPending} type="submit">
                        <Sparkles className="size-4" />
                        {generateMutation.isPending ? "Generating..." : "Generate items"}
                      </Button>
                    </div>
                    <div className="grid gap-4 md:grid-cols-[180px_1fr]">
                      <label className="space-y-2">
                        <span className={labelClassName}>TDS %</span>
                        <input className={inputClassName} type="number" step="0.01" {...generateForm.register("tds_percentage")} />
                      </label>
                      <label className="flex items-center gap-3 rounded-2xl border border-[color:var(--line)] bg-white/75 px-4 py-3 text-sm text-[var(--surface-ink)]">
                        <input className="size-4" type="checkbox" {...generateForm.register("apply_contract_retention")} />
                        Apply contract retention while generating
                      </label>
                    </div>
                    <div className="mt-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-[var(--surface-ink)]">Manual deductions</p>
                        <Button type="button" size="sm" variant="secondary" onClick={() => deductionArray.append({ deduction_type: "other", amount: 0, reason: "" })}>
                          <Plus className="size-4" />Add deduction
                        </Button>
                      </div>
                      {deductionArray.fields.length === 0 ? (
                        <Card className="border-dashed p-4 text-sm text-[var(--surface-muted)]">No manual deductions added yet.</Card>
                      ) : (
                        <div className="grid gap-3">
                          {deductionArray.fields.map((field, index) => (
                            <div key={field.id} className="rounded-[var(--radius)] border border-[color:var(--line)] bg-white/75 p-4">
                              <div className="grid gap-3 md:grid-cols-[1fr_160px_1fr_auto] md:items-end">
                                <label className="space-y-2">
                                  <span className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--surface-faint)]">Type</span>
                                  <input className={inputClassName} {...generateForm.register(`deductions.${index}.deduction_type`)} />
                                </label>
                                <label className="space-y-2">
                                  <span className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--surface-faint)]">Amount</span>
                                  <input className={inputClassName} type="number" step="0.01" {...generateForm.register(`deductions.${index}.amount`, { valueAsNumber: true })} />
                                </label>
                                <label className="space-y-2">
                                  <span className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--surface-faint)]">Reason</span>
                                  <input className={inputClassName} {...generateForm.register(`deductions.${index}.reason`)} />
                                </label>
                                <Button type="button" size="sm" variant="ghost" onClick={() => deductionArray.remove(index)}>
                                  <Trash2 className="size-4" />Remove
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </Card>
                </form>
              ) : null}

              <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
                <Card className="p-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-[var(--surface-ink)]">Bill items</p>
                    <Badge tone="neutral">{selectedBill.items.length} lines</Badge>
                  </div>
                  {selectedBill.items.length === 0 ? (
                    <Card className="border-dashed p-4 text-sm text-[var(--surface-muted)]">No items generated yet.</Card>
                  ) : (
                    <div className="grid gap-3">
                      {selectedBill.items.slice(0, 8).map((item) => (
                        <div key={item.id} className="rounded-[var(--radius)] border border-[color:var(--line)] bg-white/75 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="font-semibold text-[var(--surface-ink)]">{item.description_snapshot}</p>
                              <p className="mt-1 text-xs uppercase tracking-[0.15em] text-[var(--surface-faint)]">{item.item_code_snapshot || "No code"} / {item.unit_snapshot}</p>
                            </div>
                            <Badge tone="neutral">{formatCurrency(item.amount)}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                <div className="space-y-6">
                  <Card className="p-5">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-[var(--surface-ink)]">Deductions</p>
                      <Badge tone="neutral">{formatCurrency(selectedBill.total_deductions)}</Badge>
                    </div>
                    {selectedBill.deductions.length === 0 ? (
                      <Card className="border-dashed p-4 text-sm text-[var(--surface-muted)]">No deductions on this bill yet.</Card>
                    ) : (
                      <div className="grid gap-3">
                        {selectedBill.deductions.map((deduction) => (
                          <div key={deduction.id} className="rounded-[var(--radius)] border border-[color:var(--line)] bg-white/75 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="font-semibold text-[var(--surface-ink)]">{titleCase(deduction.deduction_type)}</p>
                                <p className="mt-1 text-sm text-[var(--surface-muted)]">{deduction.reason || deduction.description || "No note"}</p>
                              </div>
                              <Badge tone={deduction.is_system_generated ? "accent" : "neutral"}>{formatCurrency(deduction.amount)}</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>

                  <Card className="p-5">
                    <p className="text-sm font-semibold text-[var(--surface-ink)]">Status history</p>
                    <div className="mt-4 space-y-3">
                      {statusLogs.slice(0, 6).map((log) => (
                        <div key={log.id} className="rounded-[var(--radius)] border border-[color:var(--line)] bg-white/75 p-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge tone="neutral">{titleCase(log.action)}</Badge>
                            <span className="text-sm text-[var(--surface-muted)]">{formatDate(log.created_at)}</span>
                          </div>
                          <p className="mt-2 text-sm text-[var(--surface-muted)]">{log.from_status ? titleCase(log.from_status) : "Created"} to {titleCase(log.to_status)}</p>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              </div>

              <Card className="p-5">
                <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                  <label className="space-y-2">
                    <span className={labelClassName}>Workflow remarks</span>
                    <textarea className={`${inputClassName} min-h-28 resize-none`} value={workflowRemarks} onChange={(event) => setWorkflowRemarks(event.target.value)} />
                  </label>
                  <div className="space-y-4 rounded-[var(--radius)] border border-[color:var(--line)] bg-white/80 p-4">
                    <p className="text-sm font-semibold text-[var(--surface-ink)]">Workflow actions</p>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" disabled={!canSubmit || !canSubmitRABill(selectedBill) || actionMutation.isPending} onClick={() => { void runAction("submit", selectedBill.id); }}><Send className="size-4" />Submit</Button>
                      <Button size="sm" disabled={!canVerify || !canVerifyRABill(selectedBill) || actionMutation.isPending} onClick={() => { void runAction("verify", selectedBill.id); }}><ShieldCheck className="size-4" />Verify</Button>
                      <Button size="sm" disabled={!canApprove || !canApproveRABill(selectedBill) || actionMutation.isPending} onClick={() => { void runAction("approve", selectedBill.id); }}><CheckCheck className="size-4" />Approve</Button>
                      <Button size="sm" variant="secondary" disabled={!canHold || !canHoldRABill(selectedBill) || actionMutation.isPending} onClick={() => { void runAction("finance_hold", selectedBill.id); }}><PauseCircle className="size-4" />Finance hold</Button>
                      <Button size="sm" variant="ghost" disabled={!canReject || !canRejectRABill(selectedBill) || actionMutation.isPending} onClick={() => { void runAction("reject", selectedBill.id); }}><XCircle className="size-4" />Reject</Button>
                      <Button size="sm" variant="ghost" disabled={!canCancel || !canCancelRABill(selectedBill) || actionMutation.isPending} onClick={() => { void runAction("cancel", selectedBill.id); }}>Cancel</Button>
                    </div>
                    <div className="border-t border-[color:var(--line)] pt-4">
                      <p className="text-sm font-semibold text-[var(--surface-ink)]">Exception finance state</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button size="sm" variant="secondary" disabled={!canMarkPartial || !canMarkRABillPartiallyPaid(selectedBill) || actionMutation.isPending} onClick={() => { void runAction("partially_paid", selectedBill.id); }}>Partially paid</Button>
                        <Button size="sm" variant="secondary" disabled={!canMarkPaid || !canMarkRABillPaid(selectedBill) || actionMutation.isPending} onClick={() => { void runAction("paid", selectedBill.id); }}><Banknote className="size-4" />Mark paid</Button>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          ) : null}

          {serverMessage ? <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{serverMessage}</div> : null}
          {localError ? <div className="mt-4 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">{localError}</div> : null}
          {activeError ? <div className="mt-4 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">{getApiErrorMessage(activeError)}</div> : null}
        </Drawer>
      </div>
    </PermissionGate>
  );
}
