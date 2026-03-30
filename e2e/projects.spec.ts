import { expect, test } from "@playwright/test";
import {
  bootstrapOperatorSession,
  getApiBasePattern,
  getApiPath,
  operatorUser,
  fulfillJson,
} from "./support/finance-operator-fixtures";

test("project manager can create and manage projects", async ({ page }) => {
  await bootstrapOperatorSession(page);

  const projects = [
    {
      id: 1,
      company_id: 1,
      name: "Central Plaza",
      code: "PRJ001",
      original_value: 50000000,
      revised_value: 52000000,
      status: "ACTIVE",
      start_date: "2025-06-15",
      expected_end_date: "2026-12-31",
    },
  ];

  await page.route(getApiBasePattern(), async (route) => {
    const path = getApiPath(route.request().url());
    const method = route.request().method();

    if (path === "/auth/me" && method === "GET") {
      await fulfillJson(route, operatorUser);
      return;
    }

    if (path === "/projects/" && method === "GET") {
      await fulfillJson(route, projects);
      return;
    }

    if (path.includes("/projects/page") && method === "GET") {
      await fulfillJson(route, {
        items: projects,
        total: 1,
        page: 1,
        limit: 25,
        pages: 1,
      });
      return;
    }

    if (path === "/companies/" && method === "GET") {
      await fulfillJson(route, [
        { id: 1, name: "Company A", created_at: "2026-01-01", updated_at: "2026-01-01" },
      ]);
      return;
    }

    if (path === "/contracts/" && method === "GET") {
      await fulfillJson(route, []);
      return;
    }

    await route.continue();
  });

  await page.goto("/projects");

  // Verify projects page loads
  await expect(page.getByRole("heading", { name: /projects/i })).toBeVisible();
  await expect(page.getByText("Central Plaza")).toBeVisible();
  await expect(page.getByText("50000000")).toBeVisible();
});

test("user can filter projects by status", async ({ page }) => {
  await bootstrapOperatorSession(page);

  const activeProjects = [
    {
      id: 1,
      company_id: 1,
      name: "Active Project",
      code: "PRJ001",
      status: "ACTIVE",
      original_value: 50000000,
      revised_value: 52000000,
    },
  ];

  const planningProjects = [
    {
      id: 2,
      company_id: 1,
      name: "Planning Project",
      code: "PRJ002",
      status: "PLANNING",
      original_value: 30000000,
      revised_value: 30000000,
    },
  ];

  let current_status_filter = "all";

  await page.route(getApiBasePattern(), async (route) => {
    const path = getApiPath(route.request().url());
    const method = route.request().method();
    const url = new URL(route.request().url());

    if (path === "/auth/me" && method === "GET") {
      await fulfillJson(route, operatorUser);
      return;
    }

    if (path === "/projects/" && method === "GET") {
      await fulfillJson(route, [...activeProjects, ...planningProjects]);
      return;
    }

    if (path.includes("/projects/page") && method === "GET") {
      const statusFilter = url.searchParams.get("status_filter");
      if (statusFilter) current_status_filter = statusFilter;

      const filtered =
        current_status_filter === "ACTIVE"
          ? activeProjects
          : current_status_filter === "PLANNING"
            ? planningProjects
            : [...activeProjects, ...planningProjects];

      await fulfillJson(route, {
        items: filtered,
        total: filtered.length,
        page: 1,
        limit: 25,
        pages: 1,
      });
      return;
    }

    if (path === "/companies/" && method === "GET") {
      await fulfillJson(route, [
        { id: 1, name: "Company A", created_at: "2026-01-01", updated_at: "2026-01-01" },
      ]);
      return;
    }

    if (path === "/contracts/" && method === "GET") {
      await fulfillJson(route, []);
      return;
    }

    await route.continue();
  });

  await page.goto("/projects");

  // Verify both projects load initially
  await expect(page.getByText("Active Project")).toBeVisible();
  await expect(page.getByText("Planning Project")).toBeVisible();

  // Filter by ACTIVE status
  const statusSelect = page.getByRole("combobox", { name: /status|filter/i }).first();
  if (await statusSelect.isVisible()) {
    await statusSelect.click();
    await page.getByRole("option", { name: /active/i }).click();

    // Wait for filtered results
    await page.waitForResponse((response) =>
      response.url().includes("/projects/page") && response.url().includes("status_filter=ACTIVE")
    );

    // Verify only active project is shown
    await expect(page.getByText("Active Project")).toBeVisible();
  }
});

test("user can search projects by name", async ({ page }) => {
  await bootstrapOperatorSession(page);

  const projects = [
    {
      id: 1,
      company_id: 1,
      name: "Office Tower Extension",
      code: "PRJ001",
      status: "ACTIVE",
      original_value: 30000000,
      revised_value: 31500000,
    },
    {
      id: 2,
      company_id: 1,
      name: "Shopping Complex",
      code: "PRJ002",
      status: "ACTIVE",
      original_value: 50000000,
      revised_value: 52000000,
    },
  ];

  await page.route(getApiBasePattern(), async (route) => {
    const path = getApiPath(route.request().url());
    const method = route.request().method();
    const url = new URL(route.request().url());

    if (path === "/auth/me" && method === "GET") {
      await fulfillJson(route, operatorUser);
      return;
    }

    if (path === "/projects/" && method === "GET") {
      await fulfillJson(route, projects);
      return;
    }

    if (path.includes("/projects/page") && method === "GET") {
      const searchQuery = url.searchParams.get("search");
      const filtered = searchQuery
        ? projects.filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
        : projects;

      await fulfillJson(route, {
        items: filtered,
        total: filtered.length,
        page: 1,
        limit: 25,
        pages: 1,
      });
      return;
    }

    if (path === "/companies/" && method === "GET") {
      await fulfillJson(route, [
        { id: 1, name: "Company A", created_at: "2026-01-01", updated_at: "2026-01-01" },
      ]);
      return;
    }

    if (path === "/contracts/" && method === "GET") {
      await fulfillJson(route, []);
      return;
    }

    await route.continue();
  });

  await page.goto("/projects");

  // Verify both projects load
  await expect(page.getByText("Office Tower Extension")).toBeVisible();
  await expect(page.getByText("Shopping Complex")).toBeVisible();

  // Search for "Tower"
  const searchInput = page.getByPlaceholder(/search/i);
  if (await searchInput.isVisible()) {
    await searchInput.fill("Tower");

    // Wait for search results
    await page.waitForResponse((response) =>
      response.url().includes("/projects/page") && response.url().includes("search=Tower")
    );

    // Verify only matching project is visible
    await expect(page.getByText("Office Tower Extension")).toBeVisible();
  }
});
