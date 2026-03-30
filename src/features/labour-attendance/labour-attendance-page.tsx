import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  CheckCheck,
  ClipboardList,
  Eye,
  Plus,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";

import { useAuth } from "@/app/providers/auth-provider";
import {
  approveLabourAttendance,
  createLabourAttendance,
  fetchLabourAttendances,
  submitLabourAttendance,
  updateLabourAttendance,
} from "@/api/labour-attendance";
import { getApiErrorMessage } from "@/api/client";
import { fetchLabourContractors } from "@/api/labour-contractors";
import { fetchLabours } from "@/api/labour";
import { fetchProjects } from "@/api/projects";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { PermissionGate } from "@/components/shell/permission-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { Drawer } from "@/components/ui/drawer";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import {
  buildAttendanceDefaults,
  canApproveAttendance,
  canSubmitAttendance,
  filterAttendances,
  getAttendanceMetrics,
  getAttendanceStatusOptions,
  labourWorkflowToneMap,
} from "@/features/labour-operations/labour-operations-helpers";
import {
  formatCompactNumber,
  formatCurrency,
  formatDate,
  titleCase,
} from "@/lib/format";
import { hasPermissions } from "@/lib/permissions";

const EMPTY_LIST: never[] = [];
const inputClassName =
  "w-full rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-amber-100";
const labelClassName = "text-sm font-semibold text-[var(--surface-ink)]";
const attendanceItemStatusOptions = [
  "present",
  "half_day",
  "absent",
  "leave",
] as const;

const attendanceLineSchema = z.object({
  line_id: z.string().optional(),
  labour_id: z.string().min(1, "Select a labour."),
  attendance_status: z.string().min(1, "Choose an attendance status."),
  present_days: z.number().min(0, "Present days cannot be negative."),
  overtime_hours: z.number().min(0, "Overtime cannot be negative."),
  wage_rate: z.number().min(0, "Wage rate cannot be negative."),
  remarks: z.string().optional(),
});

const attendanceFormSchema = z.object({
  muster_no: z.string().min(1, "Muster number is required."),
  project_id: z.string().min(1, "Select a project."),
  contractor_id: z.string().optional(),
  date: z.string().min(1, "Attendance date is required."),
  status: z.string().min(1, "Status is required."),
  remarks: z.string().optional(),
  items: z.array(attendanceLineSchema).min(1, "Add at least one labour line."),
});

type AttendanceFormValues = z.infer<typeof attendanceFormSchema>;

