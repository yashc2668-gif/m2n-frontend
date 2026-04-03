import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchMaterialIssues } from "@/api/material-issues";
import { fetchMaterialReceipts } from "@/api/material-receipts";
import { fetchMaterialStockAdjustments } from "@/api/material-stock-adjustments";

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

describe("material workflow list pagination", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("normalizes paginated material issues into an array", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            items: [
              {
                id: 11,
                issue_no: "MI-11",
                project_id: 2,
                contract_id: null,
                issued_by: 5,
                status: "draft",
                remarks: null,
                created_at: "2026-04-01T10:00:00Z",
                updated_at: null,
                items: [],
              },
            ],
            total: 1,
            page: 1,
            limit: 100,
          },
          { status: 200 },
        ),
      ),
    );

    const issues = await fetchMaterialIssues("token-123");

    expect(Array.isArray(issues)).toBe(true);
    expect(issues[0]).toEqual(expect.objectContaining({ id: 11, issue_no: "MI-11" }));
  });

  it("normalizes paginated material receipts into an array", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            items: [
              {
                id: 12,
                receipt_no: "MRC-12",
                vendor_id: 4,
                project_id: 2,
                contract_id: null,
                received_by: 5,
                status: "draft",
                remarks: null,
                created_at: "2026-04-01T10:00:00Z",
                updated_at: null,
                items: [],
              },
            ],
            total: 1,
            page: 1,
            limit: 100,
          },
          { status: 200 },
        ),
      ),
    );

    const receipts = await fetchMaterialReceipts("token-123");

    expect(Array.isArray(receipts)).toBe(true);
    expect(receipts[0]).toEqual(
      expect.objectContaining({ id: 12, receipt_no: "MRC-12" }),
    );
  });

  it("normalizes paginated stock adjustments into an array", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            items: [
              {
                id: 13,
                adjustment_no: "ADJ-13",
                project_id: 2,
                contract_id: null,
                adjusted_by: 5,
                adjustment_type: "loss",
                status: "draft",
                remarks: null,
                created_at: "2026-04-01T10:00:00Z",
                updated_at: null,
                items: [],
              },
            ],
            total: 1,
            page: 1,
            limit: 100,
          },
          { status: 200 },
        ),
      ),
    );

    const adjustments = await fetchMaterialStockAdjustments("token-123");

    expect(Array.isArray(adjustments)).toBe(true);
    expect(adjustments[0]).toEqual(
      expect.objectContaining({ id: 13, adjustment_no: "ADJ-13" }),
    );
  });
});
