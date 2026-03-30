import { expect, test, type Page } from "@playwright/test";

import {
  bootstrapSession,
  contracts,
  engineerUser,
  fulfillJson,
  getApiBasePattern,
  getApiPath,
  operatorUser,
  projectManagerUser,
  projects,
  viewerUser,
} from "./support/finance-operator-fixtures";

function buildSubmittedBill() {
  return {
    id: 901,
    contract_id: 21,
    bill_no: 44,
    bill_date: "2026-03-28",
    period_from: "2026-03-01",
    period_to: "2026-03-28",
    gross_amount: 150000,
    total_deductions: 5000,
    net_payable: 145000,
    paid_amount: 0,
    outstanding_amount: 145000,
    status: "submitted",
    remarks: "Submitted for finance verification",
    submitted_by: operatorUser.id,
    submitted_at: "2026-03-28T11:00:00Z",
    approved_by: null,
    approved_at: null,
    items: [
      {
        id: 1201,
        ra_bill_id: 901,
        work_done_item_id: 11,
        measurement_id: 22,
        boq_item_id: 33,
        item_code_snapshot: "BOQ-44",
        description_snapshot: "Formwork package",
        unit_snapshot: "sqm",
        prev_quantity: 200,
        curr_quantity: 75,
        cumulative_quantity: 275,
        rate: 2000,
        amount: 150000,
        created_at: "2026-03-28T11:00:00Z",
      },
    ],
    deductions: [
      {
        id: 1301,
        ra_bill_id: 901,
        deduction_type: "tds",
        description: "TDS deduction",
        reason: null,
        percentage: 1,
        amount: 5000,
        secured_advance_id: null,
        is_system_generated: true,
        created_at: "2026-03-28T11:00:00Z",
      },
    ],
    status_logs: [
      {
        id: 1401,
        ra_bill_id: 901,
        from_status: "draft",
        to_status: "submitted",
        action: "submit",
        remarks: "Submitted for review",
        actor_user_id: operatorUser.id,
        created_at: "2026-03-28T11:05:00Z",
      },
    ],
    created_at: "2026-03-28T10:30:00Z",
    updated_at: null,
  };
}

function buildVerifiedBill() {
  return {
    ...buildSubmittedBill(),
    id: 902,
    bill_no: 45,
    status: "verified",
    remarks: "Verified and ready for project-level approval",
    status_logs: [
      {
        id: 1402,
        ra_bill_id: 902,
        from_status: "submitted",
        to_status: "verified",
        action: "verify",
        remarks: "Commercial checks complete",
        actor_user_id: operatorUser.id,
        created_at: "2026-03-28T12:05:00Z",
      },
    ],
  };
}

function buildApprovedBill() {
  return {
    ...buildSubmittedBill(),
    id: 903,
    bill_no: 46,
    status: "approved",
    remarks: "Approved and waiting for finance settlement",
    status_logs: [
      {
        id: 1403,
        ra_bill_id: 903,
        from_status: "verified",
        to_status: "approved",
        action: "approve",
        remarks: "Approved at project review stage",
        actor_user_id: operatorUser.id,
        created_at: "2026-03-28T13:05:00Z",
      },
    ],
  };
}

function buildDraftPayment() {
  return {
    ...buildReleasedPayment(),
    id: 802,
    status: "draft",
    reference_no: "UTR-9002",
    remarks: "Awaiting approval",
    approved_by: null,
    approved_at: null,
    released_by: null,
    released_at: null,
    allocated_amount: 0,
    available_amount: 145000,
  };
}

function buildApprovedPayment() {
  return {
    ...buildReleasedPayment(),
    id: 803,
    status: "approved",
    reference_no: "UTR-9003",
    remarks: "Approved and queued for release",
    released_by: null,
    released_at: null,
    allocated_amount: 0,
    available_amount: 145000,
  };
}

function buildReleasedPayment() {
  return {
    id: 801,
    contract_id: 21,
    payment_date: "2026-03-28",
    amount: 145000,
    status: "released",
    ra_bill_id: 901,
    payment_mode: "bank_transfer",
    reference_no: "UTR-9001",
    remarks: "Released for settlement",
    approved_by: operatorUser.id,
    approved_at: "2026-03-28T12:00:00Z",
    released_by: operatorUser.id,
    released_at: "2026-03-28T12:10:00Z",
    allocated_amount: 0,
    available_amount: 145000,
    allocations: [],
    created_at: "2026-03-28T11:45:00Z",
    updated_at: null,
  };
}

