import { describe, expect, it } from "vitest";

import {
  buildPaymentAllocationLine,
  buildPaymentDefaults,
  buildRABillDefaults,
  buildRABillGenerateDefaults,
  canAllocatePayment,
  canApprovePayment,
  canApproveRABill,
  canCancelRABill,
  canGenerateRABill,
  canHoldRABill,
  canMarkRABillPaid,
  canMarkRABillPartiallyPaid,
  canReleasePayment,
  canRejectRABill,
  canSubmitRABill,
  canVerifyRABill,
  filterPayments,
  filterRABills,
  getAllocationDraftTotal,
  getPaymentMetrics,
  getRABillMetrics,
} from "@/features/finance-operations/finance-operations-helpers";

describe("finance workflow helpers", () => {
  it("builds deterministic defaults for bills and payments", () => {
    const date = new Date("2026-03-28T09:25:00Z");

    expect(buildRABillDefaults(date)).toMatchObject({
      contract_id: "",
      bill_date: "2026-03-28",
      period_from: "2026-03-01",
      period_to: "2026-03-28",
    });
    expect(buildRABillGenerateDefaults()).toMatchObject({
      tds_percentage: "",
      apply_contract_retention: true,
      deductions: [],
    });
    expect(buildPaymentDefaults(date)).toMatchObject({
      contract_id: "",
      payment_date: "2026-03-28",
      payment_mode: "bank_transfer",
    });
    expect(buildPaymentAllocationLine("12")).toMatchObject({
      ra_bill_id: "12",
      amount: 0,
    });
  });

  it("recognizes RA bill and payment workflow actions", () => {
    expect(canGenerateRABill({ status: "draft" } as never)).toBe(true);
    expect(
      canSubmitRABill({ status: "draft", items: [{ id: 1 }] } as never),
    ).toBe(true);
    expect(canVerifyRABill({ status: "submitted" } as never)).toBe(true);
    expect(canApproveRABill({ status: "verified" } as never)).toBe(true);
    expect(canRejectRABill({ status: "finance_hold" } as never)).toBe(true);
    expect(canCancelRABill({ status: "draft" } as never)).toBe(true);
    expect(canHoldRABill({ status: "verified" } as never)).toBe(true);
    expect(canMarkRABillPartiallyPaid({ status: "approved" } as never)).toBe(
      true,
    );
    expect(canMarkRABillPaid({ status: "partially_paid" } as never)).toBe(
      true,
    );
    expect(canApprovePayment({ status: "draft" } as never)).toBe(true);
    expect(canReleasePayment({ status: "approved" } as never)).toBe(true);
    expect(
      canAllocatePayment({ status: "released", available_amount: 500 } as never),
    ).toBe(true);
  });

  it("filters bills and payments with operational controls", () => {
    expect(
      filterRABills(
        [
          {
            bill_no: 7,
            status: "submitted",
            contract_id: 11,
            bill_date: "2026-03-15",
            remarks: "north tower",
            outstanding_amount: 500,
          },
          {
            bill_no: 8,
            status: "paid",
            contract_id: 12,
            bill_date: "2026-04-15",
            remarks: "south tower",
            outstanding_amount: 0,
          },
        ] as never,
        {
          status: "submitted",
          contractId: "11",
          settlement: "open",
          search: "north",
        },
      ),
    ).toHaveLength(1);

    expect(
      filterPayments(
        [
          {
            id: 1,
            contract_id: 11,
            payment_date: "2026-03-20",
            status: "released",
            payment_mode: "bank_transfer",
            reference_no: "UTR-1",
            remarks: "march release",
          },
          {
            id: 2,
            contract_id: 12,
            payment_date: "2026-04-02",
            status: "draft",
            payment_mode: null,
            reference_no: null,
            remarks: "pending",
          },
        ] as never,
        {
          status: "released",
          contractId: "11",
          mode: "bank_transfer",
          fromDate: "2026-03-01",
          toDate: "2026-03-31",
          search: "utr-1",
        },
      ),
    ).toHaveLength(1);
  });

  it("aggregates finance metrics and allocation totals", () => {
    expect(
      getRABillMetrics(
        [
          {
            status: "draft",
            net_payable: 1000,
            outstanding_amount: 1000,
          },
          {
            status: "approved",
            net_payable: 2500,
            outstanding_amount: 500,
          },
        ] as never,
      ),
    ).toMatchObject({
      total: 2,
      draft: 1,
      approved: 1,
      netPayable: 3500,
      outstanding: 1500,
    });

    expect(
      getPaymentMetrics(
        [
          {
            status: "draft",
            amount: 1000,
            allocated_amount: 0,
            available_amount: 1000,
          },
          {
            status: "released",
            amount: 3000,
            allocated_amount: 1200,
            available_amount: 1800,
          },
        ] as never,
        [{ outstanding_amount: 900 }, { outstanding_amount: 600 }] as never,
      ),
    ).toMatchObject({
      total: 2,
      draft: 1,
      released: 1,
      pool: 4000,
      allocated: 1200,
      available: 2800,
      outstanding: 1500,
      outstandingCount: 2,
    });

    expect(
      getAllocationDraftTotal([
        { amount: 100 },
        { amount: "250.50" },
        { amount: null },
      ]),
    ).toBeCloseTo(350.5);
  });
});
