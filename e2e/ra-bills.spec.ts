import { expect, test } from "@playwright/test";

import {
  bootstrapOperatorSession,
  contracts,
  fulfillJson,
  getApiBasePattern,
  getApiPath,
  operatorUser,
  parseJsonBody,
  projects,
} from "./support/finance-operator-fixtures";

test("finance operator can create, generate, submit, verify, and approve an RA bill", async ({
  page,
}) => {
  const state = {
    nextBillId: 101,
    nextLogId: 1001,
    nextItemId: 2001,
    nextDeductionId: 3001,
    bills: [] as Array<Record<string, unknown>>,
  };

  await bootstrapOperatorSession(page);

  await page.route(getApiBasePattern(), async (route) => {
    const path = getApiPath(route.request().url());
    const method = route.request().method();

    if (path === "/auth/me" && method === "GET") {
      await fulfillJson(route, operatorUser);
      return;
    }

    if (path === "/contracts/" && method === "GET") {
      await fulfillJson(route, contracts);
      return;
    }

    if (path === "/projects/" && method === "GET") {
      await fulfillJson(route, projects);
      return;
    }

    if (path === "/ra-bills/" && method === "GET") {
      await fulfillJson(route, state.bills);
      return;
    }

    if (path === "/ra-bills/" && method === "POST") {
      const payload = await parseJsonBody<{
        contract_id: number;
        bill_date: string;
        bill_no?: number;
        period_from?: string | null;
        period_to?: string | null;
        remarks?: string | null;
      }>(route);
      const billId = state.nextBillId++;
      const billNo = payload.bill_no ?? billId;
      const bill = {
        id: billId,
        contract_id: payload.contract_id,
        bill_no: billNo,
        bill_date: payload.bill_date,
        period_from: payload.period_from ?? null,
        period_to: payload.period_to ?? null,
        gross_amount: 0,
        total_deductions: 0,
        net_payable: 0,
        paid_amount: 0,
        outstanding_amount: 0,
        status: "draft",
        remarks: payload.remarks ?? null,
        submitted_by: null,
        submitted_at: null,
        approved_by: null,
        approved_at: null,
        items: [],
        deductions: [],
        status_logs: [
          {
            id: state.nextLogId++,
            ra_bill_id: billId,
            from_status: null,
            to_status: "draft",
            action: "create",
            remarks: payload.remarks ?? null,
            actor_user_id: operatorUser.id,
            created_at: "2026-03-28T09:00:00Z",
          },
        ],
        created_at: "2026-03-28T09:00:00Z",
        updated_at: null,
      };
      state.bills.unshift(bill);
      await fulfillJson(route, bill, 201);
      return;
    }

    const billMatch = path.match(/^\/ra-bills\/(\d+)\/(generate|submit|verify|approve)$/);
    if (billMatch && method === "POST") {
      const billId = Number(billMatch[1]);
      const action = billMatch[2];
      const bill = state.bills.find((item) => item.id === billId);

      if (!bill) {
        await fulfillJson(
          route,
          { error: { message: "RA bill not found" } },
          404,
        );
        return;
      }

      if (action === "generate") {
        const payload = await parseJsonBody<{
          deductions?: Array<{ deduction_type: string; amount: number; reason?: string | null }>;
        }>(route);
        const manualDeductions = (payload.deductions ?? []).map((deduction) => ({
          id: state.nextDeductionId++,
          ra_bill_id: billId,
          deduction_type: deduction.deduction_type,
          description: null,
          reason: deduction.reason ?? null,
          percentage: null,
          amount: deduction.amount,
          secured_advance_id: null,
          is_system_generated: false,
          created_at: "2026-03-28T10:00:00Z",
        }));
        bill.items = [
          {
            id: state.nextItemId++,
            ra_bill_id: billId,
            work_done_item_id: 501,
            measurement_id: 601,
            boq_item_id: 701,
            item_code_snapshot: "BOQ-101",
            description_snapshot: "RCC core shuttering",
            unit_snapshot: "sqm",
            prev_quantity: 100,
            curr_quantity: 55,
            cumulative_quantity: 155,
            rate: 4500,
            amount: 247500,
            created_at: "2026-03-28T10:00:00Z",
          },
        ];
        bill.deductions = manualDeductions;
        bill.gross_amount = 247500;
        bill.total_deductions = manualDeductions.reduce(
          (sum, deduction) => sum + deduction.amount,
          0,
        );
        bill.net_payable = bill.gross_amount - bill.total_deductions;
        bill.outstanding_amount = bill.net_payable;
      }

      if (action === "submit") {
        bill.status = "submitted";
        bill.submitted_by = operatorUser.id;
        bill.submitted_at = "2026-03-28T10:05:00Z";
      }

      if (action === "verify") {
        bill.status = "verified";
      }

      if (action === "approve") {
        bill.status = "approved";
        bill.approved_by = operatorUser.id;
        bill.approved_at = "2026-03-28T10:15:00Z";
      }

      bill.status_logs.unshift({
        id: state.nextLogId++,
        ra_bill_id: billId,
        from_status:
          action === "generate"
            ? "draft"
            : action === "submit"
              ? "draft"
              : action === "verify"
                ? "submitted"
                : "verified",
        to_status:
          action === "generate"
            ? "draft"
            : action === "submit"
              ? "submitted"
              : action === "verify"
                ? "verified"
                : "approved",
        action,
        remarks: null,
        actor_user_id: operatorUser.id,
        created_at: "2026-03-28T10:20:00Z",
      });

      await fulfillJson(route, bill);
      return;
    }

    await fulfillJson(route, { error: { message: `Unhandled route: ${method} ${path}` } }, 500);
  });

  await page.goto("/ra-bills");

  await expect(
    page.getByText(
      "Move commercial bills from draft to finance-ready approval in one operator desk.",
    ),
  ).toBeVisible();

  await page.getByRole("button", { name: "New RA bill draft" }).click();
  const drawer = page.locator("div.fixed.inset-0.z-50");

  await drawer.getByLabel("Contract").selectOption("21");
  await drawer.getByLabel("Remarks").fill("April running bill");
  await drawer.getByRole("button", { name: "Create draft" }).click();

  await expect(page.getByText("Bill #101 draft created.")).toBeVisible();
  await drawer.getByRole("button", { name: "Generate items" }).click();
  await expect(page.getByText("Bill #101 generated.")).toBeVisible();
  await expect(drawer.getByText("RCC core shuttering")).toBeVisible();

  await drawer.getByRole("button", { name: "Submit" }).first().click();
  await expect(page.getByText("Bill #101 submitted.")).toBeVisible();

  await drawer.getByRole("button", { name: "Verify" }).first().click();
  await expect(page.getByText("Bill #101 verified.")).toBeVisible();

  await drawer.getByRole("button", { name: "Approve" }).first().click();
  await expect(page.getByText("Bill #101 approved.")).toBeVisible();
  await expect(drawer.getByRole("button", { name: "Partially paid" })).toBeVisible();
});
