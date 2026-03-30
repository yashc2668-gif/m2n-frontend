import { expect, test } from "@playwright/test";
import {
  bootstrapOperatorSession,
  getApiBasePattern,
  getApiPath,
  operatorUser,
  fulfillJson,
} from "./support/finance-operator-fixtures";

test("user can view, search, and filter materials", async ({ page }) => {
  await bootstrapOperatorSession(page);

  const materials = [
    {
      id: 1,
      item_code: "MAT001",
      item_name: "Cement",
      category: "Consumables",
      unit: "Bag",
      default_rate: 350,
      current_stock: 500,
      is_active: true,
    },
    {
      id: 2,
      item_code: "MAT002",
      item_name: "Steel Bars",
      category: "Structural",
      unit: "Ton",
      default_rate: 55000,
      current_stock: 120,
      is_active: true,
    },
  ];

  let materials_call_count = 0;

  await page.route(getApiBasePattern(), async (route) => {
    const path = getApiPath(route.request().url());
    const method = route.request().method();

    if (path === "/auth/me" && method === "GET") {
      await fulfillJson(route, operatorUser);
      return;
    }

    if (path === "/materials/" && method === "GET") {
      await fulfillJson(route, materials);
      return;
    }

    if (path.includes("/materials/page") && method === "GET") {
      materials_call_count++;
      await fulfillJson(route, {
        items: materials,
        total: 2,
        page: 1,
        limit: 25,
        pages: 1,
      });
      return;
    }

    if (path === "/materials/stock-summary" && method === "GET") {
      await fulfillJson(route, []);
      return;
    }

    if (path === "/projects/" && method === "GET") {
      await fulfillJson(route, []);
      return;
    }

    if (path === "/companies/" && method === "GET") {
      await fulfillJson(route, [
        { id: 1, name: "Company A", created_at: "2026-01-01", updated_at: "2026-01-01" },
      ]);
      return;
    }

    await route.continue();
  });

  await page.goto("/materials");

  // Verify materials page loads
  await expect(page.getByRole("heading", { name: /materials/i })).toBeVisible();

  // Wait for data to load
  await expect(page.getByText("Cement")).toBeVisible();
  await expect(page.getByText("Steel Bars")).toBeVisible();

  // Test search functionality
  const searchInput = page.getByPlaceholder(/search/i);
  await searchInput.fill("Cement");

  // Verify API was called with search parameter
  await page.waitForResponse((response) => {
    const url = response.url();
    return url.includes("/materials/page") && url.includes("search=Cement");
  });

  expect(materials_call_count).toBeGreaterThan(0);
});

test("user can create a new material", async ({ page }) => {
  await bootstrapOperatorSession(page);

  let create_material_called = false;

  await page.route(getApiBasePattern(), async (route) => {
    const path = getApiPath(route.request().url());
    const method = route.request().method();

    if (path === "/auth/me" && method === "GET") {
      await fulfillJson(route, operatorUser);
      return;
    }

    if (path === "/materials/" && method === "POST") {
      create_material_called = true;
      const body = await parseJsonBody(route);
      await fulfillJson(route, { id: 3, ...body, created_at: "2026-03-30", updated_at: "2026-03-30" });
      return;
    }

    if (path === "/materials/" && method === "GET") {
      await fulfillJson(route, []);
      return;
    }

    if (path.includes("/materials/page")) {
      await fulfillJson(route, { items: [], total: 0, page: 1, limit: 25, pages: 1 });
      return;
    }

    if (path === "/materials/stock-summary" && method === "GET") {
      await fulfillJson(route, []);
      return;
    }

    if (path === "/projects/" && method === "GET") {
      await fulfillJson(route, []);
      return;
    }

    if (path === "/companies/" && method === "GET") {
      await fulfillJson(route, [
        { id: 1, name: "Company A", created_at: "2026-01-01", updated_at: "2026-01-01" },
      ]);
      return;
    }

    await route.continue();
  });

  await page.goto("/materials");

  // Click create button
  await page.getByRole("button", { name: /create|new material/i }).click();

  // Fill form
  await page.getByLabel(/item code/i).fill("MAT999");
  await page.getByLabel(/item name/i).fill("New Material");
  await page.getByLabel(/unit/i).fill("Piece");

  // Submit
  await page.getByRole("button", { name: /save|submit|create/i }).click();

  // Verify API was called
  await page.waitForResponse((response) =>
    response.url().includes("/materials/") && response.request().method() === "POST"
  );

  expect(create_material_called).toBe(true);
});

async function parseJsonBody(route) {
  const request = route.request();
  return request.postDataJSON ? request.postDataJSON() : {};
}
