import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  HardHat,
  PencilLine,
  Phone,
  Search,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useAuth } from "@/app/providers/auth-provider";
import { fetchCompanies } from "@/api/companies";
import { getApiErrorMessage } from "@/api/client";
import {
  createLabourContractor,
  fetchLabourContractors,
  updateLabourContractor,
} from "@/api/labour-contractors";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { PageSkeleton } from "@/components/feedback/skeleton";
import { PermissionGate } from "@/components/shell/permission-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { formatCompactNumber } from "@/lib/format";
import { hasPermissions } from "@/lib/permissions";
import { useKeyboardShortcuts } from "@/lib/use-keyboard-shortcuts";

const inputClassName =
  "w-full rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-amber-100";
const labelClassName = "text-sm font-semibold text-[var(--surface-ink)]";
const EMPTY_LIST: never[] = [];

const contractorFormSchema = z.object({
  company_id: z.string().min(1, "Select a company."),
  contractor_code: z.string().optional(),
  contractor_name: z.string().min(2, "Contractor name is required."),
  contact_person: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  is_active: z.boolean(),
});

type ContractorFormValues = z.infer<typeof contractorFormSchema>;

function buildContractorDefaults(companyId = ""): ContractorFormValues {
  return {
    company_id: companyId,
    contractor_code: "",
    contractor_name: "",
    contact_person: "",
    phone: "",
    address: "",
    is_active: true,
  };
}

