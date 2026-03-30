import { useMutation, useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CircleDollarSign,
  HardHat,
  Layers,
  ReceiptText,
  ShieldAlert,
  TrendingUp,
} from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useAuth } from '@/app/providers/auth-provider';
import { fetchCompanies } from '@/api/companies';
import { getApiErrorMessage } from '@/api/client';
import { fetchDashboardFinance, fetchDashboardSummary } from '@/api/dashboard';
import {
  exportAgeingAnalysis,
  exportCashFlowForecast,
  exportContractCommercialReport,
  exportLabourProductivityReport,
  exportMaterialConsumptionReport,
  exportMISSummary,
  exportWBSReport,
  fetchMISSummary,
  fetchCashFlowForecast,
  exportProjectCostReport,
  exportRetentionTrackingReport,
  fetchAgeingAnalysis,
  fetchContractCommercialReportPage,
  fetchLabourProductivityReport,
  fetchMaterialConsumptionReport,
  fetchProjectCostReportPage,
  fetchRetentionTrackingReportPage,
  fetchWBSReport,
} from '@/api/reports';
import type {
  ContractCommercialReportRow,
  LabourTradeProductivityRow,
  MaterialConsumptionReportRow,
  MISSummaryReport,
  ProjectCostReportRow,
  RetentionTrackingRow,
  WBSItemRow,
} from '@/api/types';
import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { PageSkeleton } from '@/components/feedback/skeleton';
import { PermissionGate } from '@/components/shell/permission-gate';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { saveBlob } from '@/lib/download';
import { formatCompactNumber, formatCurrency, formatDate, formatDecimal, titleCase } from '@/lib/format';
import { useKeyboardShortcuts } from '@/lib/use-keyboard-shortcuts';

const inputClassName =
  'w-full rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-amber-100';
const labelClassName = 'text-sm font-semibold text-[var(--surface-ink)]';
const EMPTY_LIST: never[] = [];
type TableSortState = { id: string; direction: 'asc' | 'desc' };
const MIS_SUMMARY_MONTHS = 6;
const LABOUR_PRODUCTIVITY_WINDOW_DAYS = 56;
const LABOUR_PRODUCTIVITY_BENCHMARK_DAYS = 84;

function getVarianceTone(value: number) {
  if (value < 0) return 'danger' as const;
  if (value < 500000) return 'warning' as const;
  return 'success' as const;
}

function getStatusTone(status: string) {
  if (status === 'completed' || status === 'paid' || status === 'released') return 'success' as const;
  if (status === 'on_hold' || status === 'draft' || status === 'approved' || status === 'partially_paid') {
    return 'warning' as const;
  }
  if (status === 'cancelled' || status === 'terminated' || status === 'rejected') return 'danger' as const;
  return 'info' as const;
}

function getRetentionStatusTone(status: string) {
  if (status === 'ready_for_review') return 'success' as const;
  if (status === 'past_due_review') return 'danger' as const;
  if (status === 'tracking') return 'warning' as const;
  return 'neutral' as const;
}

function getLabourBenchmarkTone(status: string) {
  if (status === 'below_benchmark') return 'danger' as const;
  if (status === 'above_benchmark') return 'success' as const;
  return 'warning' as const;
}

function getLabourTrendTone(status: string) {
  if (status === 'up') return 'success' as const;
  if (status === 'down') return 'danger' as const;
  if (status === 'new_activity') return 'accent' as const;
  return 'info' as const;
}

