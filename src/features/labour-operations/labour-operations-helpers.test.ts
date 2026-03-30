import { describe, expect, it } from "vitest";

import {
  buildAdvanceDefaults,
  buildAttendanceDefaults,
  buildBillDefaults,
  buildLabourWorkflowNumber,
  canApproveAttendance,
  canApproveBill,
  canMarkBillPaid,
  canSubmitAttendance,
  filterAdvances,
  filterAttendances,
  filterBills,
  getAdvanceMetrics,
  getAttendanceStatusOptions,
  getBillStatusOptions,
  getSelectedAttendanceTotal,
} from "@/features/labour-operations/labour-operations-helpers";

describe("labour workflow helpers", () => {
  it("builds deterministic references", () => {
    const date = new Date("2026-03-27T05:45:00Z");
    expect(buildLabourWorkflowNumber("MST", date)).toBe("MST-20260327-0545");
    expect(buildAttendanceDefaults(date).muster_no).toBe("MST-20260327-0545");
    expect(buildBillDefaults(date).bill_no).toBe("LB-20260327-0545");
    expect(buildAdvanceDefaults(date).advance_no).toBe("ADV-20260327-0545");
  });

  it("returns valid attendance and bill transitions", () => {
    expect(getAttendanceStatusOptions()).toEqual(["draft", "submitted"]);
    expect(getAttendanceStatusOptions("submitted")).toEqual([
      "submitted",
      "approved",
      "cancelled",
    ]);
    expect(getBillStatusOptions()).toEqual(["draft", "submitted"]);
    expect(getBillStatusOptions("approved")).toEqual([
      "approved",
      "paid",
      "cancelled",
    ]);
  });

  it("recognizes workflow action states", () => {
    expect(canSubmitAttendance({ status: "draft" } as never)).toBe(true);
    expect(canApproveAttendance({ status: "submitted" } as never)).toBe(true);
    expect(canApproveBill({ status: "submitted" } as never)).toBe(true);
    expect(canMarkBillPaid({ status: "approved" } as never)).toBe(true);
  });

  it("aggregates advance and attendance totals", () => {
    expect(
      getAdvanceMetrics([
        { status: "active", balance_amount: 5000, recovered_amount: 1000 },
        { status: "closed", balance_amount: 0, recovered_amount: 2500 },
      ] as never),
    ).toMatchObject({ active: 1, closed: 1, balance: 5000, recovered: 3500 });

    expect(
      getSelectedAttendanceTotal(
        [
          { id: 1, total_wage: 2500 },
          { id: 2, total_wage: 3200 },
        ] as never,
        ["2"],
      ),
    ).toBe(3200);
  });

  it("filters attendance, bills, and advances with operational controls", () => {
    expect(
      filterAttendances(
        [
          {
            muster_no: "MST-1",
            status: "approved",
            project_id: 1,
            contractor_id: 3,
            attendance_date: "2026-03-10",
            remarks: "Night shift",
          },
          {
            muster_no: "MST-2",
            status: "draft",
            project_id: 2,
            contractor_id: 4,
            attendance_date: "2026-03-15",
            remarks: "Storm delay",
          },
        ] as never,
        {
          status: "approved",
          projectId: "1",
          contractorId: "3",
          search: "night",
        },
      ),
    ).toHaveLength(1);

    expect(
      filterBills(
        [
          {
            bill_no: "LB-1",
            status: "submitted",
            project_id: 1,
            contractor_id: 9,
            period_start: "2026-03-01",
            period_end: "2026-03-31",
            remarks: "March cycle",
          },
          {
            bill_no: "LB-2",
            status: "paid",
            project_id: 2,
            contractor_id: 9,
            period_start: "2026-04-01",
            period_end: "2026-04-30",
            remarks: "April cycle",
          },
        ] as never,
        {
          status: "submitted",
          contractorId: "9",
          fromDate: "2026-03-01",
          toDate: "2026-03-31",
        },
      ),
    ).toHaveLength(1);

    expect(
      filterAdvances(
        [
          {
            advance_no: "ADV-1",
            status: "active",
            project_id: 1,
            contractor_id: 2,
            balance_amount: 5000,
            remarks: "Crew cash",
          },
          {
            advance_no: "ADV-2",
            status: "closed",
            project_id: 1,
            contractor_id: 2,
            balance_amount: 0,
            remarks: "Recovered",
          },
        ] as never,
        {
          projectId: "1",
          contractorId: "2",
          balanceState: "open",
          search: "crew",
        },
      ),
    ).toHaveLength(1);
  });
});
