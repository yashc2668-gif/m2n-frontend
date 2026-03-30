import type { Contract, Project, Vendor } from "@/api/types";

function normalizeSearch(value: string) {
  return value.trim().toLowerCase();
}

export function buildProjectDefaults() {
  return {
    company_id: "",
    name: "",
    code: "",
    description: "",
    client_name: "",
    location: "",
    original_value: 0,
    revised_value: 0,
    start_date: "",
    expected_end_date: "",
    actual_end_date: "",
    status: "active",
  };
}

export function buildContractDefaults() {
  return {
    project_id: "",
    vendor_id: "",
    contract_no: "",
    title: "",
    scope_of_work: "",
    start_date: "",
    end_date: "",
    original_value: 0,
    revised_value: 0,
    retention_percentage: 0,
    status: "active",
  };
}

export function buildVendorDefaults() {
  return {
    name: "",
    code: "",
    vendor_type: "supplier",
    contact_person: "",
    phone: "",
    email: "",
    gst_number: "",
    pan_number: "",
    address: "",
  };
}

export function filterProjects(
  projects: Project[],
  filters: {
    search?: string;
    status?: string;
    companyId?: string;
  },
) {
  const search = normalizeSearch(filters.search ?? "");

  return projects.filter((project) => {
    if (
      filters.status &&
      filters.status !== "all" &&
      project.status !== filters.status
    ) {
      return false;
    }
    if (
      filters.companyId &&
      filters.companyId !== "all" &&
      project.company_id !== Number(filters.companyId)
    ) {
      return false;
    }
    if (!search) {
      return true;
    }

    return [
      project.name,
      project.code ?? "",
      project.client_name ?? "",
      project.location ?? "",
      project.status,
    ]
      .join(" ")
      .toLowerCase()
      .includes(search);
  });
}

export function filterContracts(
  contracts: Contract[],
  filters: {
    search?: string;
    status?: string;
    projectId?: string;
    vendorId?: string;
  },
) {
  const search = normalizeSearch(filters.search ?? "");

  return contracts.filter((contract) => {
    if (
      filters.status &&
      filters.status !== "all" &&
      contract.status !== filters.status
    ) {
      return false;
    }
    if (
      filters.projectId &&
      filters.projectId !== "all" &&
      contract.project_id !== Number(filters.projectId)
    ) {
      return false;
    }
    if (
      filters.vendorId &&
      filters.vendorId !== "all" &&
      contract.vendor_id !== Number(filters.vendorId)
    ) {
      return false;
    }
    if (!search) {
      return true;
    }

    return [
      contract.contract_no,
      contract.title,
      contract.scope_of_work ?? "",
      contract.status,
    ]
      .join(" ")
      .toLowerCase()
      .includes(search);
  });
}

export function filterVendors(
  vendors: Vendor[],
  filters: {
    search?: string;
    vendorType?: string;
    linkage?: string;
    contractCounts?: Map<number, number>;
  },
) {
  const search = normalizeSearch(filters.search ?? "");

  return vendors.filter((vendor) => {
    if (
      filters.vendorType &&
      filters.vendorType !== "all" &&
      vendor.vendor_type !== filters.vendorType
    ) {
      return false;
    }
    const linkedCount = filters.contractCounts?.get(vendor.id) ?? 0;
    if (filters.linkage === "linked" && linkedCount === 0) {
      return false;
    }
    if (filters.linkage === "unlinked" && linkedCount > 0) {
      return false;
    }
    if (!search) {
      return true;
    }

    return [
      vendor.name,
      vendor.code ?? "",
      vendor.vendor_type,
      vendor.contact_person ?? "",
      vendor.phone ?? "",
      vendor.email ?? "",
    ]
      .join(" ")
      .toLowerCase()
      .includes(search);
  });
}

export function getProjectMetrics(projects: Project[], contracts: Contract[]) {
  const linkedProjectIds = new Set(
    contracts.map((contract) => contract.project_id),
  );
  return {
    total: projects.length,
    active: projects.filter((project) => project.status === "active").length,
    completed: projects.filter((project) => project.status === "completed")
      .length,
    revisedValue: projects.reduce(
      (sum, project) => sum + project.revised_value,
      0,
    ),
    linked: projects.filter((project) => linkedProjectIds.has(project.id))
      .length,
  };
}

export function getContractMetrics(
  contracts: Contract[],
  referenceDate = new Date(),
) {
  const horizon = new Date(referenceDate);
  horizon.setDate(horizon.getDate() + 30);

  return {
    total: contracts.length,
    active: contracts.filter((contract) => contract.status === "active").length,
    value: contracts.reduce((sum, contract) => sum + contract.revised_value, 0),
    retentionPool: contracts.reduce(
      (sum, contract) =>
        sum + (contract.revised_value * contract.retention_percentage) / 100,
      0,
    ),
    expiringSoon: contracts.filter((contract) => {
      if (!contract.end_date || contract.status !== "active") {
        return false;
      }
      const endDate = new Date(contract.end_date);
      return endDate >= referenceDate && endDate <= horizon;
    }).length,
  };
}

export function getVendorMetrics(vendors: Vendor[], contracts: Contract[]) {
  const contractCounts = new Map<number, number>();
  for (const contract of contracts) {
    contractCounts.set(
      contract.vendor_id,
      (contractCounts.get(contract.vendor_id) ?? 0) + 1,
    );
  }

  return {
    total: vendors.length,
    suppliers: vendors.filter((vendor) => vendor.vendor_type === "supplier")
      .length,
    contractors: vendors.filter((vendor) => vendor.vendor_type === "contractor")
      .length,
    linked: Array.from(contractCounts.values()).filter((count) => count > 0)
      .length,
  };
}

export function getProjectAttention(project: Project, contractCount: number) {
  if (project.status === "completed") {
    return "success";
  }
  if (project.status === "active" && contractCount === 0) {
    return "danger";
  }
  if (project.revised_value > project.original_value) {
    return "warning";
  }
  return "info";
}

export function getContractAttention(
  contract: Contract,
  referenceDate = new Date(),
) {
  if (contract.status !== "active") {
    return "neutral";
  }
  if (contract.revised_value > contract.original_value) {
    return "warning";
  }
  if (contract.end_date) {
    const endDate = new Date(contract.end_date);
    const horizon = new Date(referenceDate);
    horizon.setDate(horizon.getDate() + 30);
    if (endDate >= referenceDate && endDate <= horizon) {
      return "danger";
    }
  }
  return "success";
}

export function getVendorAttention(
  vendor: Vendor,
  linkedContractCount: number,
) {
  if (linkedContractCount === 0) {
    return "warning";
  }
  if (!vendor.phone && !vendor.email) {
    return "danger";
  }
  return "success";
}
