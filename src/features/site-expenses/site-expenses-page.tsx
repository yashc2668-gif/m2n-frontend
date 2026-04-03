import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Banknote, ClipboardList, PencilLine, Search, WalletCards } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useAuth } from "@/app/providers/auth-provider";
import { getApiErrorMessage } from "@/api/client";
import { fetchProjects } from "@/api/projects";
import {
  approveSiteExpense,
  createSiteExpense,
  fetchSiteExpenses,
  paySiteExpense,
  updateSiteExpense,
} from "@/api/site-expenses";
import { fetchVendors } from "@/api/vendors";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { PageSkeleton } from "@/components/feedback/skeleton";
import { PermissionGate } from "@/components/shell/permission-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { formatCompactNumber, formatCurrency, formatDate, titleCase } from "@/lib/format";
import { hasPermissions } from "@/lib/permissions";
import { useKeyboardShortcuts } from "@/lib/use-keyboard-shortcuts";

const inputClassName =
  "w-full rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-amber-100";
const labelClassName = "text-sm font-semibold text-[var(--surface-ink)]";
const EMPTY_LIST: never[] = [];

const siteExpenseFormSchema = z.object({
  expense_no: z.string().min(1, "Expense number is required."),
  project_id: z.string().min(1, "Select a project."),
  vendor_id: z.string().optional(),
  expense_date: z.string().min(1, "Select expense date."),
  expense_head: z.string().min(2, "Expense head is required."),
  payee_name: z.string().optional(),
  amount: z.number().gt(0, "Amount must be greater than zero."),
  payment_mode: z.string().optional(),
  reference_no: z.string().optional(),
  remarks: z.string().optional(),
});

type SiteExpenseFormValues = z.infer<typeof siteExpenseFormSchema>;
type SiteExpenseAction = "approve" | "pay";

function buildSiteExpenseDefaults(projectId = ""): SiteExpenseFormValues {
  return {
    expense_no: "",
    project_id: projectId,
    vendor_id: "",
    expense_date: new Date().toISOString().slice(0, 10),
    expense_head: "",
    payee_name: "",
    amount: 0,
    payment_mode: "cash",
    reference_no: "",
    remarks: "",
  };
}

const statusToneMap: Record<string, "warning" | "info" | "success" | "neutral"> = {
  draft: "warning",
  approved: "info",
  paid: "success",
};

