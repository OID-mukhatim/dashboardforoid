/** التقارير المالية الربعية: جلب وحفظ. */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type RevenueRow = { source: string; planned: number; actual: number; diff: number };
export type ExpenseRow = { item: string; planned: number; actual: number; diff: number; note?: string };

export type FinancialReport = {
  id: string;
  org_id: string;
  plan_year: number;
  quarter: string;
  fiscal_type: string | null;
  approved_budget: number;
  actual_spending: number;
  surplus_deficit: number;
  revenues: RevenueRow[];
  expenses: ExpenseRow[];
  challenges: string | null;
  actions: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

/** جلب التقارير المالية مع فلترة اختيارية بالمؤسسة والسنة. */
export const loadFinancialReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orgId?: string; year?: number }) => d)
  .handler(async ({ data, context }): Promise<FinancialReport[]> => {
    let query = context.supabase
      .from("financial_reports")
      .select("*")
      .order("plan_year", { ascending: false })
      .order("quarter", { ascending: true });

    if (data.orgId) query = query.eq("org_id", data.orgId);
    if (data.year) query = query.eq("plan_year", data.year);

    const { data: rows, error } = await query;
    if (error) throw error;
    return (rows ?? []) as unknown as FinancialReport[];
  });

/** حفظ أو تحديث تقرير مالي ربعي (الفائض/العجز يُحسب تلقائياً). */
export const saveFinancialReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    id?: string;
    org_id: string;
    plan_year: number;
    quarter: string;
    fiscal_type?: string;
    approved_budget?: number;
    actual_spending?: number;
    revenues?: RevenueRow[];
    expenses?: ExpenseRow[];
    challenges?: string;
    actions?: string;
    notes?: string;
    status?: string;
  }) => d)
  .handler(async ({ data, context }) => {
    const surplus_deficit = (data.approved_budget ?? 0) - (data.actual_spending ?? 0);
    const payload = {
      ...data,
      surplus_deficit,
      updated_at: new Date().toISOString(),
    };

    const { data: report, error } = await context.supabase
      .from("financial_reports")
      .upsert(payload as never, { onConflict: "org_id,plan_year,quarter" })
      .select()
      .single();

    if (error) throw error;
    return report as unknown as FinancialReport;
  });