function buildOutstandingBills() {
  return [
    {
      ra_bill_id: 901,
      bill_no: 44,
      status: "approved",
      net_payable: 145000,
      paid_amount: 0,
      outstanding_amount: 145000,
      contract_id: 21,
    },
  ];
}

async function mockFinanceReadApis(
  page: Page,
  user: typeof operatorUser,
  options: {
    bills?: Array<Record<string, unknown>>;
    payments?: Array<Record<string, unknown>>;
    outstandingBills?: Array<Record<string, unknown>>;
  } = {},
) {
  const bills = options.bills ?? [];
  const payments = options.payments ?? [];
  const outstandingBills = options.outstandingBills ?? [];

  await page.route(getApiBasePattern(), async (route) => {
    const path = getApiPath(route.request().url());
    const method = route.request().method();
    const url = new URL(route.request().url());

    if (path === "/auth/me" && method === "GET") {
      await fulfillJson(route, user);
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
      await fulfillJson(route, bills);
      return;
    }

    if (path === "/payments/" && method === "GET") {
      await fulfillJson(route, payments);
      return;
    }

    if (path === "/payments/outstanding/ra-bills" && method === "GET") {
      const contractId = url.searchParams.get("contract_id");
      const rows = outstandingBills.filter((row) => {
        if (!contractId) {
          return true;
        }
        return row.contract_id === Number(contractId);
      });
      await fulfillJson(route, rows);
      return;
    }

    await fulfillJson(
      route,
      { error: { message: `Unhandled route: ${method} ${path}` } },
      500,
    );
  });
}

test("viewer sees RA bills in read-only mode while accountant gets workflow controls", async ({
  browser,
}) => {
  const viewerPage = await browser.newPage();
  const accountantPage = await browser.newPage();
  const bill = buildSubmittedBill();

  await bootstrapSession(viewerPage, viewerUser, "viewer-token");
  await bootstrapSession(accountantPage, operatorUser, "accountant-token");
  await mockFinanceReadApis(viewerPage, viewerUser, { bills: [bill] });
  await mockFinanceReadApis(accountantPage, operatorUser, { bills: [bill] });

  await viewerPage.goto("/ra-bills");
  await accountantPage.goto("/ra-bills");

  await expect(
    viewerPage.getByRole("button", { name: "New RA bill draft" }),
  ).toBeDisabled();
  await expect(
    accountantPage.getByRole("button", { name: "New RA bill draft" }),
  ).toBeEnabled();

  await expect(
    viewerPage.getByRole("button", { name: "Verify" }),
  ).toHaveCount(0);
  await expect(
    accountantPage.getByRole("button", { name: "Verify" }),
  ).toHaveCount(1);

  await viewerPage.getByRole("button", { name: "Review" }).click();
  await accountantPage.getByRole("button", { name: "Review" }).click();

  const viewerDrawer = viewerPage.locator("div.fixed.inset-0.z-50");
  const accountantDrawer = accountantPage.locator("div.fixed.inset-0.z-50");

  await expect(
    viewerDrawer.getByRole("button", { name: "Verify" }),
  ).toBeDisabled();
  await expect(
    viewerDrawer.getByRole("button", { name: "Finance hold" }),
  ).toBeDisabled();
  await expect(
    viewerDrawer.getByRole("button", { name: "Reject" }),
  ).toBeDisabled();

  await expect(
    accountantDrawer.getByRole("button", { name: "Verify" }),
  ).toBeEnabled();
  await expect(
    accountantDrawer.getByRole("button", { name: "Finance hold" }),
  ).toBeEnabled();
  await expect(
    accountantDrawer.getByRole("button", { name: "Reject" }),
  ).toBeEnabled();

  await viewerPage.close();
  await accountantPage.close();
});

