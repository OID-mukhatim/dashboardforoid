import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { buildLiveAlerts, reportAlertItems } from "./alerts-core";

export const loadAlerts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ lang: z.enum(["ar", "en"]) }).parse(data))
  .handler(async ({ data, context }) => {
    await (await import("./org-registry.server")).loadOrgRegistry(context.supabase);
    const { readDashboardSnapshot } = await import("./dashboard-snapshot.server");
    const [snapshot, institutions, gaps, plans, reports, years] = await Promise.all([
      readDashboardSnapshot(context.supabase),
      context.supabase.from("institutions").select("id, name_ar, name_en, license_expiry"),
      context.supabase.from("gap_scores").select("org_id, domain_index, domain_name, score, period, updated_at"),
      context.supabase.from("perf_plans").select("id, org_id, plan_year, fiscal_type"),
      context.supabase.from("perf_reports").select("plan_id, period, status, approved_at, snapshot"),
      context.supabase.from("org_active_years").select("org_id, active_year"),
    ]);
    if (institutions.error) throw institutions.error;
    if (gaps.error) throw gaps.error;
    const { activeOrgIds } = await import("./org-registry");
    const active = new Set(activeOrgIds());
    const { reportAlerts } = await import("./reports/integration");
    const { ORGS } = await import("./org-registry");
    const names = new Map(ORGS.map((o) => [o.id, data.lang === "ar" ? o.nameAr : o.nameEn]));
    const extra = reportAlertItems(reportAlerts({
      plans: plans.data ?? [], reports: (reports.data ?? []) as never, activeOrgIds: [...active], now: new Date(),
      activeYears: Object.fromEntries((years.data ?? []).map((r) => [r.org_id, r.active_year])),
    }), names, data.lang);
    return [...buildLiveAlerts((institutions.data ?? []).filter((r) => active.has(r.id)), (gaps.data ?? []).filter((g) => active.has(g.org_id)), snapshot.matrix, data.lang, new Date().toISOString().slice(0, 10)), ...extra];
  });