export default function SiteExpensesPage() {
  const { accessToken, user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [editingExpenseId, setEditingExpenseId] = useState<number | null>(null);
  const [actionRemarks, setActionRemarks] = useState("");
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const siteExpensesQuery = useQuery({
    queryKey: ["site-expenses", "page"],
    queryFn: () => fetchSiteExpenses(accessToken ?? "", { limit: 200 }),
    enabled: Boolean(accessToken),
  });
  const projectsQuery = useQuery({
    queryKey: ["projects", "site-expenses"],
    queryFn: () => fetchProjects(accessToken ?? ""),
    enabled: Boolean(accessToken),
  });
  const vendorsQuery = useQuery({
    queryKey: ["vendors", "site-expenses"],
    queryFn: () => fetchVendors(accessToken ?? "", { vendorType: null, limit: 200 }),
    enabled: Boolean(accessToken),
  });

  const siteExpenses = Array.isArray(siteExpensesQuery.data) ? siteExpensesQuery.data : EMPTY_LIST;
  const projects = Array.isArray(projectsQuery.data) ? projectsQuery.data : EMPTY_LIST;
  const vendors = Array.isArray(vendorsQuery.data) ? vendorsQuery.data : EMPTY_LIST;
  const projectMap = useMemo(() => new Map(projects.map((project) => [project.id, project.name])), [projects]);
  const vendorMap = useMemo(() => new Map(vendors.map((vendor) => [vendor.id, vendor.name])), [vendors]);
  const selectedExpense = useMemo(
    () => siteExpenses.find((expense) => expense.id === editingExpenseId) ?? null,
    [editingExpenseId, siteExpenses],
  );
  const defaultProjectId = projects[0] ? String(projects[0].id) : "";

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SiteExpenseFormValues>({
    resolver: zodResolver(siteExpenseFormSchema),
    defaultValues: buildSiteExpenseDefaults(defaultProjectId),
  });

  useEffect(() => {
    if (!selectedExpense) {
      reset(buildSiteExpenseDefaults(defaultProjectId));
      setActionRemarks("");
      return;
    }

    reset({
      expense_no: selectedExpense.expense_no,
      project_id: String(selectedExpense.project_id),
      vendor_id: selectedExpense.vendor_id ? String(selectedExpense.vendor_id) : "",
      expense_date: selectedExpense.expense_date,
      expense_head: selectedExpense.expense_head,
      payee_name: selectedExpense.payee_name ?? "",
      amount: selectedExpense.amount,
      payment_mode: selectedExpense.payment_mode ?? "",
      reference_no: selectedExpense.reference_no ?? "",
      remarks: selectedExpense.remarks ?? "",
    });
    setActionRemarks(selectedExpense.remarks ?? "");
  }, [defaultProjectId, reset, selectedExpense]);

  const filteredExpenses = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return siteExpenses.filter((expense) => {
      if (statusFilter !== "all" && expense.status !== statusFilter) {
        return false;
      }
      if (projectFilter !== "all" && String(expense.project_id) !== projectFilter) {
        return false;
      }
      if (!normalizedSearch) {
        return true;
      }
      return [
        expense.expense_no,
        expense.expense_head,
        expense.payee_name,
        expense.reference_no,
        expense.remarks,
        projectMap.get(expense.project_id),
        expense.vendor_id ? vendorMap.get(expense.vendor_id) : "",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [projectFilter, projectMap, search, siteExpenses, statusFilter, vendorMap]);

  const metrics = useMemo(
    () => ({
      total: filteredExpenses.length,
      draft: filteredExpenses.filter((expense) => expense.status === "draft").length,
      approved: filteredExpenses.filter((expense) => expense.status === "approved").length,
      paid: filteredExpenses.filter((expense) => expense.status === "paid").length,
      totalAmount: filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0),
    }),
    [filteredExpenses],
  );

  const canCreate = hasPermissions(user?.role ?? "viewer", ["site_expenses:create"]);
  const canUpdate = hasPermissions(user?.role ?? "viewer", ["site_expenses:update"]);
  const canApprove = hasPermissions(user?.role ?? "viewer", ["site_expenses:approve"]);
  const canPay = hasPermissions(user?.role ?? "viewer", ["site_expenses:pay"]);

  useKeyboardShortcuts({
    "ctrl+n": () => {
      if (!canCreate) return;
      setEditingExpenseId(null);
      setServerMessage(null);
      reset(buildSiteExpenseDefaults(defaultProjectId));
    },
    escape: () => setEditingExpenseId(null),
    "/": () => searchRef.current?.focus(),
  });

  const siteExpenseMutation = useMutation({
    mutationFn: async (values: SiteExpenseFormValues) => {
      const payload = {
        expense_no: values.expense_no.trim(),
        project_id: Number(values.project_id),
        vendor_id: values.vendor_id ? Number(values.vendor_id) : null,
        expense_date: values.expense_date,
        expense_head: values.expense_head.trim(),
        payee_name: values.payee_name?.trim() || null,
        amount: values.amount,
        payment_mode: values.payment_mode?.trim() || null,
        reference_no: values.reference_no?.trim() || null,
        remarks: values.remarks?.trim() || null,
      };

      if (selectedExpense) {
        return updateSiteExpense(accessToken ?? "", selectedExpense.id, {
          ...payload,
          lock_version: selectedExpense.lock_version,
        });
      }
      return createSiteExpense(accessToken ?? "", payload);
    },
    onSuccess: (expense) => {
      void queryClient.invalidateQueries({ queryKey: ["site-expenses"] });
      setEditingExpenseId(expense.id);
      setServerMessage(selectedExpense ? `${expense.expense_no} updated.` : `${expense.expense_no} created.`);
    },
  });

  const actionMutation = useMutation({
    mutationFn: async ({
      action,
      expenseId,
      lockVersion,
    }: {
      action: SiteExpenseAction;
      expenseId: number;
      lockVersion: number;
    }) => {
      if (action === "approve") {
        return approveSiteExpense(accessToken ?? "", expenseId, {
          lock_version: lockVersion,
          remarks: actionRemarks.trim() || null,
        });
      }
      return paySiteExpense(accessToken ?? "", expenseId, {
        lock_version: lockVersion,
        remarks: actionRemarks.trim() || null,
      });
    },
    onSuccess: (expense, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["site-expenses"] });
      setEditingExpenseId(expense.id);
      setServerMessage(`${expense.expense_no} ${variables.action === "approve" ? "approved" : "marked paid"}.`);
    },
  });

  if (siteExpensesQuery.isLoading || projectsQuery.isLoading || vendorsQuery.isLoading) {
    return <PageSkeleton statCount={5} tableRows={8} tableColumns={7} />;
  }

  if (siteExpensesQuery.error || projectsQuery.error || vendorsQuery.error) {
    return (
      <ErrorState
        description={getApiErrorMessage(siteExpensesQuery.error ?? projectsQuery.error ?? vendorsQuery.error)}
        onRetry={() => {
          void siteExpensesQuery.refetch();
          void projectsQuery.refetch();
          void vendorsQuery.refetch();
        }}
      />
    );
  }

  return (
    <PermissionGate permissions={["site_expenses:read"]}>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Site Expenses"
          title="Capture petty cash and local site spend without pushing it into vendor payments."
          description="Use this register for site-level cash spend, reimbursement entries, and small operational expenses that need approval and payment visibility."
          actions={
            <>
              <Link to="/documents">
                <Button variant="secondary">Open documents</Button>
              </Link>
              <Button
                disabled={!canCreate}
                onClick={() => {
                  setEditingExpenseId(null);
                  setServerMessage(null);
                  reset(buildSiteExpenseDefaults(defaultProjectId));
                }}
              >
                Create expense
              </Button>
            </>
          }
        />

        <div className="grid gap-4 md:grid-cols-5">
          <StatCard label="Total" value={String(metrics.total)} caption="Rows in current view" icon={ClipboardList} tone="info" />
          <StatCard label="Draft" value={String(metrics.draft)} caption="Pending approval" icon={PencilLine} tone="accent" />
          <StatCard label="Approved" value={String(metrics.approved)} caption="Ready for payment" icon={WalletCards} tone="info" />
          <StatCard label="Paid" value={String(metrics.paid)} caption="Settled expenses" icon={Banknote} tone="success" />
          <StatCard label="Amount" value={formatCompactNumber(metrics.totalAmount)} caption={formatCurrency(metrics.totalAmount)} icon={WalletCards} tone="accent" />
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(360px,0.95fr)]">
          <Card className="space-y-5 p-5">
            <div className="grid gap-4 md:grid-cols-3">
              <label className="space-y-2">
                <span className={labelClassName}>Project</span>
                <select className={inputClassName} value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
                  <option value="all">All projects</option>
                  {projects.map((project) => (
                    <option key={project.id} value={String(project.id)}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className={labelClassName}>Status</span>
                <select className={inputClassName} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  <option value="all">All statuses</option>
                  <option value="draft">Draft</option>
                  <option value="approved">Approved</option>
                  <option value="paid">Paid</option>
                </select>
              </label>
              <label className="space-y-2">
                <span className={labelClassName}>Search</span>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[var(--surface-faint)]" />
                  <input
                    ref={searchRef}
                    className={`${inputClassName} pl-11`}
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Expense no, head, payee, remarks"
                  />
                </div>
              </label>
            </div>

            <DataTable
              columns={[
                {
                  id: "expense_no",
                  header: "Expense",
                  cell: (row) => (
                    <div>
                      <p className="font-semibold text-[var(--surface-ink)]">{row.expense_no}</p>
                      <p className="text-xs text-[var(--surface-faint)]">{row.expense_head}</p>
                    </div>
                  ),
                  exportValue: (row) => row.expense_no,
                  minWidth: 210,
                },
                {
                  id: "project",
                  header: "Project",
                  cell: (row) => projectMap.get(row.project_id) ?? `Project #${row.project_id}`,
                  exportValue: (row) => projectMap.get(row.project_id) ?? `Project #${row.project_id}`,
                  minWidth: 170,
                },
                {
                  id: "payee",
                  header: "Payee",
                  cell: (row) => row.payee_name ?? (row.vendor_id ? vendorMap.get(row.vendor_id) ?? `Vendor #${row.vendor_id}` : "-"),
                  exportValue: (row) => row.payee_name ?? (row.vendor_id ? vendorMap.get(row.vendor_id) ?? `Vendor #${row.vendor_id}` : ""),
                  minWidth: 170,
                },
                {
                  id: "amount",
                  header: "Amount",
                  cell: (row) => formatCurrency(row.amount),
                  exportValue: (row) => String(row.amount),
                },
                {
                  id: "status",
                  header: "Status",
                  cell: (row) => <Badge tone={statusToneMap[row.status] ?? "neutral"}>{titleCase(row.status)}</Badge>,
                  exportValue: (row) => row.status,
                },
                {
                  id: "expense_date",
                  header: "Date",
                  cell: (row) => formatDate(row.expense_date),
                  exportValue: (row) => row.expense_date,
                },
                {
                  header: "Action",
                  cell: (row) => (
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setEditingExpenseId(row.id)}>
                        Edit
                      </Button>
                      {canApprove && row.status === "draft" ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setEditingExpenseId(row.id);
                            void actionMutation.mutateAsync({
                              action: "approve",
                              expenseId: row.id,
                              lockVersion: row.lock_version,
                            });
                          }}
                        >
                          Approve
                        </Button>
                      ) : null}
                      {canPay && row.status === "approved" ? (
                        <Button
                          size="sm"
                          onClick={() => {
                            setEditingExpenseId(row.id);
                            void actionMutation.mutateAsync({
                              action: "pay",
                              expenseId: row.id,
                              lockVersion: row.lock_version,
                            });
                          }}
                        >
                          Mark paid
                        </Button>
                      ) : null}
                    </div>
                  ),
                  minWidth: 220,
                },
              ]}
              rows={filteredExpenses}
              rowKey={(row) => row.id}
              loading={siteExpensesQuery.isFetching || actionMutation.isPending}
              emptyState={
                <EmptyState
                  title="No site expenses found"
                  description="Create the first petty-cash or site-expense entry to start the register."
                />
              }
            />
          </Card>

          <Card className="space-y-5 p-5">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--surface-faint)]">
                {selectedExpense ? "Edit Expense" : "Create Expense"}
              </p>
              <h2 className="text-xl font-semibold text-[var(--surface-ink)]">
                {selectedExpense ? selectedExpense.expense_no : "New site expense"}
              </h2>
              <p className="text-sm text-[var(--surface-faint)]">
                Use this for site cash expenses, reimbursement items, and petty operational spend.
              </p>
            </div>

            <form
              className="space-y-4"
              onSubmit={handleSubmit(async (values) => {
                setServerMessage(null);
                await siteExpenseMutation.mutateAsync(values);
              })}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className={labelClassName}>Expense no</span>
                  <input className={inputClassName} {...register("expense_no")} />
                  {errors.expense_no ? <p className="text-xs text-rose-600">{errors.expense_no.message}</p> : null}
                </label>
                <label className="space-y-2">
                  <span className={labelClassName}>Expense date</span>
                  <input type="date" className={inputClassName} {...register("expense_date")} />
                  {errors.expense_date ? <p className="text-xs text-rose-600">{errors.expense_date.message}</p> : null}
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className={labelClassName}>Project</span>
                  <select className={inputClassName} {...register("project_id")}>
                    <option value="">Select project</option>
                    {projects.map((project) => (
                      <option key={project.id} value={String(project.id)}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                  {errors.project_id ? <p className="text-xs text-rose-600">{errors.project_id.message}</p> : null}
                </label>
                <label className="space-y-2">
                  <span className={labelClassName}>Vendor</span>
                  <select className={inputClassName} {...register("vendor_id")}>
                    <option value="">Not linked</option>
                    {vendors.map((vendor) => (
                      <option key={vendor.id} value={String(vendor.id)}>
                        {vendor.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className={labelClassName}>Expense head</span>
                  <input className={inputClassName} {...register("expense_head")} placeholder="Food, diesel, site expenses" />
                  {errors.expense_head ? <p className="text-xs text-rose-600">{errors.expense_head.message}</p> : null}
                </label>
                <label className="space-y-2">
                  <span className={labelClassName}>Payee name</span>
                  <input className={inputClassName} {...register("payee_name")} placeholder="Person or counterparty" />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className={labelClassName}>Amount</span>
                  <input
                    type="number"
                    step="0.01"
                    className={inputClassName}
                    {...register("amount", { valueAsNumber: true })}
                  />
                  {errors.amount ? <p className="text-xs text-rose-600">{errors.amount.message}</p> : null}
                </label>
                <label className="space-y-2">
                  <span className={labelClassName}>Payment mode</span>
                  <select className={inputClassName} {...register("payment_mode")}>
                    <option value="">Select mode</option>
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="neft">NEFT</option>
                    <option value="cheque">Cheque</option>
                    <option value="bank_transfer">Bank transfer</option>
                  </select>
                </label>
              </div>

              <label className="space-y-2">
                <span className={labelClassName}>Reference no</span>
                <input className={inputClassName} {...register("reference_no")} placeholder="Voucher, slip, or reimbursement ref" />
              </label>

              <label className="space-y-2">
                <span className={labelClassName}>Remarks</span>
                <textarea className={`${inputClassName} min-h-28`} {...register("remarks")} />
              </label>

              {selectedExpense ? (
                <label className="space-y-2">
                  <span className={labelClassName}>Action remarks</span>
                  <textarea
                    className={`${inputClassName} min-h-24`}
                    value={actionRemarks}
                    onChange={(event) => setActionRemarks(event.target.value)}
                    placeholder="Approval or payment remarks"
                  />
                </label>
              ) : null}

              {serverMessage ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {serverMessage}
                </div>
              ) : null}

              {siteExpenseMutation.error || actionMutation.error ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {getApiErrorMessage(siteExpenseMutation.error ?? actionMutation.error)}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <Button
                  type="submit"
                  disabled={
                    isSubmitting
                    || siteExpenseMutation.isPending
                    || (!selectedExpense ? !canCreate : !canUpdate)
                  }
                >
                  {selectedExpense ? "Update expense" : "Save expense"}
                </Button>
                {selectedExpense && canApprove && selectedExpense.status === "draft" ? (
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={actionMutation.isPending}
                    onClick={() =>
                      void actionMutation.mutateAsync({
                        action: "approve",
                        expenseId: selectedExpense.id,
                        lockVersion: selectedExpense.lock_version,
                      })
                    }
                  >
                    Approve
                  </Button>
                ) : null}
                {selectedExpense && canPay && selectedExpense.status === "approved" ? (
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={actionMutation.isPending}
                    onClick={() =>
                      void actionMutation.mutateAsync({
                        action: "pay",
                        expenseId: selectedExpense.id,
                        lockVersion: selectedExpense.lock_version,
                      })
                    }
                  >
                    Mark paid
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setEditingExpenseId(null);
                    setServerMessage(null);
                    reset(buildSiteExpenseDefaults(defaultProjectId));
                  }}
                >
                  Reset
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </PermissionGate>
  );
}
