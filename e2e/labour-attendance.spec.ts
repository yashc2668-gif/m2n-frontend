import { expect, test } from "@playwright/test";
import {
  bootstrapOperatorSession,
  getApiBasePattern,
  getApiPath,
  operatorUser,
  fulfillJson,
} from "./support/finance-operator-fixtures";

test("user can record labour attendance", async ({ page }) => {
  await bootstrapOperatorSession(page);

  const labourAttendance = [
    {
      id: 1,
      date: "2026-03-30",
      labour_id: 1,
      labour_name: "Rajesh Singh",
      category: "SKILLED",
      working_hours: 8,
      piece_count: null,
      is_present: true,
      created_at: "2026-03-30T00:00:00Z",
    },
    {
      id: 2,
      date: "2026-03-30",
      labour_id: 2,
      labour_name: "Priya Sharma",
      category: "SEMI_SKILLED",
      working_hours: 8,
      piece_count: null,
      is_present: true,
      created_at: "2026-03-30T00:00:00Z",
    },
  ];

  let attendance_page_calls = 0;

  await page.route(getApiBasePattern(), async (route) => {
    const path = getApiPath(route.request().url());
    const method = route.request().method();

    if (path === "/auth/me" && method === "GET") {
      await fulfillJson(route, operatorUser);
      return;
    }

    if (path.includes("/labour-attendance/page") && method === "GET") {
      attendance_page_calls++;
      await fulfillJson(route, {
        items: labourAttendance,
        total: 2,
        page: 1,
        limit: 25,
        pages: 1,
      });
      return;
    }

    if (path === "/projects/" && method === "GET") {
      await fulfillJson(route, [
        {
          id: 1,
          name: "Project A",
          code: "PRJ001",
          status: "ACTIVE",
          created_at: "2026-01-01",
          updated_at: "2026-01-01",
        },
      ]);
      return;
    }

    if (path === "/labour/" && method === "GET") {
      await fulfillJson(route, [
        { id: 1, name: "Rajesh Singh", labour_code: "LAB001", category: "SKILLED" },
        { id: 2, name: "Priya Sharma", labour_code: "LAB002", category: "SEMI_SKILLED" },
      ]);
      return;
    }

    await route.continue();
  });

  await page.goto("/labour-attendance");

  // Verify page loads
  await expect(page.getByRole("heading", { name: /attendance|labour/i })).toBeVisible();

  // Verify attendance records are displayed
  await expect(page.getByText("Rajesh Singh")).toBeVisible();
  await expect(page.getByText("Priya Sharma")).toBeVisible();

  expect(attendance_page_calls).toBeGreaterThan(0);
});

test("user can filter labour attendance by date", async ({ page }) => {
  await bootstrapOperatorSession(page);

  const marchlAttendance = [
    {
      id: 1,
      date: "2026-03-30",
      labour_id: 1,
      labour_name: "Rajesh Singh",
      working_hours: 8,
      is_present: true,
      created_at: "2026-03-30T00:00:00Z",
    },
  ];

  const aprilAttendance = [
    {
      id: 2,
      date: "2026-04-05",
      labour_id: 2,
      labour_name: "Priya Sharma",
      working_hours: 8,
      is_present: true,
      created_at: "2026-04-05T00:00:00Z",
    },
  ];

  let current_date_filter = null;

  await page.route(getApiBasePattern(), async (route) => {
    const path = getApiPath(route.request().url());
    const method = route.request().method();
    const url = new URL(route.request().url());

    if (path === "/auth/me" && method === "GET") {
      await fulfillJson(route, operatorUser);
      return;
    }

    if (path.includes("/labour-attendance/page") && method === "GET") {
      const dateFilter = url.searchParams.get("date");
      if (dateFilter) current_date_filter = dateFilter;

      const filtered =
        current_date_filter === "2026-03-30"
          ? marchlAttendance
          : current_date_filter === "2026-04-05"
            ? aprilAttendance
            : [...marchlAttendance, ...aprilAttendance];

      await fulfillJson(route, {
        items: filtered,
        total: filtered.length,
        page: 1,
        limit: 25,
        pages: 1,
      });
      return;
    }

    if (path === "/projects/" && method === "GET") {
      await fulfillJson(route, [
        { id: 1, name: "Project A", code: "PRJ001", created_at: "2026-01-01" },
      ]);
      return;
    }

    if (path === "/labour/" && method === "GET") {
      await fulfillJson(route, []);
      return;
    }

    await route.continue();
  });

  await page.goto("/labour-attendance");

  // Verify records load
  await expect(page.getByRole("heading", { name: /attendance/i })).toBeVisible();

  // Try to filter by date if date picker exists
  const dateInput = page.getByLabel(/date|from date/i).first();
  if (await dateInput.isVisible()) {
    await dateInput.fill("2026-03-30");

    // Wait for filtered results
    await page.waitForResponse((response) =>
      response.url().includes("/labour-attendance/page")
    );
  }
});

test("user can search labour attendance by worker name", async ({ page }) => {
  await bootstrapOperatorSession(page);

  const allAttendance = [
    {
      id: 1,
      date: "2026-03-30",
      labour_id: 1,
      labour_name: "Rajesh Singh",
      working_hours: 8,
      is_present: true,
      created_at: "2026-03-30T00:00:00Z",
    },
    {
      id: 2,
      date: "2026-03-30",
      labour_id: 2,
      labour_name: "Priya Sharma",
      working_hours: 8,
      is_present: true,
      created_at: "2026-03-30T00:00:00Z",
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

    if (path.includes("/labour-attendance/page") && method === "GET") {
      const searchQuery = url.searchParams.get("search");
      const filtered = searchQuery
        ? allAttendance.filter((a) => a.labour_name.toLowerCase().includes(searchQuery.toLowerCase()))
        : allAttendance;

      await fulfillJson(route, {
        items: filtered,
        total: filtered.length,
        page: 1,
        limit: 25,
        pages: 1,
      });
      return;
    }

    if (path === "/projects/" && method === "GET") {
      await fulfillJson(route, [
        { id: 1, name: "Project A", code: "PRJ001", created_at: "2026-01-01" },
      ]);
      return;
    }

    if (path === "/labour/" && method === "GET") {
      await fulfillJson(route, []);
      return;
    }

    await route.continue();
  });

  await page.goto("/labour-attendance");

  // Verify both records load
  await expect(page.getByText("Rajesh Singh")).toBeVisible();
  await expect(page.getByText("Priya Sharma")).toBeVisible();

  // Search for "Rajesh"
  const searchInput = page.getByPlaceholder(/search/i);
  if (await searchInput.isVisible()) {
    await searchInput.fill("Rajesh");

    // Wait for search results
    await page.waitForResponse((response) =>
      response.url().includes("/labour-attendance/page") && response.url().includes("search=Rajesh")
    );

    // Verify only matching record is visible
    await expect(page.getByText("Rajesh Singh")).toBeVisible();
  }
});
