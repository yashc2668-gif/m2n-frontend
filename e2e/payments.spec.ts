import { expect, test } from "@playwright/test";

import {
  bootstrapOperatorSession,
  contracts,
  fulfillJson,
  getApiBasePattern,
  getApiPath,
  operatorUser,
  parseJsonBody,
} from "./support/finance-operator-fixtures";

test("finance operator can create, approve, release, and allocate a payment", async ({
  page,
}) => {
  const state = {
    nextPaymentId: 301,
    nextAllocationId: 401,
    payments: [] as Array<Record<string, unknown>>,
    outstandingBills: [
      {
        ra_bill_id: 501,
        bill_no: 12,
        status: "approved",
        net_payable: 50000,
        paid_amount: 0,
        outstanding_amount: 50000,
        contract_id: 21,
      },
    ],
  };

  await bootstrapOperatorSession(page);

  await page.route(getApiBasePattern(), async (route) => {
    const path = getApiPath(route.request().url());
    const method = route.request().method();
    const url = new URL(route.request().url());

    if (path === "/auth/me" && method === "GET") {
      await fulfillJson(route, operatorUser);
      return;
    }

    if (path === "/contracts/" && method === "GET") {
      await fulfillJson(route, contracts);
      return;
    }

    if (path === "/payments/" && method === "GET") {
      await fulfillJson(route, state.payments);
      return;
    }

    if (path === "/payments/outstanding/ra-bills" && method === "GET") {
      const contractId = url.searchParams.get("contract_id");
      const rows = state.outstandingBills.filter((bill) => {
        if (bill.outstanding_amount <= 0) {
          return false;
        }
        if (!contractId) {
          return true;
        }
        return bill.contract_id === Number(contractId);
      });
      await fulfillJson(route, rows);
      return;
    }

    if (path === "/payments/" && method === "POST") {
      const payload = await parseJsonBody<{
        contract_id: number;
        payment_date: string;
        amount: number;
        ra_bill_id?: number | null;
        payment_mode?: string | null;
        reference_no?: string | null;
        remarks?: string | null;
      }>(route);
      const payment = {
        id: state.nextPaymentId++,
        contract_id: payload.contract_id,
        payment_date: payload.payment_date,
        amount: payload.amount,
        status: "draft",
        ra_bill_id: payload.ra_bill_id ?? null,
        payment_mode: payload.payment_mode ?? null,
        reference_no: payload.reference_no ?? null,
        remarks: payload.remarks ?? null,
        approved_by: null,
        approved_at: null,
        released_by: null,
        released_at: null,
        allocated_amount: 0,
        available_amount: payload.amount,
        allocations: [],
        created_at: "2026-03-28T11:00:00Z",
        updated_at: null,
      };
      state.payments.unshift(payment);
      await fulfillJson(route, payment, 201);
      return;
    }

    const actionMatch = path.match(/^\/payments\/(\d+)\/(approve|release|allocate)$/);
    if (actionMatch && method === "POST") {
      const paymentId = Number(actionMatch[1]);
      const action = actionMatch[2];
      const payment = state.payments.find((item) => item.id === paymentId);

      if (!payment) {
        await fulfillJson(
          route,
          { error: { message: "Payment not found" } },
          404,
        );
        return;
      }

      if (action === "approve") {
        payment.status = "approved";
        payment.approved_by = operatorUser.id;
        payment.approved_at = "2026-03-28T11:05:00Z";
      }

      if (action === "release") {
        payment.status = "released";
        payment.released_by = operatorUser.id;
        payment.released_at = "2026-03-28T11:10:00Z";
      }

      if (action === "allocate") {
        const allocations = (JSON.parse(route.request().postData() ?? "[]") ??
          []) as Array<{ ra_bill_id: number; amount: number; remarks?: string | null }>;
        allocations.forEach((allocation) => {
          payment.allocations.push({
            id: state.nextAllocationId++,
            payment_id: payment.id,
            ra_bill_id: allocation.ra_bill_id,
            amount: allocation.amount,
            remarks: allocation.remarks ?? null,
            created_at: "2026-03-28T11:15:00Z",
          });
          payment.allocated_amount += allocation.amount;
          payment.available_amount -= allocation.amount;

          const bill = state.outstandingBills.find(
            (row) => row.ra_bill_id === allocation.ra_bill_id,
          );
          if (bill) {
            bill.paid_amount += allocation.amount;
            bill.outstanding_amount -= allocation.amount;
            bill.status = bill.outstanding_amount > 0 ? "partially_paid" : "paid";
          }
        });
      }

      await fulfillJson(route, payment);
      return;
    }

    await fulfillJson(route, { error: { message: `Unhandled route: ${method} ${path}` } }, 500);
  });

  await page.goto("/payments");

  await expect(
    page.getByText("Run release and allocation workflow from one finance desk."),
  ).toBeVisible();

  await page.getByRole("button", { name: "New payment" }).click();
  const drawer = page.locator("div.fixed.inset-0.z-50");

  await drawer.getByLabel("Contract").selectOption("21");
  await drawer.getByLabel("Amount").fill("50000");
  await drawer.getByLabel("Reference no").fill("UTR-5001");
  await drawer.getByRole("button", { name: "Create payment" }).click();

  await expect(page.getByText("Payment #301 created.")).toBeVisible();

  await drawer.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("Payment #301 approved.")).toBeVisible();

  await drawer.getByRole("button", { name: "Release" }).click();
  await expect(page.getByText("Payment #301 released.")).toBeVisible();
  await expect(drawer.getByText("Allocate released payment")).toBeVisible();

  await drawer.getByLabel("RA bill").selectOption("501");
  await drawer.getByLabel("Amount").last().fill("50000");
  await drawer.getByRole("button", { name: "Allocate payment" }).click();

  await expect(page.getByText("Payment #301 allocated successfully.")).toBeVisible();
  await expect(drawer.getByText("RA Bill #501")).toBeVisible();
});
