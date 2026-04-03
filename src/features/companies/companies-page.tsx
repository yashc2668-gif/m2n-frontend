import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Boxes,
  Building2,
  FileText,
  Search,
  Shield,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { useAuth } from "@/app/providers/auth-provider";
import { fetchCompanies } from "@/api/companies";
import { getApiErrorMessage } from "@/api/client";
import { fetchMaterials } from "@/api/materials";
import { fetchProjects } from "@/api/projects";
import type { Company } from "@/api/types";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { PageSkeleton } from "@/components/feedback/skeleton";
import { PermissionGate } from "@/components/shell/permission-gate";
import { Badge } from "@/components/ui/badge";
import { buttonVariants, Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { stageQuotationContext } from "@/features/quotations/quotation-intake";
import { formatCompactNumber, formatDate } from "@/lib/format";
import { hasPermissions } from "@/lib/permissions";
import { useKeyboardShortcuts } from "@/lib/use-keyboard-shortcuts";

const inputClassName =
  "w-full rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-amber-100";
const labelClassName = "text-sm font-semibold text-[var(--surface-ink)]";
const EMPTY_LIST: never[] = [];

function matchesSearch(company: Company, query: string) {
  const haystack = [
    company.name,
    company.address,
    company.gst_number,
    company.pan_number,
    company.phone,
    company.email,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

export default function CompaniesPage() {
  const navigate = useNavigate();
  const { accessToken, user } = useAuth();
  const [search, setSearch] = useState("");
  const [focusedCompanyId, setFocusedCompanyId] = useState<number | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const canCreateDocuments = hasPermissions(user?.role ?? "viewer", ["documents:create"]);

  const openQuotationFlow = (companyId: number, openComposer = true) => {
    stageQuotationContext({
      entityType: "company",
      entityId: companyId,
      openComposer,
    });
    void navigate({ to: "/quotations" });
  };

  const companiesQuery = useQuery({
    queryKey: ["companies", "master-page"],
    queryFn: () => fetchCompanies(accessToken ?? ""),
    enabled: Boolean(accessToken),
  });
  const projectsQuery = useQuery({
    queryKey: ["projects", "company-context"],
    queryFn: () => fetchProjects(accessToken ?? ""),
    enabled: Boolean(accessToken),
  });
  const materialsQuery = useQuery({
    queryKey: ["materials", "company-context"],
    queryFn: () => fetchMaterials(accessToken ?? ""),
    enabled: Boolean(accessToken),
  });

  const companies = Array.isArray(companiesQuery.data) ? companiesQuery.data : EMPTY_LIST;
  const projects = Array.isArray(projectsQuery.data) ? projectsQuery.data : EMPTY_LIST;
  const materials = Array.isArray(materialsQuery.data) ? materialsQuery.data : EMPTY_LIST;

  const projectCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const project of projects) {
      counts.set(project.company_id, (counts.get(project.company_id) ?? 0) + 1);
    }
    return counts;
  }, [projects]);

  const materialCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const material of materials) {
      if (!material.company_id) continue;
      counts.set(material.company_id, (counts.get(material.company_id) ?? 0) + 1);
    }
    return counts;
  }, [materials]);

  const filteredCompanies = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) {
      return companies;
    }
    return companies.filter((company) => matchesSearch(company, normalizedSearch));
  }, [companies, search]);

  const focusedCompany = useMemo(
    () =>
      filteredCompanies.find((company) => company.id === focusedCompanyId) ?? null,
    [filteredCompanies, focusedCompanyId],
  );
  const visibleFocusedCompany = focusedCompany ?? filteredCompanies[0] ?? null;

  const spotlightCompanies = useMemo(
    () => filteredCompanies.slice(0, 4),
    [filteredCompanies],
  );

  const metrics = useMemo(
    () => ({
      total: filteredCompanies.length,
      taxReady: filteredCompanies.filter(
        (company) => Boolean(company.gst_number || company.pan_number),
      ).length,
      contactReady: filteredCompanies.filter(
        (company) => Boolean(company.phone || company.email),
      ).length,
      linked: filteredCompanies.filter(
        (company) =>
          (projectCounts.get(company.id) ?? 0) + (materialCounts.get(company.id) ?? 0) > 0,
      ).length,
    }),
    [filteredCompanies, materialCounts, projectCounts],
  );

  useKeyboardShortcuts({
    "/": () => searchRef.current?.focus(),
  });

  const companyColumns: DataTableColumn<Company>[] = [
      {
        id: "name",
        header: "Company",
        sortValue: (row) => row.name,
        exportValue: (row) => `${row.name} | ${row.address ?? "Address not captured"}`,
        minWidth: 260,
        cell: (row) => (
          <div className="space-y-1">
            <p className="font-semibold text-[var(--surface-ink)]">{row.name}</p>
            <p className="text-sm text-[var(--surface-faint)]">
              {row.address ?? "Address not captured"}
            </p>
          </div>
        ),
      },
      {
        id: "tax_identity",
        header: "Tax identity",
        exportValue: (row) =>
          `GST: ${row.gst_number ?? "-"} | PAN: ${row.pan_number ?? "-"}`,
        minWidth: 210,
        cell: (row) => (
          <div className="space-y-1 text-sm">
            <p>GST {row.gst_number ?? "-"}</p>
            <p className="text-[var(--surface-faint)]">PAN {row.pan_number ?? "-"}</p>
          </div>
        ),
      },
      {
        id: "contact",
        header: "Contact",
        exportValue: (row) =>
          `${row.phone ?? "-"} | ${row.email ?? "-"}`,
        minWidth: 220,
        cell: (row) => (
          <div className="space-y-1 text-sm">
            <p>{row.phone ?? "Phone not captured"}</p>
            <p className="text-[var(--surface-faint)]">
              {row.email ?? "Email not captured"}
            </p>
          </div>
        ),
      },
      {
        id: "operations",
        header: "Operations",
        exportValue: (row) =>
          `Projects: ${projectCounts.get(row.id) ?? 0} | Materials: ${materialCounts.get(row.id) ?? 0}`,
        minWidth: 180,
        cell: (row) => (
          <div className="space-y-1 text-sm">
            <p>Projects {projectCounts.get(row.id) ?? 0}</p>
            <p className="text-[var(--surface-faint)]">
              Materials {materialCounts.get(row.id) ?? 0}
            </p>
          </div>
        ),
      },
      {
        id: "created_at",
        header: "Created",
        sortValue: (row) => row.created_at,
        exportValue: (row) => row.created_at,
        minWidth: 150,
        cell: (row) => formatDate(row.created_at),
      },
      {
        id: "action",
        header: "Action",
        hideable: false,
        resizable: false,
        cell: (row) => (
          <Button
            size="sm"
            type="button"
            variant={row.id === visibleFocusedCompany?.id ? "primary" : "secondary"}
            onClick={() => setFocusedCompanyId(row.id)}
          >
            {row.id === visibleFocusedCompany?.id ? "Focused" : "View details"}
          </Button>
        ),
      },
    ];

  if (companiesQuery.isLoading || projectsQuery.isLoading || materialsQuery.isLoading) {
    return <PageSkeleton statCount={4} tableRows={8} tableColumns={6} />;
  }

  if (companiesQuery.error || projectsQuery.error || materialsQuery.error) {
    return (
      <ErrorState
        description={getApiErrorMessage(
          companiesQuery.error ?? projectsQuery.error ?? materialsQuery.error,
        )}
        onRetry={() => {
          void companiesQuery.refetch();
          void projectsQuery.refetch();
          void materialsQuery.refetch();
        }}
      />
    );
  }

  return (
    <PermissionGate permissions={["companies:read"]}>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Company masters"
          title="Keep company identity visible everywhere the business actually works."
          description="This master makes each company readable as a full business identity: name, address, GST, PAN, phone, email, and the operational footprint linked into projects and materials."
          actions={
            <>
              <Link
                className={buttonVariants({ variant: "secondary" })}
                to="/projects"
              >
                <FileText className="size-4" />
                Open projects
              </Link>
              <Link
                className={buttonVariants({ variant: "secondary" })}
                to="/materials"
              >
                <Boxes className="size-4" />
                Open materials
              </Link>
              <Link
                className={buttonVariants({ variant: "secondary" })}
                to="/quotations"
              >
                <FileText className="size-4" />
                Quotation register
              </Link>
            </>
          }
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Companies"
            value={formatCompactNumber(metrics.total)}
            caption="Visible company masters in the current filter"
            icon={Building2}
            tone="info"
          />
          <StatCard
            label="Tax ready"
            value={formatCompactNumber(metrics.taxReady)}
            caption="Companies with GST or PAN captured"
            icon={Shield}
            tone="success"
          />
          <StatCard
            label="Contact ready"
            value={formatCompactNumber(metrics.contactReady)}
            caption="Companies with phone or email available"
            icon={Building2}
            tone="accent"
          />
          <StatCard
            label="Operationally linked"
            value={formatCompactNumber(metrics.linked)}
            caption="Companies already connected to projects or materials"
            icon={FileText}
            tone="accent"
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">
            <Card className="p-5">
              <label className="space-y-2">
                <span className={labelClassName}>Search company</span>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[var(--surface-faint)]" />
                  <input
                    ref={searchRef}
                    className={`${inputClassName} pl-11`}
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search by company name, GST, PAN, phone, email, or address"
                  />
                </div>
              </label>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              {spotlightCompanies.map((company) => (
                <div
                  key={company.id}
                  className="rounded-[var(--radius)] border border-[color:var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-lg)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--surface-faint)]">
                        Company spotlight
                      </p>
                      <h3 className="mt-2 text-2xl text-[var(--surface-ink)]">
                        {company.name}
                      </h3>
                    </div>
                    <Badge tone="info">#{company.id}</Badge>
                  </div>
                  <div className="mt-4 grid gap-2 text-sm text-[var(--surface-muted)]">
                    <p>
                      GST / PAN{" "}
                      <span className="font-semibold text-[var(--surface-ink)]">
                        {company.gst_number ?? company.pan_number ?? "Not captured"}
                      </span>
                    </p>
                    <p>
                      Contact{" "}
                      <span className="font-semibold text-[var(--surface-ink)]">
                        {company.phone ?? company.email ?? "Not captured"}
                      </span>
                    </p>
                    <p>
                      Address{" "}
                      <span className="font-semibold text-[var(--surface-ink)]">
                        {company.address ?? "Not captured"}
                      </span>
                    </p>
                    <p>
                      Projects / Materials{" "}
                      <span className="font-semibold text-[var(--surface-ink)]">
                        {projectCounts.get(company.id) ?? 0} / {materialCounts.get(company.id) ?? 0}
                      </span>
                    </p>
                  </div>
                  <Button
                    className="mt-4"
                    size="sm"
                    type="button"
                    variant="secondary"
                    onClick={() => setFocusedCompanyId(company.id)}
                  >
                    Focus company
                  </Button>
                </div>
              ))}
            </div>

            <DataTable
              columns={companyColumns}
              rows={filteredCompanies}
              rowKey={(row) => row.id}
              exportFileName="m2n-companies"
              stickyHeader
              manageColumns
              resizableColumns
              maxHeight="720px"
              emptyState={
                <EmptyState
                  title="No companies match this search"
                  description="Try searching by another part of the company identity like GST, phone, email, or address."
                />
              }
            />
          </div>

          <Card className="h-fit p-6 xl:sticky xl:top-28">
            {visibleFocusedCompany ? (
              <div className="space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--surface-faint)]">
                      Focused company
                    </p>
                    <h3 className="mt-2 text-2xl text-[var(--surface-ink)]">
                      {visibleFocusedCompany.name}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-[var(--surface-muted)]">
                      {visibleFocusedCompany.address ?? "Address not captured"}
                    </p>
                  </div>
                  <Badge tone="info">Company #{visibleFocusedCompany.id}</Badge>
                </div>

                <div className="grid gap-3 text-sm text-[var(--surface-muted)]">
                  <p>
                    GST:{" "}
                    <span className="font-semibold text-[var(--surface-ink)]">
                      {visibleFocusedCompany.gst_number ?? "Not captured"}
                    </span>
                  </p>
                  <p>
                    PAN:{" "}
                    <span className="font-semibold text-[var(--surface-ink)]">
                      {visibleFocusedCompany.pan_number ?? "Not captured"}
                    </span>
                  </p>
                  <p>
                    Phone:{" "}
                    <span className="font-semibold text-[var(--surface-ink)]">
                      {visibleFocusedCompany.phone ?? "Not captured"}
                    </span>
                  </p>
                  <p>
                    Email:{" "}
                    <span className="font-semibold text-[var(--surface-ink)]">
                      {visibleFocusedCompany.email ?? "Not captured"}
                    </span>
                  </p>
                  <p>
                    Created:{" "}
                    <span className="font-semibold text-[var(--surface-ink)]">
                      {formatDate(visibleFocusedCompany.created_at)}
                    </span>
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-[var(--radius)] border border-[color:var(--line)] bg-white/70 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--surface-faint)]">
                      Linked projects
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-[var(--surface-ink)]">
                      {projectCounts.get(visibleFocusedCompany.id) ?? 0}
                    </p>
                  </div>
                  <div className="rounded-[var(--radius)] border border-[color:var(--line)] bg-white/70 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--surface-faint)]">
                      Linked materials
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-[var(--surface-ink)]">
                      {materialCounts.get(visibleFocusedCompany.id) ?? 0}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button
                    size="sm"
                    type="button"
                    variant="secondary"
                    onClick={() => openQuotationFlow(visibleFocusedCompany.id, false)}
                  >
                    <FileText className="size-4" />
                    Open quotations
                  </Button>
                  <Button
                    size="sm"
                    type="button"
                    variant="secondary"
                    disabled={!canCreateDocuments}
                    onClick={() => openQuotationFlow(visibleFocusedCompany.id)}
                  >
                    <FileText className="size-4" />
                    Upload quotation
                  </Button>
                </div>
              </div>
            ) : (
              <EmptyState
                title="No company selected"
                description="Pick a company from the table or spotlight cards to open its full business identity."
              />
            )}
          </Card>
        </div>
      </div>
    </PermissionGate>
  );
}