export default function LabourContractorsPage() {
  const { accessToken, user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editingContractorId, setEditingContractorId] = useState<number | null>(
    null,
  );
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const contractorsQuery = useQuery({
    queryKey: ["labour-contractors", "master-page"],
    queryFn: () =>
      fetchLabourContractors(accessToken ?? "", { isActive: null, limit: 200 }),
    enabled: Boolean(accessToken),
  });
  const companiesQuery = useQuery({
    queryKey: ["companies", "labour-contractors"],
    queryFn: () => fetchCompanies(accessToken ?? ""),
    enabled: Boolean(accessToken),
  });

  const contractors = Array.isArray(contractorsQuery.data)
    ? contractorsQuery.data
    : EMPTY_LIST;
  const companies = Array.isArray(companiesQuery.data)
    ? companiesQuery.data
    : EMPTY_LIST;

  const companyMap = useMemo(
    () => new Map(companies.map((company) => [company.id, company.name])),
    [companies],
  );
  const selectedContractor = useMemo(
    () =>
      contractors.find((contractor) => contractor.id === editingContractorId) ??
      null,
    [contractors, editingContractorId],
  );
  const defaultCompanyId = user?.company_id ? String(user.company_id) : "";

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContractorFormValues>({
    resolver: zodResolver(contractorFormSchema),
    defaultValues: buildContractorDefaults(defaultCompanyId),
  });

  useEffect(() => {
    if (!selectedContractor) {
      reset(buildContractorDefaults(defaultCompanyId));
      return;
    }

    reset({
      company_id: String(selectedContractor.company_id ?? defaultCompanyId),
      contractor_code: selectedContractor.contractor_code ?? "",
      contractor_name: selectedContractor.contractor_name,
      contact_person:
        selectedContractor.contact_person ?? selectedContractor.gang_name ?? "",
      phone: selectedContractor.phone ?? "",
      address: selectedContractor.address ?? "",
      is_active: selectedContractor.is_active,
    });
  }, [defaultCompanyId, reset, selectedContractor]);

  const filteredContractors = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return contractors.filter((contractor) => {
      if (statusFilter === "active" && !contractor.is_active) {
        return false;
      }
      if (statusFilter === "inactive" && contractor.is_active) {
        return false;
      }
      if (!normalizedSearch) {
        return true;
      }

      return [
        contractor.contractor_name,
        contractor.contractor_code,
        contractor.contact_person,
        contractor.gang_name,
        contractor.phone,
        contractor.address,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [contractors, search, statusFilter]);

  const metrics = useMemo(
    () => ({
      total: filteredContractors.length,
      active: filteredContractors.filter((contractor) => contractor.is_active)
        .length,
      inactive: filteredContractors.filter(
        (contractor) => !contractor.is_active,
      ).length,
      withPhone: filteredContractors.filter((contractor) => contractor.phone)
        .length,
    }),
    [filteredContractors],
  );

  const canCreate = hasPermissions(user?.role ?? "viewer", [
    "labour_contractors:create",
  ]);
  const canUpdate = hasPermissions(user?.role ?? "viewer", [
    "labour_contractors:update",
  ]);

  useKeyboardShortcuts({
    "ctrl+n": () => {
      if (!canCreate) return;
      setEditingContractorId(null);
      setServerMessage(null);
      reset(buildContractorDefaults(defaultCompanyId));
    },
    escape: () => setEditingContractorId(null),
    "/": () => searchRef.current?.focus(),
  });

  const contractorMutation = useMutation({
    mutationFn: async (values: ContractorFormValues) => {
      const payload = {
        company_id: Number(values.company_id),
        contractor_code: values.contractor_code?.trim() || null,
        contractor_name: values.contractor_name.trim(),
        contact_person: values.contact_person?.trim() || null,
        phone: values.phone?.trim() || null,
        address: values.address?.trim() || null,
        is_active: values.is_active,
      };

      if (selectedContractor) {
        return updateLabourContractor(accessToken ?? "", selectedContractor.id, {
          ...payload,
          lock_version: selectedContractor.lock_version,
        });
      }

      return createLabourContractor(accessToken ?? "", payload);
    },
    onSuccess: (contractor) => {
      void queryClient.invalidateQueries({
        queryKey: ["labour-contractors"],
      });
      setServerMessage(
        selectedContractor
          ? `${contractor.contractor_name} updated.`
          : `${contractor.contractor_name} created.`,
      );
      setEditingContractorId(null);
      reset(buildContractorDefaults(defaultCompanyId));
    },
  });

  if (contractorsQuery.isLoading || companiesQuery.isLoading) {
    return <PageSkeleton statCount={4} tableRows={8} tableColumns={6} />;
  }

  if (contractorsQuery.error || companiesQuery.error) {
    return (
      <ErrorState
        description={getApiErrorMessage(
          contractorsQuery.error ?? companiesQuery.error,
        )}
        onRetry={() => {
          void contractorsQuery.refetch();
          void companiesQuery.refetch();
        }}
      />
    );
  }

  return (
    <PermissionGate permissions={["labour_contractors:read"]}>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Labour Contractors"
          title="Keep gang and labour-supplier masters ready before monthly sheets reach accounts."
          description="Departmental labour, labour suppliers, and gang anchors belong here. Once this register is clean, attendance, labour bills, and labour advances can map without guesswork."
          actions={
            <>
              <Link to="/labour">
                <Button variant="secondary">Open labour</Button>
              </Link>
              <Button
                disabled={!canCreate}
                onClick={() => {
                  setEditingContractorId(null);
                  setServerMessage(null);
                  reset(buildContractorDefaults(defaultCompanyId));
                }}
              >
                New contractor
              </Button>
            </>
          }
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total contractors"
            value={formatCompactNumber(metrics.total)}
            caption="Filtered labour contractor records"
            icon={Users}
            tone="info"
          />
          <StatCard
            label="Active"
            value={formatCompactNumber(metrics.active)}
            caption="Available for attendance and billing"
            icon={HardHat}
            tone="success"
          />
          <StatCard
            label="Inactive"
            value={formatCompactNumber(metrics.inactive)}
            caption="Kept for history but not active"
            icon={HardHat}
            tone="accent"
          />
          <StatCard
            label="Phone coverage"
            value={formatCompactNumber(metrics.withPhone)}
            caption="Records with phone details"
            icon={Phone}
            tone="accent"
          />
        </div>

        <Card className="p-5">
          <div className="grid gap-4 lg:grid-cols-2">
            <label className="space-y-2">
              <span className={labelClassName}>Search contractors</span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[var(--surface-faint)]" />
                <input
                  ref={searchRef}
                  className={`${inputClassName} pl-11`}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Name, code, contact, phone, or address"
                />
              </div>
            </label>
            <label className="space-y-2">
              <span className={labelClassName}>Status</span>
              <select
                className={inputClassName}
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="all">All contractors</option>
                <option value="active">Active only</option>
                <option value="inactive">Inactive only</option>
              </select>
            </label>
          </div>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <DataTable
            columns={[
              {
                id: "contractor",
                header: "Contractor",
                cell: (row) => (
                  <div className="space-y-1">
                    <p className="font-semibold text-[var(--surface-ink)]">
                      {row.contractor_name}
                    </p>
                    <p className="text-xs uppercase tracking-[0.15em] text-[var(--surface-faint)]">
                      {row.contractor_code}
                    </p>
                  </div>
                ),
                sortValue: (row) => row.contractor_name,
                exportValue: (row) => row.contractor_name,
                minWidth: 240,
              },
              {
                id: "company",
                header: "Company",
                cell: (row) =>
                  row.company_id
                    ? (companyMap.get(row.company_id) ?? `Company #${row.company_id}`)
                    : "Unassigned",
                sortValue: (row) =>
                  row.company_id ? companyMap.get(row.company_id) ?? "" : "",
                exportValue: (row) =>
                  row.company_id ? companyMap.get(row.company_id) ?? "" : "",
              },
              {
                id: "contact",
                header: "Contact / Gang",
                cell: (row) => row.contact_person ?? row.gang_name ?? "—",
                sortValue: (row) => row.contact_person ?? row.gang_name ?? "",
                exportValue: (row) => row.contact_person ?? row.gang_name ?? "",
              },
              {
                id: "phone",
                header: "Phone",
                cell: (row) => row.phone ?? "—",
                exportValue: (row) => row.phone ?? "",
              },
              {
                id: "status",
                header: "Status",
                cell: (row) => (
                  <Badge tone={row.is_active ? "success" : "neutral"}>
                    {row.is_active ? "Active" : "Inactive"}
                  </Badge>
                ),
                sortValue: (row) => Number(row.is_active),
                exportValue: (row) => (row.is_active ? "Active" : "Inactive"),
              },
              {
                header: "Action",
                cell: (row) => (
                  <Button
                    disabled={!canUpdate}
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setEditingContractorId(row.id);
                      setServerMessage(null);
                    }}
                  >
                    <PencilLine className="size-4" />
                    Edit
                  </Button>
                ),
              },
            ]}
            rows={filteredContractors}
            rowKey={(row) => row.id}
            exportFileName="m2n-labour-contractors"
            stickyHeader
            manageColumns
            resizableColumns
            maxHeight="720px"
            emptyState={
              <EmptyState
                title="No labour contractors match this view"
                description="Add labour suppliers or gang masters so departmental labour sheets have a clean anchor in the ERP."
              />
            }
          />

          <Card className="p-5">
            <div className="space-y-5">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--surface-faint)]">
                  Contractor Form
                </p>
                <h3 className="text-2xl text-[var(--surface-ink)]">
                  {selectedContractor ? "Update labour contractor" : "Create labour contractor"}
                </h3>
                <p className="text-sm leading-6 text-[var(--surface-muted)]">
                  Use this register for labour suppliers, gangs, and departmental labour anchors that appear across attendance, labour bills, and weekly food advances.
                </p>
              </div>

              <form
                className="space-y-4"
                onSubmit={handleSubmit((values) =>
                  contractorMutation.mutateAsync(values),
                )}
              >
                <label className="space-y-2">
                  <span className={labelClassName}>Company</span>
                  <select className={inputClassName} {...register("company_id")}>
                    <option value="">Select company</option>
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                  {errors.company_id ? (
                    <p className="text-sm text-[var(--danger)]">
                      {errors.company_id.message}
                    </p>
                  ) : null}
                </label>

                <label className="space-y-2">
                  <span className={labelClassName}>Contractor code</span>
                  <input
                    className={inputClassName}
                    {...register("contractor_code")}
                    placeholder="Leave blank to auto-generate"
                  />
                </label>

                <label className="space-y-2">
                  <span className={labelClassName}>Contractor name</span>
                  <input
                    className={inputClassName}
                    {...register("contractor_name")}
                    placeholder="Departmental LBR"
                  />
                  {errors.contractor_name ? (
                    <p className="text-sm text-[var(--danger)]">
                      {errors.contractor_name.message}
                    </p>
                  ) : null}
                </label>

                <label className="space-y-2">
                  <span className={labelClassName}>Contact / Gang</span>
                  <input
                    className={inputClassName}
                    {...register("contact_person")}
                    placeholder="Supervisor or gang name"
                  />
                </label>

                <label className="space-y-2">
                  <span className={labelClassName}>Phone</span>
                  <input
                    className={inputClassName}
                    {...register("phone")}
                    placeholder="9876543210"
                  />
                </label>

                <label className="space-y-2">
                  <span className={labelClassName}>Address</span>
                  <textarea
                    className={`${inputClassName} min-h-24 resize-none`}
                    {...register("address")}
                    placeholder="Office or camp address"
                  />
                </label>

                <label className="flex items-center gap-3 rounded-2xl border border-[color:var(--line)] px-4 py-3 text-sm text-[var(--surface-ink)]">
                  <input type="checkbox" {...register("is_active")} />
                  Keep this contractor active for attendance, labour bills, and advances
                </label>

                {serverMessage ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                    {serverMessage}
                  </div>
                ) : null}
                {contractorMutation.error ? (
                  <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
                    {getApiErrorMessage(contractorMutation.error)}
                  </div>
                ) : null}

                <div className="flex gap-3">
                  <Button
                    disabled={
                      isSubmitting ||
                      contractorMutation.isPending ||
                      (!selectedContractor && !canCreate) ||
                      (!!selectedContractor && !canUpdate)
                    }
                    type="submit"
                  >
                    {contractorMutation.isPending
                      ? "Saving..."
                      : selectedContractor
                        ? "Update contractor"
                        : "Create contractor"}
                  </Button>
                  <Button
                    onClick={() => {
                      setEditingContractorId(null);
                      setServerMessage(null);
                      reset(buildContractorDefaults(defaultCompanyId));
                    }}
                    type="button"
                    variant="secondary"
                  >
                    Reset
                  </Button>
                </div>
              </form>
            </div>
          </Card>
        </div>
      </div>
    </PermissionGate>
  );
}

