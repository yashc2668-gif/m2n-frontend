import type { Page, Route } from "@playwright/test";

const storageKey = "m2n.frontend.session";
const apiBase = "http://localhost:8000/api/v1";

export const operatorUser = {
  id: 7,
  company_id: 1,
  full_name: "Finance Operator",
  email: "finance@example.com",
  phone: "9999999999",
  role: "accountant",
  is_active: true,
  created_at: "2026-03-01T09:00:00Z",
};

export const viewerUser = {
  ...operatorUser,
  id: 8,
  full_name: "Read Only Viewer",
  email: "viewer@example.com",
  role: "viewer",
};

export const engineerUser = {
  ...operatorUser,
  id: 9,
  full_name: "Site Engineer",
  email: "engineer@example.com",
  role: "engineer",
};

export const projectManagerUser = {
  ...operatorUser,
  id: 10,
  full_name: "Project Manager",
  email: "pm@example.com",
  role: "project_manager",
};

export const projects = [
  {
    id: 11,
    company_id: 1,
    name: "Skyline Tower",
    code: "P-011",
    description: "Commercial tower package",
    client_name: "Urban Infra",
    location: "Noida",
    original_value: 150000000,
    revised_value: 165000000,
    start_date: "2026-01-10",
    expected_end_date: "2027-02-28",
    actual_end_date: null,
    status: "active",
    created_at: "2026-01-01T09:00:00Z",
    updated_at: "2026-03-25T09:00:00Z",
  },
];

export const contracts = [
  {
    id: 21,
    project_id: 11,
    vendor_id: 31,
    contract_no: "CT-021",
    title: "Civil Core Package",
    scope_of_work: "RCC and finishing",
    start_date: "2026-01-15",
    end_date: "2026-12-31",
    original_value: 90000000,
    revised_value: 98000000,
    retention_percentage: 5,
    status: "active",
    created_at: "2026-01-05T09:00:00Z",
  },
];

export async function bootstrapSession(
  page: Page,
  user = operatorUser,
  accessToken = "e2e-token",
  csrfToken = "e2e-csrf-token",
) {
  await page.addInitScript(
    ([key, session, cookieValue]) => {
      window.localStorage.setItem(key, JSON.stringify(session));
      document.cookie = `m2n_csrf_token=${cookieValue}; path=/`;
    },
    [
      storageKey,
      {
        accessToken,
        accessTokenExpiresAt: Date.now() + 3600 * 1000,
        csrfToken,
        user,
      },
      csrfToken,
    ],
  );
}

export async function bootstrapOperatorSession(page: Page) {
  await bootstrapSession(page, operatorUser);
}

export async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

export async function parseJsonBody<T>(route: Route) {
  return (JSON.parse(route.request().postData() ?? "{}") ?? {}) as T;
}

export function getApiPath(url: string) {
  const parsed = new URL(url);
  return parsed.pathname.replace("/api/v1", "");
}

export function getApiBasePattern() {
  return `${apiBase}/**`;
}
