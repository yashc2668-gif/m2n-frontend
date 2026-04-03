import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchMaterialRequisitions } from "@/api/material-requisitions";

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

describe("material requisitions api", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("normalizes paginated requisition responses into an array", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(
        {
          items: [
            {
              id: 101,
              requisition_no: "MR-101",
              project_id: 7,
              contract_id: null,
              requested_by: 3,
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
    );

    vi.stubGlobal("fetch", fetchMock);

    const requisitions = await fetchMaterialRequisitions("token-123");

    expect(requisitions).toEqual([
      expect.objectContaining({
        id: 101,
        requisition_no: "MR-101",
      }),
    ]);
    expect(Array.isArray(requisitions)).toBe(true);
  });
});