test("viewer sees payments read-only while accountant gets allocation controls", async ({
  browser,
}) => {
  const viewerPage = await browser.newPage();
  const accountantPage = await browser.newPage();
  const payment = buildReleasedPayment();
  const outstandingBills = buildOutstandingBills();

  await bootstrapSession(viewerPage, viewerUser, "viewer-token");
  await bootstrapSession(accountantPage, operatorUser, "accountant-token");
  await mockFinanceReadApis(viewerPage, viewerUser, {
    payments: [payment],
    outstandingBills,
  });
  await mockFinanceReadApis(accountantPage, operatorUser, {
    payments: [payment],
    outstandingBills,
  });

  await viewerPage.goto("/payments");
  await accountantPage.goto("/payments");

  await expect(
    viewerPage.getByRole("button", { name: "New payment" }),
  ).toBeDisabled();
  await expect(
    accountantPage.getByRole("button", { name: "New payment" }),
  ).toBeEnabled();

  await viewerPage.getByRole("button", { name: "Review" }).click();
  await accountantPage.getByRole("button", { name: "Review" }).click();

  const viewerDrawer = viewerPage.locator("div.fixed.inset-0.z-50");
  const accountantDrawer = accountantPage.locator("div.fixed.inset-0.z-50");

  await expect(viewerDrawer.getByText("Allocate released payment")).toBeVisible();
  await expect(
    viewerDrawer.getByRole("button", { name: "Allocate payment" }),
  ).toBeDisabled();

  await expect(
    accountantDrawer.getByText("Allocate released payment"),
  ).toBeVisible();
  await expect(
    accountantDrawer.getByRole("button", { name: "Allocate payment" }),
  ).toBeEnabled();

  await viewerPage.close();
  await accountantPage.close();
});

test("engineer sees RA bills but finance workflow stays with accountant", async ({
  browser,
}) => {
  const engineerPage = await browser.newPage();
  const accountantPage = await browser.newPage();
  const bill = buildSubmittedBill();

  await bootstrapSession(engineerPage, engineerUser, "engineer-token");
  await bootstrapSession(accountantPage, operatorUser, "accountant-token");
  await mockFinanceReadApis(engineerPage, engineerUser, { bills: [bill] });
  await mockFinanceReadApis(accountantPage, operatorUser, { bills: [bill] });

  await engineerPage.goto("/ra-bills");
  await accountantPage.goto("/ra-bills");

  await expect(
    engineerPage.getByRole("button", { name: "New RA bill draft" }),
  ).toBeDisabled();
  await expect(
    accountantPage.getByRole("button", { name: "New RA bill draft" }),
  ).toBeEnabled();

  await expect(
    engineerPage.getByRole("button", { name: "Verify" }),
  ).toHaveCount(0);
  await expect(
    engineerPage.getByRole("button", { name: "Approve" }),
  ).toHaveCount(0);
  await expect(
    accountantPage.getByRole("button", { name: "Verify" }),
  ).toHaveCount(1);

  await engineerPage.getByRole("button", { name: "Review" }).click();
  await accountantPage.getByRole("button", { name: "Review" }).click();

  const engineerDrawer = engineerPage.locator("div.fixed.inset-0.z-50");
  const accountantDrawer = accountantPage.locator("div.fixed.inset-0.z-50");

  await expect(
    engineerDrawer.getByRole("button", { name: "Submit" }),
  ).toBeDisabled();
  await expect(
    engineerDrawer.getByRole("button", { name: "Verify" }),
  ).toBeDisabled();
  await expect(
    engineerDrawer.getByRole("button", { name: "Finance hold" }),
  ).toBeDisabled();
  await expect(
    engineerDrawer.getByRole("button", { name: "Mark paid" }),
  ).toBeDisabled();

  await expect(
    accountantDrawer.getByRole("button", { name: "Verify" }),
  ).toBeEnabled();
  await expect(
    accountantDrawer.getByRole("button", { name: "Finance hold" }),
  ).toBeEnabled();
  await expect(
    accountantDrawer.getByRole("button", { name: "Reject" }),
  ).toBeEnabled();

  await engineerPage.close();
  await accountantPage.close();
});

