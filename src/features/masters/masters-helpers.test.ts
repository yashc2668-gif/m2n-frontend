import { describe, expect, it } from "vitest";

import {
  buildContractDefaults,
  buildProjectDefaults,
  buildVendorDefaults,
  filterContracts,
  filterProjects,
  filterVendors,
  getContractAttention,
  getContractMetrics,
  getProjectAttention,
  getProjectMetrics,
  getVendorAttention,
  getVendorMetrics,
} from "@/features/masters/masters-helpers";

describe("masters helpers", () => {
  it("builds clean defaults for project, contract, and vendor forms", () => {
    expect(buildProjectDefaults()).toMatchObject({
      status: "active",
      company_id: "",
    });
    expect(buildContractDefaults()).toMatchObject({
      status: "active",
      project_id: "",
    });
    expect(buildVendorDefaults()).toMatchObject({
      vendor_type: "supplier",
      name: "",
    });
  });

  it("filters projects, contracts, and vendors using operational controls", () => {
    expect(
      filterProjects(
        [
          {
            id: 1,
            company_id: 4,
            name: "Metro Deck",
            code: "P-1",
            client_name: "Urban Corp",
            location: "Delhi",
            status: "active",
          },
          {
            id: 2,
            company_id: 9,
            name: "Bridge Rehab",
            code: "P-2",
            client_name: "State Roads",
            location: "Pune",
            status: "completed",
          },
        ] as never,
        { search: "metro", status: "active", companyId: "4" },
      ),
    ).toHaveLength(1);

    expect(
      filterContracts(
        [
          {
            contract_no: "C-001",
            title: "Structure package",
            scope_of_work: "RCC",
            status: "active",
            project_id: 1,
            vendor_id: 7,
          },
          {
            contract_no: "C-002",
            title: "Finishing package",
            scope_of_work: "Paint",
            status: "closed",
            project_id: 2,
            vendor_id: 8,
          },
        ] as never,
        { search: "rcc", status: "active", projectId: "1", vendorId: "7" },
      ),
    ).toHaveLength(1);

    expect(
      filterVendors(
        [
          {
            id: 7,
            name: "Alpha Supplies",
            code: "V-1",
            vendor_type: "supplier",
            contact_person: "Amit",
            phone: "1",
            email: null,
          },
          {
            id: 8,
            name: "Bravo Infra",
            code: "V-2",
            vendor_type: "contractor",
            contact_person: "Neeraj",
            phone: null,
            email: "n@example.com",
          },
        ] as never,
        {
          search: "alpha",
          vendorType: "supplier",
          linkage: "linked",
          contractCounts: new Map([[7, 2]]),
        },
      ),
    ).toHaveLength(1);
  });

  it("aggregates project, contract, and vendor metrics", () => {
    expect(
      getProjectMetrics(
        [
          { id: 1, status: "active", revised_value: 100 },
          { id: 2, status: "completed", revised_value: 200 },
        ] as never,
        [{ project_id: 1 }] as never,
      ),
    ).toMatchObject({
      total: 2,
      active: 1,
      completed: 1,
      revisedValue: 300,
      linked: 1,
    });

    expect(
      getContractMetrics(
        [
          {
            status: "active",
            revised_value: 1000,
            retention_percentage: 5,
            end_date: "2026-04-15",
            original_value: 900,
          },
          {
            status: "closed",
            revised_value: 500,
            retention_percentage: 2,
            end_date: "2026-07-01",
            original_value: 500,
          },
        ] as never,
        new Date("2026-03-28T00:00:00Z"),
      ),
    ).toMatchObject({
      total: 2,
      active: 1,
      value: 1500,
      retentionPool: 60,
      expiringSoon: 1,
    });

    expect(
      getVendorMetrics(
        [
          { id: 7, vendor_type: "supplier" },
          { id: 8, vendor_type: "contractor" },
          { id: 9, vendor_type: "supplier" },
        ] as never,
        [{ vendor_id: 7 }, { vendor_id: 7 }, { vendor_id: 8 }] as never,
      ),
    ).toMatchObject({ total: 3, suppliers: 2, contractors: 1, linked: 2 });
  });

  it("scores attention for projects, contracts, and vendors", () => {
    expect(
      getProjectAttention(
        { status: "active", revised_value: 100, original_value: 90 } as never,
        1,
      ),
    ).toBe("warning");
    expect(
      getProjectAttention(
        { status: "active", revised_value: 100, original_value: 100 } as never,
        0,
      ),
    ).toBe("danger");
    expect(
      getContractAttention(
        {
          status: "active",
          revised_value: 100,
          original_value: 100,
          end_date: "2026-04-05",
        } as never,
        new Date("2026-03-28T00:00:00Z"),
      ),
    ).toBe("danger");
    expect(getVendorAttention({ phone: null, email: null } as never, 2)).toBe(
      "danger",
    );
    expect(getVendorAttention({ phone: "1", email: null } as never, 0)).toBe(
      "warning",
    );
  });
});
