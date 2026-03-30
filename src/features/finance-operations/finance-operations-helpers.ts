import type { OutstandingBill, Payment, RABill } from "@/api/types";

export const financeWorkflowToneMap = {
  draft: "neutral",
  submitted: "info",
  verified: "accent",
  approved: "success",
  finance_hold: "warning",
  rejected: "danger",
  cancelled: "neutral",
  partially_paid: "accent",
  paid: "success",
  released: "success",
} as const;

function normalizeSearch(value: string) {
  return value.trim().toLowerCase();
}

function toMonthStart(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function buildRABillDefaults(date = new Date()) {
  const iso = date.toISOString().slice(0, 10);
  return {
    contract_id: "",
    bill_date: iso,
    bill_no: "",
    period_from: toMonthStart(date).toISOString().slice(0, 10),
    period_to: iso,
    remarks: "",
  };
}

export function buildRABillGenerateDefaults() {
  return {
    tds_percentage: "",
    apply_contract_retention: true,
    deductions: [] as Array<{
      deduction_type: string;
      description: string;
      reason: string;
      amount: number;
    }>,
  };
}

export function buildPaymentDefaults(date = new Date()) {
  return {
    contract_id: "",
    payment_date: date.toISOString().slice(0, 10),
    amount: 0,
    ra_bill_id: "",
    payment_mode: "bank_transfer",
    reference_no: "",
    remarks: "",
  };
}

export function buildPaymentAllocationLine(raBillId = "") {
  return {
    ra_bill_id: raBillId,
    amount: 0,
    remarks: "",
  };
}

export function getRABillMetrics(bills: RABill[]) {
  return {
    total: bills.length,
    draft: bills.filter((bill) => bill.status === "draft").length,
    submitted: bills.filter((bill) => bill.status === "submitted").length,
    verified: bills.filter((bill) => bill.status === "verified").length,
    approved: bills.filter((bill) => bill.status === "approved").length,
    financeHold: bills.filter((bill) => bill.status === "finance_hold").length,
    netPayable: bills.reduce((sum, bill) => sum + bill.net_payable, 0),
    outstanding: bills.reduce((sum, bill) => sum + bill.outstanding_amount, 0),
  };
}

export function getPaymentMetrics(
  payments: Payment[],
  outstandingBills: OutstandingBill[],
) {
  return {
    total: payments.length,
    draft: payments.filter((payment) => payment.status === "draft").length,
    approved: payments.filter((payment) => payment.status === "approved").length,
    released: payments.filter((payment) => payment.status === "released").length,
    pool: payments.reduce((sum, payment) => sum + payment.amount, 0),
    allocated: payments.reduce(
      (sum, payment) => sum + payment.allocated_amount,
      0,
    ),
    available: payments.reduce(
      (sum, payment) => sum + payment.available_amount,
      0,
    ),
    outstanding: outstandingBills.reduce(
      (sum, bill) => sum + bill.outstanding_amount,
      0,
    ),
    outstandingCount: outstandingBills.length,
  };
}

export function canGenerateRABill(bill: RABill) {
  return bill.status === "draft";
}

export function canSubmitRABill(bill: RABill) {
  return bill.status === "draft" && bill.items.length > 0;
}

export function canVerifyRABill(bill: RABill) {
  return bill.status === "submitted" || bill.status === "finance_hold";
}

export function canApproveRABill(bill: RABill) {
  return bill.status === "verified";
}

export function canRejectRABill(bill: RABill) {
  return ["submitted", "verified", "finance_hold"].includes(bill.status);
}

export function canCancelRABill(bill: RABill) {
  return ["draft", "submitted", "verified", "finance_hold"].includes(
    bill.status,
  );
}

export function canHoldRABill(bill: RABill) {
  return bill.status === "submitted" || bill.status === "verified";
}

export function canMarkRABillPartiallyPaid(bill: RABill) {
  return bill.status === "approved";
}

export function canMarkRABillPaid(bill: RABill) {
  return bill.status === "approved" || bill.status === "partially_paid";
}

export function canApprovePayment(payment: Payment) {
  return payment.status === "draft";
}

export function canReleasePayment(payment: Payment) {
  return payment.status === "approved";
}

export function canAllocatePayment(payment: Payment) {
  return payment.status === "released" && payment.available_amount > 0;
}

export function filterRABills(
  bills: RABill[],
  filters: {
    status?: string;
    contractId?: string;
    settlement?: string;
    fromDate?: string;
    toDate?: string;
    search?: string;
  },
) {
  const search = normalizeSearch(filters.search ?? "");

  return bills.filter((bill) => {
    if (filters.status && filters.status !== "all" && bill.status !== filters.status) {
      return false;
    }
    if (
      filters.contractId &&
      filters.contractId !== "all" &&
      bill.contract_id !== Number(filters.contractId)
    ) {
      return false;
    }
    if (filters.settlement === "open" && bill.outstanding_amount <= 0) {
      return false;
    }
    if (filters.settlement === "cleared" && bill.outstanding_amount > 0) {
      return false;
    }
    if (filters.fromDate && bill.bill_date < filters.fromDate) {
      return false;
    }
    if (filters.toDate && bill.bill_date > filters.toDate) {
      return false;
    }
    if (!search) {
      return true;
    }

    return [String(bill.bill_no), bill.remarks ?? "", bill.status]
      .join(" ")
      .toLowerCase()
      .includes(search);
  });
}

export function filterPayments(
  payments: Payment[],
  filters: {
    status?: string;
    contractId?: string;
    mode?: string;
    fromDate?: string;
    toDate?: string;
    search?: string;
  },
) {
  const search = normalizeSearch(filters.search ?? "");

  return payments.filter((payment) => {
    if (
      filters.status &&
      filters.status !== "all" &&
      payment.status !== filters.status
    ) {
      return false;
    }
    if (
      filters.contractId &&
      filters.contractId !== "all" &&
      payment.contract_id !== Number(filters.contractId)
    ) {
      return false;
    }
    if (
      filters.mode &&
      filters.mode !== "all" &&
      (payment.payment_mode ?? "unassigned") !== filters.mode
    ) {
      return false;
    }
    if (filters.fromDate && payment.payment_date < filters.fromDate) {
      return false;
    }
    if (filters.toDate && payment.payment_date > filters.toDate) {
      return false;
    }
    if (!search) {
      return true;
    }

    return [
      String(payment.id),
      payment.reference_no ?? "",
      payment.remarks ?? "",
      payment.status,
      payment.payment_mode ?? "",
    ]
      .join(" ")
      .toLowerCase()
      .includes(search);
  });
}

export function getAllocationDraftTotal(
  allocations: Array<{ amount: number | string | null | undefined }>,
) {
  return allocations.reduce((sum, line) => {
    const value = Number(line.amount ?? 0);
    return Number.isFinite(value) ? sum + value : sum;
  }, 0);
}
