import type { LabourAdvance, LabourAttendance, LabourBill } from "@/api/types";

export const labourWorkflowToneMap = {
  draft: "neutral",
  submitted: "info",
  approved: "success",
  paid: "accent",
  cancelled: "danger",
  active: "success",
  closed: "accent",
  present: "success",
  half_day: "accent",
  absent: "neutral",
  leave: "info",
} as const;

const attendanceTransitions = {
  draft: ["submitted", "cancelled"],
  submitted: ["approved", "cancelled"],
  approved: ["cancelled"],
  cancelled: [],
} as const;

const billTransitions = {
  draft: ["submitted", "cancelled"],
  submitted: ["approved", "cancelled"],
  approved: ["paid", "cancelled"],
  paid: [],
  cancelled: [],
} as const;

export function buildLabourWorkflowNumber(prefix: string, date = new Date()) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const stamp =
    String(date.getUTCHours()).padStart(2, "0") +
    String(date.getUTCMinutes()).padStart(2, "0");
  return `${prefix}-${year}${month}${day}-${stamp}`;
}

export function buildAttendanceDefaults(date = new Date()) {
  return {
    muster_no: buildLabourWorkflowNumber("MST", date),
    project_id: "",
    contractor_id: "",
    date: date.toISOString().slice(0, 10),
    status: "draft",
    remarks: "",
    items: [
      {
        line_id: undefined,
        labour_id: "",
        attendance_status: "present",
        present_days: 1,
        overtime_hours: 0,
        wage_rate: 0,
        remarks: "",
      },
    ],
  };
}

export function buildBillDefaults(date = new Date()) {
  const iso = date.toISOString().slice(0, 10);
  const periodStart = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1),
  )
    .toISOString()
    .slice(0, 10);
  return {
    bill_no: buildLabourWorkflowNumber("LB", date),
    project_id: "",
    contract_id: "",
    contractor_id: "",
    period_start: periodStart,
    period_end: iso,
    status: "draft",
    deductions: 0,
    remarks: "",
    attendance_ids: [] as string[],
  };
}

export function buildAdvanceDefaults(date = new Date()) {
  return {
    advance_no: buildLabourWorkflowNumber("ADV", date),
    project_id: "",
    contractor_id: "",
    advance_date: date.toISOString().slice(0, 10),
    amount: 0,
    status: "active",
    remarks: "",
  };
}

export function buildAdvanceRecoveryDefaults(date = new Date()) {
  return {
    labour_bill_id: "",
    recovery_date: date.toISOString().slice(0, 10),
    amount: 0,
    remarks: "",
  };
}

export function getAttendanceStatusOptions(currentStatus?: string | null) {
  if (!currentStatus) {
    return ["draft", "submitted"];
  }
  return [
    currentStatus,
    ...(attendanceTransitions[
      currentStatus as keyof typeof attendanceTransitions
    ] ?? []),
  ];
}

export function getBillStatusOptions(currentStatus?: string | null) {
  if (!currentStatus) {
    return ["draft", "submitted"];
  }
  return [
    currentStatus,
    ...(billTransitions[currentStatus as keyof typeof billTransitions] ?? []),
  ];
}

export function getAdvanceStatusOptions() {
  return ["active", "closed", "cancelled"];
}

export function canSubmitAttendance(attendance: LabourAttendance) {
  return attendance.status === "draft";
}

export function canApproveAttendance(attendance: LabourAttendance) {
  return attendance.status === "submitted";
}

export function canApproveBill(bill: LabourBill) {
  return bill.status === "submitted";
}

export function canMarkBillPaid(bill: LabourBill) {
  return bill.status === "approved";
}

function normalizeSearch(value: string) {
  return value.trim().toLowerCase();
}

export function getAttendanceMetrics(attendances: LabourAttendance[]) {
  return {
    total: attendances.length,
    draft: attendances.filter((attendance) => attendance.status === "draft")
      .length,
    submitted: attendances.filter(
      (attendance) => attendance.status === "submitted",
    ).length,
    approved: attendances.filter(
      (attendance) => attendance.status === "approved",
    ).length,
    wage: attendances.reduce(
      (sum, attendance) => sum + attendance.total_wage,
      0,
    ),
  };
}

