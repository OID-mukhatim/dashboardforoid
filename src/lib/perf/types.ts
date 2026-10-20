export const PERSPECTIVES = ["S", "P", "L", "F"] as const;
export type Perspective = (typeof PERSPECTIVES)[number];
export type Quarter = "Q1" | "Q2" | "Q3" | "Q4";
export type CalcMethod =
  | "q_independent"
  | "q_cumulative"
  | "q_average"
  | "h_independent"
  | "h_cumulative"
  | "h_average"
  | "annual";
export type KPI = {
  id?: string;
  plan_id?: string;
  perspective: Perspective;
  seq: number;
  code: string;
  objective: string;
  name: string;
  measurement: "pct" | "num" | "qual";
  role: "leading" | "lagging";
  unit: "number" | "percent" | "amount" | "days" | "likert";
  polarity: "asc" | "desc";
  calc_method: CalcMethod;
  weight: number;
  baseline: number | null;
  annual_target: number | null;
  q1_plan: number | null;
  q1_actual: number | null;
  q2_plan: number | null;
  q2_actual: number | null;
  q3_plan: number | null;
  q3_actual: number | null;
  q4_plan: number | null;
  q4_actual: number | null;
  description?: string | null;
  department?: string | null;
  calculation_formula?: string | null;
  data_sources?: string | null;
  related_kpis?: string | null;
  enablers?: string | null;
  notes?: string | null;
  calc_formula_status?: "none" | "suggested" | "approved";
  calc_formula_approved_by?: string | null;
  calc_formula_approved_at?: string | null;
};
export type Activity = {
  id?: string;
  plan_id?: string;
  quarter: Quarter;
  activity_type: "program" | "event" | "training";
  title: string;
  target_group: string | null;
  implementer: string | null;
  beneficiaries: number | null;
  planned: number | null;
  achieved: number | null;
  kpi_id?: string | null;
  kpi_code: string | null;
  notes: string | null;
};
export type ReportValue = string | number | boolean | null;
export type Report = {
  id?: string;
  plan_id?: string;
  period: Quarter;
  executive_summary: string | null;
  planned_beneficiaries: number | null;
  annual_stats: Record<string, ReportValue>[];
  achievements: Record<string, ReportValue>[];
  challenges: Record<string, ReportValue>[];
  proposals: Record<string, ReportValue>[];
  status?: "draft" | "submitted";
  submitted_at?: string | null;
};
export type Plan = {
  id: string;
  org_id: string;
  plan_year: number;
  fiscal_type: string;
  status: "draft" | "objectives_approved" | "matrix_approved";
  updated_at: string;
  source_upload_id: string | null;
  prepared_by: string | null;
  approved_by: string | null;
  objectives_approved_at?: string | null;
  matrix_approved_at?: string | null;
  objectives_approved_by?: string | null;
  matrix_approved_by?: string | null;
};
export type Issue = { code: string; row?: number; kpi?: string; detail?: string };
export type ParsedTemplate = {
  orgName: string;
  period: Quarter;
  prepared_by: string | null;
  approved_by: string | null;
  kpis: KPI[];
  fileCodes: Record<string, string>;
  activities: Activity[];
  report: Report;
  errors: Issue[];
  warnings: Issue[];
  cached: Record<
    string,
    {
      annual_achieved: number | null;
      annual_pct: number | null;
      weighted: number | null;
      total_bt: number | null;
    }
  >;
};