test("engineer sees payments context but only accountant gets payment actions", async ({
  browser,
}) => {
  const engineerPage = await browser.newPage();
  const accountantPage = await browser.newPage();
  const payment = buildReleasedPayment();
  const outstandingBills = buildOutstandingBills();

  await bootstrapSession(engineerPage, engineerUser, "engineer-token");
  await bootstrapSession(accountantPage, operatorUser, "accountant-token");
  await mockFinanceReadApis(engineerPage, engineerUser, {
    payments: [payment],
    outstandingBills,
  });
  await mockFinanceReadApis(accountantPage, operatorUser, {
    payments: [payment],
    outstandingBills,
  });

  await engineerPage.goto("/payments");
  await accountantPage.goto("/payments");

  await expect(
    engineerPage.getByRole("button", { name: "New payment" }),
  ).toBeDisabled();
  await expect(
    accountantPage.getByRole("button", { name: "New payment" }),
  ).toBeEnabled();

  await expect(
    engineerPage.getByRole("button", { name: "Approve" }),
  ).toHaveCount(0);
  await expect(
    engineerPage.getByRole("button", { name: "Release" }),
  ).toHaveCount(0);

  await engineerPage.getByRole("button", { name: "Review" }).click();
  await accountantPage.getByRole("button", { name: "Review" }).click();

  const engineerDrawer = engineerPage.locator("div.fixed.inset-0.z-50");
  const accountantDrawer = accountantPage.locator("div.fixed.inset-0.z-50");

  await expect(
    engineerDrawer.getByRole("button", { name: "Approve" }),
  ).toBeDisabled();
  await expect(
    engineerDrawer.getByRole("button", { name: "Release" }),
  ).toBeDisabled();
  await expect(
    engineerDrawer.getByText("Allocate released payment"),
  ).toBeVisible();
  await expect(
    engineerDrawer.getByRole("button", { name: "Allocate payment" }),
  ).toBeDisabled();

  await expect(
    accountantDrawer.getByRole("button", { name: "Approve" }),
  ).toBeDisabled();
  await expect(
    accountantDrawer.getByRole("button", { name: "Release" }),
  ).toBeDisabled();
  await expect(
    accountantDrawer.getByRole("button", { name: "Allocate payment" }),
  ).toBeEnabled();

  await engineerPage.close();
  await accountantPage.close();
});

test("project manager keeps RA bill workflow controls that stay blocked for engineer", async ({
  browser,
}) => {
  const engineerPage = await browser.newPage();
  const projectManagerPage = await browser.newPage();
  const submittedBill = buildSubmittedBill();
  const verifiedBill = buildVerifiedBill();

  await bootstrapSession(engineerPage, engineerUser, "engineer-token");
  await bootstrapSession(projectManagerPage, projectManagerUser, "pm-token");
  await mockFinanceReadApis(engineerPage, engineerUser, {
    bills: [submittedBill, verifiedBill],
  });
  await mockFinanceReadApis(projectManagerPage, projectManagerUser, {
    bills: [submittedBill, verifiedBill],
  });

  await engineerPage.goto("/ra-bills");
  await projectManagerPage.goto("/ra-bills");

  await expect(
    engineerPage.getByRole("button", { name: "New RA bill draft" }),
  ).toBeDisabled();
  await expect(
    projectManagerPage.getByRole("button", { name: "New RA bill draft" }),
  ).toBeEnabled();

  await expect(
    engineerPage.getByRole("button", { name: "Verify" }),
  ).toHaveCount(0);
  await expect(
    engineerPage.getByRole("button", { name: "Approve" }),
  ).toHaveCount(0);
  await expect(
    projectManagerPage.getByRole("button", { name: "Verify" }),
  ).toHaveCount(1);
  await expect(
    projectManagerPage.getByRole("button", { name: "Approve" }),
  ).toHaveCount(1);

  await engineerPage.getByRole("button", { name: "Review" }).first().click();
  await projectManagerPage
    .getByRole("button", { name: "Review" })
    .first()
    .click();

  const engineerDrawer = engineerPage.locator("div.fixed.inset-0.z-50");
  const projectManagerDrawer = projectManagerPage.locator(
    "div.fixed.inset-0.z-50",
  );

  await expect(
    engineerDrawer.getByRole("button", { name: "Verify" }),
  ).toBeDisabled();
  await expect(
    engineerDrawer.getByRole("button", { name: "Finance hold" }),
  ).toBeDisabled();
  await expect(
    engineerDrawer.getByRole("button", { name: "Reject" }),
  ).toBeDisabled();

  await expect(
    projectManagerDrawer.getByRole("button", { name: "Verify" }),
  ).toBeEnabled();
  await expect(
    projectManagerDrawer.getByRole("button", { name: "Finance hold" }),
  ).toBeEnabled();
  await expect(
    projectManagerDrawer.getByRole("button", { name: "Reject" }),
  ).toBeEnabled();

  await engineerPage.close();
  await projectManagerPage.close();
});

