import { apiFetch, apiFetchList } from "@/api/client";
import type { Vendor, VendorCreateInput, VendorUpdateInput } from "@/api/types";

interface VendorQueryOptions {
  search?: string;
  vendorType?: string | null;
  limit?: number;
}

export function fetchVendors(token: string, options?: VendorQueryOptions) {
  return apiFetchList<Vendor>("/vendors/", {
    token,
    query: {
      limit: options?.limit ?? 100,
      search: options?.search,
      vendor_type:
        options?.vendorType === undefined
          ? "supplier"
          : (options.vendorType ?? undefined),
    },
  });
}

export function createVendor(token: string, payload: VendorCreateInput) {
  return apiFetch<Vendor>("/vendors/", {
    method: "POST",
    token,
    body: payload,
  });
}

export function updateVendor(
  token: string,
  vendorId: number,
  payload: VendorUpdateInput,
) {
  return apiFetch<Vendor>(`/vendors/${vendorId}`, {
    method: "PUT",
    token,
    body: payload,
  });
}
