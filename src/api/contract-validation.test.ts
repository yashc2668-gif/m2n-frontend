import { describe, it, expect } from "vitest";
import { z } from "zod";

// Frontend type definitions (matching src/api/types.ts)
const MaterialSchema = z.object({
  id: z.number(),
  item_code: z.string(),
  item_name: z.string(),
  category: z.string().optional(),
  unit: z.string(),
  reorder_level: z.number(),
  default_rate: z.number(),
  current_stock: z.number(),
  is_active: z.boolean(),
  company_id: z.number().optional(),
  project_id: z.number().optional().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

const ProjectSchema = z.object({
  id: z.number(),
  company_id: z.number(),
  name: z.string(),
  code: z.string().optional(),
  description: z.string().optional(),
  client_name: z.string().optional(),
  location: z.string().optional(),
  original_value: z.number(),
  revised_value: z.number(),
  start_date: z.string().optional(),
  expected_end_date: z.string().optional(),
  actual_end_date: z.string().optional().nullable(),
  status: z.string().min(1), // Status is flexible string
  created_at: z.string(),
  updated_at: z.string(),
});

const PaymentSchema = z.object({
  id: z.number(),
  payment_code: z.string(),
  project_id: z.number(),
  payee_type: z.enum(["CONTRACTOR", "VENDOR", "LABOUR"]),
  payee_id: z.number(),
  amount: z.number(),
  approval_status: z.enum(["PENDING", "APPROVED", "REJECTED", "RELEASED"]),
  payment_date: z.string(),
  description: z.string().optional(),
  payment_mode: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string(),
  lock_version: z.number(),
});

const RABillSchema = z.object({
  id: z.number(),
  ra_bill_code: z.string(),
  project_id: z.number(),
  bill_number: z.number(),
  bill_date: z.string(),
  from_date: z.string(),
  to_date: z.string(),
  bill_amount: z.number(),
  status: z.enum(["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"]),
  approved_date: z.string().optional().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  lock_version: z.number(),
});

const LabourSchema = z.object({
  id: z.number(),
  labour_code: z.string(),
  name: z.string(),
  father_name: z.string().optional(),
  category: z.enum(["SKILLED", "SEMI_SKILLED", "UNSKILLED"]),
  wage_type: z.enum(["DAILY", "PIECE_RATE", "MONTHLY"]),
  daily_wage: z.number(),
  is_active: z.boolean(),
  phone: z.string().optional(),
  address: z.string().optional(),
  aadhaar_number: z.string().optional(),
  pan_number: z.string().optional(),
  bank_account: z.string().optional(),
  ifsc_code: z.string().optional(),
  company_id: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});

// API response schemas
const PageResponseSchema = <T extends z.ZodType>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    total: z.number(),
    page: z.number(),
    limit: z.number(),
    pages: z.number(),
  });

describe("API Contract Tests - Schema Validation", () => {
  describe("Material Schema", () => {
    it("should validate correct material response", () => {
      const validMaterial = {
        id: 1,
        item_code: "MAT001",
        item_name: "Cement",
        category: "Consumables",
        unit: "Bag",
        reorder_level: 100,
        default_rate: 350,
        current_stock: 500,
        is_active: true,
        company_id: 1,
        project_id: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      };

      expect(() => MaterialSchema.parse(validMaterial)).not.toThrow();
    });

    it("should reject material missing required fields", () => {
      const invalidMaterial = {
        id: 1,
        item_name: "Cement",
        // missing: item_code, unit, etc.
      };

      expect(() => MaterialSchema.parse(invalidMaterial)).toThrow();
    });

    it("should validate material page response", () => {
      const pageResponse = {
        items: [
          {
            id: 1,
            item_code: "MAT001",
            item_name: "Cement",
            unit: "Bag",
            reorder_level: 100,
            default_rate: 350,
            current_stock: 500,
            is_active: true,
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
        ],
        total: 1,
        page: 1,
        limit: 25,
        pages: 1,
      };

      const schema = PageResponseSchema(MaterialSchema);
      expect(() => schema.parse(pageResponse)).not.toThrow();
    });
  });

  describe("Project Schema", () => {
    it("should validate correct project response", () => {
      const validProject = {
        id: 1,
        company_id: 1,
        name: "Central Plaza",
        code: "PRJ001",
        original_value: 50000000,
        revised_value: 52000000,
        status: "ACTIVE",
        start_date: "2025-06-15",
        expected_end_date: "2026-12-31",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      };

      expect(() => ProjectSchema.parse(validProject)).not.toThrow();
    });

    it("should reject project with invalid status", () => {
      const invalidProject = {
        id: 1,
        company_id: 1,
        name: "Project",
        original_value: 50000000,
        revised_value: 52000000,
        status: "INVALID_STATUS",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      };

      expect(() => ProjectSchema.parse(invalidProject)).toThrow();
    });
  });

  describe("Payment Schema", () => {
    it("should validate correct payment response", () => {
      const validPayment = {
        id: 1,
        payment_code: "PAY001",
        project_id: 1,
        payee_type: "CONTRACTOR",
        payee_id: 1,
        amount: 500000,
        approval_status: "APPROVED",
        payment_date: "2026-03-15",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        lock_version: 1,
      };

      expect(() => PaymentSchema.parse(validPayment)).not.toThrow();
    });

    it("should reject payment with invalid payee type", () => {
      const invalidPayment = {
        id: 1,
        payment_code: "PAY001",
        project_id: 1,
        payee_type: "CUSTOMER",
        payee_id: 1,
        amount: 500000,
        approval_status: "APPROVED",
        payment_date: "2026-03-15",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        lock_version: 1,
      };

      expect(() => PaymentSchema.parse(invalidPayment)).toThrow();
    });

    it("should reject payment with invalid approval status", () => {
      const invalidPayment = {
        id: 1,
        payment_code: "PAY001",
        project_id: 1,
        payee_type: "VENDOR",
        payee_id: 1,
        amount: 500000,
        approval_status: "IN_PROGRESS",
        payment_date: "2026-03-15",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        lock_version: 1,
      };

      expect(() => PaymentSchema.parse(invalidPayment)).toThrow();
    });
  });

  describe("RA Bill Schema", () => {
    it("should validate correct RA Bill response", () => {
      const validRABill = {
        id: 1,
        ra_bill_code: "RA001",
        project_id: 1,
        bill_number: 1,
        bill_date: "2026-03-15",
        from_date: "2026-02-15",
        to_date: "2026-03-15",
        bill_amount: 5000000,
        status: "DRAFT",
        approved_date: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        lock_version: 1,
      };

      expect(() => RABillSchema.parse(validRABill)).not.toThrow();
    });
  });

  describe("Labour Schema", () => {
    it("should validate correct labour response", () => {
      const validLabour = {
        id: 1,
        labour_code: "LAB001",
        name: "Rajesh Singh",
        category: "SKILLED",
        wage_type: "DAILY",
        daily_wage: 500,
        is_active: true,
        company_id: 1,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      };

      expect(() => LabourSchema.parse(validLabour)).not.toThrow();
    });

    it("should reject labour with invalid category", () => {
      const invalidLabour = {
        id: 1,
        labour_code: "LAB001",
        name: "Rajesh Singh",
        category: "EXPERT",
        wage_type: "DAILY",
        daily_wage: 500,
        is_active: true,
        company_id: 1,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      };

      expect(() => LabourSchema.parse(invalidLabour)).toThrow();
    });
  });
});
