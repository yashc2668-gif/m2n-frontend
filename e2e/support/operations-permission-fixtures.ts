import type { Page } from "@playwright/test";

import {
  bootstrapSession,
  contracts,
  engineerUser,
  fulfillJson,
  getApiBasePattern,
  getApiPath,
  operatorUser,
  projects,
  viewerUser,
} from "./finance-operator-fixtures";

export { bootstrapSession, engineerUser, operatorUser, projects, viewerUser };

export const companies = [
  {
    id: 1,
    name: "M2N Buildworks",
  },
];

export const vendors = [
  {
    id: 31,
    name: "Prime Supplier Co.",
  },
];

export const materials = [
  {
    id: 101,
    item_code: "CEM-43",
    item_name: "OPC Cement 43 Grade",
    category: "Civil",
    unit: "Bag",
    reorder_level: 50,
    default_rate: 420,
    current_stock: 30,
    is_active: true,
    company_id: 1,
    project_id: 11,
    created_at: "2026-03-01T09:00:00Z",
    updated_at: "2026-03-26T09:00:00Z",
  },
  {
    id: 102,
    item_code: "REB-10",
    item_name: "TMT Rebar 10mm",
    category: "Steel",
    unit: "Kg",
    reorder_level: 500,
    default_rate: 66,
    current_stock: 1450,
    is_active: true,
    company_id: 1,
    project_id: 11,
    created_at: "2026-03-02T09:00:00Z",
    updated_at: "2026-03-26T09:00:00Z",
  },
];

export const materialStockSummary = [
  {
    scope_type: "project",
    scope_id: 11,
    scope_name: "Skyline Tower",
    material_count: 2,
    total_stock: 1480,
  },
  {
    scope_type: "company",
    scope_id: 1,
    scope_name: "M2N Buildworks",
    material_count: 2,
    total_stock: 1480,
  },
];

export const materialReceipts = [
  {
    id: 501,
    receipt_no: "GRN-2401",
    vendor_id: 31,
    project_id: 11,
    receipt_date: "2026-03-27",
    status: "received",
    total_amount: 21000,
    remarks: "Supplier unloading cleared at gate 2.",
    items: [
      {
        id: 5101,
        material_id: 101,
        received_qty: 50,
        unit_rate: 420,
        line_amount: 21000,
      },
    ],
    created_at: "2026-03-27T08:30:00Z",
    updated_at: null,
  },
];

export const labourContractors = [
  {
    id: 41,
    contractor_name: "Sharma Gang",
    contractor_code: "CTR-041",
    contact_person: "Rakesh Sharma",
    phone: "9999900041",
    address: "Sector 18, Noida",
    is_active: true,
    created_at: "2026-02-01T09:00:00Z",
    updated_at: "2026-03-20T09:00:00Z",
  },
];

export const labours = [
  {
    id: 61,
    labour_code: "LB-061",
    full_name: "Mohan Kumar",
    trade: "mason",
    skill_type: "mason",
    skill_level: "skilled",
    contractor_id: 41,
    daily_rate: 750,
    default_wage_rate: 750,
    is_active: true,
    created_at: "2026-02-10T09:00:00Z",
    updated_at: "2026-03-24T09:00:00Z",
  },
  {
    id: 62,
    labour_code: "LB-062",
    full_name: "Ravi Singh",
    trade: "bar_bender",
    skill_type: "bar_bender",
    skill_level: "semi_skilled",
    contractor_id: 41,
    daily_rate: 700,
    default_wage_rate: 700,
    is_active: true,
    created_at: "2026-02-11T09:00:00Z",
    updated_at: "2026-03-24T09:00:00Z",
  },
];

export const labourAttendances = [
  {
    id: 701,
    muster_no: "MST-2401",
    project_id: 11,
    contractor_id: 41,
    attendance_date: "2026-03-27",
    status: "submitted",
    total_wage: 1450,
    remarks: "Submitted for site approval.",
    items: [
      {
        id: 7101,
        labour_id: 61,
        attendance_status: "present",
        present_days: 1,
        overtime_hours: 0,
        wage_rate: 750,
        remarks: null,
      },
      {
        id: 7102,
        labour_id: 62,
        attendance_status: "present",
        present_days: 1,
        overtime_hours: 0,
        wage_rate: 700,
        remarks: null,
      },
    ],
    created_at: "2026-03-27T08:00:00Z",
    updated_at: "2026-03-27T16:00:00Z",
  },
  {
    id: 702,
    muster_no: "MST-2402",
    project_id: 11,
    contractor_id: 41,
    attendance_date: "2026-03-28",
    status: "approved",
    total_wage: 1450,
    remarks: "Approved for labour billing.",
    items: [
      {
        id: 7201,
        labour_id: 61,
        attendance_status: "present",
        present_days: 1,
        overtime_hours: 0,
        wage_rate: 750,
        remarks: null,
      },
      {
        id: 7202,
        labour_id: 62,
        attendance_status: "present",
        present_days: 1,
        overtime_hours: 0,
        wage_rate: 700,
        remarks: null,
      },
    ],
    created_at: "2026-03-28T08:00:00Z",
    updated_at: "2026-03-28T16:00:00Z",
  },
];

