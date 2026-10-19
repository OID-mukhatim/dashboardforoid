import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { buildLiveAlerts } from "./alerts-core";

export const loadAlerts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ lang: z.enum(["ar", "en"]) }).parse(data))
  .handler(async ({ data, context }) => {
    await (await import("./org-registry.server")).loadOrgRegistry(context.supabase);
    const { readDashboardSnapshot } = await import("./dashboard-snapshot.server");
    const [snapshot, institutions, gaps] = await Promise.all([
      readDashboardSnapshot(context.supabase),
      context.supabase.from("institutions").select("id, name_ar, name_en, license_expiry"),
      context.supabase.from("gap_scores").select("org_id, domain_index, domain_name, score, period, updated_at"),
    ]);
    if (institutions.error) throw institutions.error;
    if (gaps.error) throw gaps.error;
    const { activeOrgIds } = await import("./org-registry");
    const active = new Set(activeOrgIds());
    return buildLiveAlerts((institutions.data ?? []).filter((r) => active.has(r.id)), (gaps.data ?? []).filter((g) => active.has(g.org_id)), snapshot.matrix, data.lang, new Date().toISOString().slice(0, 10));
  });