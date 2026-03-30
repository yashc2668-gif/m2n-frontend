import { describe, expect, it } from "vitest";

import {
  buildAdjustmentDefaults,
  buildIssueDefaults,
  buildMaterialOperationNumber,
  buildReceiptDefaults,
  getAdjustmentStatusOptions,
  getIssueStatusOptions,
  getReceiptMetrics,
  getReceiptStatusOptions,
} from "@/features/material-operations/material-operations-helpers";

describe("material operation helpers", () => {
  it("builds deterministic operation numbers", () => {
    expect(buildMaterialOperationNumber("GRN", new Date("2026-03-27T08:15:00Z"))).toBe("GRN-20260327-0815");
  });

  it("builds sensible defaults per operation", () => {
    expect(buildReceiptDefaults(new Date("2026-03-27T08:15:00Z")).status).toBe("received");
    expect(buildIssueDefaults(new Date("2026-03-27T08:15:00Z")).status).toBe("issued");
    expect(buildAdjustmentDefaults(new Date("2026-03-27T08:15:00Z")).status).toBe("posted");
  });

  it("exposes receipt and issue status options", () => {
    expect(getReceiptStatusOptions()).toEqual(["draft", "received"]);
    expect(getReceiptStatusOptions("draft")).toEqual(["draft", "received", "cancelled"]);
    expect(getIssueStatusOptions("issued")).toEqual(["issued", "cancelled"]);
    expect(getAdjustmentStatusOptions("draft")).toEqual(["draft", "posted", "cancelled"]);
  });

  it("calculates receipt metrics", () => {
    const metrics = getReceiptMetrics([
      { id: 1, receipt_no: "GRN-1", vendor_id: 1, project_id: 2, received_by: 1, receipt_date: "2026-03-27", status: "received", remarks: null, total_amount: 100, created_at: "", updated_at: null, items: [] },
      { id: 2, receipt_no: "GRN-2", vendor_id: 1, project_id: 2, received_by: 1, receipt_date: "2026-03-27", status: "draft", remarks: null, total_amount: 40, created_at: "", updated_at: null, items: [] },
    ]);
    expect(metrics.total).toBe(2);
    expect(metrics.received).toBe(1);
    expect(metrics.value).toBe(140);
  });
});
