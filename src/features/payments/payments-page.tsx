import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Banknote,
  FileDown,
  HandCoins,
  Plus,
  Search,
  SendToBack,
  ShieldCheck,
  Trash2,
  WalletCards,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";

import { useAuth } from "@/app/providers/auth-provider";
import {
  allocatePayment,
  approvePayment,
  createPayment,
  downloadPaymentPdf,
  fetchOutstandingBills,
  fetchPayments,
  releasePayment,
} from "@/api/payments";
import { getApiErrorMessage } from "@/api/client";
import { fetchContracts } from "@/api/contracts";
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
  buildPaymentAllocationLine,
  buildPaymentDefaults,
  canAllocatePayment,
  canApprovePayment,
  canReleasePayment,
  filterPayments,
  financeWorkflowToneMap,
  getAllocationDraftTotal,
  getPaymentMetrics,
} from "@/features/finance-operations/finance-operations-helpers";
import { formatCompactNumber, formatCurrency, formatDate, titleCase } from "@/lib/format";
import { hasPermissions } from "@/lib/permissions";
import { saveBlob } from "@/lib/download";

const EMPTY_LIST: never[] = [];
const inputClassName =
  "w-full rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-amber-100";
const labelClassName = "text-sm font-semibold text-[var(--surface-ink)]";

const paymentSchema = z.object({
  contract_id: z.string().min(1, "Select a contract."),
  payment_date: z.string().min(1, "Select payment date."),
  amount: z.number().gt(0, "Amount must be greater than zero."),
  ra_bill_id: z.string().optional(),
  payment_mode: z.string().optional(),
  reference_no: z.string().optional(),
  remarks: z.string().optional(),
});

const allocationSchema = z.object({
  allocations: z.array(
    z.object({
      ra_bill_id: z.string().min(1, "Select an RA bill."),
      amount: z.number().gt(0, "Amount must be greater than zero."),
      remarks: z.string().optional(),
    }),
  ).min(1, "Add at least one allocation line."),
});

type PaymentValues = z.infer<typeof paymentSchema>;
type AllocationValues = z.infer<typeof allocationSchema>;
type PaymentAction = "approve" | "release";

