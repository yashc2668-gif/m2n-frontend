export interface User {
  id: number;
  company_id: number | null;
  full_name: string;
  email: string;
  phone: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_expires_in: number;
  csrf_token: string;
  user: User;
}

export interface MessageResponse {
  message: string;
}

export interface DashboardStatusCount {
  status: string;
  count: number;
}

export interface MonthlyTrendPoint {
  month: string;
  amount: number;
}

export interface DeductionSummary {
  deduction_type: string;
  amount: number;
}

export interface ProjectFinanceSummary {
  project_id: number;
  project_name: string;
  project_code: string | null;
  billed_amount: number;
  paid_amount: number;
  outstanding_amount: number;
  contract_count: number;
  active_contract_count: number;
}

export interface ContractOutstanding {
  contract_id: number;
  project_id: number;
  project_name: string;
  contract_no: string;
  contract_title: string;
  status: string;
  billed_amount: number;
  paid_amount: number;
  outstanding_amount: number;
  secured_advance_outstanding: number;
}

export interface DashboardSummary {
  total_projects: number;
  active_contracts: number;
  total_billed_amount: number;
  total_paid_amount: number;
  outstanding_payable: number;
  secured_advance_outstanding: number;
  pending_ra_bills_by_status: DashboardStatusCount[];
  pending_payments_by_status: DashboardStatusCount[];
}

export interface DashboardFinance {
  total_billed_amount: number;
  total_paid_amount: number;
  outstanding_payable: number;
  secured_advance_outstanding: number;
  project_wise_finance_summary: ProjectFinanceSummary[];
  contract_wise_finance_summary: ContractOutstanding[];
  project_wise_billed_vs_paid: ProjectFinanceSummary[];
  contract_wise_outstanding: ContractOutstanding[];
  monthly_billing_trend: MonthlyTrendPoint[];
  monthly_payment_trend: MonthlyTrendPoint[];
  deductions_summary: DeductionSummary[];
  retention_outstanding_summary: {
    total_retention_deducted: number;
    outstanding_retention_amount: number;
    affected_bill_count: number;
    affected_contract_count: number;
  };
}

export interface ContractRecentRABill {
  bill_id: number;
  bill_no: number;
  bill_date: string;
  status: string;
  net_payable: number;
  paid_amount: number;
  outstanding_amount: number;
  retention_amount: number;
}

export interface ContractRecentPayment {
  payment_id: number;
  payment_date: string;
  status: string;
  amount: number;
  allocated_amount: number;
  available_amount: number;
  ra_bill_id: number | null;
  reference_no: string | null;
}

export interface ContractDashboard {
  contract_id: number;
  project_id: number;
  company_name: string;
  project_name: string;
  project_code: string | null;
  vendor_id: number;
  vendor_name: string;
  contract_no: string;
  contract_title: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  original_value: number;
  revised_value: number;
  retention_percentage: number;
  total_billed_amount: number;
  total_paid_amount: number;
  outstanding_payable: number;
  secured_advance_outstanding: number;
  material_cost_amount: number;
  labour_cost_amount: number;
  actual_cost_amount: number;
  commercial_headroom_amount: number;
  billed_margin_amount: number;
  headroom_pct: number;
  pending_ra_bills_by_status: DashboardStatusCount[];
  pending_payments_by_status: DashboardStatusCount[];
  monthly_billing_trend: MonthlyTrendPoint[];
  monthly_payment_trend: MonthlyTrendPoint[];
  deductions_summary: DeductionSummary[];
  retention_outstanding_amount: number;
  recent_ra_bills: ContractRecentRABill[];
  recent_payments: ContractRecentPayment[];
}

export interface ProjectCostReportRow {
  project_id: number;
  company_id: number;
  company_name: string;
  project_name: string;
  project_code: string | null;
  status: string;
  original_budget_amount: number;
  budget_amount: number;
  contract_count: number;
  active_contract_count: number;
  committed_amount: number;
  billed_cost_amount: number;
  paid_cost_amount: number;
  material_issued_amount: number;
  labour_billed_amount: number;
  actual_cost_amount: number;
  secured_advance_outstanding: number;
  actual_variance_amount: number;
  committed_variance_amount: number;
  actual_utilization_pct: number;
  committed_utilization_pct: number;
}

export interface ContractCommercialReportRow {
  contract_id: number;
  project_id: number;
  company_name: string;
  project_name: string;
  vendor_name: string;
  contract_no: string;
  contract_title: string;
  status: string;
  end_date: string | null;
  contract_value: number;
  billed_amount: number;
  paid_amount: number;
  material_cost_amount: number;
  labour_cost_amount: number;
  actual_cost_amount: number;
  outstanding_payable: number;
  retention_held_amount: number;
  secured_advance_outstanding: number;
  commercial_headroom_amount: number;
  billed_margin_amount: number;
  headroom_pct: number;
}

export interface AgeingBucket {
  bucket: string;
  label: string;
  count: number;
  amount: number;
}