export function getBillMetrics(bills: LabourBill[]) {
  return {
    total: bills.length,
    submitted: bills.filter((bill) => bill.status === "submitted").length,
    approved: bills.filter((bill) => bill.status === "approved").length,
    paid: bills.filter((bill) => bill.status === "paid").length,
    payable: bills.reduce((sum, bill) => sum + bill.net_payable, 0),
  };
}

export function getAdvanceMetrics(advances: LabourAdvance[]) {
  return {
    total: advances.length,
    active: advances.filter((advance) => advance.status === "active").length,
    closed: advances.filter((advance) => advance.status === "closed").length,
    balance: advances.reduce((sum, advance) => sum + advance.balance_amount, 0),
    recovered: advances.reduce(
      (sum, advance) => sum + advance.recovered_amount,
      0,
    ),
  };
}

export function getSelectedAttendanceTotal(
  attendances: LabourAttendance[],
  selectedIds: string[],
) {
  const selected = new Set(selectedIds.map((id) => Number(id)));
  return attendances.reduce((sum, attendance) => {
    if (!selected.has(attendance.id)) {
      return sum;
    }
    return sum + attendance.total_wage;
  }, 0);
}

export function filterAttendances(
  attendances: LabourAttendance[],
  filters: {
    status?: string;
    projectId?: string;
    contractorId?: string;
    fromDate?: string;
    toDate?: string;
    search?: string;
  },
) {
  const search = normalizeSearch(filters.search ?? "");

  return attendances.filter((attendance) => {
    if (
      filters.status &&
      filters.status !== "all" &&
      attendance.status !== filters.status
    ) {
      return false;
    }
    if (
      filters.projectId &&
      filters.projectId !== "all" &&
      attendance.project_id !== Number(filters.projectId)
    ) {
      return false;
    }
    if (
      filters.contractorId &&
      filters.contractorId !== "all" &&
      attendance.contractor_id !== Number(filters.contractorId)
    ) {
      return false;
    }
    if (filters.fromDate && attendance.attendance_date < filters.fromDate) {
      return false;
    }
    if (filters.toDate && attendance.attendance_date > filters.toDate) {
      return false;
    }
    if (!search) {
      return true;
    }

    return [attendance.muster_no, attendance.remarks ?? "", attendance.status]
      .join(" ")
      .toLowerCase()
      .includes(search);
  });
}

export function filterBills(
  bills: LabourBill[],
  filters: {
    status?: string;
    projectId?: string;
    contractorId?: string;
    fromDate?: string;
    toDate?: string;
    search?: string;
  },
) {
  const search = normalizeSearch(filters.search ?? "");

  return bills.filter((bill) => {
    if (
      filters.status &&
      filters.status !== "all" &&
      bill.status !== filters.status
    ) {
      return false;
    }
    if (
      filters.projectId &&
      filters.projectId !== "all" &&
      bill.project_id !== Number(filters.projectId)
    ) {
      return false;
    }
    if (
      filters.contractorId &&
      filters.contractorId !== "all" &&
      bill.contractor_id !== Number(filters.contractorId)
    ) {
      return false;
    }
    if (filters.fromDate && bill.period_end < filters.fromDate) {
      return false;
    }
    if (filters.toDate && bill.period_start > filters.toDate) {
      return false;
    }
    if (!search) {
      return true;
    }

    return [bill.bill_no, bill.remarks ?? "", bill.status]
      .join(" ")
      .toLowerCase()
      .includes(search);
  });
}

export function filterAdvances(
  advances: LabourAdvance[],
  filters: {
    status?: string;
    projectId?: string;
    contractorId?: string;
    balanceState?: string;
    search?: string;
  },
) {
  const search = normalizeSearch(filters.search ?? "");

  return advances.filter((advance) => {
    if (
      filters.status &&
      filters.status !== "all" &&
      advance.status !== filters.status
    ) {
      return false;
    }
    if (
      filters.projectId &&
      filters.projectId !== "all" &&
      advance.project_id !== Number(filters.projectId)
    ) {
      return false;
    }
    if (
      filters.contractorId &&
      filters.contractorId !== "all" &&
      advance.contractor_id !== Number(filters.contractorId)
    ) {
      return false;
    }
    if (filters.balanceState === "open" && advance.balance_amount <= 0) {
      return false;
    }
    if (filters.balanceState === "settled" && advance.balance_amount > 0) {
      return false;
    }
    if (!search) {
      return true;
    }

    return [advance.advance_no, advance.remarks ?? "", advance.status]
      .join(" ")
      .toLowerCase()
      .includes(search);
  });
}
