import type {
  MaterialIssue,
  MaterialReceipt,
  MaterialStockAdjustment,
} from "@/api/types";

export type OperationKind = "receipt" | "issue" | "adjustment";

export const operationStatusToneMap = {
  draft: "neutral",
  received: "success",
  issued: "success",
  posted: "accent",
  cancelled: "danger",
} as const;

const allowedTransitions = {
  receipt: {
    draft: ["received", "cancelled"],
    received: ["cancelled"],
    cancelled: [],
  },
  issue: {
    draft: ["issued", "cancelled"],
    issued: ["cancelled"],
    cancelled: [],
  },
  adjustment: {
    draft: ["posted", "cancelled"],
    posted: ["cancelled"],
    cancelled: [],
  },
} as const;

export function buildMaterialOperationNumber(prefix: string, date = new Date()) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const stamp =
    String(date.getUTCHours()).padStart(2, "0") +
    String(date.getUTCMinutes()).padStart(2, "0");
  return `${prefix}-${year}${month}${day}-${stamp}`;
}

export function buildReceiptDefaults(date = new Date()) {
  return {
    receipt_no: buildMaterialOperationNumber("GRN", date),
    vendor_id: "",
    project_id: "",
    receipt_date: date.toISOString().slice(0, 10),
    status: "received",
    remarks: "",
    items: [{ material_id: "", qty: 1, unit_rate: 0 }],
  };
}

export function buildIssueDefaults(date = new Date()) {
  return {
    issue_no: buildMaterialOperationNumber("ISS", date),
    project_id: "",
    issue_date: date.toISOString().slice(0, 10),
    status: "issued",
    site_name: "",
    activity_name: "",
    remarks: "",
    items: [{ material_id: "", qty: 1, unit_rate: 0 }],
  };
}

export function buildAdjustmentDefaults(date = new Date()) {
  return {
    adjustment_no: buildMaterialOperationNumber("ADJ", date),
    project_id: "",
    adjustment_date: date.toISOString().slice(0, 10),
    status: "posted",
    reason: "",
    remarks: "",
    items: [{ material_id: "", qty_change: 1, unit_rate: 0 }],
  };
}

export function getReceiptStatusOptions(currentStatus?: string | null) {
  return getStatusOptions("receipt", currentStatus ?? null, ["draft", "received"]);
}

export function getIssueStatusOptions(currentStatus?: string | null) {
  return getStatusOptions("issue", currentStatus ?? null, ["draft", "issued"]);
}

export function getAdjustmentStatusOptions(currentStatus?: string | null) {
  return getStatusOptions("adjustment", currentStatus ?? null, ["draft", "posted"]);
}

function getStatusOptions(
  kind: OperationKind,
  currentStatus: string | null,
  createDefaults: string[],
) {
  if (!currentStatus) {
    return createDefaults;
  }

  const transitions = allowedTransitions[kind][currentStatus as keyof (typeof allowedTransitions)[typeof kind]];
  return [currentStatus, ...transitions];
}

export function getReceiptMetrics(receipts: MaterialReceipt[]) {
  return {
    total: receipts.length,
    received: receipts.filter((receipt) => receipt.status === "received").length,
    draft: receipts.filter((receipt) => receipt.status === "draft").length,
    value: receipts.reduce((total, receipt) => total + receipt.total_amount, 0),
  };
}

export function getIssueMetrics(issues: MaterialIssue[]) {
  return {
    total: issues.length,
    issued: issues.filter((issue) => issue.status === "issued").length,
    draft: issues.filter((issue) => issue.status === "draft").length,
    value: issues.reduce((total, issue) => total + issue.total_amount, 0),
  };
}

export function getAdjustmentMetrics(adjustments: MaterialStockAdjustment[]) {
  return {
    total: adjustments.length,
    posted: adjustments.filter((adjustment) => adjustment.status === "posted").length,
    draft: adjustments.filter((adjustment) => adjustment.status === "draft").length,
    value: adjustments.reduce((total, adjustment) => total + adjustment.total_amount, 0),
  };
}