export default function PaymentsPage() {
  const { accessToken, user } = useAuth();
  const queryClient = useQueryClient();
  const [drawerMode, setDrawerMode] = useState<"create" | "review" | null>(null);
  const [selectedPaymentId, setSelectedPaymentId] = useState<number | null>(null);
  const [actionRemarks, setActionRemarks] = useState("");
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [filters, setFilters] = useState({ status: "all", contractId: "all", search: "" });

  const paymentsQuery = useQuery({
    queryKey: ["payments"],
    queryFn: () => fetchPayments(accessToken ?? ""),
    enabled: Boolean(accessToken),
  });
  const outstandingQuery = useQuery({
    queryKey: ["payments", "outstanding-bills"],
    queryFn: () => fetchOutstandingBills(accessToken ?? ""),
    enabled: Boolean(accessToken),
  });
  const contractsQuery = useQuery({
    queryKey: ["contracts"],
    queryFn: () => fetchContracts(accessToken ?? ""),
    enabled: Boolean(accessToken),
  });

  const payments = Array.isArray(paymentsQuery.data) ? paymentsQuery.data : EMPTY_LIST;
  const outstandingBills = Array.isArray(outstandingQuery.data) ? outstandingQuery.data : EMPTY_LIST;
  const contracts = Array.isArray(contractsQuery.data) ? contractsQuery.data : EMPTY_LIST;
  const contractMap = useMemo(
    () => new Map(contracts.map((contract) => [contract.id, `${contract.contract_no} - ${contract.title}`])),
    [contracts],
  );
  const selectedPayment = useMemo(
    () => payments.find((payment) => payment.id === selectedPaymentId) ?? null,
    [payments, selectedPaymentId],
  );

  const paymentForm = useForm<PaymentValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: buildPaymentDefaults(),
  });
  const allocationForm = useForm<AllocationValues>({
    resolver: zodResolver(allocationSchema),
    defaultValues: { allocations: [buildPaymentAllocationLine()] },
  });
  const allocationArray = useFieldArray({
    control: allocationForm.control,
    name: "allocations",
  });
  const allocationLines = useWatch({
    control: allocationForm.control,
    name: "allocations",
  });
  const createContractId = useWatch({ control: paymentForm.control, name: "contract_id" });
  const activeContractId = drawerMode === "review" && selectedPayment
    ? selectedPayment.contract_id
    : createContractId
      ? Number(createContractId)
      : null;

  const drawerOutstandingQuery = useQuery({
    queryKey: ["payments", "drawer-outstanding", activeContractId],
    queryFn: () => fetchOutstandingBills(accessToken ?? "", activeContractId),
    enabled: Boolean(accessToken && activeContractId),
  });
  const drawerOutstandingBills = Array.isArray(drawerOutstandingQuery.data)
    ? drawerOutstandingQuery.data
    : EMPTY_LIST;

  useEffect(() => {
    const firstBillId = drawerOutstandingBills[0]?.ra_bill_id;
    allocationForm.reset({
      allocations: [buildPaymentAllocationLine(firstBillId ? String(firstBillId) : "")],
    });
  }, [allocationForm, drawerOutstandingBills, selectedPaymentId]);

  const filteredPayments = useMemo(
    () => filterPayments(payments, filters),
    [filters, payments],
  );
  const metrics = getPaymentMetrics(filteredPayments, outstandingBills);
  const canCreate = hasPermissions(user?.role ?? "viewer", ["payments:create"]);
  const canApprove = hasPermissions(user?.role ?? "viewer", ["payments:approve"]);
  const canRelease = hasPermissions(user?.role ?? "viewer", ["payments:release"]);
  const canAllocate = hasPermissions(user?.role ?? "viewer", ["payments:allocate"]);
  const modeOptions = useMemo(() => {
    const values = new Set(["bank_transfer", "cheque", "cash", "upi"]);
    payments.forEach((payment) => {
      if (payment.payment_mode) {
        values.add(payment.payment_mode);
      }
    });
    return [...values];
  }, [payments]);

  const paymentMutation = useMutation({
    mutationFn: (values: PaymentValues) =>
      createPayment(accessToken ?? "", {
        contract_id: Number(values.contract_id),
        payment_date: values.payment_date,
        amount: values.amount,
        ra_bill_id: values.ra_bill_id ? Number(values.ra_bill_id) : null,
        payment_mode: values.payment_mode?.trim() || null,
        reference_no: values.reference_no?.trim() || null,
        remarks: values.remarks?.trim() || null,
      }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["payments"] });
      setServerMessage(`Payment #${result.id} created.`);
      setLocalError(null);
      setSelectedPaymentId(result.id);
      setDrawerMode("review");
      paymentForm.reset(buildPaymentDefaults());
    },
  });
  const paymentActionMutation = useMutation({
    mutationFn: ({ action, paymentId, remarks }: { action: PaymentAction; paymentId: number; remarks?: string | null }) => {
      if (action === "approve") {
        return approvePayment(accessToken ?? "", paymentId, {
          remarks,
          lock_version: selectedPayment?.lock_version,
        });
      }
      return releasePayment(accessToken ?? "", paymentId, {
        remarks,
        lock_version: selectedPayment?.lock_version,
      });
    },
    onSuccess: (result, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["payments"] });
      void queryClient.invalidateQueries({ queryKey: ["payments", "outstanding-bills"] });
      setServerMessage(`Payment #${result.id} ${variables.action}d.`);
      setLocalError(null);
      setSelectedPaymentId(result.id);
    },
  });

  const allocateMutation = useMutation({
    mutationFn: (values: AllocationValues) => {
      if (!selectedPayment) {
        throw new Error("Select a payment first.");
      }
      return allocatePayment(
        accessToken ?? "",
        selectedPayment.id,
        values.allocations.map((line) => ({
          ra_bill_id: Number(line.ra_bill_id),
          amount: line.amount,
          remarks: line.remarks?.trim() || null,
        })),
      );
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["payments"] });
      void queryClient.invalidateQueries({ queryKey: ["payments", "outstanding-bills"] });
      void queryClient.invalidateQueries({ queryKey: ["payments", "drawer-outstanding", result.contract_id] });
      setServerMessage(`Payment #${result.id} allocated successfully.`);
      setLocalError(null);
      setSelectedPaymentId(result.id);
    },
  });

  function openCreateDrawer() {
    setDrawerMode("create");
    setSelectedPaymentId(null);
    setActionRemarks("");
    setServerMessage(null);
    setLocalError(null);
    paymentForm.reset(buildPaymentDefaults());
    allocationForm.reset({ allocations: [buildPaymentAllocationLine()] });
  }

  function openReviewDrawer(paymentId: number) {
    const payment = payments.find((item) => item.id === paymentId);
    setDrawerMode("review");
    setSelectedPaymentId(paymentId);
    setActionRemarks(payment?.remarks ?? "");
    setServerMessage(null);
    setLocalError(null);
  }

  function closeDrawer() {
    setDrawerMode(null);
    setSelectedPaymentId(null);
    setActionRemarks("");
    setServerMessage(null);
    setLocalError(null);
  }

  async function runPaymentAction(action: PaymentAction, paymentId: number) {
    setServerMessage(null);
    setLocalError(null);
    await paymentActionMutation.mutateAsync({
      action,
      paymentId,
      remarks: actionRemarks.trim() || null,
    });
  }

  const activeError =
    paymentMutation.error ?? paymentActionMutation.error ?? allocateMutation.error ?? null;
  const draftAllocationTotal = getAllocationDraftTotal(allocationLines ?? EMPTY_LIST);

  if (paymentsQuery.isLoading || outstandingQuery.isLoading || contractsQuery.isLoading) {
    return (
      <LoadingState
        title="Opening payment operations desk"
        description="Syncing payment pool, release posture, contract context, and outstanding RA bills."
      />
    );
  }

  if (paymentsQuery.error || outstandingQuery.error || contractsQuery.error) {
    return (
      <ErrorState
        description={getApiErrorMessage(
          paymentsQuery.error ?? outstandingQuery.error ?? contractsQuery.error,
        )}
        onRetry={() => {
          void paymentsQuery.refetch();
          void outstandingQuery.refetch();
          void contractsQuery.refetch();
        }}
      />
    );
  }

  return (
    <PermissionGate permissions={["payments:read"]}>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Payments"
          title="Run release and allocation workflow from one finance desk."
          description="Create draft payments, move them through approval and release, then allocate only against valid outstanding RA bills for the same contract."
          actions={
            <Button disabled={!canCreate} onClick={openCreateDrawer}>
              <Banknote className="size-4" />
              New payment
            </Button>
          }
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Payment pool" value={formatCurrency(metrics.pool)} caption="Total value in current view" icon={Banknote} tone="accent" />
          <StatCard label="Released" value={formatCompactNumber(metrics.released)} caption="Ready for allocation" icon={SendToBack} tone="success" />
          <StatCard label="Available" value={formatCurrency(metrics.available)} caption="Unallocated release balance" icon={HandCoins} tone="info" />
          <StatCard label="Outstanding bills" value={formatCompactNumber(metrics.outstandingCount)} caption={formatCurrency(metrics.outstanding)} icon={WalletCards} tone="accent" />
        </div>

        <Card className="p-5">
          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-[1.2fr_repeat(2,minmax(0,1fr))]">
            <label className="space-y-2 xl:col-span-1">
              <span className={labelClassName}>Search payment</span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[var(--surface-faint)]" />
                <input
                  className={`${inputClassName} pl-11`}
                  placeholder="Payment id, reference, remarks"
                  value={filters.search}
                  onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                />
              </div>
            </label>
            <label className="space-y-2">
              <span className={labelClassName}>Status</span>
              <select className={inputClassName} value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
                <option value="all">All statuses</option>
                <option value="draft">Draft</option>
                <option value="approved">Approved</option>
                <option value="released">Released</option>
              </select>
            </label>
            <label className="space-y-2">
              <span className={labelClassName}>Contract</span>
              <select className={inputClassName} value={filters.contractId} onChange={(event) => setFilters((current) => ({ ...current, contractId: event.target.value }))}>
                <option value="all">All contracts</option>
                {contracts.map((contract) => (
                  <option key={contract.id} value={contract.id}>{contractMap.get(contract.id)}</option>
                ))}
              </select>
            </label>
          </div>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          {filteredPayments.length === 0 ? (
            <EmptyState title="No payments in this view" description="Create a payment draft or widen the filters to inspect another finance slice." />
          ) : (
            <div className="grid gap-5">
              {filteredPayments.map((payment) => (
                <Card key={payment.id} className="p-5">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-2xl text-[var(--surface-ink)]">Payment #{payment.id}</h3>
                        <Badge tone={financeWorkflowToneMap[payment.status as keyof typeof financeWorkflowToneMap] ?? "neutral"}>{titleCase(payment.status)}</Badge>
                        <Badge tone="neutral">{payment.allocations.length} allocations</Badge>
                      </div>
                      <div className="grid gap-2 text-sm text-[var(--surface-muted)] md:grid-cols-4">
                        <p>Contract: <span className="font-semibold text-[var(--surface-ink)]">{contractMap.get(payment.contract_id) ?? `Contract #${payment.contract_id}`}</span></p>
                        <p>Date: <span className="font-semibold text-[var(--surface-ink)]">{formatDate(payment.payment_date)}</span></p>
                        <p>Mode: <span className="font-semibold text-[var(--surface-ink)]">{titleCase(payment.payment_mode ?? "unassigned")}</span></p>
                        <p>Reference: <span className="font-semibold text-[var(--surface-ink)]">{payment.reference_no || "-"}</span></p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge tone="neutral">Amount {formatCurrency(payment.amount)}</Badge>
                        <Badge tone="neutral">Allocated {formatCurrency(payment.allocated_amount)}</Badge>
                        <Badge tone={payment.available_amount > 0 ? "warning" : "success"}>Available {formatCurrency(payment.available_amount)}</Badge>
                      </div>
                      <p className="text-sm leading-6 text-[var(--surface-muted)]">{payment.remarks || "No remarks yet. Open review for action and allocation controls."}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      <Button size="sm" variant="secondary" onClick={() => openReviewDrawer(payment.id)}>Review</Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={async () => {
                          const blob = await downloadPaymentPdf(accessToken ?? "", payment.id);
                          saveBlob(blob, `Payment_Voucher_${payment.id}.pdf`);
                        }}
                      >
                        <FileDown className="size-4" />PDF
                      </Button>
                      {canApprove && canApprovePayment(payment) ? <Button size="sm" disabled={paymentActionMutation.isPending} onClick={() => { void runPaymentAction("approve", payment.id); }}><ShieldCheck className="size-4" />Approve</Button> : null}
                      {canRelease && canReleasePayment(payment) ? <Button size="sm" disabled={paymentActionMutation.isPending} onClick={() => { void runPaymentAction("release", payment.id); }}><SendToBack className="size-4" />Release</Button> : null}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
          <Card className="h-fit p-5 xl:sticky xl:top-28">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[var(--surface-ink)]">Outstanding RA bills</p>
                <p className="text-sm text-[var(--surface-muted)]">Allocation can only happen against these approved or partially paid bills.</p>
              </div>
              <Badge tone="warning">{outstandingBills.length}</Badge>
            </div>
            {outstandingBills.length === 0 ? (
              <EmptyState title="No outstanding bills" description="This panel lights up when approved RA bills still need settlement." />
            ) : (
              <div className="grid gap-3">
                {outstandingBills.slice(0, 8).map((bill) => (
                  <div key={bill.ra_bill_id} className="rounded-[var(--radius)] border border-[color:var(--line)] bg-white/75 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-[var(--surface-ink)]">Bill #{bill.bill_no}</p>
                      <Badge tone={bill.status === "partially_paid" ? "accent" : "warning"}>{titleCase(bill.status)}</Badge>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-[var(--surface-muted)]">
                      <p>Net payable: <span className="font-semibold text-[var(--surface-ink)]">{formatCurrency(bill.net_payable)}</span></p>
                      <p>Paid: <span className="font-semibold text-[var(--surface-ink)]">{formatCurrency(bill.paid_amount)}</span></p>
                      <p>Outstanding: <span className="font-semibold text-[var(--surface-ink)]">{formatCurrency(bill.outstanding_amount)}</span></p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <Drawer
          open={drawerMode !== null}
          title={selectedPayment ? `Payment #${selectedPayment.id}` : "Create payment draft"}
          description={selectedPayment ? "Approve, release, and allocate this payment while staying within contract-scoped backend rules." : "Create a draft payment first, then move it through finance actions and allocation."}
          onClose={closeDrawer}
          widthClassName="max-w-5xl"
        >
          {drawerMode === "create" ? (
            <form className="space-y-6" onSubmit={paymentForm.handleSubmit(async (values) => {
              setServerMessage(null);
              setLocalError(null);
              await paymentMutation.mutateAsync(values);
            })}>
              <Card className="p-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className={labelClassName}>Contract</span>
                    <select className={inputClassName} {...paymentForm.register("contract_id")}>
                      <option value="">Select contract</option>
                      {contracts.map((contract) => (
                        <option key={contract.id} value={contract.id}>{contractMap.get(contract.id)}</option>
                      ))}
                    </select>
                    {paymentForm.formState.errors.contract_id ? <p className="text-sm text-[var(--danger)]">{paymentForm.formState.errors.contract_id.message}</p> : null}
                  </label>
                  <label className="space-y-2">
                    <span className={labelClassName}>Payment date</span>
                    <input className={inputClassName} type="date" {...paymentForm.register("payment_date")} />
                    {paymentForm.formState.errors.payment_date ? <p className="text-sm text-[var(--danger)]">{paymentForm.formState.errors.payment_date.message}</p> : null}
                  </label>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <label className="space-y-2">
                    <span className={labelClassName}>Amount</span>
                    <input className={inputClassName} type="number" step="0.01" {...paymentForm.register("amount", { valueAsNumber: true })} />
                    {paymentForm.formState.errors.amount ? <p className="text-sm text-[var(--danger)]">{paymentForm.formState.errors.amount.message}</p> : null}
                  </label>
                  <label className="space-y-2">
                    <span className={labelClassName}>Payment mode</span>
                    <select className={inputClassName} {...paymentForm.register("payment_mode")}>
                      {modeOptions.map((mode) => <option key={mode} value={mode}>{titleCase(mode)}</option>)}
                    </select>
                  </label>
                  <label className="space-y-2">
                    <span className={labelClassName}>Seed RA bill</span>
                    <select className={inputClassName} {...paymentForm.register("ra_bill_id")}>
                      <option value="">Optional outstanding bill</option>
                      {drawerOutstandingBills.map((bill) => (
                        <option key={bill.ra_bill_id} value={bill.ra_bill_id}>Bill #{bill.bill_no} / {formatCurrency(bill.outstanding_amount)}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className={labelClassName}>Reference no</span>
                    <input className={inputClassName} {...paymentForm.register("reference_no")} />
                  </label>
                  <label className="space-y-2">
                    <span className={labelClassName}>Remarks</span>
                    <input className={inputClassName} {...paymentForm.register("remarks")} />
                  </label>
                </div>
              </Card>
              <div className="flex flex-wrap justify-between gap-3 rounded-2xl border border-[color:var(--line)] bg-white/80 px-4 py-3">
                <Button type="button" variant="secondary" onClick={closeDrawer}>Close</Button>
                <Button disabled={!canCreate || paymentForm.formState.isSubmitting || paymentMutation.isPending} type="submit">{paymentMutation.isPending ? "Creating..." : "Create payment"}</Button>
              </div>
            </form>
          ) : selectedPayment ? (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <StatCard label="Status" value={titleCase(selectedPayment.status)} caption="Current payment workflow state" icon={ShieldCheck} tone="info" />
                <StatCard label="Amount" value={formatCurrency(selectedPayment.amount)} caption="Total payment value" icon={Banknote} tone="accent" />
                <StatCard label="Allocated" value={formatCurrency(selectedPayment.allocated_amount)} caption="Already mapped to RA bills" icon={WalletCards} tone="success" />
                <StatCard label="Available" value={formatCurrency(selectedPayment.available_amount)} caption="Balance left for allocation" icon={HandCoins} tone="accent" />
              </div>

              <Card className="p-5">
                <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                  <label className="space-y-2">
                    <span className={labelClassName}>Finance remarks</span>
                    <textarea className={`${inputClassName} min-h-28 resize-none`} value={actionRemarks} onChange={(event) => setActionRemarks(event.target.value)} />
                  </label>
                  <div className="space-y-4 rounded-[var(--radius)] border border-[color:var(--line)] bg-white/80 p-4">
                    <p className="text-sm font-semibold text-[var(--surface-ink)]">Workflow actions</p>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" disabled={!canApprove || !canApprovePayment(selectedPayment) || paymentActionMutation.isPending} onClick={() => { void runPaymentAction("approve", selectedPayment.id); }}><ShieldCheck className="size-4" />Approve</Button>
                      <Button size="sm" variant="secondary" disabled={!canRelease || !canReleasePayment(selectedPayment) || paymentActionMutation.isPending} onClick={() => { void runPaymentAction("release", selectedPayment.id); }}><SendToBack className="size-4" />Release</Button>
                    </div>
                    <p className="text-sm text-[var(--surface-muted)]">Allocation is unlocked only after release, and only for outstanding bills under the same contract.</p>
                  </div>
                </div>
              </Card>

              <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
                <Card className="p-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-[var(--surface-ink)]">Current allocations</p>
                    <Badge tone="neutral">{selectedPayment.allocations.length} lines</Badge>
                  </div>
                  {selectedPayment.allocations.length === 0 ? (
                    <Card className="border-dashed p-4 text-sm text-[var(--surface-muted)]">No allocations posted yet.</Card>
                  ) : (
                    <div className="grid gap-3">
                      {selectedPayment.allocations.map((allocation) => (
                        <div key={allocation.id} className="rounded-[var(--radius)] border border-[color:var(--line)] bg-white/75 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-semibold text-[var(--surface-ink)]">RA Bill #{allocation.ra_bill_id}</p>
                            <Badge tone="neutral">{formatCurrency(allocation.amount)}</Badge>
                          </div>
                          <p className="mt-2 text-sm text-[var(--surface-muted)]">{allocation.remarks || "No allocation remarks"}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                <div className="space-y-6">
                  <Card className="p-5">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-[var(--surface-ink)]">Contract outstanding bills</p>
                      <Badge tone="warning">{drawerOutstandingBills.length}</Badge>
                    </div>
                    {drawerOutstandingBills.length === 0 ? (
                      <Card className="border-dashed p-4 text-sm text-[var(--surface-muted)]">No eligible outstanding bills under this contract.</Card>
                    ) : (
                      <div className="grid gap-3">
                        {drawerOutstandingBills.map((bill) => (
                          <div key={bill.ra_bill_id} className="rounded-[var(--radius)] border border-[color:var(--line)] bg-white/75 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <p className="font-semibold text-[var(--surface-ink)]">Bill #{bill.bill_no}</p>
                              <Badge tone={bill.status === "partially_paid" ? "accent" : "warning"}>{formatCurrency(bill.outstanding_amount)}</Badge>
                            </div>
                            <p className="mt-2 text-sm text-[var(--surface-muted)]">Status {titleCase(bill.status)} / Net {formatCurrency(bill.net_payable)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>

                  {canAllocatePayment(selectedPayment) ? (
                    <form className="space-y-4" onSubmit={allocationForm.handleSubmit(async (values) => {
                      setServerMessage(null);
                      setLocalError(null);
                      await allocateMutation.mutateAsync(values);
                    })}>
                      <Card className="p-5">
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-[var(--surface-ink)]">Allocate released payment</p>
                            <p className="text-sm text-[var(--surface-muted)]">Draft allocation total {formatCurrency(draftAllocationTotal)} against available {formatCurrency(selectedPayment.available_amount)}.</p>
                          </div>
                          <Button type="button" size="sm" variant="secondary" onClick={() => allocationArray.append(buildPaymentAllocationLine(drawerOutstandingBills[0] ? String(drawerOutstandingBills[0].ra_bill_id) : ""))}><Plus className="size-4" />Add line</Button>
                        </div>
                        <div className="grid gap-3">
                          {allocationArray.fields.map((field, index) => (
                            <div key={field.id} className="rounded-[var(--radius)] border border-[color:var(--line)] bg-white/75 p-4">
                              <div className="grid gap-3 md:grid-cols-[1fr_160px_1fr_auto] md:items-end">
                                <label className="space-y-2">
                                  <span className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--surface-faint)]">RA bill</span>
                                  <select className={inputClassName} {...allocationForm.register(`allocations.${index}.ra_bill_id`)}>
                                    <option value="">Select bill</option>
                                    {drawerOutstandingBills.map((bill) => (
                                      <option key={bill.ra_bill_id} value={bill.ra_bill_id}>Bill #{bill.bill_no}</option>
                                    ))}
                                  </select>
                                </label>
                                <label className="space-y-2">
                                  <span className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--surface-faint)]">Amount</span>
                                  <input className={inputClassName} type="number" step="0.01" {...allocationForm.register(`allocations.${index}.amount`, { valueAsNumber: true })} />
                                </label>
                                <label className="space-y-2">
                                  <span className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--surface-faint)]">Remarks</span>
                                  <input className={inputClassName} {...allocationForm.register(`allocations.${index}.remarks`)} />
                                </label>
                                <Button type="button" size="sm" variant="ghost" onClick={() => allocationArray.remove(index)} disabled={allocationArray.fields.length === 1}><Trash2 className="size-4" />Remove</Button>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="mt-4 flex justify-end">
                          <Button disabled={!canAllocate || allocateMutation.isPending} type="submit">{allocateMutation.isPending ? "Allocating..." : "Allocate payment"}</Button>
                        </div>
                      </Card>
                    </form>
                  ) : null}
                </div>
              </div>
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
