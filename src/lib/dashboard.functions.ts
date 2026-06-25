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

    // Latest row wins per org
    const seen = new Set<string>();
    for (const r of extractions ?? []) {
      const code = String(r.entity_code ?? "");
      if (!VALID_ORGS.includes(code as OrgCode) || seen.has(code)) continue;
      seen.add(code);
      const p = (r.payload ?? {}) as {
        gaps?: Record<string, number>;
        gov?: number;
        fin?: number;
        maturity?: number;
      };
      const gaps = p.gaps ?? {};
      const gapVals = Object.values(gaps).filter((v) => typeof v === "number" && Number.isFinite(v));
      const gapAvg = gapVals.length ? gapVals.reduce((a, b) => a + b, 0) / gapVals.length : null;
      const gov = typeof p.gov === "number" ? p.gov : null;
      matrix[code] = {
        gaps,
        gapAvg: gapAvg !== null ? Math.round(gapAvg * 100) / 100 : null,
        govScore: gov,
        govPct: gov !== null ? Math.round((gov / 5) * 100) : null,
        finScore: typeof p.fin === "number" ? p.fin : null,
        maturity: typeof p.maturity === "number" ? p.maturity : null,
        source: "extraction",
      };
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