export interface OutstandingRABillAgeingRow {
  bill_id: number;
  contract_id: number;
  project_name: string;
  contract_no: string;
  contract_title: string;
  bill_no: number;
  bill_date: string;
  status: string;
  outstanding_amount: number;
  age_days: number;
  bucket: string;
}

export interface PendingPaymentAgeingRow {
  payment_id: number;
  contract_id: number;
  project_name: string;
  contract_no: string;
  payment_date: string;
  status: string;
  pending_amount: number;
  age_days: number;
  bucket: string;
}

export interface AgeingAnalysis {
  ra_bill_buckets: AgeingBucket[];
  payment_buckets: AgeingBucket[];
  overdue_ra_bills: OutstandingRABillAgeingRow[];
  overdue_payments: PendingPaymentAgeingRow[];
}

export interface RetentionTrackingRow {
  contract_id: number;
  project_id: number;
  company_name: string;
  project_name: string;
  vendor_name: string;
  contract_no: string;
  contract_title: string;
  status: string;
  scheduled_release_date: string | null;
  retention_percentage: number;
  contract_value: number;
  billed_amount: number;
  estimated_retention_cap: number;
  total_retention_deducted: number;
  outstanding_retention_amount: number;
  progress_pct: number;
  release_status: string;
}

export interface CashFlowForecastSummary {
  total_receivable_pipeline: number;
  overdue_receivables: number;
  receivables_within_horizon: number;
  total_payable_pipeline: number;
  overdue_payables: number;
  payables_within_horizon: number;
  projected_net_flow: number;
  projected_peak_deficit: number;
  projected_peak_surplus: number;
}

export interface CashFlowBucket {
  bucket_start: string;
  bucket_end: string;
  label: string;
  receivable_amount: number;
  payable_amount: number;
  net_amount: number;
  cumulative_net_amount: number;
}

export interface CashFlowReceivableRow {
  bill_id: number;
  contract_id: number;
  project_name: string;
  contract_no: string;
  contract_title: string;
  bill_no: number;
  bill_date: string;
  forecast_date: string;
  status: string;
  outstanding_amount: number;
  is_overdue: boolean;
}

export interface CashFlowPaymentRow {
  payment_id: number;
  contract_id: number;
  project_name: string;
  contract_no: string;
  payment_date: string;
  forecast_date: string;
  status: string;
  pending_amount: number;
  is_overdue: boolean;
}

export interface CashFlowForecast {
  summary: CashFlowForecastSummary;
  buckets: CashFlowBucket[];
  upcoming_receivables: CashFlowReceivableRow[];
  upcoming_payments: CashFlowPaymentRow[];
}

export interface MaterialConsumptionSummary {
  total_required_qty: number;
  total_issued_qty: number;
  total_wastage_qty: number;
  total_balance_to_issue_qty: number;
  total_excess_issue_qty: number;
  total_required_amount: number;
  total_issued_amount: number;
  total_wastage_amount: number;
  overall_wastage_pct: number;
}

export interface MaterialConsumptionProjectRollup {
  project_id: number;
  company_name: string;
  project_name: string;
  project_code: string | null;
  required_qty: number;
  issued_qty: number;
  wastage_qty: number;
  required_amount: number;
  issued_amount: number;
  wastage_amount: number;
}

export interface MaterialConsumptionReportRow {
  company_name: string;
  project_id: number;
  project_name: string;
  project_code: string | null;
  material_id: number;
  material_code: string;
  material_name: string;
  category: string | null;
  unit: string;
  requested_qty: number;
  required_qty: number;
  requisition_issued_qty: number;
  issued_qty: number;
  wastage_qty: number;
  balance_to_issue_qty: number;
  excess_issue_qty: number;
  issue_coverage_pct: number;
  wastage_pct: number;
  required_amount: number;
  issued_amount: number;
  wastage_amount: number;
}

export interface MaterialConsumptionReport {
  summary: MaterialConsumptionSummary;
  top_wastage_projects: MaterialConsumptionProjectRollup[];
  watchlist: MaterialConsumptionReportRow[];
  items: MaterialConsumptionReportRow[];
  total: number;
  page: number;
  limit: number;
}

export interface MISTrendPoint {
  month: string;
  label: string;
  billed_amount: number;
  released_amount: number;
  retention_amount: number;
  net_amount: number;
}

export interface MISStatusMix {
  status: string;
  count: number;
}

export interface MISOutstandingProject {
  project_id: number;
  project_name: string;
  project_code: string | null;
  status: string;
  billed_amount: number;
  released_amount: number;
  outstanding_amount: number;
  active_contract_count: number;
}

