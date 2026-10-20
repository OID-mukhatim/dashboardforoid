/**
 * Live dashboard aggregates — single round-trip snapshot loaded from DB.
 * Powers the main cards, performance map, governance summary, and the
 * composite-score cards. Falls back gracefully when a source is missing.
 */
import { createServerFn } from "@tanstack/react-start";
import { activeOrgIds, isAcademicOrg } from "./org-registry";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type OrgCode = string;
const VALID_ORGS = {
  includes: (id: string) => activeOrgIds().includes(id),
  [Symbol.iterator]: () => activeOrgIds()[Symbol.iterator](),
};

export type SourceRef = { label: string; updatedAt: string | null };

export type LiveMatrixEntry = {
  gaps: Record<string, number>;
  gapAvg: number | null;
  govScore: number | null;
  govPct: number | null;
  finScore: number | null;
  maturity: number | null;
  source: "extraction" | null;
  sources: { gap?: SourceRef; governance?: SourceRef; kpi?: SourceRef; financial?: SourceRef };
};

export type LiveKpiEntry = {
  weightedAvgPct: number | null; // 0..100
  weightedAvgScore: number | null; // 0..5
  count: number;
};

export type DashboardSnapshot = {
  matrix: Record<string, LiveMatrixEntry>;
  kpi: Record<string, LiveKpiEntry> | null;
  totals: {
    kpisCount: number;
    orgsWithKpis: number;
    extractionsCount: number;
    initiativesCount: number;
    lastUploadAt: string | null;
  };
  generatedAt: string;
};

export const loadDashboardSnapshot = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { readDashboardSnapshot } = await import("./dashboard-snapshot.server");
    return readDashboardSnapshot(context.supabase);
  });

export type InstitutionalProfileEntry = {
  fields: Record<string, string>;
  fieldCount: number;
  sourceSheet: string | null;
  fileName: string | null;
  updatedAt: string;
};

export const loadInstitutionalProfiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await (await import("./org-registry.server")).loadOrgRegistry(context.supabase);
    const { data, error } = await context.supabase
      .from("document_extractions")
      .select("entity_code, payload, file_name, created_at")
      .eq("kind", "institutional_profile")
      .order("created_at", { ascending: false });
    if (error) throw error;

    const out: Record<string, InstitutionalProfileEntry> = {};
    for (const r of data ?? []) {
      const code = String(r.entity_code ?? "");
      if (!code || !VALID_ORGS.includes(code as OrgCode)) continue;
      const payload = (r.payload ?? {}) as {
        fields?: Record<string, string>;
        source_sheet?: string;
      };
      const fields = payload.fields ?? {};
      const existing = out[code];
      if (!existing) {
        out[code] = {
          fields: { ...fields },
          fieldCount: Object.keys(fields).length,
          sourceSheet: payload.source_sheet ?? null,
          fileName: r.file_name ?? null,
          updatedAt: r.created_at,
        };
      } else {
        // older rows fill missing fields only
        for (const [k, v] of Object.entries(fields)) {
          if (!(k in existing.fields)) existing.fields[k] = v;
        }
        existing.fieldCount = Object.keys(existing.fields).length;
      }
    }
    return out;
  });

/* ------------------------------------------------------------------ */
/* حفظ نقطة زمنية (البعد الزمني) — تُستدعى عند كل رفع ناجح لبيانات      */
/* الفجوات أو الحوكمة أو المؤشرات.                                     */
/* ------------------------------------------------------------------ */
export const saveTimelineEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      orgId: string;
      domain: "composite" | "gap" | "governance" | "kpi" | "financial";
      period: string;
      periodOrder: number;
      value: number;
      note?: string | null;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    await (await import("./org-registry.server")).loadOrgRegistry(context.supabase);
    if (!VALID_ORGS.includes(data.orgId as OrgCode)) {
      return { ok: false as const, error: "invalid org" };
    }
    const { error } = await context.supabase.from("timeline_entries").upsert(
      {
        org_id: data.orgId,
        domain: data.domain,
        period: data.period,
        period_order: data.periodOrder,
        value: data.value,
        note: data.note ?? null,
      },
      { onConflict: "org_id,domain,period" },
    );
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

/* ============ Governance policies & gap scores (live editing) ============ */

export const loadGovernancePolicies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("governance_policies")
      .select("policy_id, org_id, status, note, updated_at");
    if (error) return [];
    return data ?? [];
  });

export const updatePolicyStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { policyId: string; orgId: string; status: string; note?: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("governance_policies").upsert(
      {
        policy_id: data.policyId,
        org_id: data.orgId,
        status: data.status,
        note: data.note ?? null,
        updated_by: context.userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "policy_id,org_id" },
    );
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

export const loadGapScores = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("gap_scores")
      .select("org_id, domain_index, domain_name, score, period, note, updated_at")
      .order("domain_index", { ascending: true });
    if (error) return [];
    return data ?? [];
  });

export const updateGapScore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      orgId: string;
      domainIndex: number;
      domainName: string;
      score: number;
      period: string;
      note?: string;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("gap_scores").upsert(
      {
        org_id: data.orgId,
        domain_index: data.domainIndex,
        domain_name: data.domainName,
        score: data.score,
        period: data.period || "Q2-2026",
        note: data.note ?? null,
        updated_by: context.userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "org_id,domain_index,period" },
    );
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

/* ════════════ دورات الخطط: السنة النشطة لكل مؤسسة ════════════ */

/** خريطة: كود المؤسسة → السنة النشطة. */
export const loadActiveYears = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("org_active_years").select("org_id, active_year");
    const map: Record<string, number> = {};
    for (const r of data ?? []) map[r.org_id] = r.active_year;
    return map;
  });

/** تعيين السنة النشطة لمؤسسة. */
export const setActiveYear = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orgId: string; year: number }) => d)
  .handler(async ({ data, context }) => {
    await (await import("./org-registry.server")).loadOrgRegistry(context.supabase);
    const academic = isAcademicOrg(data.orgId);
    const { error } = await context.supabase.from("org_active_years").upsert(
      {
        org_id: data.orgId,
        active_year: data.year,
        fiscal_type: academic ? "academic" : "calendar",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "org_id" },
    );
    if (error) throw error;
    return { ok: true };
  });

export const saveSectionOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { sections: string[] }) => {
    if (
      !Array.isArray(d?.sections) ||
      d.sections.some((s) => typeof s !== "string") ||
      d.sections.length > 50
    )
      throw new Error("invalid");
    return { sections: d.sections };
  })
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any)
      .from("section_order")
      .upsert(
        { user_id: context.userId, sections: data.sections, updated_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const loadSectionOrder = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await (context.supabase as any)
      .from("section_order")
      .select("sections")
      .eq("user_id", context.userId)
      .maybeSingle();
    return (data?.sections as string[] | undefined) ?? null;
  });
