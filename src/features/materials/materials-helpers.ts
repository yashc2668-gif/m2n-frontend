import type { Material, MaterialRequisition } from "@/api/types";

export type MaterialAttentionTone = "critical" | "watch" | "healthy" | "inactive";

export function getMaterialAttention(material: Material): MaterialAttentionTone {
  if (!material.is_active) {
    return "inactive";
  }
  if (material.current_stock <= 0) {
    return "critical";
  }
  if (material.reorder_level > 0 && material.current_stock <= material.reorder_level) {
    return "watch";
  }
  return "healthy";
}

export function buildMaterialFormDefaults() {
  return {
    item_code: "",
    item_name: "",
    category: "",
    unit: "Nos",
    reorder_level: 0,
    default_rate: 0,
    current_stock: 0,
    is_active: true,
    company_id: "",
    project_id: "",
  };
}

export function buildRequisitionNumber(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const stamp =
    String(date.getUTCHours()).padStart(2, "0") +
    String(date.getUTCMinutes()).padStart(2, "0");
  return `MR-${year}${month}${day}-${stamp}`;
}

export function buildRequisitionDefaults(date = new Date()) {
  return {
    requisition_no: buildRequisitionNumber(date),
    project_id: "",
    remarks: "",
    items: [{ material_id: "", requested_qty: 1 }],
  };
}

export function getRequisitionCounts(requisitions: MaterialRequisition[]) {
  return requisitions.reduce(
    (accumulator, requisition) => {
      accumulator.total += 1;
      accumulator[requisition.status] = (accumulator[requisition.status] ?? 0) + 1;
      return accumulator;
    },
    { total: 0 } as Record<string, number>,
  );
}

export function canSubmitRequisition(requisition: MaterialRequisition) {
  return requisition.status === "draft" || requisition.status === "rejected";
}

export function canApproveRequisition(requisition: MaterialRequisition) {
  return requisition.status === "submitted";
}