export interface MISMonthlySummary {
  current_month: string;
  current_month_label: string;
  previous_month: string;
  previous_month_label: string;
  project_count: number;
  active_project_count: number;
  active_contract_count: number;
  current_month_billed_amount: number;
  previous_month_billed_amount: number;
  current_month_released_amount: number;
  previous_month_released_amount: number;
  current_month_net_amount: number;
  previous_month_net_amount: number;
  payment_release_coverage_pct: number;
  outstanding_payable: number;
  overdue_vendor_bill_amount: number;
  overdue_pending_payment_amount: number;
  retention_held_amount: number;
  secured_advance_outstanding: number;
}

export interface MISSummaryReport {
  summary: MISMonthlySummary;
  monthly_trend: MISTrendPoint[];
  status_mix: MISStatusMix[];
  top_outstanding_projects: MISOutstandingProject[];
}

export interface LabourProductivitySummary {
  current_period_start: string;
  current_period_end: string;
  benchmark_period_start: string;
  benchmark_period_end: string;
  records_logged: number;
  crew_days_logged: number;
  active_trade_groups: number;
  projects_covered: number;
  below_benchmark_groups: number;
  benchmark_hit_rate_pct: number;
}

export interface LabourTradeProductivityRow {
  trade: string;
  unit: string;
  trade_label: string;
  record_count: number;
  project_count: number;
  contract_count: number;
  recent_output_qty: number;
  prior_output_qty: number;
  output_change_pct: number;
  recent_labour_count: number;
  benchmark_labour_count: number;
  recent_productivity: number;
  benchmark_productivity: number;
  productivity_gap: number;
  productivity_gap_pct: number;
  productivity_index: number;
  benchmark_status: string;
  output_trend_status: string;
  last_entry_date: string | null;
}

export interface LabourProductivityReport {
  summary: LabourProductivitySummary;
  benchmark_focus: LabourTradeProductivityRow[];
  watchlist: LabourTradeProductivityRow[];
  items: LabourTradeProductivityRow[];
  total: number;
  page: number;
  limit: number;
}

export interface Company {
  id: number;
  name: string;
  address: string | null;
  gst_number: string | null;
  pan_number: string | null;
  phone: string | null;
  email: string | null;
  created_at: string;
}

export interface Project {
  id: number;
  company_id: number;
  name: string;
  code: string | null;
  description: string | null;
  client_name: string | null;
  location: string | null;
  original_value: number;
  revised_value: number;
  start_date: string | null;
  expected_end_date: string | null;
  actual_end_date: string | null;
  status: string;
  lock_version: number;
  created_at: string;
  updated_at: string | null;
}

export interface ProjectCreateInput {
  company_id: number;
  name: string;
  code?: string | null;
  description?: string | null;
  client_name?: string | null;
  location?: string | null;
  original_value?: number;
  revised_value?: number;
  start_date?: string | null;
  expected_end_date?: string | null;
  status?: string;
}

export interface ProjectUpdateInput {
  lock_version?: number;
  company_id?: number;
  name?: string;
  code?: string | null;
  description?: string | null;
  client_name?: string | null;
  location?: string | null;
  original_value?: number;
  revised_value?: number;
  start_date?: string | null;
  expected_end_date?: string | null;
  actual_end_date?: string | null;
  status?: string;
}

export interface Vendor {
  id: number;
  company_id: number | null;
  name: string;
  code: string | null;
  vendor_type: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  gst_number: string | null;
  pan_number: string | null;
  address: string | null;
  lock_version: number;
  created_at: string;
  updated_at: string | null;
}

export interface VendorCreateInput {
  company_id?: number | null;
  name: string;
  code?: string | null;
  vendor_type?: string;
  contact_person?: string | null;
  phone?: string | null;
  email?: string | null;
  gst_number?: string | null;
  pan_number?: string | null;
  address?: string | null;
}

export type VendorUpdateInput = Partial<VendorCreateInput> & { lock_version?: number };

export interface Material {
  id: number;
  item_code: string;
  item_name: string;
  category: string | null;
  unit: string;
  reorder_level: number;
  default_rate: number;
  current_stock: number;
  is_active: boolean;
  company_id: number | null;
  project_id: number | null;
  lock_version: number;
  created_at: string;
  updated_at: string | null;
}

export interface MaterialStockSummary {
  scope_type: string;
  scope_id: number | null;
  scope_name: string | null;
  material_count: number;
  total_stock: number;
}

export interface MaterialCreateInput {
  item_code: string;
  item_name: string;
  category?: string | null;
  unit: string;
  reorder_level?: number;
  default_rate?: number;
  current_stock?: number;
  is_active?: boolean;
  company_id?: number | null;
  project_id?: number | null;
}

export interface MaterialUpdateInput {
  item_code?: string;
  item_name?: string;
  category?: string | null;
  unit?: string;
  reorder_level?: number;
  default_rate?: number;
  current_stock?: number;
  is_active?: boolean;
  company_id?: number | null;
  project_id?: number | null;
  lock_version?: number;
}

export interface InventoryTransaction {
  id: number;
  material_id: number;
  project_id: number | null;
  transaction_type: string;
  qty_in: number;
  qty_out: number;
  balance_after: number;
  reference_type: string | null;
  reference_id: number | null;
  transaction_date: string;
  remarks: string | null;
  created_at: string;
}

