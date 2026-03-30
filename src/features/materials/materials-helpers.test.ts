import { describe, expect, it } from "vitest";

import {
  buildMaterialFormDefaults,
  buildRequisitionDefaults,
  buildRequisitionNumber,
  canApproveRequisition,
  canSubmitRequisition,
  getMaterialAttention,
  getRequisitionCounts,
} from "@/features/materials/materials-helpers";

describe("material helpers", () => {
  it("classifies material attention correctly", () => {
    expect(
      getMaterialAttention({
        id: 1,
        item_code: "CEM-01",
        item_name: "Cement",
        category: "Civil",
        unit: "Bag",
        reorder_level: 20,
        default_rate: 360,
        current_stock: 0,
        is_active: true,
        company_id: 1,
        project_id: 2,
        lock_version: 1,
        created_at: "2026-03-27T00:00:00Z",
        updated_at: null,
      }),
    ).toBe("critical");
  });

  it("builds stable requisition defaults", () => {
    const defaults = buildRequisitionDefaults(new Date("2026-03-27T08:15:00Z"));
    expect(defaults.requisition_no).toBe("MR-20260327-0815");
    expect(defaults.items).toHaveLength(1);
  });

  it("counts requisitions by status", () => {
    const counts = getRequisitionCounts([
      { id: 1, requisition_no: "MR-1", project_id: 1, contract_id: null, requested_by: 1, status: "draft", remarks: null, created_at: "", updated_at: null, items: [] },
      { id: 2, requisition_no: "MR-2", project_id: 1, contract_id: null, requested_by: 1, status: "submitted", remarks: null, created_at: "", updated_at: null, items: [] },
      { id: 3, requisition_no: "MR-3", project_id: 1, contract_id: null, requested_by: 1, status: "submitted", remarks: null, created_at: "", updated_at: null, items: [] },
    ]);
    expect(counts.total).toBe(3);
    expect(counts.submitted).toBe(2);
  });

  it("exposes requisition action guards", () => {
    const draft = { id: 1, requisition_no: "MR-1", project_id: 1, contract_id: null, requested_by: 1, status: "draft", remarks: null, created_at: "", updated_at: null, items: [] };
    const submitted = { ...draft, id: 2, status: "submitted" };
    expect(canSubmitRequisition(draft)).toBe(true);
    expect(canSubmitRequisition(submitted)).toBe(false);
    expect(canApproveRequisition(submitted)).toBe(true);
  });

  it("keeps form defaults ergonomic", () => {
    const defaults = buildMaterialFormDefaults();
    expect(defaults.unit).toBe("Nos");
    expect(buildRequisitionNumber(new Date("2026-03-27T12:34:00Z"))).toBe("MR-20260327-1234");
  });
});
