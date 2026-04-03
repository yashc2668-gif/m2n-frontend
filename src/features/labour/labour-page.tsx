import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  HardHat,
  PencilLine,
  Search,
  Sparkles,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useAuth } from "@/app/providers/auth-provider";
import { fetchCompanies } from "@/api/companies";
import { getApiErrorMessage } from "@/api/client";
import {
  createLabour,
  fetchLabours,
  updateLabour,
} from "@/api/labour";
import { fetchLabourContractors } from "@/api/labour-contractors";
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
import { formatCompactNumber, formatCurrency, titleCase } from "@/lib/format";
import { hasPermissions } from "@/lib/permissions";
import { useKeyboardShortcuts } from "@/lib/use-keyboard-shortcuts";

const inputClassName =
  "w-full rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-amber-100";
const labelClassName = "text-sm font-semibold text-[var(--surface-ink)]";
const EMPTY_LIST: never[] = [];

const labourFormSchema = z.object({
  company_id: z.string().min(1, "Select a company."),
  labour_code: z.string().min(1, "Labour code is required."),
  full_name: z.string().min(2, "Full name is required."),
  trade: z.string().optional(),
  skill_level: z.string().optional(),
  daily_rate: z.number().min(0, "Daily rate cannot be negative."),
  unit: z.string().min(1, "Unit is required."),
  contractor_id: z.string().optional(),
  is_active: z.boolean(),
});

type LabourFormValues = z.infer<typeof labourFormSchema>;

function buildLabourDefaults(companyId = ""): LabourFormValues {
  return {
    company_id: companyId,
    labour_code: "",
    full_name: "",
    trade: "",
    skill_level: "",
    daily_rate: 0,
    unit: "day",
    contractor_id: "",
    is_active: true,
  };
}