export interface MaterialReceiptItem {
  id: number;
  material_id: number;
  received_qty: number;
  unit_rate: number;
  line_amount: number;
  created_at: string;
  updated_at: string | null;
}

export interface MaterialReceipt {
  id: number;
  receipt_no: string;
  vendor_id: number;
  project_id: number;
  received_by: number;
  receipt_date: string;
  status: string;
  remarks: string | null;
  total_amount: number;
  created_at: string;
  updated_at: string | null;
  items: MaterialReceiptItem[];
}

export interface MaterialReceiptCreateInput {
  receipt_no: string;
  vendor_id: number;
  project_id: number;
  receipt_date: string;
  status?: string;
  remarks?: string | null;
  items: Array<{
    material_id: number;
    received_qty: number;
    unit_rate?: number;
  }>;
}

export interface MaterialReceiptUpdateInput {
  receipt_no?: string;
  vendor_id?: number;
  project_id?: number;
  receipt_date?: string;
  status?: string;
  remarks?: string | null;
  items?: Array<{
    id: number;
    received_qty?: number;
    unit_rate?: number;
  }>;
}

export interface MaterialIssueItem {
  id: number;
  material_id: number;
  issued_qty: number;
  unit_rate: number;
  line_amount: number;
  created_at: string;
  updated_at: string | null;
}

export interface MaterialIssue {
  id: number;
  issue_no: string;
  project_id: number;
  contract_id: number | null;
  issued_by: number;
  issue_date: string;
  status: string;
  site_name: string | null;
  activity_name: string | null;
  remarks: string | null;
  total_amount: number;
  created_at: string;
  updated_at: string | null;
  items: MaterialIssueItem[];
}

export interface MaterialIssueCreateInput {
  issue_no: string;
  project_id: number;
  contract_id?: number | null;
  issue_date: string;
  status?: string;
  site_name?: string | null;
  activity_name?: string | null;
  remarks?: string | null;
  items: Array<{
    material_id: number;
    issued_qty: number;
    unit_rate?: number;
  }>;
}

export interface MaterialIssueUpdateInput {
  issue_no?: string;
  project_id?: number;
  contract_id?: number | null;
  issue_date?: string;
  status?: string;
  site_name?: string | null;
  activity_name?: string | null;
  remarks?: string | null;
  items?: Array<{
    id: number;
    issued_qty?: number;
    unit_rate?: number;
  }>;
}

export interface MaterialStockAdjustmentItem {
  id: number;
  material_id: number;
  qty_change: number;
  unit_rate: number;
  line_amount: number;
  created_at: string;
  updated_at: string | null;
}

export interface MaterialStockAdjustment {
  id: number;
  adjustment_no: string;
  project_id: number;
  adjusted_by: number;
  adjustment_date: string;
  status: string;
  reason: string | null;
  remarks: string | null;
  total_amount: number;
  created_at: string;
  updated_at: string | null;
  items: MaterialStockAdjustmentItem[];
}

export interface MaterialStockAdjustmentCreateInput {
  adjustment_no: string;
  project_id: number;
  adjustment_date: string;
  status?: string;
  reason?: string | null;
  remarks?: string | null;
  items: Array<{
    material_id: number;
    qty_change: number;
    unit_rate?: number;
  }>;
}

export interface MaterialStockAdjustmentUpdateInput {
  adjustment_no?: string;
  project_id?: number;
  adjustment_date?: string;
  status?: string;
  reason?: string | null;
  remarks?: string | null;
  items?: Array<{
    id: number;
    qty_change?: number;
    unit_rate?: number;
  }>;
}

export interface Labour {
  id: number;
  company_id: number | null;
  labour_code: string;
  full_name: string;
  trade: string | null;
  skill_level: string | null;
  daily_rate: number;
  skill_type: string | null;
  default_wage_rate: number;
  unit: string;
  contractor_id: number | null;
  is_active: boolean;
  lock_version: number;
  created_at: string;
  updated_at: string | null;
}

export interface LabourCreateInput {
  company_id: number;
  labour_code: string;
  full_name: string;
  trade?: string | null;
  skill_level?: string | null;
  daily_rate?: number;
  unit?: string;
  contractor_id?: number | null;
  is_active?: boolean;
}

export interface LabourUpdateInput {
  lock_version?: number;
  company_id?: number;
  labour_code?: string;
  full_name?: string;
  trade?: string | null;
  skill_level?: string | null;
  daily_rate?: number;
  unit?: string;
  contractor_id?: number | null;
  is_active?: boolean;
}

export interface LabourContractor {
  id: number;
  company_id: number | null;
  contractor_code: string;
  contractor_name: string;
  contact_person: string | null;
  gang_name: string | null;
  address: string | null;
  phone: string | null;
  is_active: boolean;
  lock_version: number;
  created_at: string;
  updated_at: string | null;
}

