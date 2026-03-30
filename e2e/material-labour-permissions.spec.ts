import { expect, test, type Locator, type Page } from "@playwright/test";

import {
  bootstrapSession,
  engineerUser,
  labourAdvances,
  labourAttendances,
  labourBills,
  mockOperationsReadApis,
  operatorUser,
  viewerUser,
} from "./support/operations-permission-fixtures";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function visibleButton(target: Page | Locator, label: string) {
  return target
    .locator("button:visible")
    .filter({ hasText: new RegExp(`^${escapeRegExp(label)}$`) })
    .first();
}

test("viewer sees material master in read-only mode while engineer gets stock-master controls", async ({
  browser,
}) => {
  const viewerPage = await browser.newPage();
  const engineerPage = await browser.newPage();

  await bootstrapSession(viewerPage, viewerUser, "viewer-token");
  await bootstrapSession(engineerPage, engineerUser, "engineer-token");
  await mockOperationsReadApis(viewerPage, viewerUser);
  await mockOperationsReadApis(engineerPage, engineerUser);

  await viewerPage.goto("/materials");
  await engineerPage.goto("/materials");

  await expect(
    visibleButton(viewerPage, "New material"),
  ).toBeDisabled();
  await expect(
    visibleButton(engineerPage, "New material"),
  ).toBeEnabled();

  await expect(
    visibleButton(viewerPage, "Edit"),
  ).toBeDisabled();
  await expect(
    visibleButton(engineerPage, "Edit"),
  ).toBeEnabled();

  await expect(
    visibleButton(viewerPage, "Create material"),
  ).toBeDisabled();
  await expect(
    visibleButton(engineerPage, "Create material"),
  ).toBeEnabled();

  await viewerPage.close();
  await engineerPage.close();
});

test("accountant sees material receipts read-only while engineer gets inward-stock controls", async ({
  browser,
}) => {
  const accountantPage = await browser.newPage();
  const engineerPage = await browser.newPage();

  await bootstrapSession(accountantPage, operatorUser, "accountant-token");
  await bootstrapSession(engineerPage, engineerUser, "engineer-token");
  await mockOperationsReadApis(accountantPage, operatorUser);
  await mockOperationsReadApis(engineerPage, engineerUser);

  await accountantPage.goto("/materials/receipts");
  await engineerPage.goto("/materials/receipts");

  await expect(
    visibleButton(accountantPage, "Review"),
  ).toBeDisabled();
  await expect(
    visibleButton(engineerPage, "Review"),
  ).toBeEnabled();

  await expect(
    visibleButton(accountantPage, "Create receipt"),
  ).toBeDisabled();
  await expect(
    visibleButton(engineerPage, "Create receipt"),
  ).toBeEnabled();

  await accountantPage.close();
  await engineerPage.close();
});

test("accountant sees labour attendance read-only while engineer gets muster workflow controls", async ({
  browser,
}) => {
  const accountantPage = await browser.newPage();
  const engineerPage = await browser.newPage();

  await bootstrapSession(accountantPage, operatorUser, "accountant-token");
  await bootstrapSession(engineerPage, engineerUser, "engineer-token");
  await mockOperationsReadApis(accountantPage, operatorUser, {
    attendanceRows: labourAttendances,
  });
  await mockOperationsReadApis(engineerPage, engineerUser, {
    attendanceRows: labourAttendances,
  });

  await accountantPage.goto("/labour/attendance");
  await engineerPage.goto("/labour/attendance");

  await expect(
    visibleButton(accountantPage, "New muster"),
  ).toBeDisabled();
  await expect(
    visibleButton(engineerPage, "New muster"),
  ).toBeEnabled();

  await expect(
    visibleButton(accountantPage, "Approve"),
  ).toBeDisabled();
  await expect(
    visibleButton(engineerPage, "Approve"),
  ).toBeEnabled();

  await visibleButton(accountantPage, "Review").click();
  await visibleButton(engineerPage, "Review").click();

  const accountantDrawer = accountantPage.locator("div.fixed.inset-0.z-50");
  const engineerDrawer = engineerPage.locator("div.fixed.inset-0.z-50");

  await expect(
    visibleButton(accountantDrawer, "Approve"),
  ).toBeDisabled();
  await expect(
    visibleButton(engineerDrawer, "Approve"),
  ).toBeEnabled();

  await accountantPage.close();
  await engineerPage.close();
});

test("viewer sees labour bills read-only while engineer gets billing workflow controls", async ({
  browser,
}) => {
  const viewerPage = await browser.newPage();
  const engineerPage = await browser.newPage();

  await bootstrapSession(viewerPage, viewerUser, "viewer-token");
  await bootstrapSession(engineerPage, engineerUser, "engineer-token");
  await mockOperationsReadApis(viewerPage, viewerUser, {
    billRows: labourBills,
    attendanceRows: labourAttendances,
  });
  await mockOperationsReadApis(engineerPage, engineerUser, {
    billRows: labourBills,
    attendanceRows: labourAttendances,
  });

  await viewerPage.goto("/labour/bills");
  await engineerPage.goto("/labour/bills");

  await expect(
    visibleButton(viewerPage, "New labour bill"),
  ).toBeDisabled();
  await expect(
    visibleButton(engineerPage, "New labour bill"),
  ).toBeEnabled();

  await expect(
    visibleButton(viewerPage, "Approve"),
  ).toBeDisabled();
  await expect(
    visibleButton(engineerPage, "Approve"),
  ).toBeEnabled();

  await visibleButton(viewerPage, "Review").click();
  await visibleButton(engineerPage, "Review").click();

  const viewerDrawer = viewerPage.locator("div.fixed.inset-0.z-50");
  const engineerDrawer = engineerPage.locator("div.fixed.inset-0.z-50");

  await expect(
    visibleButton(viewerDrawer, "Update bill"),
  ).toBeDisabled();
  await expect(
    visibleButton(engineerDrawer, "Update bill"),
  ).toBeEnabled();

  await viewerPage.close();
  await engineerPage.close();
});

test("viewer sees labour advances read-only while engineer gets recovery controls", async ({
  browser,
}) => {
  const viewerPage = await browser.newPage();
  const engineerPage = await browser.newPage();

  await bootstrapSession(viewerPage, viewerUser, "viewer-token");
  await bootstrapSession(engineerPage, engineerUser, "engineer-token");
  await mockOperationsReadApis(viewerPage, viewerUser, {
    advanceRows: labourAdvances,
    billRows: labourBills,
  });
  await mockOperationsReadApis(engineerPage, engineerUser, {
    advanceRows: labourAdvances,
    billRows: labourBills,
  });

  await viewerPage.goto("/labour/advances");
  await engineerPage.goto("/labour/advances");

  await expect(
    visibleButton(viewerPage, "New advance"),
  ).toBeDisabled();
  await expect(
    visibleButton(engineerPage, "New advance"),
  ).toBeEnabled();

  await visibleButton(viewerPage, "Review").click();
  await visibleButton(engineerPage, "Review").click();

  const viewerDrawer = viewerPage.locator("div.fixed.inset-0.z-50");
  const engineerDrawer = engineerPage.locator("div.fixed.inset-0.z-50");

  await expect(
    visibleButton(viewerDrawer, "Update advance"),
  ).toBeDisabled();
  await expect(
    visibleButton(engineerDrawer, "Update advance"),
  ).toBeEnabled();
  await expect(
    visibleButton(viewerDrawer, "Add recovery"),
  ).toBeDisabled();
  await expect(
    visibleButton(engineerDrawer, "Add recovery"),
  ).toBeEnabled();

  await viewerPage.close();
  await engineerPage.close();
});