export const labourBills = [
  {
    id: 801,
    bill_no: "LB-2401",
    project_id: 11,
    contractor_id: 41,
    contract_id: 21,
    period_start: "2026-03-01",
    period_end: "2026-03-31",
    gross_amount: 1450,
    deductions: 50,
    net_payable: 1400,
    status: "submitted",
    remarks: "Awaiting contractor bill approval.",
    items: [
      {
        id: 8101,
        labour_bill_id: 801,
        attendance_id: 702,
        description: "Approved attendance cycle",
        amount: 1450,
      },
    ],
    created_at: "2026-03-28T18:00:00Z",
    updated_at: null,
  },
];

export const labourAdvances = [
  {
    id: 901,
    advance_no: "ADV-2401",
    project_id: 11,
    contractor_id: 41,
    advance_date: "2026-03-20",
    amount: 50000,
    recovered_amount: 12000,
    balance_amount: 38000,
    status: "active",
    remarks: "Site mobilization cash support.",
    recoveries: [
      {
        id: 9101,
        labour_advance_id: 901,
        labour_bill_id: 801,
        recovery_date: "2026-03-25",
        amount: 12000,
        remarks: "Recovered against labour bill cycle 1.",
      },
    ],
    created_at: "2026-03-20T12:00:00Z",
    updated_at: "2026-03-25T18:00:00Z",
  },
];

type OperationUser = typeof engineerUser;

export async function mockOperationsReadApis(
  page: Page,
  user: OperationUser,
  options: {
    materialsRows?: Array<Record<string, unknown>>;
    stockSummaryRows?: Array<Record<string, unknown>>;
    receiptRows?: Array<Record<string, unknown>>;
    labourRows?: Array<Record<string, unknown>>;
    contractorRows?: Array<Record<string, unknown>>;
    attendanceRows?: Array<Record<string, unknown>>;
    billRows?: Array<Record<string, unknown>>;
    advanceRows?: Array<Record<string, unknown>>;
  } = {},
) {
  const materialsRows = options.materialsRows ?? materials;
  const stockSummaryRows = options.stockSummaryRows ?? materialStockSummary;
  const receiptRows = options.receiptRows ?? materialReceipts;
  const labourRows = options.labourRows ?? labours;
  const contractorRows = options.contractorRows ?? labourContractors;
  const attendanceRows = options.attendanceRows ?? labourAttendances;
  const billRows = options.billRows ?? labourBills;
  const advanceRows = options.advanceRows ?? labourAdvances;

  await page.route(getApiBasePattern(), async (route) => {
    const path = getApiPath(route.request().url());
    const method = route.request().method();

    if (path === "/auth/me" && method === "GET") {
      await fulfillJson(route, user);
      return;
    }

    if (path === "/companies/" && method === "GET") {
      await fulfillJson(route, companies);
      return;
    }

    if (path === "/projects/" && method === "GET") {
      await fulfillJson(route, projects);
      return;
    }

    if (path === "/vendors/" && method === "GET") {
      await fulfillJson(route, vendors);
      return;
    }

    if (path === "/contracts/" && method === "GET") {
      await fulfillJson(route, contracts);
      return;
    }

    if (path === "/materials/" && method === "GET") {
      await fulfillJson(route, materialsRows);
      return;
    }

    if (path === "/materials/stock-summary" && method === "GET") {
      await fulfillJson(route, stockSummaryRows);
      return;
    }

    if (path === "/material-receipts/" && method === "GET") {
      await fulfillJson(route, receiptRows);
      return;
    }

    if (path === "/labours/" && method === "GET") {
      await fulfillJson(route, labourRows);
      return;
    }

    if (path === "/labour-contractors/" && method === "GET") {
      await fulfillJson(route, contractorRows);
      return;
    }

    if (path === "/labour-attendance/" && method === "GET") {
      await fulfillJson(route, attendanceRows);
      return;
    }

    if (path === "/labour-bills/" && method === "GET") {
      await fulfillJson(route, billRows);
      return;
    }

    if (path === "/labour-advances/" && method === "GET") {
      await fulfillJson(route, advanceRows);
      return;
    }

    await fulfillJson(
      route,
      { error: { message: `Unhandled route: ${method} ${path}` } },
      500,
    );
  });
}
