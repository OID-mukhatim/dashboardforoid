import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Plan, KPI, Activity, Report } from "./types";
const importInput = z.object({
  uploadId: z.string().uuid(),
  year: z.number().int().min(1900).max(2200),
});
export const previewPerfImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => importInput.parse(d))
  .handler(async ({ data, context }) => {
    const { buildPreview } = await import("./import-core.server");
    return buildPreview(context.supabase, context.userId, data);
  });
export const approvePerfImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    importInput.extend({ allowDefinitions: z.boolean(), revision: z.string().nullable() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { buildPreview } = await import("./import-core.server");
    const result = await buildPreview(context.supabase, context.userId, data);
    if (result.errors.length) throw new Error("invalid_template");
    if (result.revision !== data.revision) throw new Error("stale_preview");
    const { data: id, error } = await context.supabase.rpc("commit_perf_import", {
      p_org: result.org.id,
      p_year: data.year,
      p_upload: data.uploadId,
      p_payload: result.parsed as any,
      p_allow_definitions: data.allowDefinitions,
      p_revision: data.revision as any,
    });
    if (error) throw new Error(error.message);
    return { planId: id, orgId: result.org.id, year: data.year };
  });
export const loadPerfData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const [plans, kpis, activities, reports, active, events] = await Promise.all([
      sb.from("perf_plans").select("*").order("plan_year", { ascending: false }),
      sb.from("perf_kpis").select("*").order("seq"),
      sb.from("perf_activities").select("*"),
      sb.from("perf_reports").select("*"),
      sb.from("org_active_years").select("org_id,active_year"),
      sb.from("perf_plan_events").select("*").order("changed_at", { ascending: false }),
    ]);
    for (const r of [plans, kpis, activities, reports, active, events])
      if (r.error) throw new Error(r.error.message);
    return {
      plans: (plans.data ?? []) as Plan[],
      kpis: (kpis.data ?? []) as KPI[],
      activities: (activities.data ?? []) as Activity[],
      reports: (reports.data ?? []) as Report[],
      events: events.data ?? [],
      activeYears: Object.fromEntries(
        (active.data ?? []).map((r) => [r.org_id, r.active_year]),
      ) as Record<string, number>,
    };
  });