export default function ReportsPage() {
  const { accessToken } = useAuth();
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [companyFilter, setCompanyFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [tablePage, setTablePage] = useState(1);
  const [tablePageSize, setTablePageSize] = useState(25);
  const [tableSort, setTableSort] = useState<TableSortState>({
    id: 'actual_variance_amount',
    direction: 'asc',
  });
  const [contractPage, setContractPage] = useState(1);
  const [contractPageSize, setContractPageSize] = useState(25);
  const [contractSort, setContractSort] = useState<TableSortState>({
    id: 'commercial_headroom_amount',
    direction: 'asc',
  });
  const [materialPage, setMaterialPage] = useState(1);
  const [materialPageSize, setMaterialPageSize] = useState(25);
  const [materialSort, setMaterialSort] = useState<TableSortState>({
    id: 'wastage_amount',
    direction: 'desc',
  });
  const [labourPage, setLabourPage] = useState(1);
  const [labourPageSize, setLabourPageSize] = useState(25);
  const [labourSort, setLabourSort] = useState<TableSortState>({
    id: 'productivity_gap_pct',
    direction: 'asc',
  });
  const [retentionPage, setRetentionPage] = useState(1);
  const [retentionPageSize, setRetentionPageSize] = useState(25);
  const [retentionSort, setRetentionSort] = useState<TableSortState>({
    id: 'outstanding_retention_amount',
    direction: 'desc',
  });
  const searchRef = useRef<HTMLInputElement>(null);

  useKeyboardShortcuts({
    '/': () => searchRef.current?.focus(),
  });

  useEffect(() => {
    setTablePage(1);
    setContractPage(1);
    setMaterialPage(1);
    setLabourPage(1);
    setRetentionPage(1);
    setWbsPage(1);
  }, [companyFilter, deferredSearch, statusFilter]);

  const summaryQuery = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: () => fetchDashboardSummary(accessToken ?? ''),
    enabled: Boolean(accessToken),
  });
  const financeQuery = useQuery({
    queryKey: ['dashboard', 'finance'],
    queryFn: () => fetchDashboardFinance(accessToken ?? ''),
    enabled: Boolean(accessToken),
  });
  const companiesQuery = useQuery({
    queryKey: ['companies'],
    queryFn: () => fetchCompanies(accessToken ?? ''),
    enabled: Boolean(accessToken),
  });
  const misSummaryQuery = useQuery({
    queryKey: [
      'reports',
      'mis-summary',
      companyFilter,
      statusFilter,
      deferredSearch,
    ],
    queryFn: () =>
      fetchMISSummary(accessToken ?? '', {
        company_id: companyFilter === 'all' ? undefined : Number(companyFilter),
        status_filter: statusFilter === 'all' ? undefined : statusFilter,
        search: deferredSearch || undefined,
        months: MIS_SUMMARY_MONTHS,
        top_limit: 5,
      }),
    enabled: Boolean(accessToken),
  });
  const projectCostQuery = useQuery({
    queryKey: [
      'reports',
      'project-costs',
      companyFilter,
      statusFilter,
      deferredSearch,
      tablePage,
      tablePageSize,
      tableSort.id,
      tableSort.direction,
    ],
    queryFn: () =>
      fetchProjectCostReportPage(accessToken ?? '', {
        company_id: companyFilter === 'all' ? undefined : Number(companyFilter),
        status_filter: statusFilter === 'all' ? undefined : statusFilter,
        search: deferredSearch || undefined,
        page: tablePage,
        limit: tablePageSize,
        sort_by: tableSort.id,
        sort_dir: tableSort.direction,
      }),
    enabled: Boolean(accessToken),
    placeholderData: (previous) => previous,
  });
  const contractCommercialQuery = useQuery({
    queryKey: [
      'reports',
      'contract-commercials',
      companyFilter,
      deferredSearch,
      contractPage,
      contractPageSize,
      contractSort.id,
      contractSort.direction,
    ],
    queryFn: () =>
      fetchContractCommercialReportPage(accessToken ?? '', {
        company_id: companyFilter === 'all' ? undefined : Number(companyFilter),
        search: deferredSearch || undefined,
        page: contractPage,
        limit: contractPageSize,
        sort_by: contractSort.id,
        sort_dir: contractSort.direction,
      }),
    enabled: Boolean(accessToken),
    placeholderData: (previous) => previous,
  });
  const ageingQuery = useQuery({
    queryKey: ['reports', 'ageing-analysis', companyFilter],
    queryFn: () =>
      fetchAgeingAnalysis(accessToken ?? '', {
        company_id: companyFilter === 'all' ? undefined : Number(companyFilter),
        top_limit: 6,
      }),
    enabled: Boolean(accessToken),
  });
  const cashFlowQuery = useQuery({
    queryKey: ['reports', 'cash-flow-forecast', companyFilter, deferredSearch],
    queryFn: () =>
      fetchCashFlowForecast(accessToken ?? '', {
        company_id: companyFilter === 'all' ? undefined : Number(companyFilter),
        search: deferredSearch || undefined,
        top_limit: 6,
        horizon_weeks: 8,
        collection_days: 30,
      }),
    enabled: Boolean(accessToken),
  });
  const materialConsumptionQuery = useQuery({
    queryKey: [
      'reports',
      'material-consumption',
      companyFilter,
      statusFilter,
      deferredSearch,
      materialPage,
      materialPageSize,
      materialSort.id,
      materialSort.direction,
    ],
    queryFn: () =>
      fetchMaterialConsumptionReport(accessToken ?? '', {
        company_id: companyFilter === 'all' ? undefined : Number(companyFilter),
        status_filter: statusFilter === 'all' ? undefined : statusFilter,
        search: deferredSearch || undefined,
        page: materialPage,
        limit: materialPageSize,
        sort_by: materialSort.id,
        sort_dir: materialSort.direction,
      }),
    enabled: Boolean(accessToken),
    placeholderData: (previous) => previous,
  });
  const labourProductivityQuery = useQuery({
    queryKey: [
      'reports',
      'labour-productivity',
      companyFilter,
      statusFilter,
      deferredSearch,
      labourPage,
      labourPageSize,
      labourSort.id,
      labourSort.direction,
    ],
    queryFn: () =>
      fetchLabourProductivityReport(accessToken ?? '', {
        company_id: companyFilter === 'all' ? undefined : Number(companyFilter),
        status_filter: statusFilter === 'all' ? undefined : statusFilter,
        search: deferredSearch || undefined,
        window_days: LABOUR_PRODUCTIVITY_WINDOW_DAYS,
        benchmark_days: LABOUR_PRODUCTIVITY_BENCHMARK_DAYS,
        page: labourPage,
        limit: labourPageSize,
        sort_by: labourSort.id,
        sort_dir: labourSort.direction,
      }),
    enabled: Boolean(accessToken),
    placeholderData: (previous) => previous,
  });
  const retentionQuery = useQuery({
    queryKey: [
      'reports',
      'retention-tracking',
      companyFilter,
      deferredSearch,
      retentionPage,
      retentionPageSize,
      retentionSort.id,
      retentionSort.direction,
    ],
    queryFn: () =>
      fetchRetentionTrackingReportPage(accessToken ?? '', {
        company_id: companyFilter === 'all' ? undefined : Number(companyFilter),
        search: deferredSearch || undefined,
        page: retentionPage,
        limit: retentionPageSize,
        sort_by: retentionSort.id,
        sort_dir: retentionSort.direction,
      }),
    enabled: Boolean(accessToken),
    placeholderData: (previous) => previous,
  });

  const projectExportMutation = useMutation({
    mutationFn: async () =>
      exportProjectCostReport(accessToken ?? '', {
        company_id: companyFilter === 'all' ? undefined : Number(companyFilter),
        status_filter: statusFilter === 'all' ? undefined : statusFilter,
        search: deferredSearch || undefined,
        sort_by: tableSort.id,
        sort_dir: tableSort.direction,
      }),
    onSuccess: (blob) => {
      saveBlob(blob, 'm2n-project-cost-report.csv');
    },
  });
  const contractExportMutation = useMutation({
    mutationFn: async () =>
      exportContractCommercialReport(accessToken ?? '', {
        company_id: companyFilter === 'all' ? undefined : Number(companyFilter),
        search: deferredSearch || undefined,
        sort_by: contractSort.id,
        sort_dir: contractSort.direction,
      }),
    onSuccess: (blob) => {
      saveBlob(blob, 'm2n-contract-commercial-report.csv');
    },
  });
  const materialExportMutation = useMutation({
    mutationFn: async () =>
      exportMaterialConsumptionReport(accessToken ?? '', {
        company_id: companyFilter === 'all' ? undefined : Number(companyFilter),
        status_filter: statusFilter === 'all' ? undefined : statusFilter,
        search: deferredSearch || undefined,
        sort_by: materialSort.id,
        sort_dir: materialSort.direction,
      }),
    onSuccess: (blob) => {
      saveBlob(blob, 'm2n-material-consumption-report.csv');
    },
  });
  const labourExportMutation = useMutation({
    mutationFn: async () =>
      exportLabourProductivityReport(accessToken ?? '', {
        company_id: companyFilter === 'all' ? undefined : Number(companyFilter),
        status_filter: statusFilter === 'all' ? undefined : statusFilter,
        search: deferredSearch || undefined,
        window_days: LABOUR_PRODUCTIVITY_WINDOW_DAYS,
        benchmark_days: LABOUR_PRODUCTIVITY_BENCHMARK_DAYS,
        sort_by: labourSort.id,
        sort_dir: labourSort.direction,
      }),
    onSuccess: (blob) => {
      saveBlob(blob, 'm2n-labour-productivity-report.csv');
    },
  });
  const retentionExportMutation = useMutation({
    mutationFn: async () =>
      exportRetentionTrackingReport(accessToken ?? '', {
        company_id: companyFilter === 'all' ? undefined : Number(companyFilter),
        search: deferredSearch || undefined,
        sort_by: retentionSort.id,
        sort_dir: retentionSort.direction,
      }),
    onSuccess: (blob) => {
      saveBlob(blob, 'm2n-retention-tracking-report.csv');
    },
  });

  // ── WBS state ────────────────────────────────────────────
  const [wbsPage, setWbsPage] = useState(1);
  const [wbsPageSize, setWbsPageSize] = useState(25);
  const [wbsSort, setWbsSort] = useState<TableSortState>({
    id: 'remaining_amount',
    direction: 'desc',
  });

  const wbsQuery = useQuery({
    queryKey: [
      'reports',
      'wbs',
      companyFilter,
      deferredSearch,
      wbsPage,
      wbsPageSize,
      wbsSort.id,
      wbsSort.direction,
    ],
    queryFn: () =>
      fetchWBSReport(accessToken ?? '', {
        company_id: companyFilter === 'all' ? undefined : Number(companyFilter),
        search: deferredSearch || undefined,
        page: wbsPage,
        limit: wbsPageSize,
        sort_by: wbsSort.id,
        sort_dir: wbsSort.direction,
      }),
    enabled: Boolean(accessToken),
    placeholderData: (previous) => previous,
  });

  const wbsExportMutation = useMutation({
    mutationFn: async () =>
      exportWBSReport(accessToken ?? '', {
        company_id: companyFilter === 'all' ? undefined : Number(companyFilter),
        search: deferredSearch || undefined,
        sort_by: wbsSort.id,
        sort_dir: wbsSort.direction,
      }),
    onSuccess: (blob) => {
      saveBlob(blob, 'm2n-wbs-work-breakdown-report.csv');
    },
  });

  // ── Export mutations for ageing / cash-flow / MIS ────────
  const ageingExportMutation = useMutation({
    mutationFn: async () =>
      exportAgeingAnalysis(accessToken ?? '', {
        company_id: companyFilter === 'all' ? undefined : Number(companyFilter),
      }),
    onSuccess: (blob) => {
      saveBlob(blob, 'm2n-ageing-analysis-report.csv');
    },
  });
  const cashFlowExportMutation = useMutation({
    mutationFn: async () =>
      exportCashFlowForecast(accessToken ?? '', {
        company_id: companyFilter === 'all' ? undefined : Number(companyFilter),
        search: deferredSearch || undefined,
      }),
    onSuccess: (blob) => {
      saveBlob(blob, 'm2n-cash-flow-forecast-report.csv');
    },
  });
  const misExportMutation = useMutation({
    mutationFn: async () =>
      exportMISSummary(accessToken ?? '', {
        company_id: companyFilter === 'all' ? undefined : Number(companyFilter),
        status_filter: statusFilter === 'all' ? undefined : statusFilter,
        search: deferredSearch || undefined,
      }),
    onSuccess: (blob) => {
      saveBlob(blob, 'm2n-mis-summary-report.csv');
    },
  });

  const companies = companiesQuery.data ?? EMPTY_LIST;
  const misSummary: MISSummaryReport | undefined = misSummaryQuery.data;
  const misMonthlyTrend = misSummary?.monthly_trend ?? EMPTY_LIST;
  const misStatusMix = misSummary?.status_mix ?? EMPTY_LIST;
  const misTopOutstandingProjects = misSummary?.top_outstanding_projects ?? EMPTY_LIST;
  const summary = summaryQuery.data;
  const finance = financeQuery.data;
  const costRows = projectCostQuery.data?.items ?? EMPTY_LIST;
  const costTotal = projectCostQuery.data?.total ?? 0;
  const contractRows = contractCommercialQuery.data?.items ?? EMPTY_LIST;
  const contractTotal = contractCommercialQuery.data?.total ?? 0;
  const materialReport = materialConsumptionQuery.data;
  const materialRows = materialReport?.items ?? EMPTY_LIST;
  const materialTotal = materialReport?.total ?? 0;
  const labourReport = labourProductivityQuery.data;
  const labourRows = labourReport?.items ?? EMPTY_LIST;
  const labourTotal = labourReport?.total ?? 0;
  const retentionRows = retentionQuery.data?.items ?? EMPTY_LIST;
  const retentionTotal = retentionQuery.data?.total ?? 0;
  const ageing = ageingQuery.data;
  const cashFlow = cashFlowQuery.data;
  const wbsReport = wbsQuery.data;
  const wbsRows = wbsReport?.items ?? EMPTY_LIST;
  const wbsTotal = wbsReport?.total ?? 0;
  const wbsCategoryRollup = useMemo(() => wbsReport?.category_rollup ?? EMPTY_LIST, [wbsReport]);

  const varianceWatchlist = useMemo(
    () => costRows.filter((row) => row.actual_variance_amount < 0).slice(0, 5),
    [costRows],
  );
  const utilizationChartData = useMemo(
    () =>
      [...costRows]
        .sort((left, right) => right.actual_utilization_pct - left.actual_utilization_pct)
        .slice(0, 6)
        .map((row) => ({
          project_name: row.project_name,
          budget_amount: row.budget_amount,
          actual_cost_amount: row.actual_cost_amount,
        })),
    [costRows],
  );
  const contractHeadroomChartData = useMemo(
    () =>
      [...contractRows]
        .sort((left, right) => left.commercial_headroom_amount - right.commercial_headroom_amount)
        .slice(0, 6)
        .map((row) => ({
          contract_no: row.contract_no,
          contract_value: row.contract_value,
          actual_cost_amount: row.actual_cost_amount,
        })),
    [contractRows],
  );
  const materialConsumptionChartData = useMemo(
    () => materialReport?.top_wastage_projects ?? EMPTY_LIST,
    [materialReport],
  );
  const materialWatchlist = useMemo(
    () => materialReport?.watchlist ?? EMPTY_LIST,
    [materialReport],
  );
  const labourBenchmarkFocus = useMemo(
    () => labourReport?.benchmark_focus ?? EMPTY_LIST,
    [labourReport],
  );
  const labourBenchmarkChartData = useMemo(
    () =>
      labourBenchmarkFocus.map((row) => ({
        trade_label: `${titleCase(row.trade)} (${row.unit})`,
        benchmark_index: 100,
        current_index: row.productivity_index,
      })),
    [labourBenchmarkFocus],
  );
  const labourWatchlist = useMemo(
    () => labourReport?.watchlist ?? EMPTY_LIST,
    [labourReport],
  );
  const misStatusMixChartData = useMemo(
    () =>
      misStatusMix.map((row) => ({
        status: titleCase(row.status),
        count: row.count,
      })),
    [misStatusMix],
  );
  const retentionWatchlist = useMemo(
    () =>
      [...retentionRows]
        .sort((left, right) => right.outstanding_retention_amount - left.outstanding_retention_amount)
        .slice(0, 5),
    [retentionRows],
  );
  const costColumns = useMemo<DataTableColumn<ProjectCostReportRow>[]>(
    () => [
      {
        id: 'project_name',
        header: 'Project',
        sortKey: 'project_name',
        minWidth: 230,
        exportValue: (row) => row.project_name,
        cell: (row) => (
          <div className="space-y-1">
            <p className="font-semibold text-[var(--surface-ink)]">{row.project_name}</p>
            <p className="text-xs uppercase tracking-[0.15em] text-[var(--surface-faint)]">
              {row.project_code || 'No code'}
            </p>
          </div>
        ),
      },
      {
        id: 'company_name',
        header: 'Company',
        sortKey: 'company_name',
        minWidth: 180,
        exportValue: (row) => row.company_name,
        cell: (row) => row.company_name,
      },
      {
        id: 'status',
        header: 'Status',
        sortKey: 'status',
        exportValue: (row) => titleCase(row.status),
        cell: (row) => <Badge tone={getStatusTone(row.status)}>{titleCase(row.status)}</Badge>,
      },
      {
        id: 'budget_amount',
        header: 'Budget',
        sortKey: 'budget_amount',
        exportValue: (row) => String(row.budget_amount),
        cell: (row) => formatCurrency(row.budget_amount),
      },
      {
        id: 'committed_amount',
        header: 'Committed',
        sortKey: 'committed_amount',
        exportValue: (row) => String(row.committed_amount),
        cell: (row) => formatCurrency(row.committed_amount),
      },
      {
        id: 'actual_cost_amount',
        header: 'Actual',
        sortKey: 'actual_cost_amount',
        exportValue: (row) => String(row.actual_cost_amount),
        cell: (row) => formatCurrency(row.actual_cost_amount),
      },
      {
        id: 'billed_cost_amount',
        header: 'Vendor billed',
        sortKey: 'billed_cost_amount',
        defaultHidden: true,
        exportValue: (row) => String(row.billed_cost_amount),
        cell: (row) => formatCurrency(row.billed_cost_amount),
      },
      {
        id: 'paid_cost_amount',
        header: 'Vendor paid',
        sortKey: 'paid_cost_amount',
        exportValue: (row) => String(row.paid_cost_amount),
        cell: (row) => formatCurrency(row.paid_cost_amount),
      },
      {
        id: 'material_issued_amount',
        header: 'Material',
        sortKey: 'material_issued_amount',
        defaultHidden: true,
        exportValue: (row) => String(row.material_issued_amount),
        cell: (row) => formatCurrency(row.material_issued_amount),
      },
      {
        id: 'labour_billed_amount',
        header: 'Labour',
        sortKey: 'labour_billed_amount',
        defaultHidden: true,
        exportValue: (row) => String(row.labour_billed_amount),
        cell: (row) => formatCurrency(row.labour_billed_amount),
      },
      {
        id: 'actual_variance_amount',
        header: 'Actual variance',
        sortKey: 'actual_variance_amount',
        minWidth: 170,
        exportValue: (row) => String(row.actual_variance_amount),
        cell: (row) => (
          <span
            className={
              row.actual_variance_amount < 0 ? 'font-semibold text-[var(--danger)]' : 'font-semibold text-emerald-700'
            }
          >
            {formatCurrency(row.actual_variance_amount)}
          </span>
        ),
      },
      {
        id: 'actual_utilization_pct',
        header: 'Utilization',
        sortKey: 'actual_utilization_pct',
        exportValue: (row) => String(row.actual_utilization_pct),
        cell: (row) => (
          <div className="space-y-1">
            <p className="font-semibold text-[var(--surface-ink)]">{formatDecimal(row.actual_utilization_pct)}%</p>
            <p className="text-xs text-[var(--surface-faint)]">
              {row.contract_count} contracts, {row.active_contract_count} active
            </p>
          </div>
        ),
      },
    ],
    [],
  );
  const contractColumns = useMemo<DataTableColumn<ContractCommercialReportRow>[]>(
    () => [
      {
        id: 'contract_no',
        header: 'Contract',
        sortKey: 'contract_no',
        minWidth: 220,
        exportValue: (row) => row.contract_no,
        cell: (row) => (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Link
                className="font-semibold text-[var(--accent-strong)] underline-offset-4 hover:underline"
                to="/reports/contracts/$contractId"
                params={{ contractId: String(row.contract_id) }}
              >
                {row.contract_no}
              </Link>
              <Badge tone={getStatusTone(row.status)}>{titleCase(row.status)}</Badge>
            </div>
            <p className="text-sm text-[var(--surface-muted)]">{row.contract_title}</p>
          </div>
        ),
      },
      {
        id: 'project_name',
        header: 'Project',
        sortKey: 'project_name',
        minWidth: 210,
        exportValue: (row) => row.project_name,
        cell: (row) => (
          <div className="space-y-1">
            <p className="font-semibold text-[var(--surface-ink)]">{row.project_name}</p>
            <p className="text-xs uppercase tracking-[0.15em] text-[var(--surface-faint)]">{row.company_name}</p>
          </div>
        ),
      },
      {
        id: 'vendor_name',
        header: 'Vendor',
        sortKey: 'vendor_name',
        minWidth: 180,
        exportValue: (row) => row.vendor_name,
        cell: (row) => row.vendor_name,
      },
      {
        id: 'contract_value',
        header: 'Value',
        sortKey: 'contract_value',
        exportValue: (row) => String(row.contract_value),
        cell: (row) => formatCurrency(row.contract_value),
      },
      {
        id: 'billed_amount',
        header: 'Revenue billed',
        sortKey: 'billed_amount',
        exportValue: (row) => String(row.billed_amount),
        cell: (row) => formatCurrency(row.billed_amount),
      },
      {
        id: 'paid_amount',
        header: 'Paid out',
        sortKey: 'paid_amount',
        exportValue: (row) => String(row.paid_amount),
        cell: (row) => formatCurrency(row.paid_amount),
      },
      {
        id: 'actual_cost_amount',
        header: 'Actual cost',
        sortKey: 'actual_cost_amount',
        exportValue: (row) => String(row.actual_cost_amount),
        cell: (row) => formatCurrency(row.actual_cost_amount),
      },
      {
        id: 'commercial_headroom_amount',
        header: 'Headroom',
        sortKey: 'commercial_headroom_amount',
        minWidth: 170,
        exportValue: (row) => String(row.commercial_headroom_amount),
        cell: (row) => (
          <span
            className={
              row.commercial_headroom_amount < 0
                ? 'font-semibold text-[var(--danger)]'
                : 'font-semibold text-emerald-700'
            }
          >
            {formatCurrency(row.commercial_headroom_amount)}
          </span>
        ),
      },
      {
        id: 'billed_margin_amount',
        header: 'Billed margin',
        sortKey: 'billed_margin_amount',
        defaultHidden: true,
        exportValue: (row) => String(row.billed_margin_amount),
        cell: (row) => formatCurrency(row.billed_margin_amount),
      },
      {
        id: 'headroom_pct',
        header: 'Headroom %',
        sortKey: 'headroom_pct',
        exportValue: (row) => String(row.headroom_pct),
        cell: (row) => `${formatDecimal(row.headroom_pct)}%`,
      },
      {
        id: 'outstanding_payable',
        header: 'Outstanding payable',
        sortKey: 'outstanding_payable',
        exportValue: (row) => String(row.outstanding_payable),
        cell: (row) => formatCurrency(row.outstanding_payable),
      },
      {
        id: 'retention_held_amount',
        header: 'Retention held',
        sortKey: 'retention_held_amount',
        defaultHidden: true,
        exportValue: (row) => String(row.retention_held_amount),
        cell: (row) => formatCurrency(row.retention_held_amount),
      },
      {
        id: 'secured_advance_outstanding',
        header: 'Advance balance',
        sortKey: 'secured_advance_outstanding',
        defaultHidden: true,
        exportValue: (row) => String(row.secured_advance_outstanding),
        cell: (row) => formatCurrency(row.secured_advance_outstanding),
      },
      {
        id: 'end_date',
        header: 'End date',
        exportValue: (row) => (row.end_date ? formatDate(row.end_date) : '-'),
        cell: (row) => (row.end_date ? formatDate(row.end_date) : '-'),
      },
    ],
    [],
  );
  const materialColumns = useMemo<DataTableColumn<MaterialConsumptionReportRow>[]>(
    () => [
      {
        id: 'project_name',
        header: 'Project',
        sortKey: 'project_name',
        minWidth: 220,
        exportValue: (row) => row.project_name,
        cell: (row) => (
          <div className="space-y-1">
            <p className="font-semibold text-[var(--surface-ink)]">{row.project_name}</p>
            <p className="text-xs uppercase tracking-[0.15em] text-[var(--surface-faint)]">
              {row.project_code || 'No code'} / {row.company_name}
            </p>
          </div>
        ),
      },
      {
        id: 'material_name',
        header: 'Material',
        sortKey: 'material_name',
        minWidth: 220,
        exportValue: (row) => row.material_name,
        cell: (row) => (
          <div className="space-y-1">
            <p className="font-semibold text-[var(--surface-ink)]">{row.material_name}</p>
            <p className="text-xs uppercase tracking-[0.15em] text-[var(--surface-faint)]">
              {row.material_code} {row.category ? `/ ${row.category}` : ''}
            </p>
          </div>
        ),
      },
      {
        id: 'unit',
        header: 'Unit',
        sortKey: 'unit',
        exportValue: (row) => row.unit,
        cell: (row) => row.unit,
      },
      {
        id: 'requested_qty',
        header: 'Requested',
        sortKey: 'requested_qty',
        defaultHidden: true,
        exportValue: (row) => String(row.requested_qty),
        cell: (row) => formatDecimal(row.requested_qty),
      },
      {
        id: 'required_qty',
        header: 'Required',
        sortKey: 'required_qty',
        exportValue: (row) => String(row.required_qty),
        cell: (row) => formatDecimal(row.required_qty),
      },
      {
        id: 'issued_qty',
        header: 'Issued',
        sortKey: 'issued_qty',
        exportValue: (row) => String(row.issued_qty),
        cell: (row) => formatDecimal(row.issued_qty),
      },
      {
        id: 'wastage_qty',
        header: 'Wastage',
        sortKey: 'wastage_qty',
        exportValue: (row) => String(row.wastage_qty),
        cell: (row) => formatDecimal(row.wastage_qty),
      },
      {
        id: 'balance_to_issue_qty',
        header: 'Balance',
        sortKey: 'balance_to_issue_qty',
        exportValue: (row) => String(row.balance_to_issue_qty),
        cell: (row) => formatDecimal(row.balance_to_issue_qty),
      },
      {
        id: 'excess_issue_qty',
        header: 'Excess',
        sortKey: 'excess_issue_qty',
        exportValue: (row) => String(row.excess_issue_qty),
        cell: (row) => formatDecimal(row.excess_issue_qty),
      },
      {
        id: 'issue_coverage_pct',
        header: 'Coverage %',
        sortKey: 'issue_coverage_pct',
        exportValue: (row) => String(row.issue_coverage_pct),
        cell: (row) => `${formatDecimal(row.issue_coverage_pct)}%`,
      },
      {
        id: 'wastage_pct',
        header: 'Wastage %',
        sortKey: 'wastage_pct',
        exportValue: (row) => String(row.wastage_pct),
        cell: (row) => (
          <span
            className={row.wastage_pct > 5 ? 'font-semibold text-[var(--danger)]' : 'font-semibold text-[var(--surface-ink)]'}
          >
            {formatDecimal(row.wastage_pct)}%
          </span>
        ),
      },
      {
        id: 'required_amount',
        header: 'Required value',
        sortKey: 'required_amount',
        exportValue: (row) => String(row.required_amount),
        cell: (row) => formatCurrency(row.required_amount),
      },
      {
        id: 'issued_amount',
        header: 'Issued value',
        sortKey: 'issued_amount',
        exportValue: (row) => String(row.issued_amount),
        cell: (row) => formatCurrency(row.issued_amount),
      },
      {
        id: 'wastage_amount',
        header: 'Wastage value',
        sortKey: 'wastage_amount',
        minWidth: 160,
        exportValue: (row) => String(row.wastage_amount),
        cell: (row) => (
          <span
            className={row.wastage_amount > 0 ? 'font-semibold text-[var(--danger)]' : 'font-semibold text-[var(--surface-ink)]'}
          >
            {formatCurrency(row.wastage_amount)}
          </span>
        ),
      },
      {
        id: 'requisition_issued_qty',
        header: 'Req issued qty',
        sortKey: 'requisition_issued_qty',
        defaultHidden: true,
        exportValue: (row) => String(row.requisition_issued_qty),
        cell: (row) => formatDecimal(row.requisition_issued_qty),
      },
    ],
    [],
  );
  const labourColumns = useMemo<DataTableColumn<LabourTradeProductivityRow>[]>(
    () => [
      {
        id: 'trade_label',
        header: 'Trade / unit',
        sortKey: 'trade_label',
        minWidth: 220,
        exportValue: (row) => row.trade_label,
        cell: (row) => (
          <div className="space-y-1">
            <p className="font-semibold text-[var(--surface-ink)]">{titleCase(row.trade)}</p>
            <p className="text-xs uppercase tracking-[0.15em] text-[var(--surface-faint)]">
              {row.unit} / {row.project_count} projects
            </p>
          </div>
        ),
      },
      {
        id: 'record_count',
        header: 'Records',
        sortKey: 'record_count',
        exportValue: (row) => String(row.record_count),
        cell: (row) => formatDecimal(row.record_count),
      },
      {
        id: 'contract_count',
        header: 'Contracts',
        sortKey: 'contract_count',
        defaultHidden: true,
        exportValue: (row) => String(row.contract_count),
        cell: (row) => formatDecimal(row.contract_count),
      },
      {
        id: 'recent_output_qty',
        header: 'Recent output',
        sortKey: 'recent_output_qty',
        minWidth: 140,
        exportValue: (row) => String(row.recent_output_qty),
        cell: (row) => (
          <div>
            <p className="font-semibold text-[var(--surface-ink)]">{formatDecimal(row.recent_output_qty)}</p>
            <p className="text-xs text-[var(--surface-faint)]">{row.unit}</p>
          </div>
        ),
      },
      {
        id: 'prior_output_qty',
        header: 'Prior output',
        sortKey: 'prior_output_qty',
        exportValue: (row) => String(row.prior_output_qty),
        cell: (row) => (
          <div>
            <p className="font-semibold text-[var(--surface-ink)]">{formatDecimal(row.prior_output_qty)}</p>
            <p className="text-xs text-[var(--surface-faint)]">{row.unit}</p>
          </div>
        ),
      },
      {
        id: 'output_change_pct',
        header: 'Output trend',
        sortKey: 'output_change_pct',
        minWidth: 150,
        exportValue: (row) => String(row.output_change_pct),
        cell: (row) => (
          <div className="space-y-1">
            <p
              className={
                row.output_change_pct < 0 ? 'font-semibold text-[var(--danger)]' : 'font-semibold text-emerald-700'
              }
            >
              {formatDecimal(row.output_change_pct)}%
            </p>
            <Badge tone={getLabourTrendTone(row.output_trend_status)}>{titleCase(row.output_trend_status)}</Badge>
          </div>
        ),
      },
      {
        id: 'recent_labour_count',
        header: 'Crew days',
        sortKey: 'recent_labour_count',
        exportValue: (row) => String(row.recent_labour_count),
        cell: (row) => formatDecimal(row.recent_labour_count),
      },
      {
        id: 'recent_productivity',
        header: 'Current productivity',
        sortKey: 'recent_productivity',
        minWidth: 160,
        exportValue: (row) => String(row.recent_productivity),
        cell: (row) => (
          <div>
            <p className="font-semibold text-[var(--surface-ink)]">{formatDecimal(row.recent_productivity)}</p>
            <p className="text-xs text-[var(--surface-faint)]">{row.unit} per crew day</p>
          </div>
        ),
      },
      {
        id: 'benchmark_productivity',
        header: 'Benchmark',
        sortKey: 'benchmark_productivity',
        minWidth: 140,
        exportValue: (row) => String(row.benchmark_productivity),
        cell: (row) => (
          <div>
            <p className="font-semibold text-[var(--surface-ink)]">{formatDecimal(row.benchmark_productivity)}</p>
            <p className="text-xs text-[var(--surface-faint)]">{row.unit} per crew day</p>
          </div>
        ),
      },
      {
        id: 'productivity_gap_pct',
        header: 'Gap %',
        sortKey: 'productivity_gap_pct',
        minWidth: 130,
        exportValue: (row) => String(row.productivity_gap_pct),
        cell: (row) => (
          <span
            className={
              row.productivity_gap_pct < 0 ? 'font-semibold text-[var(--danger)]' : 'font-semibold text-emerald-700'
            }
          >
            {formatDecimal(row.productivity_gap_pct)}%
          </span>
        ),
      },
      {
        id: 'productivity_index',
        header: 'Index',
        sortKey: 'productivity_index',
        defaultHidden: true,
        exportValue: (row) => String(row.productivity_index),
        cell: (row) => `${formatDecimal(row.productivity_index)}`,
      },
      {
        id: 'benchmark_status',
        header: 'Benchmark status',
        sortKey: 'benchmark_status',
        minWidth: 150,
        exportValue: (row) => titleCase(row.benchmark_status),
        cell: (row) => (
          <Badge tone={getLabourBenchmarkTone(row.benchmark_status)}>{titleCase(row.benchmark_status)}</Badge>
        ),
      },
      {
        id: 'last_entry_date',
        header: 'Last logged',
        sortKey: 'last_entry_date',
        exportValue: (row) => (row.last_entry_date ? formatDate(row.last_entry_date) : '-'),
        cell: (row) => (row.last_entry_date ? formatDate(row.last_entry_date) : '-'),
      },
    ],
    [],
  );
  const retentionColumns = useMemo<DataTableColumn<RetentionTrackingRow>[]>(
    () => [
      {
        id: 'contract_no',
        header: 'Contract',
        sortKey: 'contract_no',
        minWidth: 220,
        exportValue: (row) => row.contract_no,
        cell: (row) => (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Link
                className="font-semibold text-[var(--accent-strong)] underline-offset-4 hover:underline"
                to="/reports/contracts/$contractId"
                params={{ contractId: String(row.contract_id) }}
              >
                {row.contract_no}
              </Link>
              <Badge tone={getRetentionStatusTone(row.release_status)}>{titleCase(row.release_status)}</Badge>
            </div>
            <p className="text-sm text-[var(--surface-muted)]">{row.contract_title}</p>
          </div>
        ),
      },
      {
        id: 'project_name',
        header: 'Project',
        sortKey: 'project_name',
        minWidth: 200,
        exportValue: (row) => row.project_name,
        cell: (row) => (
          <div className="space-y-1">
            <p className="font-semibold text-[var(--surface-ink)]">{row.project_name}</p>
            <p className="text-xs uppercase tracking-[0.15em] text-[var(--surface-faint)]">{row.vendor_name}</p>
          </div>
        ),
      },
      {
        id: 'retention_percentage',
        header: 'Retention %',
        sortKey: 'retention_percentage',
        exportValue: (row) => String(row.retention_percentage),
        cell: (row) => `${formatDecimal(row.retention_percentage)}%`,
      },
      {
        id: 'contract_value',
        header: 'Contract value',
        sortKey: 'contract_value',
        exportValue: (row) => String(row.contract_value),
        cell: (row) => formatCurrency(row.contract_value),
      },
      {
        id: 'estimated_retention_cap',
        header: 'Cap',
        sortKey: 'estimated_retention_cap',
        exportValue: (row) => String(row.estimated_retention_cap),
        cell: (row) => formatCurrency(row.estimated_retention_cap),
      },
      {
        id: 'outstanding_retention_amount',
        header: 'Held now',
        sortKey: 'outstanding_retention_amount',
        minWidth: 150,
        exportValue: (row) => String(row.outstanding_retention_amount),
        cell: (row) => formatCurrency(row.outstanding_retention_amount),
      },
      {
        id: 'progress_pct',
        header: 'Coverage',
        sortKey: 'progress_pct',
        minWidth: 160,
        exportValue: (row) => String(row.progress_pct),
        cell: (row) => (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold text-[var(--surface-ink)]">{formatDecimal(row.progress_pct)}%</span>
              <span className="text-[var(--surface-faint)]">{formatCurrency(row.total_retention_deducted)}</span>
            </div>
            <div className="h-2 rounded-full bg-[color:var(--line)]">
              <div
                className="h-2 rounded-full bg-[var(--accent)]"
                style={{ width: `${Math.max(0, Math.min(row.progress_pct, 100))}%` }}
              />
            </div>
          </div>
        ),
      },
      {
        id: 'scheduled_release_date',
        header: 'Release date',
        sortKey: 'scheduled_release_date',
        exportValue: (row) => (row.scheduled_release_date ? formatDate(row.scheduled_release_date) : '-'),
        cell: (row) => (row.scheduled_release_date ? formatDate(row.scheduled_release_date) : '-'),
      },
      {
        id: 'billed_amount',
        header: 'Billed amount',
        sortKey: 'billed_amount',
        defaultHidden: true,
        exportValue: (row) => String(row.billed_amount),
        cell: (row) => formatCurrency(row.billed_amount),
      },
      {
        id: 'total_retention_deducted',
        header: 'Deducted total',
        defaultHidden: true,
        exportValue: (row) => String(row.total_retention_deducted),
        cell: (row) => formatCurrency(row.total_retention_deducted),
      },
    ],
    [],
  );

  // ── WBS columns ──────────────────────────────────────────
  const wbsColumns = useMemo<DataTableColumn<WBSItemRow>[]>(
    () => [
      {
        id: 'contract_no',
        header: 'Contract',
        sortKey: 'contract_no',
        exportValue: (row) => row.contract_no,
        cell: (row) => (
          <Link
            className="text-[var(--accent-strong)] underline-offset-4 hover:underline"
            to="/reports/contracts/$contractId"
            params={{ contractId: String(row.contract_id) }}
          >
            {row.contract_no}
          </Link>
        ),
      },
      {
        id: 'project_name',
        header: 'Project',
        sortKey: 'project_name',
        defaultHidden: true,
        exportValue: (row) => row.project_name,
        cell: (row) => row.project_name,
      },
      {
        id: 'category',
        header: 'Category',
        sortKey: 'category',
        exportValue: (row) => row.category ?? '-',
        cell: (row) => (
          <Badge tone="neutral">{row.category || 'Uncategorised'}</Badge>
        ),
      },
      {
        id: 'item_code',
        header: 'Item code',
        sortKey: 'item_code',
        exportValue: (row) => row.item_code ?? '-',
        cell: (row) => (
          <span className="font-mono text-xs">{row.item_code || '-'}</span>
        ),
      },
      {
        id: 'description',
        header: 'Description',
        sortKey: 'description',
        exportValue: (row) => row.description,
        cell: (row) => (
          <span className="line-clamp-2 max-w-xs text-sm">{row.description}</span>
        ),
      },
      {
        id: 'unit',
        header: 'Unit',
        sortKey: 'unit',
        exportValue: (row) => row.unit,
        cell: (row) => row.unit,
      },
      {
        id: 'boq_quantity',
        header: 'BOQ qty',
        sortKey: 'boq_quantity',
        exportValue: (row) => String(row.boq_quantity),
        cell: (row) => formatDecimal(row.boq_quantity),
      },
      {
        id: 'boq_amount',
        header: 'BOQ amount',
        sortKey: 'boq_amount',
        exportValue: (row) => String(row.boq_amount),
        cell: (row) => formatCurrency(row.boq_amount),
      },
      {
        id: 'work_done_quantity',
        header: 'Done qty',
        sortKey: 'work_done_quantity',
        exportValue: (row) => String(row.work_done_quantity),
        cell: (row) => formatDecimal(row.work_done_quantity),
      },
      {
        id: 'work_done_amount',
        header: 'Done amount',
        sortKey: 'work_done_amount',
        exportValue: (row) => String(row.work_done_amount),
        cell: (row) => formatCurrency(row.work_done_amount),
      },
      {
        id: 'billed_quantity',
        header: 'Billed qty',
        sortKey: 'billed_quantity',
        defaultHidden: true,
        exportValue: (row) => String(row.billed_quantity),
        cell: (row) => formatDecimal(row.billed_quantity),
      },
      {
        id: 'billed_amount',
        header: 'Billed amount',
        sortKey: 'billed_amount',
        defaultHidden: true,
        exportValue: (row) => String(row.billed_amount),
        cell: (row) => formatCurrency(row.billed_amount),
      },
      {
        id: 'remaining_quantity',
        header: 'Remaining qty',
        sortKey: 'remaining_quantity',
        exportValue: (row) => String(row.remaining_quantity),
        cell: (row) => formatDecimal(row.remaining_quantity),
      },
      {
        id: 'remaining_amount',
        header: 'Remaining amount',
        sortKey: 'remaining_amount',
        exportValue: (row) => String(row.remaining_amount),
        cell: (row) => (
          <span className={row.remaining_amount > 0 ? 'text-[var(--danger)]' : ''}>
            {formatCurrency(row.remaining_amount)}
          </span>
        ),
      },
      {
        id: 'completion_pct',
        header: 'Completion %',
        sortKey: 'completion_pct',
        exportValue: (row) => `${row.completion_pct}%`,
        cell: (row) => {
          const pct = row.completion_pct;
          const tone = pct >= 100 ? 'success' : pct >= 50 ? 'warning' : 'danger';
          return (
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-200">
                <div
                  className={`h-full rounded-full ${
                    tone === 'success'
                      ? 'bg-emerald-500'
                      : tone === 'warning'
                        ? 'bg-amber-400'
                        : 'bg-red-400'
                  }`}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
              <span className="text-xs font-semibold">{pct}%</span>
            </div>
          );
        },
      },
    ],
    [],
  );

  if (
    summaryQuery.isLoading ||
    financeQuery.isLoading ||
    companiesQuery.isLoading ||
    misSummaryQuery.isLoading ||
    projectCostQuery.isLoading ||
    contractCommercialQuery.isLoading ||
    ageingQuery.isLoading ||
    cashFlowQuery.isLoading ||
    materialConsumptionQuery.isLoading ||
    labourProductivityQuery.isLoading ||
    retentionQuery.isLoading ||
    wbsQuery.isLoading
  ) {
    return <PageSkeleton statCount={5} tableRows={8} tableColumns={8} />;
  }

  if (
    summaryQuery.error ||
    financeQuery.error ||
    companiesQuery.error ||
    misSummaryQuery.error ||
    projectCostQuery.error ||
    contractCommercialQuery.error ||
    ageingQuery.error ||
    cashFlowQuery.error ||
    materialConsumptionQuery.error ||
    labourProductivityQuery.error ||
    retentionQuery.error ||
    !summary ||
    !finance ||
    !misSummary ||
    !ageing ||
    !cashFlow ||
    !materialReport ||
    !labourReport
  ) {
    return (
      <ErrorState
        description={getApiErrorMessage(
            summaryQuery.error ??
            financeQuery.error ??
            companiesQuery.error ??
            misSummaryQuery.error ??
            projectCostQuery.error ??
            contractCommercialQuery.error ??
            ageingQuery.error ??
            cashFlowQuery.error ??
            materialConsumptionQuery.error ??
            labourProductivityQuery.error ??
            retentionQuery.error ??
            wbsQuery.error,
        )}
        onRetry={() => {
          void summaryQuery.refetch();
          void financeQuery.refetch();
          void companiesQuery.refetch();
          void misSummaryQuery.refetch();
          void projectCostQuery.refetch();
          void contractCommercialQuery.refetch();
          void ageingQuery.refetch();
          void cashFlowQuery.refetch();
          void materialConsumptionQuery.refetch();
          void labourProductivityQuery.refetch();
          void retentionQuery.refetch();
          void wbsQuery.refetch();
        }}
      />
    );
  }

  return (
    <PermissionGate permissions={['dashboard:read']}>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Management intelligence"
          title="Turn portfolio data into commercial control instead of static registers."
          description="Phase 4 now covers cost variance, contract P&L pressure, short-horizon cash flow forecasting, material consumption control, overdue receivables and payments ageing, plus retention review queues that senior teams can act on fast."
          actions={
            <>
              <Link className={buttonVariants({ variant: 'secondary' })} to="/audit-logs">
                Audit trail
              </Link>
              <Link className={buttonVariants({ variant: 'primary' })} to="/payments">
                Finance queue
                <ArrowRight className="size-4" />
              </Link>
            </>
          }
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatCard
            label="Projects tracked"
            value={formatCompactNumber(summary.total_projects)}
            caption={`${formatCompactNumber(costTotal)} projects in the cost report slice`}
            icon={BarChart3}
            tone="info"
          />
          <StatCard
            label="Vendor billed"
            value={formatCurrency(summary.total_billed_amount)}
            caption={`Released ${formatCurrency(summary.total_paid_amount)}`}
            icon={ReceiptText}
            tone="accent"
          />
          <StatCard
            label="Outstanding payable"
            value={formatCurrency(summary.outstanding_payable)}
            caption="Approved or partially paid vendor exposure"
            icon={CircleDollarSign}
            tone="accent"
          />
          <StatCard
            label="Retention held"
            value={formatCurrency(finance.retention_outstanding_summary.outstanding_retention_amount)}
            caption={`${finance.retention_outstanding_summary.affected_contract_count} contracts impacted`}
            icon={ShieldAlert}
            tone="success"
          />
          <StatCard
            label="Secured advances"
            value={formatCurrency(summary.secured_advance_outstanding)}
            caption="Outstanding recoverable advance balance"
            icon={AlertTriangle}
            tone="info"
          />
        </div>

        <Card className="p-5">
          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr_1fr]">
            <label className="space-y-2">
              <span className={labelClassName}>Search portfolio</span>
              <input
                ref={searchRef}
                className={inputClassName}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Project, contract, vendor, material, trade, unit, client, location, or company"
              />
            </label>
            <label className="space-y-2">
              <span className={labelClassName}>Company</span>
              <select
                className={inputClassName}
                value={companyFilter}
                onChange={(event) => setCompanyFilter(event.target.value)}
              >
                <option value="all">All companies</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className={labelClassName}>Project status</span>
              <select
                className={inputClassName}
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="on_hold">On hold</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </label>
          </div>
          <p className="mt-4 text-sm leading-6 text-[var(--surface-muted)]">
            Actual cost in this first cut is calculated as released vendor payments + issued material value + approved labour bills.
            Material consumption uses approved requisition quantity as required demand and treats posted negative stock adjustments as wastage.
            Labour productivity benchmarks each trade within the same logged unit across the last 8 weeks against the preceding 12 weeks, with +/-10% treated as on benchmark.
            Cash flow forecast still assumes approved outstanding RA bills collect 30 days after bill date.
          </p>
        </Card>

        <Card className="p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-2xl text-[var(--surface-ink)]">Monthly MIS summary</h3>
              <p className="mt-1 text-sm text-[var(--surface-muted)]">
                Filter-aware monthly management pack showing billing, release rhythm, project mix, and current liability pressure.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                className={buttonVariants({ variant: 'secondary', size: 'sm' })}
                disabled={misExportMutation.isPending}
                onClick={() => misExportMutation.mutate()}
              >
                {misExportMutation.isPending ? 'Exporting…' : 'Export CSV'}
              </button>
              <Badge tone="success">Phase 4.8</Badge>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[var(--radius)] border border-[color:var(--line)] bg-white/75 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--surface-faint)]">
                {misSummary.summary.current_month_label} billed
              </p>
              <p className="mt-3 text-3xl font-semibold text-[var(--surface-ink)]">
                {formatCurrency(misSummary.summary.current_month_billed_amount)}
              </p>
              <p className="mt-2 text-sm text-[var(--surface-muted)]">
                Previous month {formatCurrency(misSummary.summary.previous_month_billed_amount)}
              </p>
            </div>
            <div className="rounded-[var(--radius)] border border-[color:var(--line)] bg-white/75 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--surface-faint)]">
                {misSummary.summary.current_month_label} released
              </p>
              <p className="mt-3 text-3xl font-semibold text-[var(--surface-ink)]">
                {formatCurrency(misSummary.summary.current_month_released_amount)}
              </p>
              <p className="mt-2 text-sm text-[var(--surface-muted)]">
                Previous month {formatCurrency(misSummary.summary.previous_month_released_amount)}
              </p>
            </div>
            <div className="rounded-[var(--radius)] border border-[color:var(--line)] bg-white/75 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--surface-faint)]">
                Month net liability
              </p>
              <p
                className={`mt-3 text-3xl font-semibold ${
                  misSummary.summary.current_month_net_amount > 0 ? 'text-[var(--danger)]' : 'text-emerald-700'
                }`}
              >
                {formatCurrency(misSummary.summary.current_month_net_amount)}
              </p>
              <p className="mt-2 text-sm text-[var(--surface-muted)]">
                Previous month {formatCurrency(misSummary.summary.previous_month_net_amount)}
              </p>
            </div>
            <div className="rounded-[var(--radius)] border border-[color:var(--line)] bg-white/75 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--surface-faint)]">
                Release coverage
              </p>
              <p className="mt-3 text-3xl font-semibold text-[var(--surface-ink)]">
                {formatDecimal(misSummary.summary.payment_release_coverage_pct)}%
              </p>
              <p className="mt-2 text-sm text-[var(--surface-muted)]">
                Overdue bills {formatCurrency(misSummary.summary.overdue_vendor_bill_amount)}
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-[var(--radius)] border border-[color:var(--line)] bg-white/80 p-4">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="text-lg font-semibold text-[var(--surface-ink)]">Monthly billing vs release rhythm</h4>
                  <p className="mt-1 text-sm text-[var(--surface-muted)]">
                    Last {MIS_SUMMARY_MONTHS} months of billed value, released cash, and retained holdback in the current report slice.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="warning">{formatCurrency(misSummary.summary.outstanding_payable)} open liability</Badge>
                  <Badge tone="accent">{formatCurrency(misSummary.summary.retention_held_amount)} retention held</Badge>
                </div>
              </div>
              {misMonthlyTrend.some(
                (point) => point.billed_amount > 0 || point.released_amount > 0 || point.retention_amount > 0,
              ) ? (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={misMonthlyTrend} margin={{ top: 10, right: 0, left: -18, bottom: 0 }}>
                      <CartesianGrid stroke="rgba(104, 83, 47, 0.14)" vertical={false} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} />
                      <YAxis tickFormatter={(value) => formatCompactNumber(Number(value))} tickLine={false} axisLine={false} />
                      <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0))} />
                      <Legend />
                      <Bar dataKey="billed_amount" name="Billed" fill="#f2d49a" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="released_amount" name="Released" fill="#d97706" radius={[6, 6, 0, 0]} />
                      <Line
                        type="monotone"
                        dataKey="retention_amount"
                        name="Retention"
                        stroke="#92400e"
                        strokeWidth={3}
                        dot={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState
                  title="No monthly MIS movement yet"
                  description="Billing, released payments, and retention deductions will populate this dashboard once transactions start landing."
                />
              )}
            </div>

            <div className="space-y-6">
              <div className="rounded-[var(--radius)] border border-[color:var(--line)] bg-white/80 p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-lg font-semibold text-[var(--surface-ink)]">Portfolio mix</h4>
                    <p className="mt-1 text-sm text-[var(--surface-muted)]">
                      Project status distribution inside the active MIS filter context.
                    </p>
                  </div>
                  <Badge tone="info">
                    {formatDecimal(misSummary.summary.active_project_count)} active / {formatDecimal(misSummary.summary.project_count)} total
                  </Badge>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {misStatusMixChartData.length === 0 ? (
                    <EmptyState
                      title="No projects in this slice"
                      description="Adjust the filters to bring portfolio status mix into view."
                    />
                  ) : (
                    misStatusMixChartData.map((row) => (
                      <div
                        key={row.status}
                        className="rounded-[var(--radius)] border border-[color:var(--line)] bg-white/75 p-4"
                      >
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--surface-faint)]">
                          {row.status}
                        </p>
                        <p className="mt-3 text-2xl font-semibold text-[var(--surface-ink)]">{formatDecimal(row.count)}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-[var(--radius)] border border-[color:var(--line)] bg-white/80 p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-lg font-semibold text-[var(--surface-ink)]">Top project pressure</h4>
                    <p className="mt-1 text-sm text-[var(--surface-muted)]">
                      Projects carrying the highest approved unpaid liability in the current slice.
                    </p>
                  </div>
                  <Link className={buttonVariants({ variant: 'ghost', size: 'sm' })} to="/projects">
                    Open projects
                  </Link>
                </div>
                <div className="space-y-3">
                  {misTopOutstandingProjects.length === 0 ? (
                    <EmptyState
                      title="No project pressure visible"
                      description="Outstanding liability will appear here once approved bills and releases start building a backlog."
                    />
                  ) : (
                    misTopOutstandingProjects.map((row) => (
                      <div
                        key={row.project_id}
                        className="rounded-[var(--radius)] border border-[color:var(--line)] bg-white/75 p-4"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-semibold text-[var(--surface-ink)]">{row.project_name}</p>
                            <p className="text-sm text-[var(--surface-muted)]">
                              {row.project_code || 'No code'} / {titleCase(row.status)}
                            </p>
                          </div>
                          <Badge tone={row.outstanding_amount > 0 ? 'danger' : 'success'}>
                            {formatCurrency(row.outstanding_amount)}
                          </Badge>
                        </div>
                        <div className="mt-3 grid gap-2 text-sm text-[var(--surface-muted)] md:grid-cols-2">
                          <p>
                            Billed:{' '}
                            <span className="font-semibold text-[var(--surface-ink)]">{formatCurrency(row.billed_amount)}</span>
                          </p>
                          <p>
                            Released:{' '}
                            <span className="font-semibold text-[var(--surface-ink)]">
                              {formatCurrency(row.released_amount)}
                            </span>
                          </p>
                          <p>
                            Active contracts:{' '}
                            <span className="font-semibold text-[var(--surface-ink)]">
                              {formatDecimal(row.active_contract_count)}
                            </span>
                          </p>
                          <p>
                            Net pressure:{' '}
                            <span className="font-semibold text-[var(--surface-ink)]">
                              {formatCurrency(row.billed_amount - row.released_amount)}
                            </span>
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-2xl text-[var(--surface-ink)]">Cash flow forecast</h3>
              <p className="mt-1 text-sm text-[var(--surface-muted)]">
                Eight-week inflow and outflow projection from approved receivables and pending payment commitments.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                className={buttonVariants({ variant: 'secondary', size: 'sm' })}
                disabled={cashFlowExportMutation.isPending}
                onClick={() => cashFlowExportMutation.mutate()}
              >
                {cashFlowExportMutation.isPending ? 'Exporting…' : 'Export CSV'}
              </button>
              <Badge tone="accent">Phase 4.3</Badge>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[var(--radius)] border border-[color:var(--line)] bg-white/75 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--surface-faint)]">
                Receivable pipeline
              </p>
              <p className="mt-3 text-3xl font-semibold text-[var(--surface-ink)]">
                {formatCurrency(cashFlow.summary.total_receivable_pipeline)}
              </p>
              <p className="mt-2 text-sm text-[var(--surface-muted)]">
                {formatCurrency(cashFlow.summary.receivables_within_horizon)} forecast inside the current horizon
              </p>
            </div>
            <div className="rounded-[var(--radius)] border border-[color:var(--line)] bg-white/75 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--surface-faint)]">
                Payable pipeline
              </p>
              <p className="mt-3 text-3xl font-semibold text-[var(--surface-ink)]">
                {formatCurrency(cashFlow.summary.total_payable_pipeline)}
              </p>
              <p className="mt-2 text-sm text-[var(--surface-muted)]">
                {formatCurrency(cashFlow.summary.payables_within_horizon)} expected to leave within eight weeks
              </p>
            </div>
            <div className="rounded-[var(--radius)] border border-[color:var(--line)] bg-white/75 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--surface-faint)]">
                Projected net flow
              </p>
              <p
                className={`mt-3 text-3xl font-semibold ${
                  cashFlow.summary.projected_net_flow < 0 ? 'text-[var(--danger)]' : 'text-emerald-700'
                }`}
              >
                {formatCurrency(cashFlow.summary.projected_net_flow)}
              </p>
              <p className="mt-2 text-sm text-[var(--surface-muted)]">
                Receivables minus payables across the current forecast horizon
              </p>
            </div>
            <div className="rounded-[var(--radius)] border border-[color:var(--line)] bg-white/75 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--surface-faint)]">
                Peak deficit
              </p>
              <p
                className={`mt-3 text-3xl font-semibold ${
                  cashFlow.summary.projected_peak_deficit < 0
                    ? 'text-[var(--danger)]'
                    : 'text-[var(--surface-ink)]'
                }`}
              >
                {formatCurrency(cashFlow.summary.projected_peak_deficit)}
              </p>
              <p className="mt-2 text-sm text-[var(--surface-muted)]">
                Lowest cumulative net position before later inflows catch up
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-[var(--radius)] border border-[color:var(--line)] bg-white/80 p-4">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="text-lg font-semibold text-[var(--surface-ink)]">Week-wise liquidity view</h4>
                  <p className="mt-1 text-sm text-[var(--surface-muted)]">
                    Bars show inflows/outflows; the line shows cumulative net movement from today forward.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="success">{formatCurrency(cashFlow.summary.overdue_receivables)} overdue inflow</Badge>
                  <Badge tone="warning">{formatCurrency(cashFlow.summary.overdue_payables)} overdue outflow</Badge>
                </div>
              </div>
              {cashFlow.buckets.some(
                (bucket) => bucket.receivable_amount > 0 || bucket.payable_amount > 0 || bucket.cumulative_net_amount !== 0,
              ) ? (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={cashFlow.buckets} margin={{ top: 10, right: 0, left: -18, bottom: 0 }}>
                      <CartesianGrid stroke="rgba(104, 83, 47, 0.14)" vertical={false} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} />
                      <YAxis tickFormatter={(value) => formatCompactNumber(Number(value))} tickLine={false} axisLine={false} />
                      <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0))} />
                      <Legend />
                      <Bar dataKey="receivable_amount" name="Receivables" fill="#059669" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="payable_amount" name="Payments" fill="#d97706" radius={[6, 6, 0, 0]} />
                      <Line
                        type="monotone"
                        dataKey="cumulative_net_amount"
                        name="Cumulative net"
                        stroke="#7c2d12"
                        strokeWidth={3}
                        dot={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState
                  title="No cash movement in the current horizon"
                  description="Approved receivables and pending payments will appear here as soon as the pipeline starts filling."
                />
              )}
            </div>

            <div className="space-y-6">
              <div className="rounded-[var(--radius)] border border-[color:var(--line)] bg-white/80 p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-lg font-semibold text-[var(--surface-ink)]">Forecast receivables</h4>
                    <p className="mt-1 text-sm text-[var(--surface-muted)]">
                      Highest value collections expected in the next eight weeks.
                    </p>
                  </div>
                  <Link className={buttonVariants({ variant: 'ghost', size: 'sm' })} to="/ra-bills">
                    Open RA bills
                  </Link>
                </div>
                <div className="space-y-3">
                  {cashFlow.upcoming_receivables.length === 0 ? (
                    <EmptyState
                      title="No receivables forecast"
                      description="Approved and partially paid RA bills will appear here once they have collectible balance."
                    />
                  ) : (
                    cashFlow.upcoming_receivables.map((row) => (
                      <div
                        key={row.bill_id}
                        className="rounded-[var(--radius)] border border-[color:var(--line)] bg-white/75 p-4"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-semibold text-[var(--surface-ink)]">
                              Bill #{row.bill_no} /{' '}
                              <Link
                                className="text-[var(--accent-strong)] underline-offset-4 hover:underline"
                                to="/reports/contracts/$contractId"
                                params={{ contractId: String(row.contract_id) }}
                              >
                                {row.contract_no}
                              </Link>
                            </p>
                            <p className="text-sm text-[var(--surface-muted)]">{row.project_name}</p>
                          </div>
                          <Badge tone={row.is_overdue ? 'danger' : 'success'}>
                            {row.is_overdue ? 'Overdue' : 'Planned'}
                          </Badge>
                        </div>
                        <div className="mt-3 grid gap-2 text-sm text-[var(--surface-muted)] md:grid-cols-2">
                          <p>
                            Forecast:{' '}
                            <span className="font-semibold text-[var(--surface-ink)]">{formatDate(row.forecast_date)}</span>
                          </p>
                          <p>
                            Outstanding:{' '}
                            <span className="font-semibold text-[var(--surface-ink)]">
                              {formatCurrency(row.outstanding_amount)}
                            </span>
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-[var(--radius)] border border-[color:var(--line)] bg-white/80 p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-lg font-semibold text-[var(--surface-ink)]">Forecast payments</h4>
                    <p className="mt-1 text-sm text-[var(--surface-muted)]">
                      Due and overdue cash-out commitments that treasury needs to stage.
                    </p>
                  </div>
                  <Link className={buttonVariants({ variant: 'ghost', size: 'sm' })} to="/payments">
                    Open payments
                  </Link>
                </div>
                <div className="space-y-3">
                  {cashFlow.upcoming_payments.length === 0 ? (
                    <EmptyState
                      title="No outgoing forecast"
                      description="Draft and approved payments will appear here once finance starts staging releases."
                    />
                  ) : (
                    cashFlow.upcoming_payments.map((row) => (
                      <div
                        key={row.payment_id}
                        className="rounded-[var(--radius)] border border-[color:var(--line)] bg-white/75 p-4"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-semibold text-[var(--surface-ink)]">
                              <Link
                                className="text-[var(--accent-strong)] underline-offset-4 hover:underline"
                                to="/reports/contracts/$contractId"
                                params={{ contractId: String(row.contract_id) }}
                              >
                                {row.contract_no}
                              </Link>
                            </p>
                            <p className="text-sm text-[var(--surface-muted)]">{row.project_name}</p>
                          </div>
                          <Badge tone={row.is_overdue ? 'danger' : 'warning'}>
                            {row.is_overdue ? 'Overdue' : titleCase(row.status)}
                          </Badge>
                        </div>
                        <div className="mt-3 grid gap-2 text-sm text-[var(--surface-muted)] md:grid-cols-2">
                          <p>
                            Forecast:{' '}
                            <span className="font-semibold text-[var(--surface-ink)]">{formatDate(row.forecast_date)}</span>
                          </p>
                          <p>
                            Pending:{' '}
                            <span className="font-semibold text-[var(--surface-ink)]">{formatCurrency(row.pending_amount)}</span>
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-2xl text-[var(--surface-ink)]">Material consumption control</h3>
              <p className="mt-1 text-sm text-[var(--surface-muted)]">
                Approved demand, actual issue movement, and stock-loss leakage by project and material.
              </p>
            </div>
            <Badge tone="warning">Phase 4.4</Badge>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[var(--radius)] border border-[color:var(--line)] bg-white/75 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--surface-faint)]">Required qty</p>
              <p className="mt-3 text-3xl font-semibold text-[var(--surface-ink)]">
                {formatDecimal(materialReport.summary.total_required_qty)}
              </p>
              <p className="mt-2 text-sm text-[var(--surface-muted)]">
                Estimated value {formatCurrency(materialReport.summary.total_required_amount)}
              </p>
            </div>
            <div className="rounded-[var(--radius)] border border-[color:var(--line)] bg-white/75 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--surface-faint)]">Issued qty</p>
              <p className="mt-3 text-3xl font-semibold text-[var(--surface-ink)]">
                {formatDecimal(materialReport.summary.total_issued_qty)}
              </p>
              <p className="mt-2 text-sm text-[var(--surface-muted)]">
                Actual value {formatCurrency(materialReport.summary.total_issued_amount)}
              </p>
            </div>
            <div className="rounded-[var(--radius)] border border-[color:var(--line)] bg-white/75 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--surface-faint)]">Wastage qty</p>
              <p className="mt-3 text-3xl font-semibold text-[var(--danger)]">
                {formatDecimal(materialReport.summary.total_wastage_qty)}
              </p>
              <p className="mt-2 text-sm text-[var(--surface-muted)]">
                Leakage {formatDecimal(materialReport.summary.overall_wastage_pct)}% of issued quantity
              </p>
            </div>
            <div className="rounded-[var(--radius)] border border-[color:var(--line)] bg-white/75 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--surface-faint)]">Open demand</p>
              <p className="mt-3 text-3xl font-semibold text-[var(--surface-ink)]">
                {formatDecimal(materialReport.summary.total_balance_to_issue_qty)}
              </p>
              <p className="mt-2 text-sm text-[var(--surface-muted)]">
                Excess issue {formatDecimal(materialReport.summary.total_excess_issue_qty)}
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="rounded-[var(--radius)] border border-[color:var(--line)] bg-white/80 p-4">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="text-lg font-semibold text-[var(--surface-ink)]">Top wastage projects</h4>
                  <p className="mt-1 text-sm text-[var(--surface-muted)]">
                    Highest material loss pockets in the current reporting slice.
                  </p>
                </div>
                <Link className={buttonVariants({ variant: 'ghost', size: 'sm' })} to="/materials/adjustments">
                  Stock adjustments
                </Link>
              </div>
              {materialConsumptionChartData.length === 0 ? (
                <EmptyState
                  title="No material movement yet"
                  description="Approved requisitions, issues, and posted wastage adjustments will light up this view."
                />
              ) : (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={materialConsumptionChartData} margin={{ top: 10, right: 0, left: -18, bottom: 0 }}>
                      <CartesianGrid stroke="rgba(104, 83, 47, 0.14)" vertical={false} />
                      <XAxis dataKey="project_name" tickLine={false} axisLine={false} interval={0} angle={-12} height={74} />
                      <YAxis tickFormatter={(value) => formatCompactNumber(Number(value))} tickLine={false} axisLine={false} />
                      <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0))} />
                      <Bar dataKey="required_amount" name="Required" fill="#f2d49a" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="issued_amount" name="Issued" fill="#d97706" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="wastage_amount" name="Wastage" fill="#c2410c" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="rounded-[var(--radius)] border border-[color:var(--line)] bg-white/80 p-4">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="text-lg font-semibold text-[var(--surface-ink)]">Leakage watchlist</h4>
                  <p className="mt-1 text-sm text-[var(--surface-muted)]">
                    Project-material combinations needing tighter issue discipline or adjustment review.
                  </p>
                </div>
                <Link className={buttonVariants({ variant: 'ghost', size: 'sm' })} to="/materials/issues">
                  Material issues
                </Link>
              </div>
              <div className="space-y-3">
                {materialWatchlist.length === 0 ? (
                  <EmptyState
                    title="No leakage watchlist"
                    description="Once issue and wastage data appears, the highest-risk material rows will show up here."
                  />
                ) : (
                  materialWatchlist.map((row) => (
                    <div
                      key={`${row.project_id}-${row.material_id}`}
                      className="rounded-[var(--radius)] border border-[color:var(--line)] bg-white/75 p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-semibold text-[var(--surface-ink)]">{row.material_name}</p>
                          <p className="text-sm text-[var(--surface-muted)]">{row.project_name}</p>
                        </div>
                        <Badge tone={row.wastage_amount > 0 ? 'danger' : 'warning'}>
                          {formatCurrency(row.wastage_amount)}
                        </Badge>
                      </div>
                      <div className="mt-3 grid gap-2 text-sm text-[var(--surface-muted)] md:grid-cols-2">
                        <p>
                          Required:{' '}
                          <span className="font-semibold text-[var(--surface-ink)]">{formatDecimal(row.required_qty)}</span>
                        </p>
                        <p>
                          Issued:{' '}
                          <span className="font-semibold text-[var(--surface-ink)]">{formatDecimal(row.issued_qty)}</span>
                        </p>
                        <p>
                          Wastage:{' '}
                          <span className="font-semibold text-[var(--surface-ink)]">{formatDecimal(row.wastage_qty)}</span>
                        </p>
                        <p>
                          Coverage:{' '}
                          <span className="font-semibold text-[var(--surface-ink)]">{formatDecimal(row.issue_coverage_pct)}%</span>
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </Card>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-2xl text-[var(--surface-ink)]">Material consumption report</h3>
              <p className="mt-1 text-sm text-[var(--surface-muted)]">
                Required vs issued vs wastage by project and material, with coverage and excess issue visibility.
              </p>
            </div>
            <Badge tone="warning">Phase 4.4</Badge>
          </div>
          <DataTable
            columns={materialColumns}
            rows={materialRows}
            rowKey={(row) => `${row.project_id}-${row.material_id}`}
            loading={materialConsumptionQuery.isFetching}
            paginationMode="server"
            page={materialPage}
            pageSize={materialPageSize}
            totalRows={materialTotal}
            onPageChange={setMaterialPage}
            onPageSizeChange={setMaterialPageSize}
            sortingMode="server"
            sortId={materialSort.id}
            sortDir={materialSort.direction}
            onSortChange={(sort) => {
              if (!sort) return;
              setMaterialSort(sort);
            }}
            onExport={async () => {
              await materialExportMutation.mutateAsync();
            }}
            exporting={materialExportMutation.isPending}
            stickyHeader
            manageColumns
            resizableColumns
            maxHeight="760px"
            emptyState={
              <EmptyState
                title="No material consumption in this slice"
                description="Approved requisitions, issued notes, and posted stock losses will populate this report."
              />
            }
          />
        </div>

        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-2xl text-[var(--surface-ink)]">Labour productivity dashboard</h3>
              <p className="mt-1 text-sm text-[var(--surface-muted)]">
                Trade and unit benchmark tracking for the last 8 weeks against the preceding 12 weeks.
              </p>
            </div>
            <Badge tone="warning">Phase 4.5</Badge>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Crew Days"
              value={formatDecimal(labourReport.summary.crew_days_logged)}
              caption={`Logged from ${formatDate(labourReport.summary.current_period_start)} to ${formatDate(labourReport.summary.current_period_end)}`}
              icon={HardHat}
              tone="accent"
            />
            <StatCard
              label="Records"
              value={formatDecimal(labourReport.summary.records_logged)}
              caption="Recent productivity logs in the current reporting window"
              icon={ReceiptText}
              tone="info"
            />
            <StatCard
              label="Trade Groups"
              value={formatDecimal(labourReport.summary.active_trade_groups)}
              caption={`${formatDecimal(labourReport.summary.projects_covered)} projects with active productivity data`}
              icon={BarChart3}
              tone="success"
            />
            <StatCard
              label="Benchmark Hit"
              value={`${formatDecimal(labourReport.summary.benchmark_hit_rate_pct)}%`}
              caption={`${formatDecimal(labourReport.summary.below_benchmark_groups)} trade groups below benchmark`}
              icon={TrendingUp}
              tone="info"
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <Card className="p-6">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="text-lg font-semibold text-[var(--surface-ink)]">Benchmark index by trade</h4>
                  <p className="mt-1 text-sm text-[var(--surface-muted)]">
                    An index of 100 means the same trade and unit are matching their prior 12-week benchmark.
                  </p>
                </div>
                <Badge tone="accent">
                  {formatDate(labourReport.summary.benchmark_period_start)} - {formatDate(labourReport.summary.current_period_end)}
                </Badge>
              </div>
              {labourBenchmarkChartData.length === 0 ? (
                <EmptyState
                  title="No productivity benchmark yet"
                  description="Recent labour logs will light up this dashboard as soon as trades start getting recorded."
                />
              ) : (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={labourBenchmarkChartData} margin={{ top: 10, right: 0, left: -18, bottom: 0 }}>
                      <CartesianGrid stroke="rgba(104, 83, 47, 0.14)" vertical={false} />
                      <XAxis dataKey="trade_label" tickLine={false} axisLine={false} interval={0} angle={-12} height={90} />
                      <YAxis tickFormatter={(value) => `${formatDecimal(Number(value))}`} tickLine={false} axisLine={false} />
                      <Tooltip formatter={(value) => `${formatDecimal(Number(value ?? 0))} index`} />
                      <Legend />
                      <Bar dataKey="benchmark_index" name="Benchmark" fill="#f2d49a" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="current_index" name="Current" fill="#d97706" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            <Card className="p-6">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-lg font-semibold text-[var(--surface-ink)]">Under-benchmark watchlist</h4>
                  <p className="mt-1 text-sm text-[var(--surface-muted)]">
                    Highest-risk trade and unit pockets where current productivity is trailing the recent benchmark.
                  </p>
                </div>
                <Link className={buttonVariants({ variant: 'ghost', size: 'sm' })} to="/labour/productivity">
                  Open productivity log
                </Link>
              </div>
              <div className="space-y-3">
                {labourWatchlist.length === 0 ? (
                  <EmptyState
                    title="No under-benchmark trade groups"
                    description="Current filters are not surfacing any trade-unit combinations more than 10% below benchmark."
                  />
                ) : (
                  labourWatchlist.map((row) => (
                    <div
                      key={`${row.trade}-${row.unit}`}
                      className="rounded-[var(--radius)] border border-[color:var(--line)] bg-white/75 p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-semibold text-[var(--surface-ink)]">{titleCase(row.trade)}</p>
                          <p className="text-sm text-[var(--surface-muted)]">{row.unit} output / crew day</p>
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <Badge tone={getLabourBenchmarkTone(row.benchmark_status)}>
                            {titleCase(row.benchmark_status)}
                          </Badge>
                          <Badge tone={getLabourTrendTone(row.output_trend_status)}>
                            {titleCase(row.output_trend_status)}
                          </Badge>
                        </div>
                      </div>
                      <div className="mt-3 grid gap-2 text-sm text-[var(--surface-muted)] md:grid-cols-2">
                        <p>
                          Current output:{' '}
                          <span className="font-semibold text-[var(--surface-ink)]">
                            {formatDecimal(row.recent_output_qty)} {row.unit}
                          </span>
                        </p>
                        <p>
                          Prior output:{' '}
                          <span className="font-semibold text-[var(--surface-ink)]">
                            {formatDecimal(row.prior_output_qty)} {row.unit}
                          </span>
                        </p>
                        <p>
                          Current productivity:{' '}
                          <span className="font-semibold text-[var(--surface-ink)]">
                            {formatDecimal(row.recent_productivity)} {row.unit}/crew day
                          </span>
                        </p>
                        <p>
                          Benchmark:{' '}
                          <span className="font-semibold text-[var(--surface-ink)]">
                            {formatDecimal(row.benchmark_productivity)} {row.unit}/crew day
                          </span>
                        </p>
                        <p>
                          Gap:{' '}
                          <span className="font-semibold text-[var(--danger)]">
                            {formatDecimal(row.productivity_gap_pct)}%
                          </span>
                        </p>
                        <p>
                          Last logged:{' '}
                          <span className="font-semibold text-[var(--surface-ink)]">
                            {row.last_entry_date ? formatDate(row.last_entry_date) : '-'}
                          </span>
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-2xl text-[var(--surface-ink)]">Labour productivity benchmark report</h3>
                <p className="mt-1 text-sm text-[var(--surface-muted)]">
                  Trade and unit productivity with recent output movement, benchmark gap, and crew-day concentration.
                </p>
              </div>
              <Badge tone="warning">Phase 4.5</Badge>
            </div>
            <DataTable
              columns={labourColumns}
              rows={labourRows}
              rowKey={(row) => `${row.trade}-${row.unit}`}
              loading={labourProductivityQuery.isFetching}
              paginationMode="server"
              page={labourPage}
              pageSize={labourPageSize}
              totalRows={labourTotal}
              onPageChange={setLabourPage}
              onPageSizeChange={setLabourPageSize}
              sortingMode="server"
              sortId={labourSort.id}
              sortDir={labourSort.direction}
              onSortChange={(sort) => {
                if (!sort) return;
                setLabourSort(sort);
              }}
              onExport={async () => {
                await labourExportMutation.mutateAsync();
              }}
              exporting={labourExportMutation.isPending}
              stickyHeader
              manageColumns
              resizableColumns
              maxHeight="760px"
              emptyState={
                <EmptyState
                  title="No labour productivity in this slice"
                  description="Log trade output with labour count and unit on the productivity page to populate this report."
                />
              }
            />
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Card className="p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="text-2xl text-[var(--surface-ink)]">Budget vs actual leaders</h3>
                <p className="mt-1 text-sm text-[var(--surface-muted)]">
                  Highest utilization projects from the current reporting slice.
                </p>
              </div>
              <Badge tone="info">Phase 4.1</Badge>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={utilizationChartData} margin={{ top: 10, right: 0, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(104, 83, 47, 0.14)" vertical={false} />
                  <XAxis dataKey="project_name" tickLine={false} axisLine={false} interval={0} angle={-12} height={70} />
                  <YAxis tickFormatter={(value) => formatCompactNumber(Number(value))} tickLine={false} axisLine={false} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0))} />
                  <Bar dataKey="budget_amount" fill="#f2d49a" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="actual_cost_amount" fill="#d97706" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="space-y-6">
            <Card className="p-6">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h3 className="text-2xl text-[var(--surface-ink)]">Variance watchlist</h3>
                  <p className="mt-1 text-sm text-[var(--surface-muted)]">
                    Projects already past budget on realized cost.
                  </p>
                </div>
                <Badge tone="warning">Top overruns</Badge>
              </div>
              <div className="space-y-3">
                {varianceWatchlist.length === 0 ? (
                  <EmptyState
                    title="No overruns in this slice"
                    description="Current filters are not showing any projects beyond realized budget."
                  />
                ) : (
                  varianceWatchlist.map((row) => (
                    <div
                      key={row.project_id}
                      className="rounded-[var(--radius)] border border-[color:var(--line)] bg-white/75 p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-semibold text-[var(--surface-ink)]">{row.project_name}</p>
                          <p className="text-xs uppercase tracking-[0.15em] text-[var(--surface-faint)]">
                            {row.company_name}
                          </p>
                        </div>
                        <Badge tone={getVarianceTone(row.actual_variance_amount)}>
                          {formatCurrency(row.actual_variance_amount)}
                        </Badge>
                      </div>
                      <div className="mt-3 grid gap-2 text-sm text-[var(--surface-muted)] md:grid-cols-2">
                        <p>
                          Budget: <span className="font-semibold text-[var(--surface-ink)]">{formatCurrency(row.budget_amount)}</span>
                        </p>
                        <p>
                          Actual: <span className="font-semibold text-[var(--surface-ink)]">{formatCurrency(row.actual_cost_amount)}</span>
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>

            <Card className="p-6">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h3 className="text-2xl text-[var(--surface-ink)]">Commercial exposure</h3>
                  <p className="mt-1 text-sm text-[var(--surface-muted)]">
                    Contracts with the highest outstanding payable.
                  </p>
                </div>
                <Badge tone="accent">Phase 4 start</Badge>
              </div>
              <div className="space-y-3">
                {finance.contract_wise_outstanding.slice(0, 5).map((item) => (
                  <div
                    key={item.contract_id}
                    className="rounded-[var(--radius)] border border-[color:var(--line)] bg-white/75 p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-[var(--surface-ink)]">{item.contract_title}</p>
                        <p className="text-xs uppercase tracking-[0.15em] text-[var(--surface-faint)]">
                          {item.project_name} /{' '}
                          <Link
                            className="text-[var(--accent-strong)] underline-offset-4 hover:underline"
                            to="/reports/contracts/$contractId"
                            params={{ contractId: String(item.contract_id) }}
                          >
                            {item.contract_no}
                          </Link>
                        </p>
                      </div>
                      <Badge tone="warning">{formatCurrency(item.outstanding_amount)}</Badge>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-[var(--surface-muted)] md:grid-cols-2">
                      <p>
                        Billed: <span className="font-semibold text-[var(--surface-ink)]">{formatCurrency(item.billed_amount)}</span>
                      </p>
                      <p>
                        Paid: <span className="font-semibold text-[var(--surface-ink)]">{formatCurrency(item.paid_amount)}</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-2xl text-[var(--surface-ink)]">Project cost report</h3>
              <p className="mt-1 text-sm text-[var(--surface-muted)]">
                Budget, committed, and realized cost variance by project.
              </p>
            </div>
            <Badge tone="info">Phase 4.1 baseline</Badge>
          </div>
          <DataTable
            columns={costColumns}
            rows={costRows}
            rowKey={(row) => row.project_id}
            loading={projectCostQuery.isFetching}
            paginationMode="server"
            page={tablePage}
            pageSize={tablePageSize}
            totalRows={costTotal}
            onPageChange={setTablePage}
            onPageSizeChange={setTablePageSize}
            sortingMode="server"
            sortId={tableSort.id}
            sortDir={tableSort.direction}
            onSortChange={(sort) => {
              if (!sort) return;
              setTableSort(sort);
            }}
            onExport={async () => {
              await projectExportMutation.mutateAsync();
            }}
            exporting={projectExportMutation.isPending}
            stickyHeader
            manageColumns
            resizableColumns
            maxHeight="760px"
            emptyState={
              <EmptyState
                title="No projects in this report"
                description="Widen the filters or add more operational data to generate management insight."
              />
            }
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <Card className="p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-2xl text-[var(--surface-ink)]">Contract headroom pressure</h3>
                <p className="mt-1 text-sm text-[var(--surface-muted)]">
                  Lowest remaining commercial headroom from the filtered contract slice.
                </p>
              </div>
              <Badge tone="warning">Phase 4.2</Badge>
            </div>
            {contractHeadroomChartData.length === 0 ? (
              <EmptyState
                title="No contract commercials yet"
                description="Add contract billing, payment, material, or labour activity to unlock P&amp;L tracking."
              />
            ) : (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={contractHeadroomChartData} margin={{ top: 10, right: 0, left: -18, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(104, 83, 47, 0.14)" vertical={false} />
                    <XAxis dataKey="contract_no" tickLine={false} axisLine={false} interval={0} angle={-12} height={72} />
                    <YAxis tickFormatter={(value) => formatCompactNumber(Number(value))} tickLine={false} axisLine={false} />
                    <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0))} />
                    <Bar dataKey="contract_value" fill="#f2d49a" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="actual_cost_amount" fill="#92400e" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          <Card className="p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-2xl text-[var(--surface-ink)]">Retention review queue</h3>
                <p className="mt-1 text-sm text-[var(--surface-muted)]">
                  Contracts holding the highest retention so finance can plan release checks.
                </p>
              </div>
              <Badge tone="success">Phase 4.7</Badge>
            </div>
            <div className="space-y-3">
              {retentionWatchlist.length === 0 ? (
                <EmptyState
                  title="No retention exposure"
                  description="Retention deductions will appear here as soon as RA bills start holding them back."
                />
              ) : (
                retentionWatchlist.map((row) => (
                  <div
                    key={row.contract_id}
                    className="rounded-[var(--radius)] border border-[color:var(--line)] bg-white/75 p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-[var(--surface-ink)]">
                          <Link
                            className="text-[var(--accent-strong)] underline-offset-4 hover:underline"
                            to="/reports/contracts/$contractId"
                            params={{ contractId: String(row.contract_id) }}
                          >
                            {row.contract_no}
                          </Link>
                        </p>
                        <p className="text-sm text-[var(--surface-muted)]">{row.project_name}</p>
                      </div>
                      <Badge tone={getRetentionStatusTone(row.release_status)}>{titleCase(row.release_status)}</Badge>
                    </div>
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-[var(--surface-muted)]">Held now</span>
                        <span className="font-semibold text-[var(--surface-ink)]">
                          {formatCurrency(row.outstanding_retention_amount)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-[var(--surface-muted)]">Cap coverage</span>
                        <span className="font-semibold text-[var(--surface-ink)]">{formatDecimal(row.progress_pct)}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-[color:var(--line)]">
                        <div
                          className="h-2 rounded-full bg-[var(--accent)]"
                          style={{ width: `${Math.max(0, Math.min(row.progress_pct, 100))}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        <Card className="p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-2xl text-[var(--surface-ink)]">Ageing analysis</h3>
              <p className="mt-1 text-sm text-[var(--surface-muted)]">
                Overdue receivables and pending payment exposure grouped into management buckets.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                className={buttonVariants({ variant: 'secondary', size: 'sm' })}
                disabled={ageingExportMutation.isPending}
                onClick={() => ageingExportMutation.mutate()}
              >
                {ageingExportMutation.isPending ? 'Exporting…' : 'Export CSV'}
              </button>
              <Badge tone="warning">Phase 4.6</Badge>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h4 className="text-lg font-semibold text-[var(--surface-ink)]">Outstanding RA bills</h4>
                <Link className={buttonVariants({ variant: 'ghost', size: 'sm' })} to="/ra-bills">
                  Open RA bills
                </Link>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                {ageing.ra_bill_buckets.map((bucket) => (
                  <div
                    key={bucket.bucket}
                    className="rounded-[var(--radius)] border border-[color:var(--line)] bg-white/80 p-4"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--surface-faint)]">
                      {bucket.label}
                    </p>
                    <p className="mt-3 text-2xl text-[var(--surface-ink)]">{formatCurrency(bucket.amount)}</p>
                    <p className="mt-1 text-sm text-[var(--surface-muted)]">{bucket.count} bills</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h4 className="text-lg font-semibold text-[var(--surface-ink)]">Pending payments overdue</h4>
                <Link className={buttonVariants({ variant: 'ghost', size: 'sm' })} to="/payments">
                  Open payments
                </Link>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                {ageing.payment_buckets.map((bucket) => (
                  <div
                    key={bucket.bucket}
                    className="rounded-[var(--radius)] border border-[color:var(--line)] bg-white/80 p-4"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--surface-faint)]">
                      {bucket.label}
                    </p>
                    <p className="mt-3 text-2xl text-[var(--surface-ink)]">{formatCurrency(bucket.amount)}</p>
                    <p className="mt-1 text-sm text-[var(--surface-muted)]">{bucket.count} payments</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-2xl text-[var(--surface-ink)]">Oldest overdue RA bills</h3>
                <p className="mt-1 text-sm text-[var(--surface-muted)]">
                  Prioritize collection follow-ups from the oldest unpaid certified bills.
                </p>
              </div>
              <Link className={buttonVariants({ variant: 'secondary', size: 'sm' })} to="/ra-bills">
                Review bills
              </Link>
            </div>
            <div className="space-y-3">
              {ageing.overdue_ra_bills.length === 0 ? (
                <EmptyState
                  title="No overdue RA bills"
                  description="Approved and partially paid bills with balances will appear here automatically."
                />
              ) : (
                ageing.overdue_ra_bills.map((row) => (
                  <div
                    key={row.bill_id}
                    className="rounded-[var(--radius)] border border-[color:var(--line)] bg-white/75 p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-[var(--surface-ink)]">
                          Bill #{row.bill_no} /{' '}
                          <Link
                            className="text-[var(--accent-strong)] underline-offset-4 hover:underline"
                            to="/reports/contracts/$contractId"
                            params={{ contractId: String(row.contract_id) }}
                          >
                            {row.contract_no}
                          </Link>
                        </p>
                        <p className="text-sm text-[var(--surface-muted)]">{row.project_name}</p>
                      </div>
                      <Badge tone="danger">{row.age_days} days</Badge>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-[var(--surface-muted)] md:grid-cols-2">
                      <p>
                        Outstanding:{' '}
                        <span className="font-semibold text-[var(--surface-ink)]">
                          {formatCurrency(row.outstanding_amount)}
                        </span>
                      </p>
                      <p>
                        Bill date:{' '}
                        <span className="font-semibold text-[var(--surface-ink)]">{formatDate(row.bill_date)}</span>
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card className="p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-2xl text-[var(--surface-ink)]">Oldest pending payments</h3>
                <p className="mt-1 text-sm text-[var(--surface-muted)]">
                  Payment commitments already past due date and waiting for release.
                </p>
              </div>
              <Link className={buttonVariants({ variant: 'secondary', size: 'sm' })} to="/payments">
                Review queue
              </Link>
            </div>
            <div className="space-y-3">
              {ageing.overdue_payments.length === 0 ? (
                <EmptyState
                  title="No overdue payments"
                  description="Draft and approved payments older than today will show up here for treasury review."
                />
              ) : (
                ageing.overdue_payments.map((row) => (
                  <div
                    key={row.payment_id}
                    className="rounded-[var(--radius)] border border-[color:var(--line)] bg-white/75 p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-[var(--surface-ink)]">
                          <Link
                            className="text-[var(--accent-strong)] underline-offset-4 hover:underline"
                            to="/reports/contracts/$contractId"
                            params={{ contractId: String(row.contract_id) }}
                          >
                            {row.contract_no}
                          </Link>
                        </p>
                        <p className="text-sm text-[var(--surface-muted)]">{row.project_name}</p>
                      </div>
                      <Badge tone="warning">{row.age_days} days</Badge>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-[var(--surface-muted)] md:grid-cols-2">
                      <p>
                        Pending:{' '}
                        <span className="font-semibold text-[var(--surface-ink)]">{formatCurrency(row.pending_amount)}</span>
                      </p>
                      <p>
                        Due date:{' '}
                        <span className="font-semibold text-[var(--surface-ink)]">{formatDate(row.payment_date)}</span>
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-2xl text-[var(--surface-ink)]">Contract-wise P&amp;L</h3>
              <p className="mt-1 text-sm text-[var(--surface-muted)]">
                Revenue, cost, margin, and payable pressure per contract with sortable commercial headroom.
              </p>
            </div>
            <Badge tone="warning">Phase 4.2</Badge>
          </div>
          <DataTable
            columns={contractColumns}
            rows={contractRows}
            rowKey={(row) => row.contract_id}
            loading={contractCommercialQuery.isFetching}
            paginationMode="server"
            page={contractPage}
            pageSize={contractPageSize}
            totalRows={contractTotal}
            onPageChange={setContractPage}
            onPageSizeChange={setContractPageSize}
            sortingMode="server"
            sortId={contractSort.id}
            sortDir={contractSort.direction}
            onSortChange={(sort) => {
              if (!sort) return;
              setContractSort(sort);
            }}
            onExport={async () => {
              await contractExportMutation.mutateAsync();
            }}
            exporting={contractExportMutation.isPending}
            stickyHeader
            manageColumns
            resizableColumns
            maxHeight="760px"
            emptyState={
              <EmptyState
                title="No contracts in this commercial slice"
                description="Populate contract billing, payments, material issues, and labour bills to unlock contract P&amp;L."
              />
            }
          />
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-2xl text-[var(--surface-ink)]">Retention tracking</h3>
              <p className="mt-1 text-sm text-[var(--surface-muted)]">
                Held retention, cap coverage, and upcoming release review dates per contract.
              </p>
            </div>
            <Badge tone="success">Phase 4.7</Badge>
          </div>
          <DataTable
            columns={retentionColumns}
            rows={retentionRows}
            rowKey={(row) => row.contract_id}
            loading={retentionQuery.isFetching}
            paginationMode="server"
            page={retentionPage}
            pageSize={retentionPageSize}
            totalRows={retentionTotal}
            onPageChange={setRetentionPage}
            onPageSizeChange={setRetentionPageSize}
            sortingMode="server"
            sortId={retentionSort.id}
            sortDir={retentionSort.direction}
            onSortChange={(sort) => {
              if (!sort) return;
              setRetentionSort(sort);
            }}
            onExport={async () => {
              await retentionExportMutation.mutateAsync();
            }}
            exporting={retentionExportMutation.isPending}
            stickyHeader
            manageColumns
            resizableColumns
            maxHeight="760px"
            emptyState={
              <EmptyState
                title="No retention data in this slice"
                description="Once RA bill deductions start capturing retention, release planning will appear here."
              />
            }
          />
        </div>

        {/* ── WBS (Work Breakdown Structure) — Phase 4.9 ───────── */}
        <Card className="p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-2xl text-[var(--surface-ink)]">
                <Layers className="mr-2 inline-block size-6" />
                WBS — Work breakdown structure
              </h3>
              <p className="mt-1 text-sm text-[var(--surface-muted)]">
                Hierarchical BOQ structure with % completion per category. Track remaining work and billed progress across
                contracts.
              </p>
            </div>
            <Badge tone="info">Phase 4.9</Badge>
          </div>

          {wbsReport?.summary && (
            <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <StatCard
                label="BOQ value"
                value={formatCurrency(wbsReport.summary.total_boq_amount)}
                caption={`${wbsReport.summary.total_items} items across ${wbsReport.summary.contracts_covered} contracts`}
                icon={Layers}
                tone="info"
              />
              <StatCard
                label="Work done"
                value={formatCurrency(wbsReport.summary.total_work_done_amount)}
                caption={`${wbsReport.summary.overall_completion_pct}% complete`}
                icon={TrendingUp}
                tone="success"
              />
              <StatCard
                label="Billed"
                value={formatCurrency(wbsReport.summary.total_billed_amount)}
                caption={`${wbsReport.summary.projects_covered} projects covered`}
                icon={ReceiptText}
                tone="accent"
              />
              <StatCard
                label="Remaining"
                value={formatCurrency(wbsReport.summary.total_remaining_amount)}
                caption="Balance work value"
                icon={AlertTriangle}
                tone="accent"
              />
              <StatCard
                label="Categories"
                value={String(wbsReport.summary.categories_count)}
                caption="BOQ category groups"
                icon={BarChart3}
                tone="success"
              />
            </div>
          )}

          {wbsCategoryRollup.length > 0 && (
            <div className="mb-6">
              <h4 className="mb-3 text-lg font-semibold text-[var(--surface-ink)]">Category-wise completion</h4>
              <div className="space-y-2">
                {wbsCategoryRollup.map((cat) => (
                  <div
                    key={cat.category}
                    className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 rounded-[var(--radius)] border border-[color:var(--line)] bg-white/75 px-4 py-3"
                  >
                    <div>
                      <p className="font-semibold text-[var(--surface-ink)]">{cat.category}</p>
                      <p className="text-xs text-[var(--surface-muted)]">{cat.item_count} items</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-[var(--surface-muted)]">BOQ</p>
                      <p className="font-semibold text-[var(--surface-ink)]">{formatCurrency(cat.boq_amount)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-[var(--surface-muted)]">Remaining</p>
                      <p className="font-semibold text-[var(--surface-ink)]">{formatCurrency(cat.remaining_amount)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-200">
                        <div
                          className={`h-full rounded-full ${
                            cat.completion_pct >= 100
                              ? 'bg-emerald-500'
                              : cat.completion_pct >= 50
                                ? 'bg-amber-400'
                                : 'bg-red-400'
                          }`}
                          style={{ width: `${Math.min(cat.completion_pct, 100)}%` }}
                        />
                      </div>
                      <span className="min-w-[3rem] text-right text-sm font-semibold">{cat.completion_pct}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <DataTable
            columns={wbsColumns}
            rows={wbsRows}
            rowKey={(row) => row.boq_item_id}
            loading={wbsQuery.isFetching}
            paginationMode="server"
            page={wbsPage}
            pageSize={wbsPageSize}
            totalRows={wbsTotal}
            onPageChange={setWbsPage}
            onPageSizeChange={setWbsPageSize}
            sortingMode="server"
            sortId={wbsSort.id}
            sortDir={wbsSort.direction}
            onSortChange={(sort) => {
              if (!sort) return;
              setWbsSort(sort);
            }}
            onExport={async () => {
              await wbsExportMutation.mutateAsync();
            }}
            exporting={wbsExportMutation.isPending}
            stickyHeader
            manageColumns
            resizableColumns
            maxHeight="760px"
            emptyState={
              <EmptyState
                title="No BOQ data in this slice"
                description="Once BOQ items and work-done records are entered, the work breakdown structure will appear here."
              />
            }
          />
        </Card>
      </div>
    </PermissionGate>
  );
}