export default function LabourPage() {
  const { accessToken, user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [contractorFilter, setContractorFilter] = useState("all");
  const [editingLabourId, setEditingLabourId] = useState<number | null>(null);
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const labourQuery = useQuery({
    queryKey: ["labour"],
    queryFn: () => fetchLabours(accessToken ?? "", { limit: 200 }),
    enabled: Boolean(accessToken),
  });
  const contractorsQuery = useQuery({
    queryKey: ["labour-contractors", "directory"],
    queryFn: () =>
      fetchLabourContractors(accessToken ?? "", { isActive: null, limit: 200 }),
    enabled: Boolean(accessToken),
  });
  const companiesQuery = useQuery({
    queryKey: ["companies", "labour"],
    queryFn: () => fetchCompanies(accessToken ?? ""),
    enabled: Boolean(accessToken),
  });

  const labours = Array.isArray(labourQuery.data) ? labourQuery.data : EMPTY_LIST;
  const contractors = Array.isArray(contractorsQuery.data)
    ? contractorsQuery.data
    : EMPTY_LIST;
  const companies = Array.isArray(companiesQuery.data)
    ? companiesQuery.data
    : EMPTY_LIST;

  const contractorMap = useMemo(
    () =>
      new Map(
        contractors.map((contractor) => [
          contractor.id,
          contractor.contractor_name,
        ]),
      ),
    [contractors],
  );
  const companyMap = useMemo(
    () => new Map(companies.map((company) => [company.id, company.name])),
    [companies],
  );
  const selectedLabour = useMemo(
    () => labours.find((worker) => worker.id === editingLabourId) ?? null,
    [editingLabourId, labours],
  );
  const defaultCompanyId = user?.company_id ? String(user.company_id) : "";

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<LabourFormValues>({
    resolver: zodResolver(labourFormSchema),
    defaultValues: buildLabourDefaults(defaultCompanyId),
  });

  useEffect(() => {
    if (!selectedLabour) {
      reset(buildLabourDefaults(defaultCompanyId));
      return;
    }

    reset({
      company_id: String(selectedLabour.company_id ?? defaultCompanyId),
      labour_code: selectedLabour.labour_code,
      full_name: selectedLabour.full_name,
      trade: selectedLabour.trade ?? selectedLabour.skill_type ?? "",
      skill_level: selectedLabour.skill_level ?? "",
      daily_rate: selectedLabour.daily_rate,
      unit: selectedLabour.unit,
      contractor_id: selectedLabour.contractor_id
        ? String(selectedLabour.contractor_id)
        : "",
      is_active: selectedLabour.is_active,
    });
  }, [defaultCompanyId, reset, selectedLabour]);

  const filteredLabours = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return labours.filter((worker) => {
      if (statusFilter === "active" && !worker.is_active) {
        return false;
      }
      if (statusFilter === "inactive" && worker.is_active) {
        return false;
      }
      if (
        contractorFilter !== "all" &&
        String(worker.contractor_id ?? "") !== contractorFilter
      ) {
        return false;
      }
      if (!normalizedSearch) {
        return true;
      }

      return [
        worker.full_name,
        worker.labour_code,
        worker.trade,
        worker.skill_type,
        worker.skill_level,
        worker.contractor_id
          ? contractorMap.get(worker.contractor_id) ?? ""
          : "direct crew",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [contractorFilter, contractorMap, labours, search, statusFilter]);

  const activeWorkers = filteredLabours.filter((worker) => worker.is_active)
    .length;
  const uniqueTrades = new Set(
    filteredLabours.map(
      (worker) => worker.trade ?? worker.skill_type ?? "Unassigned",
    ),
  ).size;
  const avgDailyRate = filteredLabours.length
    ? filteredLabours.reduce(
        (total, worker) => total + worker.daily_rate,
        0,
      ) / filteredLabours.length
    : 0;

  const canCreate = hasPermissions(user?.role ?? "viewer", ["labour:create"]);
  const canUpdate = hasPermissions(user?.role ?? "viewer", ["labour:update"]);

  useKeyboardShortcuts({
    "ctrl+n": () => {
      if (!canCreate) return;
      setEditingLabourId(null);
      setServerMessage(null);
      reset(buildLabourDefaults(defaultCompanyId));
    },
    escape: () => setEditingLabourId(null),
    "/": () => searchRef.current?.focus(),
  });

  const labourMutation = useMutation({
    mutationFn: async (values: LabourFormValues) => {
      const payload = {
        company_id: Number(values.company_id),
        labour_code: values.labour_code.trim(),
        full_name: values.full_name.trim(),
        trade: values.trade?.trim() || null,
        skill_level: values.skill_level?.trim() || null,
        daily_rate: values.daily_rate,
        unit: values.unit.trim(),
        contractor_id: values.contractor_id
          ? Number(values.contractor_id)
          : null,
        is_active: values.is_active,
      };

      if (selectedLabour) {
        return updateLabour(accessToken ?? "", selectedLabour.id, {
          ...payload,
          lock_version: selectedLabour.lock_version,
        });
      }

      return createLabour(accessToken ?? "", payload);
    },
    onSuccess: (worker) => {
      void queryClient.invalidateQueries({ queryKey: ["labour"] });
      setServerMessage(
        selectedLabour
          ? `${worker.full_name} updated.`
          : `${worker.full_name} created.`,
      );
      setEditingLabourId(null);
      reset(buildLabourDefaults(defaultCompanyId));
    },
  });

  if (
    labourQuery.isLoading ||
    contractorsQuery.isLoading ||
    companiesQuery.isLoading
  ) {
    return <PageSkeleton statCount={4} tableRows={8} tableColumns={7} />;
  }

  if (labourQuery.error || contractorsQuery.error || companiesQuery.error) {
    return (
      <ErrorState
        description={getApiErrorMessage(
          labourQuery.error ?? contractorsQuery.error ?? companiesQuery.error,
        )}
        onRetry={() => {
          void labourQuery.refetch();
          void contractorsQuery.refetch();
          void companiesQuery.refetch();
        }}
      />
    );
  }

  return (
    <PermissionGate permissions={["labour:read"]}>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Crew control"
          title="Keep labour masters, rates, and contractor mapping ready before monthly sheets land."
          description="Individual worker names from departmental labour sheets belong here. Tie each worker to the right labour contractor, rate, and trade so attendance, labour bills, and advances stay consistent."
          actions={
            <>
              <Link to="/labour/contractors">
                <Button variant="secondary">Contractors</Button>
              </Link>
              <Button
                disabled={!canCreate}
                onClick={() => {
                  setEditingLabourId(null);
                  setServerMessage(null);
                  reset(buildLabourDefaults(defaultCompanyId));
                }}
              >
                New labour
              </Button>
            </>
          }
        />

        <div className="grid gap-4 md:grid-cols-3">
          <StatCard
            label="Active workers"
            value={formatCompactNumber(activeWorkers)}
            caption="Current active labour records"
            icon={Users}
            tone="success"
          />
          <StatCard
            label="Trade mix"
            value={formatCompactNumber(uniqueTrades)}
            caption="Distinct trades represented in the current list"
            icon={Sparkles}
            tone="info"
          />
          <StatCard
            label="Average daily rate"
            value={formatCurrency(avgDailyRate)}
            caption="Average rate across filtered labour records"
            icon={HardHat}
            tone="accent"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-5">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--surface-faint)]">
                Contractors
              </p>
              <h3 className="text-xl text-[var(--surface-ink)]">
                Keep labour suppliers and gang anchors clean.
              </h3>
              <p className="text-sm text-[var(--surface-muted)]">
                Departmental labour, gangs, and labour suppliers should exist before attendance and advance records start.
              </p>
              <Link to="/labour/contractors">
                <Button variant="secondary">Open contractors</Button>
              </Link>
            </div>
          </Card>
          <Card className="p-5">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--surface-faint)]">
                Attendance
              </p>
              <h3 className="text-xl text-[var(--surface-ink)]">
                Mark daily muster and approval flow.
              </h3>
              <p className="text-sm text-[var(--surface-muted)]">
                Capture crew presence, overtime, and wage posture before billing starts.
              </p>
              <Link to="/labour/attendance">
                <Button variant="secondary">Open attendance</Button>
              </Link>
            </div>
          </Card>
          <Card className="p-5">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--surface-faint)]">
                Bills & Advances
              </p>
              <h3 className="text-xl text-[var(--surface-ink)]">
                Keep labour payable and recovery flow aligned.
              </h3>
              <p className="text-sm text-[var(--surface-muted)]">
                Monthly labour sheets should flow into labour bills and weekly food/cash movements should flow into labour advances.
              </p>
              <div className="flex gap-3">
                <Link to="/labour/bills">
                  <Button variant="secondary">Bills</Button>
                </Link>
                <Link to="/labour/advances">
                  <Button>Advances</Button>
                </Link>
              </div>
            </div>
          </Card>
        </div>

        <Card className="p-5">
          <div className="grid gap-4 lg:grid-cols-3">
            <label className="space-y-2 lg:col-span-1">
              <span className={labelClassName}>Search labour</span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[var(--surface-faint)]" />
                <input
                  ref={searchRef}
                  className={`${inputClassName} pl-11`}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Name, code, trade, or contractor"
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
                <option value="all">All workers</option>
                <option value="active">Active only</option>
                <option value="inactive">Inactive only</option>
              </select>
            </label>
            <label className="space-y-2">
              <span className={labelClassName}>Contractor</span>
              <select
                className={inputClassName}
                value={contractorFilter}
                onChange={(event) => setContractorFilter(event.target.value)}
              >
                <option value="all">All contractors</option>
                <option value="">Direct crew only</option>
                {contractors.map((contractor) => (
                  <option key={contractor.id} value={contractor.id}>
                    {contractor.contractor_name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <DataTable
            columns={[
              {
                id: "labour",
                header: "Labour",
                cell: (row) => (
                  <div className="space-y-1">
                    <p className="font-semibold text-[var(--surface-ink)]">
                      {row.full_name}
                    </p>
                    <p className="text-xs uppercase tracking-[0.15em] text-[var(--surface-faint)]">
                      {row.labour_code}
                    </p>
                  </div>
                ),
                sortValue: (row) => row.full_name,
                exportValue: (row) => row.full_name,
                minWidth: 220,
              },
              {
                id: "trade",
                header: "Trade",
                cell: (row) =>
                  titleCase(row.trade ?? row.skill_type ?? "unassigned"),
                sortValue: (row) => row.trade ?? row.skill_type ?? "",
                exportValue: (row) => row.trade ?? row.skill_type ?? "",
              },
              {
                id: "skill",
                header: "Skill level",
                cell: (row) => row.skill_level ?? "—",
                sortValue: (row) => row.skill_level ?? "",
                exportValue: (row) => row.skill_level ?? "",
              },
              {
                id: "rate",
                header: "Daily rate",
                cell: (row) => formatCurrency(row.daily_rate),
                sortValue: (row) => row.daily_rate,
                exportValue: (row) => String(row.daily_rate),
              },
              {
                id: "contractor",
                header: "Contractor",
                cell: (row) =>
                  row.contractor_id
                    ? contractorMap.get(row.contractor_id) ??
                      `Contractor #${row.contractor_id}`
                    : "Direct crew",
                sortValue: (row) =>
                  row.contractor_id
                    ? contractorMap.get(row.contractor_id) ?? ""
                    : "",
                exportValue: (row) =>
                  row.contractor_id
                    ? contractorMap.get(row.contractor_id) ?? ""
                    : "Direct crew",
              },
              {
                id: "company",
                header: "Company",
                cell: (row) =>
                  row.company_id
                    ? companyMap.get(row.company_id) ?? `Company #${row.company_id}`
                    : "Unassigned",
                sortValue: (row) =>
                  row.company_id ? companyMap.get(row.company_id) ?? "" : "",
                exportValue: (row) =>
                  row.company_id ? companyMap.get(row.company_id) ?? "" : "",
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
                      setEditingLabourId(row.id);
                      setServerMessage(null);
                    }}
                  >
                    <PencilLine className="size-4" />
                    Edit
                  </Button>
                ),
              },
            ]}
            rows={filteredLabours}
            rowKey={(row) => row.id}
            exportFileName="m2n-labour-master"
            stickyHeader
            manageColumns
            resizableColumns
            maxHeight="720px"
            emptyState={
              <EmptyState
                title="No labour records found"
                description="Add individual workers from your departmental labour sheets so attendance and labour bills can map without manual re-entry."
              />
            }
          />

          <Card className="p-5">
            <div className="space-y-5">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--surface-faint)]">
                  Labour Form
                </p>
                <h3 className="text-2xl text-[var(--surface-ink)]">
                  {selectedLabour ? "Update labour master" : "Create labour master"}
                </h3>
                <p className="text-sm leading-6 text-[var(--surface-muted)]">
                  Use this form for worker names that appear on departmental labour sheets before they move into attendance and billing.
                </p>
              </div>

              <form
                className="space-y-4"
                onSubmit={handleSubmit((values) =>
                  labourMutation.mutateAsync(values),
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

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className={labelClassName}>Labour code</span>
                    <input
                      className={inputClassName}
                      {...register("labour_code")}
                      placeholder="LAB-001"
                    />
                    {errors.labour_code ? (
                      <p className="text-sm text-[var(--danger)]">
                        {errors.labour_code.message}
                      </p>
                    ) : null}
                  </label>
                  <label className="space-y-2">
                    <span className={labelClassName}>Full name</span>
                    <input
                      className={inputClassName}
                      {...register("full_name")}
                      placeholder="Ramjivan"
                    />
                    {errors.full_name ? (
                      <p className="text-sm text-[var(--danger)]">
                        {errors.full_name.message}
                      </p>
                    ) : null}
                  </label>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className={labelClassName}>Trade</span>
                    <input
                      className={inputClassName}
                      {...register("trade")}
                      placeholder="Mason"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className={labelClassName}>Skill level</span>
                    <input
                      className={inputClassName}
                      {...register("skill_level")}
                      placeholder="Skilled"
                    />
                  </label>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className={labelClassName}>Daily rate</span>
                    <input
                      className={inputClassName}
                      type="number"
                      step="0.01"
                      {...register("daily_rate", { valueAsNumber: true })}
                    />
                    {errors.daily_rate ? (
                      <p className="text-sm text-[var(--danger)]">
                        {errors.daily_rate.message}
                      </p>
                    ) : null}
                  </label>
                  <label className="space-y-2">
                    <span className={labelClassName}>Unit</span>
                    <input
                      className={inputClassName}
                      {...register("unit")}
                      placeholder="day"
                    />
                    {errors.unit ? (
                      <p className="text-sm text-[var(--danger)]">
                        {errors.unit.message}
                      </p>
                    ) : null}
                  </label>
                </div>

                <label className="space-y-2">
                  <span className={labelClassName}>Labour contractor</span>
                  <select className={inputClassName} {...register("contractor_id")}>
                    <option value="">Direct crew / no contractor</option>
                    {contractors.map((contractor) => (
                      <option key={contractor.id} value={contractor.id}>
                        {contractor.contractor_name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex items-center gap-3 rounded-2xl border border-[color:var(--line)] px-4 py-3 text-sm text-[var(--surface-ink)]">
                  <input type="checkbox" {...register("is_active")} />
                  Keep this worker active in labour operations
                </label>

                {serverMessage ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                    {serverMessage}
                  </div>
                ) : null}
                {labourMutation.error ? (
                  <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
                    {getApiErrorMessage(labourMutation.error)}
                  </div>
                ) : null}

                <div className="flex gap-3">
                  <Button
                    disabled={
                      isSubmitting ||
                      labourMutation.isPending ||
                      (!selectedLabour && !canCreate) ||
                      (!!selectedLabour && !canUpdate)
                    }
                    type="submit"
                  >
                    {labourMutation.isPending
                      ? "Saving..."
                      : selectedLabour
                        ? "Update labour"
                        : "Create labour"}
                  </Button>
                  <Button
                    onClick={() => {
                      setEditingLabourId(null);
                      setServerMessage(null);
                      reset(buildLabourDefaults(defaultCompanyId));
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