export default function LabourAttendancePage() {
  const { accessToken, user } = useAuth();
  const queryClient = useQueryClient();
  const [drawerMode, setDrawerMode] = useState<"create" | "review" | null>(
    null,
  );
  const [selectedAttendanceId, setSelectedAttendanceId] = useState<
    number | null
  >(null);
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    status: "all",
    projectId: "all",
    contractorId: "all",
    fromDate: "",
    toDate: "",
    search: "",
  });

  const attendancesQuery = useQuery({
    queryKey: ["labour-attendance"],
    queryFn: () => fetchLabourAttendances(accessToken ?? ""),
    enabled: Boolean(accessToken),
  });
  const laboursQuery = useQuery({
    queryKey: ["labours"],
    queryFn: () => fetchLabours(accessToken ?? ""),
    enabled: Boolean(accessToken),
  });
  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: () => fetchProjects(accessToken ?? ""),
    enabled: Boolean(accessToken),
  });
  const contractorsQuery = useQuery({
    queryKey: ["labour-contractors"],
    queryFn: () => fetchLabourContractors(accessToken ?? ""),
    enabled: Boolean(accessToken),
  });

  const attendances = attendancesQuery.data ?? EMPTY_LIST;
  const labours = laboursQuery.data ?? EMPTY_LIST;
  const projects = projectsQuery.data ?? EMPTY_LIST;
  const contractors = contractorsQuery.data ?? EMPTY_LIST;

  const projectMap = useMemo(
    () => new Map(projects.map((project) => [project.id, project.name])),
    [projects],
  );
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
  const labourMap = useMemo(
    () => new Map(labours.map((labour) => [labour.id, labour])),
    [labours],
  );
  const selectedAttendance = useMemo(
    () =>
      attendances.find(
        (attendance) => attendance.id === selectedAttendanceId,
      ) ?? null,
    [attendances, selectedAttendanceId],
  );
  const isDrawerOpen = drawerMode !== null;
  const isEditMode = drawerMode === "review" && Boolean(selectedAttendance);

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<AttendanceFormValues>({
    resolver: zodResolver(attendanceFormSchema),
    defaultValues: buildAttendanceDefaults(),
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  });

  const selectedContractorId = useWatch({ control, name: "contractor_id" });
  const itemValues = useWatch({ control, name: "items" }) ?? [];
  const draftWagePreview = itemValues.reduce((sum, item) => {
    const presentDays = Number(item?.present_days ?? 0);
    const overtimeHours = Number(item?.overtime_hours ?? 0);
    const wageRate = Number(item?.wage_rate ?? 0);
    return sum + presentDays * wageRate + (overtimeHours * wageRate) / 8;
  }, 0);

  const availableLabours = useMemo(() => {
    if (!selectedContractorId) {
      return labours;
    }

    return labours.filter(
      (labour) =>
        labour.contractor_id === null ||
        labour.contractor_id === Number(selectedContractorId),
    );
  }, [labours, selectedContractorId]);

  useEffect(() => {
    if (!isDrawerOpen || drawerMode === "create" || !selectedAttendance) {
      reset(buildAttendanceDefaults());
      return;
    }

    reset({
      muster_no: selectedAttendance.muster_no,
      project_id: String(selectedAttendance.project_id),
      contractor_id: selectedAttendance.contractor_id
        ? String(selectedAttendance.contractor_id)
        : "",
      date: selectedAttendance.attendance_date,
      status: selectedAttendance.status,
      remarks: selectedAttendance.remarks ?? "",
      items: selectedAttendance.items.map((item) => ({
        line_id: String(item.id),
        labour_id: String(item.labour_id),
        attendance_status: item.attendance_status,
        present_days: item.present_days,
        overtime_hours: item.overtime_hours,
        wage_rate: item.wage_rate,
        remarks: item.remarks ?? "",
      })),
    });
  }, [drawerMode, isDrawerOpen, reset, selectedAttendance]);

  const filteredAttendances = useMemo(
    () =>
      filterAttendances(attendances, {
        status: filters.status,
        projectId: filters.projectId,
        contractorId: filters.contractorId,
        fromDate: filters.fromDate,
        toDate: filters.toDate,
        search: filters.search,
      }),
    [attendances, filters],
  );

  const metrics = getAttendanceMetrics(filteredAttendances);
  const visibleCrewCount = filteredAttendances.reduce(
    (sum, attendance) => sum + attendance.items.length,
    0,
  );
  const canCreate = hasPermissions(user?.role ?? "viewer", [
    "attendance:create",
  ]);
  const canUpdate = hasPermissions(user?.role ?? "viewer", [
    "labour_attendance:update",
  ]);

  const attendanceMutation = useMutation({
    mutationFn: async (values: AttendanceFormValues) => {
      const payload = {
        muster_no: values.muster_no.trim(),
        contractor_id: values.contractor_id
          ? Number(values.contractor_id)
          : null,
        date: values.date,
        status: values.status,
        remarks: values.remarks?.trim() || null,
      };

      if (selectedAttendance) {
        if (values.items.some((item) => !item.line_id)) {
          throw new Error(
            "Existing muster records only support updating current labour lines. Create a new muster for additional crew.",
          );
        }

        return updateLabourAttendance(
          accessToken ?? "",
          selectedAttendance.id,
          {
            ...payload,
            items: values.items.map((item) => ({
              id: Number(item.line_id),
              attendance_status: item.attendance_status,
              present_days: item.present_days,
              overtime_hours: item.overtime_hours,
              wage_rate: item.wage_rate,
              remarks: item.remarks?.trim() || null,
            })),
          },
        );
      }

      return createLabourAttendance(accessToken ?? "", {
        ...payload,
        project_id: Number(values.project_id),
        items: values.items.map((item) => ({
          labour_id: Number(item.labour_id),
          attendance_status: item.attendance_status,
          present_days: item.present_days,
          overtime_hours: item.overtime_hours,
          wage_rate: item.wage_rate,
          remarks: item.remarks?.trim() || null,
        })),
      });
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["labour-attendance"] });
      void queryClient.invalidateQueries({ queryKey: ["labour-bills"] });
      setServerMessage(
        selectedAttendance
          ? `${result.muster_no} updated and ready for downstream billing checks.`
          : `${result.muster_no} created successfully.`,
      );
      setDrawerMode("review");
      setSelectedAttendanceId(result.id);
    },
  });

  const submitMutation = useMutation({
    mutationFn: (attendanceId: number) =>
      submitLabourAttendance(accessToken ?? "", attendanceId),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["labour-attendance"] });
      setServerMessage(`${result.muster_no} submitted for approval.`);
      setDrawerMode("review");
      setSelectedAttendanceId(result.id);
    },
  });

  const approveMutation = useMutation({
    mutationFn: (attendanceId: number) =>
      approveLabourAttendance(accessToken ?? "", attendanceId),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["labour-attendance"] });
      void queryClient.invalidateQueries({ queryKey: ["labour-bills"] });
      setServerMessage(
        `${result.muster_no} approved and opened for attendance-driven billing.`,
      );
      setDrawerMode("review");
      setSelectedAttendanceId(result.id);
    },
  });

  const activeError =
    attendanceMutation.error ??
    submitMutation.error ??
    approveMutation.error ??
    null;

  function openCreateDrawer() {
    setDrawerMode("create");
    setSelectedAttendanceId(null);
    setServerMessage(null);
    reset(buildAttendanceDefaults());
  }

  function openReviewDrawer(attendanceId: number) {
    setDrawerMode("review");
    setSelectedAttendanceId(attendanceId);
    setServerMessage(null);
  }

  function closeDrawer() {
    setDrawerMode(null);
    setSelectedAttendanceId(null);
    setServerMessage(null);
    reset(buildAttendanceDefaults());
  }

  if (
    attendancesQuery.isLoading ||
    laboursQuery.isLoading ||
    projectsQuery.isLoading ||
    contractorsQuery.isLoading
  ) {
    return (
      <LoadingState
        title="Loading labour attendance"
        description="Pulling muster history, crew master, project scope, and contractor coverage."
      />
    );
  }

  if (
    attendancesQuery.error ||
    laboursQuery.error ||
    projectsQuery.error ||
    contractorsQuery.error
  ) {
    return (
      <ErrorState
        description={getApiErrorMessage(
          attendancesQuery.error ??
            laboursQuery.error ??
            projectsQuery.error ??
            contractorsQuery.error,
        )}
        onRetry={() => {
          void attendancesQuery.refetch();
          void laboursQuery.refetch();
          void projectsQuery.refetch();
          void contractorsQuery.refetch();
        }}
      />
    );
  }

  return (
    <PermissionGate permissions={["labour_attendance:read"]}>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Labour attendance"
          title="Run muster control with strong filters, guarded edits, and review-ready drawers."
          description="Attendance is where labour cost truth starts. This workspace keeps the crew signal clean, while still respecting duplicate blocking, billing locks, and workflow rules from the backend."
          actions={
            <Button disabled={!canCreate} onClick={openCreateDrawer}>
              <Plus className="size-4" />
              New muster
            </Button>
          }
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Visible musters"
            value={formatCompactNumber(metrics.total)}
            caption="Current filter result"
            icon={ClipboardList}
            tone="info"
          />
          <StatCard
            label="Submitted"
            value={formatCompactNumber(metrics.submitted)}
            caption="Awaiting approval"
            icon={CalendarDays}
            tone="accent"
          />
          <StatCard
            label="Approved"
            value={formatCompactNumber(metrics.approved)}
            caption="Ready for bill generation"
            icon={CheckCheck}
            tone="success"
          />
          <StatCard
            label="Visible wage"
            value={formatCurrency(metrics.wage)}
            caption={`${formatCompactNumber(visibleCrewCount)} crew lines in view`}
            icon={Users}
            tone="accent"
          />
        </div>

        <Card className="p-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1.2fr_repeat(5,minmax(0,1fr))]">
            <label className="space-y-2 xl:col-span-1">
              <span className={labelClassName}>Search muster</span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[var(--surface-faint)]" />
                <input
                  className={`${inputClassName} pl-11`}
                  placeholder="Muster no, remarks, status"
                  value={filters.search}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      search: event.target.value,
                    }))
                  }
                />
              </div>
            </label>

            <label className="space-y-2">
              <span className={labelClassName}>Status</span>
              <select
                className={inputClassName}
                value={filters.status}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    status: event.target.value,
                  }))
                }
              >
                <option value="all">All statuses</option>
                <option value="draft">Draft</option>
                <option value="submitted">Submitted</option>
                <option value="approved">Approved</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </label>

            <label className="space-y-2">
              <span className={labelClassName}>Project</span>
              <select
                className={inputClassName}
                value={filters.projectId}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    projectId: event.target.value,
                  }))
                }
              >
                <option value="all">All projects</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className={labelClassName}>Contractor</span>
              <select
                className={inputClassName}
                value={filters.contractorId}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    contractorId: event.target.value,
                  }))
                }
              >
                <option value="all">All contractors</option>
                {contractors.map((contractor) => (
                  <option key={contractor.id} value={contractor.id}>
                    {contractor.contractor_name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className={labelClassName}>From date</span>
              <DatePicker
                value={filters.fromDate}
                onChange={(v) =>
                  setFilters((current) => ({
                    ...current,
                    fromDate: v,
                  }))
                }
                placeholder="Start date"
              />
            </label>

            <label className="space-y-2">
              <span className={labelClassName}>To date</span>
              <DatePicker
                value={filters.toDate}
                onChange={(v) =>
                  setFilters((current) => ({
                    ...current,
                    toDate: v,
                  }))
                }
                placeholder="End date"
              />
            </label>
          </div>
        </Card>

        {filteredAttendances.length === 0 ? (
          <EmptyState
            title="No musters in this view"
            description="Create the first attendance record or widen the current search and filter controls."
          />
        ) : (
          <div className="grid gap-5">
            {filteredAttendances.map((attendance) => {
              const crewPreview = attendance.items
                .slice(0, 3)
                .map(
                  (item) =>
                    labourMap.get(item.labour_id)?.full_name ??
                    `Labour #${item.labour_id}`,
                );

              return (
                <Card key={attendance.id} className="p-5">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-2xl text-[var(--surface-ink)]">
                          {attendance.muster_no}
                        </h3>
                        <Badge
                          tone={
                            labourWorkflowToneMap[
                              attendance.status as keyof typeof labourWorkflowToneMap
                            ] ?? "neutral"
                          }
                        >
                          {titleCase(attendance.status)}
                        </Badge>
                        <Badge tone="neutral">
                          {attendance.items.length} crew line
                          {attendance.items.length === 1 ? "" : "s"}
                        </Badge>
                      </div>

                      <div className="grid gap-2 text-sm text-[var(--surface-muted)] md:grid-cols-4">
                        <p>
                          Project:{" "}
                          <span className="font-semibold text-[var(--surface-ink)]">
                            {projectMap.get(attendance.project_id) ??
                              `Project #${attendance.project_id}`}
                          </span>
                        </p>
                        <p>
                          Contractor:{" "}
                          <span className="font-semibold text-[var(--surface-ink)]">
                            {attendance.contractor_id
                              ? (contractorMap.get(attendance.contractor_id) ??
                                `Contractor #${attendance.contractor_id}`)
                              : "Auto scoped"}
                          </span>
                        </p>
                        <p>
                          Date:{" "}
                          <span className="font-semibold text-[var(--surface-ink)]">
                            {formatDate(attendance.attendance_date)}
                          </span>
                        </p>
                        <p>
                          Total wage:{" "}
                          <span className="font-semibold text-[var(--surface-ink)]">
                            {formatCurrency(attendance.total_wage)}
                          </span>
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {crewPreview.map((name) => (
                          <Badge key={name} tone="neutral">
                            {name}
                          </Badge>
                        ))}
                        {attendance.items.length > 3 ? (
                          <Badge tone="neutral">
                            +{attendance.items.length - 3} more
                          </Badge>
                        ) : null}
                      </div>

                      <p className="text-sm leading-6 text-[var(--surface-muted)]">
                        {attendance.remarks || "No remarks added yet."}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => openReviewDrawer(attendance.id)}
                      >
                        <Eye className="size-4" />
                        Review
                      </Button>
                      <Button
                        size="sm"
                        disabled={
                          !canCreate ||
                          !canSubmitAttendance(attendance) ||
                          submitMutation.isPending
                        }
                        onClick={() => {
                          setServerMessage(null);
                          submitMutation.mutate(attendance.id);
                        }}
                      >
                        Submit
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={
                          !canUpdate ||
                          !canApproveAttendance(attendance) ||
                          approveMutation.isPending
                        }
                        onClick={() => {
                          setServerMessage(null);
                          approveMutation.mutate(attendance.id);
                        }}
                      >
                        <CheckCheck className="size-4" />
                        Approve
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        <Drawer
          open={isDrawerOpen}
          title={
            selectedAttendance
              ? selectedAttendance.muster_no
              : "Create labour attendance"
          }
          description={
            selectedAttendance
              ? "Review line-level attendance, tune allowed fields, and move the record through the workflow without breaking backend billing or duplicate-attendance rules."
              : "Create a fresh muster with project scope, contractor coverage, and crew-level wage details."
          }
          onClose={closeDrawer}
          widthClassName="max-w-4xl"
        >
          <div className="space-y-6">
            {selectedAttendance ? (
              <div className="grid gap-4 md:grid-cols-4">
                <Card className="p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--surface-faint)]">
                    Project
                  </p>
                  <p className="mt-2 text-lg text-[var(--surface-ink)]">
                    {projectMap.get(selectedAttendance.project_id) ??
                      `Project #${selectedAttendance.project_id}`}
                  </p>
                </Card>
                <Card className="p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--surface-faint)]">
                    Contractor
                  </p>
                  <p className="mt-2 text-lg text-[var(--surface-ink)]">
                    {selectedAttendance.contractor_id
                      ? (contractorMap.get(selectedAttendance.contractor_id) ??
                        `Contractor #${selectedAttendance.contractor_id}`)
                      : "Auto scoped"}
                  </p>
                </Card>
                <Card className="p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--surface-faint)]">
                    Date
                  </p>
                  <p className="mt-2 text-lg text-[var(--surface-ink)]">
                    {formatDate(selectedAttendance.attendance_date)}
                  </p>
                </Card>
                <Card className="p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--surface-faint)]">
                    Total wage
                  </p>
                  <p className="mt-2 text-lg text-[var(--surface-ink)]">
                    {formatCurrency(selectedAttendance.total_wage)}
                  </p>
                </Card>
              </div>
            ) : null}

            <Card className="p-5">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-[var(--surface-ink)]">
                    Backend-safe edit posture
                  </p>
                  <p className="text-sm leading-6 text-[var(--surface-muted)]">
                    Project and labour line membership stay locked during review
                    because the backend update contract only allows edits on
                    existing lines. If the billed-attendance lock is active, the
                    backend will reject the change and we surface that message
                    here.
                  </p>
                </div>
                {selectedAttendance ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      disabled={
                        !canCreate ||
                        !canSubmitAttendance(selectedAttendance) ||
                        submitMutation.isPending
                      }
                      onClick={() => {
                        setServerMessage(null);
                        submitMutation.mutate(selectedAttendance.id);
                      }}
                    >
                      Submit
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={
                        !canUpdate ||
                        !canApproveAttendance(selectedAttendance) ||
                        approveMutation.isPending
                      }
                      onClick={() => {
                        setServerMessage(null);
                        approveMutation.mutate(selectedAttendance.id);
                      }}
                    >
                      <CheckCheck className="size-4" />
                      Approve
                    </Button>
                  </div>
                ) : null}
              </div>
            </Card>

            <form
              className="space-y-6"
              onSubmit={handleSubmit(async (values) => {
                setServerMessage(null);
                await attendanceMutation.mutateAsync(values);
              })}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className={labelClassName}>Muster number</span>
                  <input
                    className={inputClassName}
                    {...register("muster_no")}
                  />
                  {errors.muster_no ? (
                    <p className="text-sm text-[var(--danger)]">
                      {errors.muster_no.message}
                    </p>
                  ) : null}
                </label>

                <label className="space-y-2">
                  <span className={labelClassName}>Status</span>
                  <select
                    className={inputClassName}
                    disabled={isEditMode ? !canUpdate : !canCreate}
                    {...register("status")}
                  >
                    {getAttendanceStatusOptions(selectedAttendance?.status).map(
                      (status) => (
                        <option key={status} value={status}>
                          {titleCase(status)}
                        </option>
                      ),
                    )}
                  </select>
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <label className="space-y-2">
                  <span className={labelClassName}>Project</span>
                  <select
                    className={inputClassName}
                    disabled={isEditMode}
                    {...register("project_id")}
                  >
                    <option value="">Select project</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                  {errors.project_id ? (
                    <p className="text-sm text-[var(--danger)]">
                      {errors.project_id.message}
                    </p>
                  ) : null}
                </label>

                <label className="space-y-2">
                  <span className={labelClassName}>Contractor scope</span>
                  <select
                    className={inputClassName}
                    disabled={isEditMode ? !canUpdate : !canCreate}
                    {...register("contractor_id")}
                  >
                    <option value="">Auto scope from labour lines</option>
                    {contractors.map((contractor) => (
                      <option key={contractor.id} value={contractor.id}>
                        {contractor.contractor_name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className={labelClassName}>Attendance date</span>
                  <input
                    className={inputClassName}
                    type="date"
                    {...register("date")}
                  />
                  {errors.date ? (
                    <p className="text-sm text-[var(--danger)]">
                      {errors.date.message}
                    </p>
                  ) : null}
                </label>
              </div>

              <label className="space-y-2">
                <span className={labelClassName}>Remarks</span>
                <textarea
                  className={`${inputClassName} min-h-24 resize-none`}
                  placeholder="Crew notes, weather callouts, or supervisor remarks"
                  {...register("remarks")}
                />
              </label>

              <div className="space-y-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[var(--surface-ink)]">
                      Crew lines
                    </p>
                    <p className="text-sm text-[var(--surface-muted)]">
                      Review mode keeps the same labour membership and only
                      edits status, hours, rate, and remarks for each existing
                      line.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={isEditMode || !canCreate}
                    onClick={() =>
                      append({
                        line_id: undefined,
                        labour_id: "",
                        attendance_status: "present",
                        present_days: 1,
                        overtime_hours: 0,
                        wage_rate: 0,
                        remarks: "",
                      })
                    }
                  >
                    <Plus className="size-4" />
                    Add labour line
                  </Button>
                </div>

                {errors.items?.message ? (
                  <p className="text-sm text-[var(--danger)]">
                    {errors.items.message}
                  </p>
                ) : null}

                {fields.map((field, index) => {
                  const labourField = register(`items.${index}.labour_id`);
                  const statusField = register(
                    `items.${index}.attendance_status`,
                  );
                  const currentItem = itemValues[index];
                  const labour = labourMap.get(
                    Number(currentItem?.labour_id || 0),
                  );

                  return (
                    <Card key={field.id} className="p-4">
                      <input
                        type="hidden"
                        {...register(`items.${index}.line_id`)}
                      />
                      <div className="grid gap-4 xl:grid-cols-[1.1fr_repeat(4,minmax(0,1fr))_auto]">
                        <label className="space-y-2">
                          <span className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--surface-faint)]">
                            Labour
                          </span>
                          <select
                            className={inputClassName}
                            disabled={isEditMode}
                            {...labourField}
                            onChange={(event) => {
                              labourField.onChange(event);
                              if (!isEditMode) {
                                const nextLabour = labourMap.get(
                                  Number(event.target.value),
                                );
                                if (nextLabour) {
                                  setValue(
                                    `items.${index}.wage_rate`,
                                    nextLabour.default_wage_rate ||
                                      nextLabour.daily_rate,
                                  );
                                }
                              }
                            }}
                          >
                            <option value="">Select labour</option>
                            {availableLabours.map((row) => (
                              <option key={row.id} value={row.id}>
                                {row.full_name} ({row.labour_code})
                              </option>
                            ))}
                          </select>
                          {errors.items?.[index]?.labour_id ? (
                            <p className="text-sm text-[var(--danger)]">
                              {errors.items[index]?.labour_id?.message}
                            </p>
                          ) : null}
                        </label>

                        <label className="space-y-2">
                          <span className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--surface-faint)]">
                            Status
                          </span>
                          <select
                            className={inputClassName}
                            {...statusField}
                            onChange={(event) => {
                              statusField.onChange(event);
                              if (event.target.value === "half_day") {
                                setValue(`items.${index}.present_days`, 0.5);
                              }
                              if (
                                event.target.value === "absent" ||
                                event.target.value === "leave"
                              ) {
                                setValue(`items.${index}.present_days`, 0);
                                setValue(`items.${index}.overtime_hours`, 0);
                              }
                              if (event.target.value === "present") {
                                setValue(`items.${index}.present_days`, 1);
                              }
                            }}
                          >
                            {attendanceItemStatusOptions.map((status) => (
                              <option key={status} value={status}>
                                {titleCase(status)}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="space-y-2">
                          <span className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--surface-faint)]">
                            Present days
                          </span>
                          <input
                            className={inputClassName}
                            type="number"
                            step="0.5"
                            {...register(`items.${index}.present_days`, {
                              valueAsNumber: true,
                            })}
                          />
                          {errors.items?.[index]?.present_days ? (
                            <p className="text-sm text-[var(--danger)]">
                              {errors.items[index]?.present_days?.message}
                            </p>
                          ) : null}
                        </label>

                        <label className="space-y-2">
                          <span className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--surface-faint)]">
                            Overtime
                          </span>
                          <input
                            className={inputClassName}
                            type="number"
                            step="0.5"
                            {...register(`items.${index}.overtime_hours`, {
                              valueAsNumber: true,
                            })}
                          />
                          {errors.items?.[index]?.overtime_hours ? (
                            <p className="text-sm text-[var(--danger)]">
                              {errors.items[index]?.overtime_hours?.message}
                            </p>
                          ) : null}
                        </label>

                        <label className="space-y-2">
                          <span className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--surface-faint)]">
                            Wage rate
                          </span>
                          <input
                            className={inputClassName}
                            type="number"
                            step="0.01"
                            {...register(`items.${index}.wage_rate`, {
                              valueAsNumber: true,
                            })}
                          />
                          {errors.items?.[index]?.wage_rate ? (
                            <p className="text-sm text-[var(--danger)]">
                              {errors.items[index]?.wage_rate?.message}
                            </p>
                          ) : null}
                        </label>

                        <div className="flex items-end">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={isEditMode || fields.length === 1}
                            onClick={() => remove(index)}
                          >
                            <Trash2 className="size-4" />
                            Remove
                          </Button>
                        </div>
                      </div>

                      <label className="mt-4 block space-y-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--surface-faint)]">
                          Line remarks
                        </span>
                        <textarea
                          className={`${inputClassName} min-h-20 resize-none`}
                          placeholder="Supervisor note for this labour line"
                          {...register(`items.${index}.remarks`)}
                        />
                      </label>

                      <div className="mt-4 flex flex-wrap gap-3 text-sm text-[var(--surface-muted)]">
                        <span>
                          Default rate:{" "}
                          <span className="font-semibold text-[var(--surface-ink)]">
                            {labour
                              ? formatCurrency(
                                  labour.default_wage_rate || labour.daily_rate,
                                )
                              : "Manual entry"}
                          </span>
                        </span>
                        <span>
                          Line preview:{" "}
                          <span className="font-semibold text-[var(--surface-ink)]">
                            {formatCurrency(
                              Number(currentItem?.present_days ?? 0) *
                                Number(currentItem?.wage_rate ?? 0) +
                                (Number(currentItem?.overtime_hours ?? 0) *
                                  Number(currentItem?.wage_rate ?? 0)) /
                                  8,
                            )}
                          </span>
                        </span>
                      </div>
                    </Card>
                  );
                })}
              </div>

              {serverMessage ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  {serverMessage}
                </div>
              ) : null}
              {activeError ? (
                <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
                  {getApiErrorMessage(activeError)}
                </div>
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[color:var(--line)] bg-white/80 px-4 py-3 text-sm text-[var(--surface-muted)]">
                <span>
                  Wage snapshot:{" "}
                  <span className="font-semibold text-[var(--surface-ink)]">
                    {selectedAttendance
                      ? formatCurrency(selectedAttendance.total_wage)
                      : formatCurrency(draftWagePreview)}
                  </span>
                </span>

                <div className="flex flex-wrap gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={closeDrawer}
                  >
                    Close
                  </Button>
                  <Button
                    disabled={
                      isSubmitting ||
                      attendanceMutation.isPending ||
                      (isEditMode ? !canUpdate : !canCreate)
                    }
                    type="submit"
                  >
                    {attendanceMutation.isPending
                      ? "Saving..."
                      : isEditMode
                        ? "Update attendance"
                        : "Create attendance"}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </Drawer>
      </div>
    </PermissionGate>
  );
}