export interface LabourContractorCreateInput {
  company_id: number;
  contractor_code?: string | null;
  contractor_name: string;
  contact_person?: string | null;
  phone?: string | null;
  address?: string | null;
  is_active?: boolean;
}

export interface LabourContractorUpdateInput {
  lock_version?: number;
  company_id?: number;
  contractor_code?: string | null;
  contractor_name?: string;
  contact_person?: string | null;
  phone?: string | null;
  address?: string | null;
  is_active?: boolean;
}

export interface Contract {
  id: number;
  project_id: number;
  vendor_id: number;
  contract_no: string;
  title: string;
  scope_of_work: string | null;
  start_date: string | null;
  end_date: string | null;
  original_value: number;
  revised_value: number;
  retention_percentage: number;
  status: string;
  lock_version: number;
  created_at: string;
}

export interface ContractCreateInput {
  project_id: number;
  vendor_id: number;
  contract_no: string;
  title: string;
  scope_of_work?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  original_value?: number;
  revised_value?: number;
  retention_percentage?: number;
  status?: string;
}

export interface ContractUpdateInput {
  lock_version?: number;
  vendor_id?: number;
  contract_no?: string;
  title?: string;
  scope_of_work?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  original_value?: number;
  revised_value?: number;
  retention_percentage?: number;
  status?: string;
}

