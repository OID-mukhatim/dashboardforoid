/**
 * منظومة إدارة المؤشرات: استيراد المصفوفة، استكمال البطاقة، تحديث المنجز الربعي.
 * تعمل على جدول kpis القائم (kpi_code / entity_code / q*_planned / q*_actual).
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ORG_FISCAL_YEAR, validateWeights, type OrgId } from "@/lib/oid-data";

type Row = Record<string, unknown>;

const pick = (row: Row, keys: string[]): string => {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
};

const numOrNull = (v: string): number | null => {
  const n = parseFloat(v.replace("%", "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/** استيراد مصفوفة المؤشرات لمؤسسة وسنة خطة. */
export const importKPIMatrix = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orgId: string; year: number; rows: Row[]; force?: boolean }) => d)
  .handler(async ({ data, context }) => {
    const { orgId, year, rows, force } = data;
    const validation = validateWeights(rows);
    if (!validation.valid && !force) {
      return { ok: false as const, errors: validation.errors, warnings: validation.warnings };
    }

    const fiscalType = ORG_FISCAL_YEAR[orgId as OrgId] ?? "calendar";
    const records = rows.map((row) => {
      const baseCode = pick(row, ["الكود", "ID", "kpi_code", "code"]);
      const code = /-20\d{2}$/.test(baseCode) ? baseCode : `${baseCode}-${year}`;
      const weightRaw = numOrNull(pick(row, ["الوزن", "الوزن النسبي", "Weight", "Weight %"]));
      return {
        kpi_code: code,
        entity_code: orgId,
        plan_year: year,
        period: `PLAN-${year}`,
        fiscal_type: fiscalType,
        fiscal_year_type: fiscalType,
        is_baseline: year === 2026,
        sector: pick(row, ["المنظور", "Sector"]),
        objective: pick(row, ["الهدف", "الهدف الاستراتيجي", "objective"]),
        kpi_name: pick(row, ["مؤشر الأداء", "المؤشر", "KPI"]),
        kpi_type: pick(row, ["نوعه", "النوع", "Type"]) || null,
        weight: weightRaw !== null && weightRaw > 1 ? weightRaw / 100 : weightRaw,
        baseline: numOrNull(pick(row, ["خط الأساس", "Baseline"])),
        annual_target: numOrNull(pick(row, ["المستهدف السنوي", "Annual Target"])),
        q1_planned: numOrNull(pick(row, ["Q1", "الربع الأول"])),
        q2_planned: numOrNull(pick(row, ["Q2", "الربع الثاني"])),
        q3_planned: numOrNull(pick(row, ["Q3", "الربع الثالث"])),
        q4_planned: numOrNull(pick(row, ["Q4", "الربع الرابع"])),
        card_completed: false,
      };
    });

    const { error } = await context.supabase
      .from("kpis")
      .upsert(records, { onConflict: "entity_code,kpi_code,plan_year" });
    if (error) throw error;

    const { data: active } = await context.supabase
      .from("org_active_years")
      .select("active_year")
      .eq("org_id", orgId)
      .maybeSingle();
    if (!active || year > active.active_year) {
      await context.supabase.from("org_active_years").upsert(
        { org_id: orgId, active_year: year, fiscal_type: fiscalType, updated_at: new Date().toISOString() },
        { onConflict: "org_id" },
      );
    }

    return { ok: true as const, inserted: records.length, errors: validation.errors, warnings: validation.warnings };
  });

type Quarter = "q1" | "q2" | "q3" | "q4";

/** بناء تحديث المنجز للربع المحدد بنوع صريح. */
const quarterPatch = (q: Quarter, v: number | null) =>
  q === "q1" ? { q1_actual: v } : q === "q2" ? { q2_actual: v } : q === "q3" ? { q3_actual: v } : { q4_actual: v };

export type KPICardInput = {
  id: string;
  description?: string | null;
  related_goal?: string | null;
  department?: string | null;
  indicator_type?: string | null;
  unit?: string | null;
  polarity?: string | null;
  calculation?: string | null;
  data_sources?: string | null;
  frequency?: string | null;
  related_kpis?: string | null;
  enablers?: string | null;
  threshold_red?: string | null;
  threshold_yellow?: string | null;
  threshold_green?: string | null;
};

/** حفظ بطاقة المؤشر مع احتساب اكتمالها. */
export const updateKPICard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: KPICardInput) => d)
  .handler(async ({ data, context }) => {
    const { id, ...card } = data;
    const required: (keyof typeof card)[] = [
      "description",
      "unit",
      "calculation",
      "threshold_red",
      "threshold_green",
    ];
    const missing = required.filter((f) => !String(card[f] ?? "").trim());
    const isComplete = missing.length === 0;

    const { error } = await context.supabase
      .from("kpis")
      .update({ ...card, card_completed: isComplete, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    return { ok: true, completed: isComplete, missing };
  });

/** تحديث المنجز الفعلي لربع واحد (يُسجَّل أيضاً في البعد الزمني). */
export const updateKPIAchieved = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; quarter: Quarter; achieved: number | null }) => d)
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { error } = await sb
      .from("kpis")
      .update({ ...quarterPatch(data.quarter, data.achieved), updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw error;

    const { data: kpi } = await sb
      .from("kpis")
      .select("entity_code, plan_year, kpi_name, annual_target, fiscal_type")
      .eq("id", data.id)
      .maybeSingle();

    if (kpi && data.achieved !== null && kpi.annual_target) {
      const ratio = Math.max(0, Math.min(1, Number(data.achieved) / Number(kpi.annual_target)));
      await sb.from("timeline_entries").upsert(
        {
          org_id: kpi.entity_code,
          domain: "kpi_overall",
          period: `${data.quarter.toUpperCase()}-${kpi.plan_year ?? 2026}`,
          period_order: ["q1", "q2", "q3", "q4"].indexOf(data.quarter) + 1,
          value: ratio * 5,
          note: `تحديث ${kpi.kpi_name ?? ""}`.trim(),
          fiscal_year_type: kpi.fiscal_type ?? "calendar",
        },
        { onConflict: "org_id,domain,period" },
      );
    }
    return { ok: true };
  });

/** حفظ دفعة تحديثات المنجز. */
export const saveQuarterAchievements = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { quarter: Quarter; items: { id: string; achieved: number | null }[] }) => d)
  .handler(async ({ data, context }) => {
    for (const item of data.items) {
      const { error } = await context.supabase
        .from("kpis")
        .update({ ...quarterPatch(data.quarter, item.achieved), updated_at: new Date().toISOString() })
        .eq("id", item.id);
      if (error) throw error;
    }
    return { ok: true, saved: data.items.length };
  });

/** المؤشرات التي لم تكتمل بطاقتها بعد. */
export const loadIncompleteCards = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orgId?: string }) => d)
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from("kpis")
      .select("id, kpi_code, kpi_name, entity_code, plan_year")
      .eq("card_completed", false);
    if (data.orgId && data.orgId !== "الكل") query = query.eq("entity_code", data.orgId);
    const { data: rows, error } = await query;
    if (error) throw error;
    return rows ?? [];
  });
