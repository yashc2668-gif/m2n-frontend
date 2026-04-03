import {
  BarChart3,
  Building2,
  Boxes,
  BrainCircuit,
  ClipboardCheck,
  ClipboardList,
  FileText,
  FolderOpen,
  HardHat,
  LayoutDashboard,
  ListChecks,
  PackagePlus,
  PackageMinus,
  ReceiptText,
  Ruler,
  ScanSearch,
  Shield,
  Sparkles,
  ScrollText,
  Truck,
  WalletCards,
  type LucideIcon,
} from "lucide-react";

import type { AppRole } from "@/lib/permissions";

export interface NavigationItem {
  to: string;
  label: string;
  description: string;
  icon: LucideIcon;
  permissions?: string[];
  roles?: AppRole[];
}

export interface NavigationSection {
  title: string;
  items: NavigationItem[];
}

export const navigationSections: NavigationSection[] = [
  {
    title: "Command",
    items: [
      {
        to: "/",
        label: "Dashboard",
        description: "Portfolio pulse and finance overview",
        icon: LayoutDashboard,
        permissions: ["dashboard:read"],
      },
      {
        to: "/reports",
        label: "Reports",
        description: "Cost variance, MIS, and management intelligence",
        icon: BarChart3,
        permissions: ["dashboard:read"],
      },
    ],
  },
  {
    title: "Masters",
    items: [
      {
        to: "/companies",
        label: "Companies",
        description: "Business identity master with GST, PAN, and contacts",
        icon: Building2,
        permissions: ["companies:read"],
      },
      {
        to: "/projects",
        label: "Projects",
        description: "Project anchor, value, and status control",
        icon: Building2,
        permissions: ["projects:read"],
      },
      {
        to: "/contracts",
        label: "Contracts",
        description: "Commercial linkage across projects and vendors",
        icon: FileText,
        permissions: ["contracts:read"],
      },
      {
        to: "/vendors",
        label: "Vendors",
        description: "Supplier and contractor partner master",
        icon: Truck,
        permissions: ["vendors:read"],
      },
      {
        to: "/quotations",
        label: "Quotations",
        description: "Vendor-first quotation register and PDF intake",
        icon: FileText,
        permissions: ["documents:read"],
      },
      {
        to: "/boq",
        label: "Bill of Quantities",
        description: "Contract BOQ items with qty, rate, and amount",
        icon: ListChecks,
        permissions: ["boq:read"],
      },
    ],
  },
  {
    title: "Execution",
    items: [
      {
        to: "/materials",
        label: "Materials",
        description: "Master stock and reorder control",
        icon: Boxes,
        permissions: ["materials:read"],
      },
      {
        to: "/materials/requisitions",
        label: "Requisitions",
        description: "Raise and move material demand through workflow",
        icon: ClipboardCheck,
        permissions: ["material_requisitions:read"],
      },
      {
        to: "/materials/receipts",
        label: "Receipts",
        description: "Capture vendor inward stock against projects",
        icon: PackagePlus,
        permissions: ["material_receipts:read"],
      },
      {
        to: "/materials/issues",
        label: "Issues",
        description: "Issue stock to site and activity consumption",
        icon: PackageMinus,
        permissions: ["material_issues:read"],
      },
      {
        to: "/materials/adjustments",
        label: "Adjustments",
        description: "Post damage, wastage, and correction entries",
        icon: ScanSearch,
        permissions: ["material_stock_adjustments:read"],
      },
      {
        to: "/stock-ledger",
        label: "Stock Ledger",
        description: "Movement trace for every issue and receipt",
        icon: ScrollText,
        permissions: ["stock_ledger:read"],
      },
      {
        to: "/labour",
        label: "Labour",
        description: "Crew strength, skills, and daily cost view",
        icon: ClipboardList,
        permissions: ["labour:read"],
      },
      {
        to: "/labour/contractors",
        label: "Labour Contractors",
        description: "Gang and labour-supplier master for departmental sheets",
        icon: HardHat,
        permissions: ["labour_contractors:read"],
      },
      {
        to: "/labour/attendance",
        label: "Attendance",
        description: "Mark muster, submit, and approve labour attendance",
        icon: ClipboardCheck,
        permissions: ["labour_attendance:read"],
      },
      {
        to: "/labour/bills",
        label: "Labour Bills",
        description: "Generate contractor bills from approved attendance",
        icon: ReceiptText,
        permissions: ["labour_bills:read"],
      },
      {
        to: "/labour/advances",
        label: "Advances",
        description: "Track advances, balances, and bill-linked recoveries",
        icon: Sparkles,
        permissions: ["labour_advances:read"],
      },
      {
        to: "/labour/productivity",
        label: "Productivity",
        description: "Daily output per trade and crew benchmarking",
        icon: HardHat,
        permissions: ["labour_productivity:read"],
      },
    ],
  },
  {
    title: "Assurance",
    items: [
      {
        to: "/ra-bills",
        label: "RA Bills",
        description: "Commercial billing workflow from draft to approval",
        icon: ReceiptText,
        permissions: ["ra_bills:read"],
      },
      {
        to: "/payments",
        label: "Payments",
        description: "Release posture and RA bill linkage",
        icon: ReceiptText,
        permissions: ["payments:read"],
      },
      {
        to: "/site-expenses",
        label: "Site Expenses",
        description: "Petty cash, reimbursement, and local site spend register",
        icon: WalletCards,
        permissions: ["site_expenses:read"],
      },
      {
        to: "/measurements",
        label: "Measurements",
        description: "Field measurement records, submit and approve",
        icon: Ruler,
        permissions: ["measurements:read"],
      },
      {
        to: "/work-done",
        label: "Work Done",
        description: "Cumulative quantities executed against BOQ",
        icon: ClipboardCheck,
        permissions: ["work_done:read"],
      },
      {
        to: "/secured-advances",
        label: "Secured Advances",
        description: "Material on site advances and recoveries",
        icon: Shield,
        permissions: ["secured_advances:read"],
      },
      {
        to: "/documents",
        label: "Documents",
        description: "Centralised document archive with versioning",
        icon: FolderOpen,
        permissions: ["documents:read"],
      },
      {
        to: "/audit-logs",
        label: "Audit Logs",
        description: "Critical actions and trace visibility",
        icon: ScrollText,
        permissions: ["audit_logs:read"],
      },
      {
        to: "/ai-boundary",
        label: "AI Boundary",
        description: "Policy guardrails and evaluation sandbox",
        icon: BrainCircuit,
        roles: ["admin"],
      },
    ],
  },
  {
    title: "Administration",
    items: [
      {
        to: "/admin/users",
        label: "Users",
        description: "Team accounts, roles, and access control",
        icon: Shield,
        roles: ["admin"],
      },
    ],
  },
];

export function findNavigationItem(pathname: string) {
  const allItems = navigationSections.flatMap((section) => section.items);
  return (
    allItems.find((item) => item.to === pathname) ??
    allItems.find((item) => item.to !== "/" && pathname.startsWith(item.to)) ??
    allItems[0]
  );
}
