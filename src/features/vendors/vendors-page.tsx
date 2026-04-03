import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Building2,
  FileText,
  PencilLine,
  Search,
  Truck,
  UserRound,
  WalletCards,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useAuth } from "@/app/providers/auth-provider";
import { getApiErrorMessage } from "@/api/client";
import { fetchContracts } from "@/api/contracts";
import { createVendor, fetchVendors, updateVendor } from "@/api/vendors";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { PageSkeleton } from "@/components/feedback/skeleton";
import { PermissionGate } from "@/components/shell/permission-gate";
import { Badge } from "@/components/ui/badge";
import { buttonVariants, Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import {
  buildVendorDefaults,
  filterVendors,
  getVendorAttention,
  getVendorMetrics,
} from "@/features/masters/masters-helpers";
import { stageQuotationContext } from "@/features/quotations/quotation-intake";
import { formatCompactNumber, titleCase } from "@/lib/format";
import { hasPermissions } from "@/lib/permissions";
import { useKeyboardShortcuts } from "@/lib/use-keyboard-shortcuts";

const inputClassName =
  "w-full rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-amber-100";
const labelClassName = "text-sm font-semibold text-[var(--surface-ink)]";
const EMPTY_LIST: never[] = [];
const attentionToneMap: Record<string, "danger" | "warning" | "success"> = {
  danger: "danger",
  warning: "warning",
  success: "success",
};

const vendorFormSchema = z.object({
  name: z.string().min(2, "Vendor name is required."),
  code: z.string().optional(),
  vendor_type: z.string().min(1, "Select a vendor type."),
  contact_person: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  gst_number: z.string().optional(),
  pan_number: z.string().optional(),
  address: z.string().optional(),
});

type VendorFormValues = z.infer<typeof vendorFormSchema>;

export default function VendorsPage() {
  const navigate = useNavigate();
  const { accessToken, user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [vendorTypeFilter, setVendorTypeFilter] = useState("all");
  const [linkageFilter, setLinkageFilter] = useState("all");
  const [editingVendorId, setEditingVendorId] = useState<number | null>(null);
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const vendorsQuery = useQuery({
    queryKey: ["vendors", "masters"],
    queryFn: () => fetchVendors(accessToken ?? "", { vendorType: null }),
    enabled: Boolean(accessToken),
  });
  const contractsQuery = useQuery({
    queryKey: ["contracts"],
    queryFn: () => fetchContracts(accessToken ?? ""),
    enabled: Boolean(accessToken),
  });

  const vendors = Array.isArray(vendorsQuery.data) ? vendorsQuery.data : EMPTY_LIST;
  const contracts = Array.isArray(contractsQuery.data) ? contractsQuery.data : EMPTY_LIST;

  const contractCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const contract of contracts) {
      counts.set(contract.vendor_id, (counts.get(contract.vendor_id) ?? 0) + 1);
    }
    return counts;
  }, [contracts]);
  const selectedVendor = useMemo(
    () => vendors.find((vendor) => vendor.id === editingVendorId) ?? null,
    [editingVendorId, vendors],
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<VendorFormValues>({
    resolver: zodResolver(vendorFormSchema),
    defaultValues: buildVendorDefaults(),
  });

  useEffect(() => {
    if (!selectedVendor) {
      reset(buildVendorDefaults());
      return;
    }

    reset({
      name: selectedVendor.name,
      code: selectedVendor.code ?? "",
      vendor_type: selectedVendor.vendor_type,
      contact_person: selectedVendor.contact_person ?? "",
      phone: selectedVendor.phone ?? "",
      email: selectedVendor.email ?? "",
      gst_number: selectedVendor.gst_number ?? "",
      pan_number: selectedVendor.pan_number ?? "",
      address: selectedVendor.address ?? "",
    });
  }, [reset, selectedVendor]);

  const filteredVendors = useMemo(
    () =>
      filterVendors(vendors, {
        search,
        vendorType: vendorTypeFilter,
        linkage: linkageFilter,
        contractCounts,
      }),
    [contractCounts, linkageFilter, search, vendorTypeFilter, vendors],
  );

  const metrics = getVendorMetrics(filteredVendors, contracts);
  const spotlightVendors = useMemo(
    () =>
      filteredVendors
        .map((vendor) => ({
          vendor,
          contractCount: contractCounts.get(vendor.id) ?? 0,
          attention: getVendorAttention(
            vendor,
            contractCounts.get(vendor.id) ?? 0,
          ),
        }))
        .filter((entry) => entry.attention !== "success")
        .slice(0, 5),
    [contractCounts, filteredVendors],
  );

  const canCreate = hasPermissions(user?.role ?? "viewer", ["vendors:create"]);
  const canUpdate = hasPermissions(user?.role ?? "viewer", ["vendors:update"]);
  const canCreateDocuments = hasPermissions(user?.role ?? "viewer", ["documents:create"]);

  const openQuotationFlow = (vendorId: number, openComposer = true) => {
    stageQuotationContext({
      entityType: "vendor",
      entityId: vendorId,
      openComposer,
    });
    void navigate({ to: "/quotations" });
  };

  useKeyboardShortcuts({
    'ctrl+n': () => {
      if (!canCreate) return;
      setEditingVendorId(null);
      setServerMessage(null);
      reset(buildVendorDefaults());
    },
    'escape': () => setEditingVendorId(null),
    '/': () => searchRef.current?.focus(),
  });

  const vendorTypes = useMemo(
    () =>
      Array.from(new Set(vendors.map((vendor) => vendor.vendor_type))).sort(),
    [vendors],
  );

  const vendorMutation = useMutation({
    mutationFn: async (values: VendorFormValues) => {
      const payload = {
        name: values.name.trim(),
        code: values.code?.trim() || null,
        vendor_type: values.vendor_type,
        contact_person: values.contact_person?.trim() || null,
        phone: values.phone?.trim() || null,
        email: values.email?.trim() || null,
        gst_number: values.gst_number?.trim() || null,
        pan_number: values.pan_number?.trim() || null,
        address: values.address?.trim() || null,
      };

      if (selectedVendor) {
        return updateVendor(accessToken ?? "", selectedVendor.id, {
          ...payload,
          lock_version: selectedVendor.lock_version,
        });
      }

      return createVendor(accessToken ?? "", payload);
    },
    onSuccess: (vendor) => {
      void queryClient.invalidateQueries({ queryKey: ["vendors", "masters"] });
      setServerMessage(
        selectedVendor ? `${vendor.name} updated.` : `${vendor.name} created.`,
      );
      setEditingVendorId(null);
      reset(buildVendorDefaults());
    },
  });

  if (vendorsQuery.isLoading || contractsQuery.isLoading) {
    return (
      <PageSkeleton statCount={4} tableRows={8} tableColumns={6} />
    );
  }

  if (vendorsQuery.error || contractsQuery.error) {
    return (
      <ErrorState
        description={getApiErrorMessage(
          vendorsQuery.error ?? contractsQuery.error,
        )}
        onRetry={() => {
          void vendorsQuery.refetch();
          void contractsQuery.refetch();
        }}
      />
    );
  }

  return (
    <PermissionGate permissions={["vendors:read"]}>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Vendor masters"
          title="Keep supplier and contractor partners polished, contactable, and commercially linked."
          description="Vendors do more than sit in a master table. This page shows who is ready for contract linkage, who needs cleanup, and which partners are carrying the most workload."
          actions={
            <>
              <Link
                className={buttonVariants({ variant: "secondary" })}
                to="/contracts"
              >
                <FileText className="size-4" />
                Open contracts
              </Link>
              <Link
                className={buttonVariants({ variant: "secondary" })}
                to="/materials/receipts"
              >
                <Truck className="size-4" />
                Open receipts
              </Link>
              <Link
                className={buttonVariants({ variant: "secondary" })}
                to="/quotations"
              >
                <FileText className="size-4" />
                Quotation register
              </Link>
              <Button
                disabled={!canCreate}
                onClick={() => {
                  setEditingVendorId(null);
                  setServerMessage(null);
                  reset(buildVendorDefaults());
                }}
              >
                New vendor
              </Button>
            </>
          }
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Vendors"
            value={formatCompactNumber(metrics.total)}
            caption="Visible partner masters in this view"
            icon={Building2}
            tone="info"
          />
          <StatCard
            label="Suppliers"
            value={formatCompactNumber(metrics.suppliers)}
            caption="Material and procurement-facing partners"
            icon={Truck}
            tone="accent"
          />
          <StatCard
            label="Contractors"
            value={formatCompactNumber(metrics.contractors)}
            caption="Execution and subcontract partners"
            icon={UserRound}
            tone="success"
          />
          <StatCard
            label="Linked"
            value={formatCompactNumber(metrics.linked)}
            caption="Vendors already attached to contracts"
            icon={WalletCards}
            tone="accent"
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">
            <Card className="p-5">
              <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr_1fr]">
                <label className="space-y-2">
                  <span className={labelClassName}>Search vendor</span>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[var(--surface-faint)]" />
                    <input
                      ref={searchRef}
                      className={`${inputClassName} pl-11`}
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search by name, code, contact, or email"
                    />
                  </div>
                </label>
                <label className="space-y-2">
                  <span className={labelClassName}>Vendor type</span>
                  <select
                    className={inputClassName}
                    value={vendorTypeFilter}
                    onChange={(event) =>
                      setVendorTypeFilter(event.target.value)
                    }
                  >
                    <option value="all">All types</option>
                    {vendorTypes.map((type) => (
                      <option key={type} value={type}>
                        {titleCase(type)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2">
                  <span className={labelClassName}>Linkage</span>
                  <select
                    className={inputClassName}
                    value={linkageFilter}
                    onChange={(event) => setLinkageFilter(event.target.value)}
                  >
                    <option value="all">All vendors</option>
                    <option value="linked">Contract linked</option>
                    <option value="unlinked">No contract yet</option>
                  </select>
                </label>
              </div>
            </Card>

            <div className="grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
              <Card className="p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl text-[var(--surface-ink)]">
                      Partner watchlist
                    </h3>
                    <p className="mt-1 text-sm text-[var(--surface-muted)]">
                      Vendors missing contact readiness or still waiting for
                      commercial linkage.
                    </p>
                  </div>
                  <Badge tone="warning">Top 5</Badge>
                </div>
                <div className="space-y-3">
                  {spotlightVendors.length === 0 ? (
                    <EmptyState
                      title="Vendor posture looks clean"
                      description="Visible partners already have enough linkage and contact detail."
                    />
                  ) : (
                    spotlightVendors.map(
                      ({ vendor, contractCount, attention }) => (
                        <div
                          key={vendor.id}
                          className="rounded-[var(--radius)] border border-[color:var(--line)] bg-white/75 p-4"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="font-semibold text-[var(--surface-ink)]">
                                {vendor.name}
                              </p>
                              <p className="text-xs uppercase tracking-[0.15em] text-[var(--surface-faint)]">
                                {vendor.code || "No vendor code"}
                              </p>
                            </div>
                            <Badge tone={attentionToneMap[attention]}>
                              {titleCase(attention)}
                            </Badge>
                          </div>
                          <div className="mt-3 grid gap-2 text-sm text-[var(--surface-muted)]">
                            <p>
                              Type:{" "}
                              <span className="font-semibold text-[var(--surface-ink)]">
                                {titleCase(vendor.vendor_type)}
                              </span>
                            </p>
                            <p>
                              Contracts linked:{" "}
                              <span className="font-semibold text-[var(--surface-ink)]">
                                {contractCount}
                              </span>
                            </p>
                          </div>
                        </div>
                      ),
                    )
                  )}
                </div>
              </Card>

              <div className="grid gap-4 md:grid-cols-2">
                {filteredVendors.slice(0, 4).map((vendor) => (
                  <div
                    key={vendor.id}
                    className="rounded-[var(--radius)] border border-[color:var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-lg)]"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--surface-faint)]">
                          Partner pulse
                        </p>
                        <h3 className="mt-2 text-2xl text-[var(--surface-ink)]">
                          {vendor.name}
                        </h3>
                      </div>
                      <Badge
                        tone={
                          attentionToneMap[
                            getVendorAttention(
                              vendor,
                              contractCounts.get(vendor.id) ?? 0,
                            )
                          ]
                        }
                      >
                        {titleCase(vendor.vendor_type)}
                      </Badge>
                    </div>
                    <p className="mt-4 text-sm leading-6 text-[var(--surface-muted)]">
                      Contact {vendor.contact_person || "Not captured"}
                    </p>
                    <p className="mt-3 text-sm text-[var(--surface-muted)]">
                      Linked contracts:{" "}
                      <span className="font-semibold text-[var(--surface-ink)]">
                        {contractCounts.get(vendor.id) ?? 0}
                      </span>
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <DataTable
              columns={[
                {
                  id: "Vendor",
                  header: "Vendor",
                  cell: (row) => (
                    <div className="space-y-1">
                      <p className="font-semibold text-[var(--surface-ink)]">
                        {row.name}
                      </p>
                      <p className="text-xs uppercase tracking-[0.15em] text-[var(--surface-faint)]">
                        {row.code || "No code"}
                      </p>
                    </div>
                  ),
                  sortValue: (row) => row.name,
                  exportValue: (row) => row.name,
                },
                {
                  id: "Type",
                  header: "Type",
                  cell: (row) => (
                    <Badge
                      tone={
                        attentionToneMap[
                          getVendorAttention(
                            row,
                            contractCounts.get(row.id) ?? 0,
                          )
                        ]
                      }
                    >
                      {titleCase(row.vendor_type)}
                    </Badge>
                  ),
                  sortValue: (row) => row.vendor_type,
                  exportValue: (row) => titleCase(row.vendor_type),
                },
                {
                  id: "Contact",
                  header: "Contact",
                  cell: (row) => (
                    <div className="space-y-1 text-sm">
                      <p>{row.contact_person || "Contact not captured"}</p>
                      <p className="text-[var(--surface-faint)]">
                        {row.phone || row.email || "No phone or email"}
                      </p>
                    </div>
                  ),
                  sortValue: (row) => row.contact_person ?? "",
                  exportValue: (row) => row.contact_person ?? "",
                },
                {
                  id: "Tax",
                  header: "Tax",
                  cell: (row) => (
                    <div className="space-y-1 text-sm">
                      <p>GST {row.gst_number || "-"}</p>
                      <p className="text-[var(--surface-faint)]">
                        PAN {row.pan_number || "-"}
                      </p>
                    </div>
                  ),
                  exportValue: (row) => `GST: ${row.gst_number || "-"} / PAN: ${row.pan_number || "-"}`,
                },
                {
                  id: "Contracts",
                  header: "Contracts",
                  cell: (row) => contractCounts.get(row.id) ?? 0,
                  sortValue: (row) => contractCounts.get(row.id) ?? 0,
                  exportValue: (row) => String(contractCounts.get(row.id) ?? 0),
                },
                {
                  header: "Action",
                  cell: (row) => (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={!canUpdate}
                        onClick={() => {
                          setEditingVendorId(row.id);
                          setServerMessage(null);
                        }}
                      >
                        <PencilLine className="size-4" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        type="button"
                        variant="secondary"
                        disabled={!canCreateDocuments}
                        onClick={() => openQuotationFlow(row.id)}
                      >
                        <FileText className="size-4" />
                        Upload quote
                      </Button>
                    </div>
                  ),
                },
              ]}
              rows={filteredVendors}
              rowKey={(row) => row.id}
              exportFileName="m2n-vendors"
              stickyHeader
              defaultSortId="Vendor"
              defaultSortDir="asc"
              emptyState={
                <EmptyState
                  title="No vendors match these filters"
                  description="Try widening vendor type, linkage, or search controls."
                />
              }
            />
          </div>

          <Card className="h-fit p-6 xl:sticky xl:top-28">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--surface-faint)]">
                  {selectedVendor ? "Edit vendor" : "Create vendor"}
                </p>
                <h3 className="mt-2 text-2xl text-[var(--surface-ink)]">
                  {selectedVendor
                    ? selectedVendor.name
                    : "Add a new partner master"}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[var(--surface-muted)]">
                  Use this form to keep supplier and contractor details clean
                  before they flow into contracts, receipts, and payments.
                </p>
              </div>
              {selectedVendor ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditingVendorId(null);
                    setServerMessage(null);
                    reset(buildVendorDefaults());
                  }}
                >
                  New instead
                </Button>
              ) : null}
            </div>

            <form
              className="space-y-4"
              onSubmit={handleSubmit(async (values) => {
                setServerMessage(null);
                await vendorMutation.mutateAsync(values);
              })}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className={labelClassName}>Vendor name</span>
                  <input
                    className={inputClassName}
                    {...register("name")}
                    placeholder="Alpha Infra Supplies"
                  />
                  {errors.name ? (
                    <p className="text-sm text-[var(--danger)]">
                      {errors.name.message}
                    </p>
                  ) : null}
                </label>
                <label className="space-y-2">
                  <span className={labelClassName}>Vendor code</span>
                  <input
                    className={inputClassName}
                    {...register("code")}
                    placeholder="VEN-001"
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className={labelClassName}>Vendor type</span>
                  <select
                    className={inputClassName}
                    {...register("vendor_type")}
                  >
                    <option value="supplier">Supplier</option>
                    <option value="contractor">Contractor</option>
                    <option value="service_provider">Service provider</option>
                    <option value="subcontractor">Subcontractor</option>
                  </select>
                </label>
                <label className="space-y-2">
                  <span className={labelClassName}>Contact person</span>
                  <input
                    className={inputClassName}
                    {...register("contact_person")}
                    placeholder="Rahul Sharma"
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className={labelClassName}>Phone</span>
                  <input
                    className={inputClassName}
                    {...register("phone")}
                    placeholder="+91 98XXXXXX"
                  />
                </label>
                <label className="space-y-2">
                  <span className={labelClassName}>Email</span>
                  <input
                    className={inputClassName}
                    {...register("email")}
                    placeholder="ops@vendor.com"
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className={labelClassName}>GST number</span>
                  <input
                    className={inputClassName}
                    {...register("gst_number")}
                    placeholder="27ABCDE1234F1Z5"
                  />
                </label>
                <label className="space-y-2">
                  <span className={labelClassName}>PAN number</span>
                  <input
                    className={inputClassName}
                    {...register("pan_number")}
                    placeholder="ABCDE1234F"
                  />
                </label>
              </div>

              <label className="space-y-2">
                <span className={labelClassName}>Address</span>
                <textarea
                  className={`${inputClassName} min-h-24 resize-none`}
                  {...register("address")}
                  placeholder="Registered office or dispatch address"
                />
              </label>

              {serverMessage ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  {serverMessage}
                </div>
              ) : null}
              {vendorMutation.error ? (
                <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
                  {getApiErrorMessage(vendorMutation.error)}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <Button
                  disabled={
                    isSubmitting ||
                    vendorMutation.isPending ||
                    (!canCreate && !selectedVendor) ||
                    (!canUpdate && Boolean(selectedVendor))
                  }
                  type="submit"
                >
                  {vendorMutation.isPending
                    ? "Saving..."
                    : selectedVendor
                      ? "Update vendor"
                      : "Create vendor"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setEditingVendorId(null);
                    setServerMessage(null);
                    reset(buildVendorDefaults());
                  }}
                >
                  Reset form
                </Button>
                {selectedVendor ? (
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={!canCreateDocuments}
                    onClick={() => openQuotationFlow(selectedVendor.id)}
                  >
                    <FileText className="size-4" />
                    Upload quotation
                  </Button>
                ) : null}
              </div>
            </form>
          </Card>
        </div>
      </div>
    </PermissionGate>
  );
}