export interface LabourAttendanceItem {
  id: number;
  labour_id: number;
  attendance_status: string;
  present_days: number;
  overtime_hours: number;
  wage_rate: number;
  line_amount: number;
  remarks: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface LabourAttendance {
  id: number;
  muster_no: string;
  project_id: number;
  contractor_id: number | null;
  date: string | null;
  attendance_date: string;
  created_by: number | null;
  marked_by: number;
  status: string;
  remarks: string | null;
  total_wage: number;
  lock_version?: number;
  created_at: string;
  updated_at: string | null;
  items: LabourAttendanceItem[];
}

export interface LabourAttendanceCreateInput {
  muster_no?: string;
  project_id: number;
  contractor_id?: number | null;
  date: string;
  created_by?: number | null;
  status?: string;
  remarks?: string | null;
  items: Array<{
    labour_id: number;
    attendance_status?: string;
    present_days?: number | null;
    overtime_hours?: number;
    wage_rate?: number | null;
    remarks?: string | null;
  }>;
}

export interface LabourAttendanceUpdateInput {
  muster_no?: string;
  contractor_id?: number | null;
  date?: string;
  created_by?: number | null;
  status?: string;
  remarks?: string | null;
  items?: Array<{
    id: number;
    attendance_status?: string;
    present_days?: number | null;
    overtime_hours?: number;
    wage_rate?: number | null;
    remarks?: string | null;
  }>;
}

export interface LabourAttendanceTransitionInput {
  remarks?: string | null;
}

export interface LabourBillItem {
  id: number;
  attendance_id: number | null;
  labour_id: number | null;
  description: string | null;
  quantity: number;
  rate: number;
  amount: number;
  created_at: string;
  updated_at: string | null;
}

export interface LabourBill {
  id: number;
  bill_no: string;
  project_id: number;
  contract_id: number | null;
  contractor_id: number;
  period_start: string;
  period_end: string;
  status: string;
  gross_amount: number;
  deductions: number;
  net_payable: number;
  net_amount: number;
  remarks: string | null;
  lock_version?: number;
  created_at: string;
  updated_at: string | null;
  items: LabourBillItem[];
}

export interface LabourBillCreateInput {
  bill_no: string;
  project_id: number;
  contract_id?: number | null;
  contractor_id: number;
  period_start: string;
  period_end: string;
  status?: string;
  gross_amount?: number;
  deductions?: number;
  net_payable?: number | null;
  remarks?: string | null;
  attendance_ids?: number[];
}

export interface LabourBillUpdateInput {
  bill_no?: string;
  project_id?: number;
  contract_id?: number | null;
  contractor_id?: number;
  period_start?: string;
  period_end?: string;
  status?: string;
  gross_amount?: number;
  deductions?: number;
  net_payable?: number;
  remarks?: string | null;
  attendance_ids?: number[];
}

export interface LabourBillTransitionInput {
  remarks?: string | null;
}

export interface LabourAdvanceRecovery {
  id: number;
  advance_id: number;
  labour_bill_id: number | null;
  recovery_date: string;
  amount: number;
  remarks: string | null;
  created_at: string;
}

export interface LabourAdvance {
  id: number;
  advance_no: string;
  project_id: number;
  contractor_id: number;
  advance_date: string;
  amount: number;
  recovered_amount: number;
  balance_amount: number;
  status: string;
  remarks: string | null;
  lock_version?: number;
  created_at: string;
  updated_at: string | null;
  recoveries: LabourAdvanceRecovery[];
}

export interface LabourAdvanceCreateInput {
  advance_no: string;
  project_id: number;
  contractor_id: number;
  advance_date: string;
  amount: number;
  status?: string;
  remarks?: string | null;
}

export interface LabourAdvanceUpdateInput {
  advance_no?: string;
  contractor_id?: number;
  advance_date?: string;
  amount?: number;
  status?: string;
  remarks?: string | null;
}

export interface LabourAdvanceRecoveryCreateInput {
  labour_bill_id?: number | null;
  recovery_date: string;
  amount: number;
  remarks?: string | null;
}

export interface MaterialRequisitionItem {
  id: number;
  material_id: number;
  requested_qty: number;
  approved_qty: number;
  issued_qty: number;
  created_at: string;
  updated_at: string | null;
}

export interface MaterialRequisition {
  id: number;
  requisition_no: string;
  project_id: number;
  contract_id: number | null;
  requested_by: number;
  status: string;
  remarks: string | null;
  created_at: string;
  updated_at: string | null;
  items: MaterialRequisitionItem[];
}

export interface MaterialRequisitionItemCreateInput {
  material_id: number;
  requested_qty: number;
  approved_qty?: number;
  issued_qty?: number;
}

export interface MaterialRequisitionCreateInput {
  requisition_no: string;
  project_id: number;
  contract_id?: number | null;
  requested_by?: number | null;
  status?: string;
  remarks?: string | null;
  items: MaterialRequisitionItemCreateInput[];
}

export interface MaterialRequisitionApproveInput {
  remarks?: string | null;
  items?: Array<{
    id: number;
    requested_qty?: number;
    approved_qty?: number;
    issued_qty?: number;
  }>;
}

export interface PaymentAllocation {
  id: number;
  payment_id: number;
  ra_bill_id: number;
  amount: number;
  remarks: string | null;
  created_at: string;
}

export interface PaymentAllocationCreateInput {
  ra_bill_id: number;
  amount: number;
  remarks?: string | null;
}

export interface OutstandingBill {
  ra_bill_id: number;
  bill_no: number;
  status: string;
  net_payable: number;
  paid_amount: number;
  outstanding_amount: number;
}

export interface PaymentCreateInput {
  contract_id: number;
  payment_date: string;
  amount: number;
  ra_bill_id?: number | null;
  payment_mode?: string | null;
  reference_no?: string | null;
  remarks?: string | null;
}

export interface PaymentActionInput {
  lock_version?: number;
  remarks?: string | null;
}

export interface Payment {
  id: number;
  contract_id: number;
  payment_date: string;
  amount: number;
  status: "draft" | "approved" | "released" | "cancelled";
  ra_bill_id: number | null;
  payment_mode: string | null;
  reference_no: string | null;
  remarks: string | null;
  approved_by: number | null;
  approved_at: string | null;
  released_by: number | null;
  released_at: string | null;
  allocated_amount: number;
  available_amount: number;
  allocations: PaymentAllocation[];
  lock_version: number;
  created_at: string;
  updated_at: string | null;
}

export interface SiteExpenseCreateInput {
  expense_no: string;
  project_id: number;
  vendor_id?: number | null;
  expense_date: string;
  expense_head: string;
  payee_name?: string | null;
  amount: number;
  payment_mode?: string | null;
  reference_no?: string | null;
  remarks?: string | null;
}

export interface SiteExpenseUpdateInput {
  lock_version?: number;
  expense_no?: string;
  project_id?: number;
  vendor_id?: number | null;
  expense_date?: string;
  expense_head?: string;
  payee_name?: string | null;
  amount?: number;
  payment_mode?: string | null;
  reference_no?: string | null;
  remarks?: string | null;
}

export interface SiteExpenseActionInput {
  lock_version?: number;
  remarks?: string | null;
}

export interface SiteExpense {
  id: number;
  expense_no: string;
  project_id: number;
  vendor_id: number | null;
  expense_date: string;
  expense_head: string;
  payee_name: string | null;
  amount: number;
  payment_mode: string | null;
  reference_no: string | null;
  status: "draft" | "approved" | "paid";
  remarks: string | null;
  created_by: number | null;
  approved_by: number | null;
  approved_at: string | null;
  paid_by: number | null;
  paid_at: string | null;
  lock_version: number;
  created_at: string;
  updated_at: string | null;
}

export type RABillStatus =
  | "draft"
  | "submitted"
  | "verified"
  | "approved"
  | "rejected"
  | "cancelled"
  | "finance_hold"
  | "partially_paid"
  | "paid";

export interface RABillDeduction {
  id: number;
  ra_bill_id: number;
  deduction_type: string;
  description: string | null;
  reason: string | null;
  percentage: number | null;
  amount: number;
  secured_advance_id: number | null;
  is_system_generated: boolean;
  created_at: string;
}

export interface RABillItem {
  id: number;
  ra_bill_id: number;
  work_done_item_id: number;
  measurement_id: number;
  boq_item_id: number;
  item_code_snapshot: string | null;
  description_snapshot: string;
  unit_snapshot: string;
  prev_quantity: number;
  curr_quantity: number;
  cumulative_quantity: number;
  rate: number;
  amount: number;
  created_at: string;
}

export interface RABillStatusLog {
  id: number;
  ra_bill_id: number;
  from_status: string | null;
  to_status: string;
  action: string;
  remarks: string | null;
  actor_user_id: number;
  created_at: string;
}

export interface RABill {
  id: number;
  contract_id: number;
  bill_no: number;
  bill_date: string;
  period_from: string | null;
  period_to: string | null;
  gross_amount: number;
  total_deductions: number;
  net_payable: number;
  paid_amount: number;
  outstanding_amount: number;
  status: RABillStatus;
  remarks: string | null;
  submitted_by: number | null;
  submitted_at: string | null;
  approved_by: number | null;
  approved_at: string | null;
  items: RABillItem[];
  deductions: RABillDeduction[];
  status_logs: RABillStatusLog[];
  lock_version: number;
  created_at: string;
  updated_at: string | null;
}

export interface RABillDeductionCreateInput {
  deduction_type: string;
  description?: string | null;
  reason?: string | null;
  percentage?: number | null;
  amount?: number;
  secured_advance_id?: number | null;
  is_system_generated?: boolean;
}

export interface RABillCreateInput {
  contract_id: number;
  bill_date: string;
  bill_no?: number;
  period_from?: string | null;
  period_to?: string | null;
  remarks?: string | null;
  deductions?: RABillDeductionCreateInput[];
}

export interface RABillGenerateInput {
  tds_percentage?: number | null;
  apply_contract_retention?: boolean;
  deductions?: RABillDeductionCreateInput[];
  lock_version?: number;
}

export interface RABillActionInput {
  lock_version?: number;
  remarks?: string | null;
}

export interface AuditLog {
  id: number;
  entity_type: string;
  entity_id: number;
  action: string;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
  performed_by: number;
  performed_at: string;
  remarks: string | null;
  request_id: string | null;
}

export interface AIBoundaryPolicy {
  ai_enabled: boolean;
  ai_mode: string;
  allow_state_changing_execution: boolean;
  require_human_review: boolean;
  require_backend_validation: boolean;
  allowed_operation_types: string[];
  blocked_operation_types: string[];
  required_guards: string[];
  notes: string[];
}

export interface AIBoundaryEvaluationRequest {
  operation_type: string;
  affects_state?: boolean;
}

export interface AIBoundaryEvaluationResponse {
  operation_type: string;
  normalized_operation_type: string;
  affects_state: boolean;
  allowed: boolean;
  reasons: string[];
  required_guards: string[];
}

// ── BOQ ──────────────────────────────────────────────────

export interface BOQItem {
  id: number;
  contract_id: number;
  item_code: string | null;
  description: string;
  unit: string;
  quantity: number;
  rate: number;
  amount: number;
  category: string | null;
  created_at: string;
}

export interface BOQItemCreateInput {
  item_code?: string | null;
  description: string;
  unit: string;
  quantity?: number;
  rate?: number;
  amount?: number;
  category?: string | null;
}

export type BOQItemUpdateInput = Partial<BOQItemCreateInput>;

// ── Measurements ─────────────────────────────────────────

export type MeasurementStatus = 'draft' | 'submitted' | 'approved';

export interface MeasurementItemOut {
  id: number;
  boq_item_id: number;
  description_snapshot: string;
  unit_snapshot: string;
  previous_quantity: number;
  current_quantity: number;
  cumulative_quantity: number;
  rate: number;
  amount: number;
  allow_excess: boolean;
  warning_message: string | null;
  remarks: string | null;
  created_at: string;
}

export interface Measurement {
  id: number;
  contract_id: number;
  measurement_no: string;
  measurement_date: string;
  status: MeasurementStatus;
  remarks: string | null;
  created_by: number | null;
  submitted_by: number | null;
  approved_by: number | null;
  submitted_at: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string | null;
  items: MeasurementItemOut[];
}

export interface MeasurementItemCreateInput {
  boq_item_id: number;
  current_quantity: number;
  rate?: number;
  amount?: number;
  allow_excess?: boolean;
  remarks?: string | null;
}

export interface MeasurementCreateInput {
  contract_id: number;
  measurement_no: string;
  measurement_date: string;
  remarks?: string | null;
  items: MeasurementItemCreateInput[];
}

export interface MeasurementUpdateInput {
  measurement_date?: string;
  remarks?: string | null;
  items?: MeasurementItemCreateInput[];
}

// ── Work Done ────────────────────────────────────────────

export interface WorkDone {
  id: number;
  contract_id: number;
  measurement_id: number;
  measurement_item_id: number;
  boq_item_id: number;
  recorded_date: string;
  previous_quantity: number;
  current_quantity: number;
  cumulative_quantity: number;
  rate: number;
  amount: number;
  remarks: string | null;
  approved_by: number | null;
  created_at: string;
}

// ── Secured Advances ─────────────────────────────────────

export type SecuredAdvanceStatus = 'active' | 'fully_recovered' | 'written_off';

export interface SecuredAdvanceRecovery {
  id: number;
  secured_advance_id: number;
  ra_bill_id: number;
  recovery_date: string;
  amount: number;
  remarks: string | null;
  created_by: number | null;
  created_at: string;
}

// ── WBS (Work Breakdown Structure) ───────────────────────

export interface WBSItemRow {
  boq_item_id: number;
  contract_id: number;
  project_id: number;
  company_name: string;
  project_name: string;
  project_code: string | null;
  contract_no: string;
  contract_title: string;
  vendor_name: string;
  item_code: string | null;
  description: string;
  unit: string;
  category: string | null;
  boq_quantity: number;
  boq_rate: number;
  boq_amount: number;
  work_done_quantity: number;
  work_done_amount: number;
  billed_quantity: number;
  billed_amount: number;
  remaining_quantity: number;
  remaining_amount: number;
  completion_pct: number;
}

export interface WBSCategoryRollup {
  category: string;
  item_count: number;
  boq_amount: number;
  work_done_amount: number;
  billed_amount: number;
  remaining_amount: number;
  completion_pct: number;
}

export interface WBSSummary {
  total_boq_amount: number;
  total_work_done_amount: number;
  total_billed_amount: number;
  total_remaining_amount: number;
  overall_completion_pct: number;
  total_items: number;
  categories_count: number;
  contracts_covered: number;
  projects_covered: number;
}

export interface WBSReport {
  summary: WBSSummary;
  category_rollup: WBSCategoryRollup[];
  items: WBSItemRow[];
  total: number;
  page: number;
  limit: number;
}

export interface SecuredAdvance {
  id: number;
  contract_id: number;
  advance_date: string;
  description: string | null;
  advance_amount: number;
  recovered_amount: number;
  balance: number;
  status: SecuredAdvanceStatus;
  issued_by: number | null;
  recovery_count: number;
  recoveries: SecuredAdvanceRecovery[];
  created_at: string;
  updated_at: string | null;
}

export interface SecuredAdvanceIssueCreateInput {
  contract_id: number;
  advance_date: string;
  description?: string | null;
  advance_amount: number;
}

export interface SecuredAdvanceUpdateInput {
  description?: string | null;
  status?: SecuredAdvanceStatus;
}

// ── Documents ────────────────────────────────────────────

export type DocumentEntityType =
  | 'contract'
  | 'measurement'
  | 'ra_bill'
  | 'payment'
  | 'vendor'
  | 'company'
  | 'labour_attendance'
  | 'labour_bill'
  | 'labour_advance'
  | 'site_expense';

export interface DocumentVersion {
  id: number;
  document_id: number;
  version_number: number;
  file_name: string;
  file_path: string;
  mime_type: string | null;
  file_size: number | null;
  remarks: string | null;
  uploaded_by: number | null;
  created_at: string;
  updated_at: string | null;
}

export interface Document {
  id: number;
  entity_type: DocumentEntityType;
  entity_id: number;
  storage_key: string;
  title: string;
  document_type: string | null;
  current_version_number: number;
  latest_file_name: string;
  latest_file_path: string;
  latest_mime_type: string | null;
  latest_file_size: number | null;
  remarks: string | null;
  created_by: number | null;
  created_at: string;
  updated_at: string | null;
  versions: DocumentVersion[];
}

export interface DocumentCreateInput {
  entity_type: DocumentEntityType;
  entity_id: number;
  title: string;
  document_type?: string | null;
  file_name: string;
  file_path: string;
  mime_type?: string | null;
  file_size?: number;
  remarks?: string | null;
}

export interface DocumentUpdateInput {
  title?: string;
  document_type?: string | null;
  remarks?: string | null;
}

// ── Users (admin) ────────────────────────────────────────

export interface UserCreateInput {
  company_id?: number | null;
  full_name: string;
  email: string;
  password: string;
  phone?: string | null;
  role?: string;
}

export interface UserUpdateInput {
  company_id?: number | null;
  full_name?: string;
  email?: string;
  password?: string;
  phone?: string | null;
  role?: string;
  is_active?: boolean;
}

// ── Labour Productivity ──────────────────────────────────

export interface LabourProductivity {
  id: number;
  project_id: number;
  contract_id: number | null;
  date: string;
  trade: string;
  quantity_done: number;
  labour_count: number;
  productivity_value: number;
  labour_id: number | null;
  unit: string;
  remarks: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface LabourProductivityCreateInput {
  project_id: number;
  contract_id?: number | null;
  date: string;
  trade: string;
  quantity_done: number;
  labour_count?: number;
  productivity_value?: number;
  labour_id?: number | null;
  unit?: string;
  remarks?: string | null;
}

export type LabourProductivityUpdateInput = Partial<LabourProductivityCreateInput>;
