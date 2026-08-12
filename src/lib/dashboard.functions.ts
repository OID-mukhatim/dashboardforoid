/**
 * Live dashboard aggregates — single round-trip snapshot loaded from DB.
 * Powers the main cards, performance map, governance summary, and the
 * composite-score cards. Falls back gracefully when a source is missing.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type OrgCode = "ZF" | "ZUST" | "ZAD" | "TAYO" | "KAFI" | "HAMDI";
const VALID_ORGS: OrgCode[] = ["ZF", "ZUST", "ZAD", "TAYO", "KAFI", "HAMDI"];

export type LiveMatrixEntry = {
  gaps: Record<string, number>;
  gapAvg: number | null;
  govScore: number | null;
  govPct: number | null;
  finScore: number | null;
  maturity: number | null;
  source: "extraction" | null;
};

export type LiveKpiEntry = {
  weightedAvgPct: number | null; // 0..100
  weightedAvgScore: number | null; // 0..5
  count: number;
};

export type DashboardSnapshot = {
  matrix: Record<string, LiveMatrixEntry>;
  kpi: Record<string, LiveKpiEntry>;
  totals: {
    kpisCount: number;
    orgsWithKpis: number;
    extractionsCount: number;
  };
  generatedAt: string;
};

function emptyMatrix(): LiveMatrixEntry {
  return { gaps: {}, gapAvg: null, govScore: null, govPct: null, finScore: null, maturity: null, source: null };
}

export const loadDashboardSnapshot = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;

    // 1) KPI aggregates per org
    const { data: kpis, error: kpiErr } = await sb
      .from("kpis")
      .select("entity_code, achievement_pct, overall_pct, weight");
    if (kpiErr) throw kpiErr;

    const kpiAgg: Record<string, LiveKpiEntry> = {};
    for (const code of VALID_ORGS) kpiAgg[code] = { weightedAvgPct: null, weightedAvgScore: null, count: 0 };

    const byOrg = new Map<string, { wSum: number; wxSum: number; count: number }>();
    for (const r of kpis ?? []) {
      const code = String(r.entity_code ?? "");
      if (!VALID_ORGS.includes(code as OrgCode)) continue;
      const pctRaw = r.achievement_pct ?? r.overall_pct;
      if (pctRaw == null) continue;
      const pct = Number(pctRaw);
      if (!Number.isFinite(pct)) continue;
      const pct100 = pct <= 1 ? pct * 100 : pct;
      const w = Number(r.weight ?? 1) || 1;
      const cur = byOrg.get(code) ?? { wSum: 0, wxSum: 0, count: 0 };
      cur.wSum += w;
      cur.wxSum += pct100 * w;
      cur.count += 1;
      byOrg.set(code, cur);
    }
    for (const [code, v] of byOrg) {
      const pct = v.wSum > 0 ? v.wxSum / v.wSum : null;
      kpiAgg[code] = {
        weightedAvgPct: pct === null ? null : Math.round(pct * 10) / 10,
        weightedAvgScore: pct === null ? null : Math.round((pct / 20) * 100) / 100,
        count: v.count,
      };
    }

    // 2) Institutional matrix from document_extractions
    const { data: extractions, error: exErr } = await sb
      .from("document_extractions")
      .select("kind, entity_code, payload, created_at")
      .eq("kind", "institutional_matrix")
      .order("created_at", { ascending: false });
    if (exErr) throw exErr;

    const matrix: Record<string, LiveMatrixEntry> = {};
    for (const code of VALID_ORGS) matrix[code] = emptyMatrix();

    // Merge across all matrix rows per org (most recent → oldest). For each
    // field, the latest non-null value wins; gaps maps are unioned with newer
    // keys overriding older ones. This lets the Gap, Governance and Networks
    // uploads each contribute their own slice of the institutional profile.
    for (const r of extractions ?? []) {
      const code = String(r.entity_code ?? "");
      if (!VALID_ORGS.includes(code as OrgCode)) continue;
      const p = (r.payload ?? {}) as {
        gaps?: Record<string, number>;
        gov?: number;
        fin?: number;
        maturity?: number;
      };
      const cur = matrix[code];
      if (p.gaps) {
        for (const [k, v] of Object.entries(p.gaps)) {
          if (typeof v === "number" && Number.isFinite(v) && !(k in cur.gaps)) cur.gaps[k] = v;
        }
      }
      if (cur.govScore === null && typeof p.gov === "number") cur.govScore = p.gov;
      if (cur.finScore === null && typeof p.fin === "number") cur.finScore = p.fin;
      if (cur.maturity === null && typeof p.maturity === "number") cur.maturity = p.maturity;
      cur.source = "extraction";
    }
    for (const code of VALID_ORGS) {
      const cur = matrix[code];
      const gapVals = Object.values(cur.gaps).filter((v) => typeof v === "number" && Number.isFinite(v));
      if (gapVals.length) cur.gapAvg = Math.round((gapVals.reduce((a, b) => a + b, 0) / gapVals.length) * 100) / 100;
      if (cur.govScore !== null) cur.govPct = Math.round((cur.govScore / 5) * 100);
    }


    const snap: DashboardSnapshot = {
      matrix,
      kpi: kpiAgg,
      totals: {
        kpisCount: (kpis ?? []).length,
        orgsWithKpis: byOrg.size,
        extractionsCount: (extractions ?? []).length,
      },
      generatedAt: new Date().toISOString(),
    };
    return snap;
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
      const payload = (r.payload ?? {}) as { fields?: Record<string, string>; source_sheet?: string };
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


export type QuarterlyReportRecord = {
  id: string;
  orgCode: string | null;
  fileName: string;
  quarter: string | null;
  year: number | null;
  payload: Record<string, unknown>;
  createdAt: string;
};

/** التقارير الربعية المستخرجة من ملفات Excel المرفوعة. */
export const loadQuarterlyReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("document_extractions")
      .select("id, entity_code, file_name, payload, created_at")
      .eq("kind", "quarterly_report")
      .order("created_at", { ascending: false });
    if (error) throw error;

    const out: QuarterlyReportRecord[] = [];
    const seen = new Set<string>();
    for (const r of data ?? []) {
      const p = (r.payload ?? {}) as Record<string, unknown>;
      const orgCode = (r.entity_code as string | null) ?? ((p.org_code as string | null) ?? null);
      const quarter = (p.quarter as string | null) ?? null;
      const year = typeof p.year === "number" ? p.year : null;
      const key = `${orgCode ?? "?"}|${quarter ?? "?"}|${year ?? "?"}`;
      if (seen.has(key)) continue; // الأحدث يفوز
      seen.add(key);
      out.push({ id: r.id, orgCode, fileName: r.file_name, quarter, year, payload: p, createdAt: r.created_at });
    }
    return out;
  });
