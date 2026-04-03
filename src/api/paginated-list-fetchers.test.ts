import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchBOQItems } from "@/api/boq";
import { fetchLabourAdvances } from "@/api/labour-advances";
import { fetchLabourAttendances } from "@/api/labour-attendance";
import { fetchLabourBills } from "@/api/labour-bills";
import { fetchLabourProductivities } from "@/api/labour-productivities";
import { fetchMeasurements } from "@/api/measurements";
import { fetchSecuredAdvanceRecoveries, fetchSecuredAdvances } from "@/api/secured-advances";
import { fetchUsers } from "@/api/users";
import { fetchWorkDone } from "@/api/work-done";

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

describe("paginated list fetchers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it.each([
    ["BOQ items", () => fetchBOQItems("token-123", 7)],
    ["labour advances", () => fetchLabourAdvances("token-123")],
    ["labour attendances", () => fetchLabourAttendances("token-123")],
    ["labour bills", () => fetchLabourBills("token-123")],
    ["labour productivities", () => fetchLabourProductivities("token-123")],
    ["measurements", () => fetchMeasurements("token-123")],
    ["secured advances", () => fetchSecuredAdvances("token-123")],
    ["secured advance recoveries", () => fetchSecuredAdvanceRecoveries("token-123", 5)],
    ["users", () => fetchUsers("token-123")],
    ["work done", () => fetchWorkDone("token-123")],
  ])("normalizes paginated %s responses into arrays", async (_label, runFetch) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            items: [{ id: 1 }],
            total: 1,
            page: 1,
            limit: 100,
          },
          { status: 200 },
        ),
      ),
    );

    const result = await runFetch();

    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual([{ id: 1 }]);
  });
});
