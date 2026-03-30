import { describe, expect, it } from "vitest";

import { getRoleLabel, hasPermissions, normalizeRole } from "@/lib/permissions";

describe("permissions helpers", () => {
  it("normalizes backend role aliases", () => {
    expect(normalizeRole("Project Manager")).toBe("project_manager");
    expect(normalizeRole("ENGINEER")).toBe("engineer");
  });

  it("grants admin full access", () => {
    expect(hasPermissions("admin", ["materials:create", "payments:approve"])).toBe(true);
  });

  it("keeps viewer read only", () => {
    expect(hasPermissions("viewer", ["materials:read"])).toBe(true);
    expect(hasPermissions("viewer", ["material_receipts:read", "material_issues:read"])).toBe(true);
    expect(hasPermissions("viewer", ["materials:create"])).toBe(false);
  });

  it("keeps frontend permission aliases aligned with backend RBAC", () => {
    expect(hasPermissions("engineer", ["receipts:create"])).toBe(true);
    expect(hasPermissions("engineer", ["stock:issue", "stock:adjust"])).toBe(true);
    expect(hasPermissions("project_manager", ["requisitions:create", "requisitions:approve"])).toBe(true);
    expect(hasPermissions("engineer", ["attendance:create", "attendance:approve"])).toBe(true);
    expect(hasPermissions("accountant", ["labour_bills:create", "labour_bills:approve", "labour_advances:create"])).toBe(true);
    expect(hasPermissions("contractor", ["stock:issue"])).toBe(false);
  });

  it("keeps project manager in RA bill review but out of settlement controls", () => {
    expect(hasPermissions("project_manager", ["ra_bills:create", "ra_bills:verify", "ra_bills:approve"])).toBe(true);
    expect(hasPermissions("project_manager", ["payments:create"])).toBe(false);
    expect(hasPermissions("project_manager", ["payments:approve", "payments:release", "payments:allocate"])).toBe(false);
    expect(hasPermissions("project_manager", ["ra_bills:partially_paid", "ra_bills:paid"])).toBe(false);
    expect(hasPermissions("project_manager", ["secured_advances:create", "secured_advances:update"])).toBe(false);
    expect(hasPermissions("accountant", ["payments:create", "payments:allocate", "ra_bills:paid", "secured_advances:create"])).toBe(true);
  });

  it("removes hidden master-admin powers from project manager", () => {
    expect(hasPermissions("project_manager", ["companies:read"])).toBe(true);
    expect(hasPermissions("project_manager", ["vendors:read", "vendors:update"])).toBe(true);
    expect(hasPermissions("project_manager", ["companies:create"])).toBe(false);
    expect(hasPermissions("project_manager", ["companies:update"])).toBe(false);
    expect(hasPermissions("project_manager", ["vendors:delete"])).toBe(false);
    expect(hasPermissions("project_manager", ["users:read"])).toBe(false);
  });

  it("returns friendly role labels", () => {
    expect(getRoleLabel("accountant")).toBe("Accountant");
  });
});