test("project manager cannot settle approved RA bills while accountant can", async ({
  browser,
}) => {
  const projectManagerPage = await browser.newPage();
  const accountantPage = await browser.newPage();
  const approvedBill = buildApprovedBill();

  await bootstrapSession(projectManagerPage, projectManagerUser, "pm-token");
  await bootstrapSession(accountantPage, operatorUser, "accountant-token");
  await mockFinanceReadApis(projectManagerPage, projectManagerUser, {
    bills: [approvedBill],
  });
  await mockFinanceReadApis(accountantPage, operatorUser, {
    bills: [approvedBill],
  });

  await projectManagerPage.goto("/ra-bills");
  await accountantPage.goto("/ra-bills");

  await projectManagerPage.getByRole("button", { name: "Review" }).click();
  await accountantPage.getByRole("button", { name: "Review" }).click();

  const projectManagerDrawer = projectManagerPage.locator(
    "div.fixed.inset-0.z-50",
  );
  const accountantDrawer = accountantPage.locator("div.fixed.inset-0.z-50");

  await expect(
    projectManagerDrawer.getByRole("button", { name: "Partially paid" }),
  ).toBeDisabled();
  await expect(
    projectManagerDrawer.getByRole("button", { name: "Mark paid" }),
  ).toBeDisabled();

  await expect(
    accountantDrawer.getByRole("button", { name: "Partially paid" }),
  ).toBeEnabled();
  await expect(
    accountantDrawer.getByRole("button", { name: "Mark paid" }),
  ).toBeEnabled();

  await projectManagerPage.close();
  await accountantPage.close();
});

test("project manager sees payments but settlement actions stay with accountant", async ({
  browser,
}) => {
  const projectManagerPage = await browser.newPage();
  const accountantPage = await browser.newPage();
  const draftPayment = buildDraftPayment();
  const approvedPayment = buildApprovedPayment();
  const releasedPayment = buildReleasedPayment();
  const outstandingBills = buildOutstandingBills();

  await bootstrapSession(projectManagerPage, projectManagerUser, "pm-token");
  await bootstrapSession(accountantPage, operatorUser, "accountant-token");
  await mockFinanceReadApis(projectManagerPage, projectManagerUser, {
    payments: [draftPayment, approvedPayment, releasedPayment],
    outstandingBills,
  });
  await mockFinanceReadApis(accountantPage, operatorUser, {
    payments: [draftPayment, approvedPayment, releasedPayment],
    outstandingBills,
  });

  await projectManagerPage.goto("/payments");
  await accountantPage.goto("/payments");

  await expect(
    projectManagerPage.getByRole("button", { name: "New payment" }),
  ).toBeDisabled();
  await expect(
    accountantPage.getByRole("button", { name: "New payment" }),
  ).toBeEnabled();

  await expect(
    projectManagerPage.getByRole("button", { name: "Approve" }),
  ).toHaveCount(0);
  await expect(
    projectManagerPage.getByRole("button", { name: "Release" }),
  ).toHaveCount(0);
  await expect(
    accountantPage.getByRole("button", { name: "Approve" }),
  ).toHaveCount(1);
  await expect(
    accountantPage.getByRole("button", { name: "Release" }),
  ).toHaveCount(1);

  await projectManagerPage
    .getByRole("button", { name: "Review" })
    .nth(2)
    .click();
  await accountantPage.getByRole("button", { name: "Review" }).nth(2).click();

  const projectManagerDrawer = projectManagerPage.locator(
    "div.fixed.inset-0.z-50",
  );
  const accountantDrawer = accountantPage.locator("div.fixed.inset-0.z-50");

  await expect(
    projectManagerDrawer.getByRole("button", { name: "Allocate payment" }),
  ).toBeDisabled();
  await expect(
    accountantDrawer.getByRole("button", { name: "Allocate payment" }),
  ).toBeEnabled();

  await projectManagerPage.close();
  await accountantPage.close();
});
