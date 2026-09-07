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
    initiativesCount: number;
    lastUploadAt: string | null;
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
    }

    // 2b) Live governance policies + gap scores tables take precedence
    const { data: govRows } = await sb.from("governance_policies").select("org_id, status");
    const { data: gapRows } = await sb
      .from("gap_scores")
      .select("org_id, domain_index, domain_name, score")
      .eq("period", "Q2-2026");

    const GOV_WEIGHTS: Record<string, number> = {
      active: 0.9, inactive: 0.5, review: 0.4, inDev: 0.3, missing: 0, pending: 0,
    };

    for (const code of VALID_ORGS) {
      const cur = matrix[code];
      const orgPolicies = (govRows ?? []).filter((p) => p.org_id === code);
      if (orgPolicies.length > 0) {
        const raw = orgPolicies.reduce((s, p) => s + (GOV_WEIGHTS[String(p.status)] ?? 0), 0) / orgPolicies.length;
        cur.govScore = Math.round(raw * 5 * 100) / 100;
      }
      const orgGaps = (gapRows ?? []).filter((g) => g.org_id === code);
      if (orgGaps.length > 0) {
        for (const g of orgGaps) {
          const n = Number(g.score);
          if (Number.isFinite(n)) cur.gaps[String(g.domain_name)] = n;
        }
        cur.gapAvg =
          Math.round((orgGaps.reduce((s, g) => s + Number(g.score), 0) / orgGaps.length) * 100) / 100;
      }
      if (cur.govScore !== null) cur.govPct = Math.round((cur.govScore / 5) * 100);
    }




    // 3) totals: initiatives count + last upload timestamp (never throws)
    const { count: initiativesCount } = await sb
      .from("initiatives")
      .select("id", { count: "exact", head: true });
    const { data: lastUpload } = await sb
      .from("uploads")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1);

    const snap: DashboardSnapshot = {
      matrix,
      kpi: kpiAgg,
      totals: {
        kpisCount: (kpis ?? []).length,
        orgsWithKpis: byOrg.size,
        extractionsCount: (extractions ?? []).length,
        initiativesCount: initiativesCount ?? 0,
        lastUploadAt: lastUpload?.[0]?.created_at ?? null,
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any;
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

    // مزامنة تلقائية مع جدول quarterly_reports (fire-and-forget)
    void Promise.allSettled(
      out.map((r) => {
        if (!r.orgCode || !r.quarter) return Promise.resolve();
        return context.supabase
          .from("quarterly_reports")
          .upsert(
            {
              org_id: r.orgCode,
              year: r.year ?? 2026,
              quarter: r.quarter,
              title: String((r.payload as any)?.title ?? r.fileName ?? ""),
              raw: r.payload,
              upload_id: null,
            },
            { onConflict: "org_id,year,quarter,title" },
          );
      }),
    );

    return out;
  });

export type QuarterlyActivitiesResult = {
  source: "db" | "docs";
  rows: QuarterlyReportRecord[];
};

/**
 * المصدر الوحيد للتقارير الربعية: يقرأ من جدول quarterly_reports أولاً،
 * وإن كان فارغاً يعود إلى document_extractions (kind='quarterly_report').
 */
export const loadQuarterlyActivities = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<QuarterlyActivitiesResult> => {
    const { data: qr, error: qrErr } = await context.supabase
      .from("quarterly_reports")
      .select("id, org_id, year, quarter, title, raw, created_at")
      .order("created_at", { ascending: false });
    if (qrErr) throw qrErr;

    if (qr && qr.length > 0) {
      const seen = new Set<string>();
      const rows: QuarterlyReportRecord[] = [];
      for (const r of qr) {
        const key = `${r.org_id}|${r.quarter}|${r.year}`;
        if (seen.has(key)) continue; // الأحدث يفوز
        seen.add(key);
        const p = (r.raw ?? {}) as Record<string, unknown>;
        rows.push({
          id: r.id,
          orgCode: (r.org_id as string | null) ?? ((p.org_code as string | null) ?? null),
          fileName: r.title,
          quarter: r.quarter ?? ((p.quarter as string | null) ?? null),
          year: r.year ?? (typeof p.year === "number" ? p.year : null),
          payload: p,
          createdAt: r.created_at,
        });
      }
      return { source: "db", rows };
    }

    // fallback: القراءة من الاستخراجات الخام
    const { data: de, error: deErr } = await context.supabase
      .from("document_extractions")
      .select("id, entity_code, file_name, payload, created_at")
      .eq("kind", "quarterly_report")
      .order("created_at", { ascending: false });
    if (deErr) throw deErr;

    const rows: QuarterlyReportRecord[] = [];
    const seen = new Set<string>();
    for (const r of de ?? []) {
      const p = (r.payload ?? {}) as Record<string, unknown>;
      const orgCode = (r.entity_code as string | null) ?? ((p.org_code as string | null) ?? null);
      const quarter = (p.quarter as string | null) ?? null;
      const year = typeof p.year === "number" ? p.year : null;
      const key = `${orgCode ?? "?"}|${quarter ?? "?"}|${year ?? "?"}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({ id: r.id, orgCode, fileName: r.file_name, quarter, year, payload: p, createdAt: r.created_at });
    }
    return { source: "docs", rows };
  });

export type KpiAggregate = { weightedPct: number | null; count: number };

/** متوسط إنجاز مؤشرات الأداء الموزون لكل مؤسسة (0..100). */
export const loadKpiAggregates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const out: Record<string, KpiAggregate> = {};
    for (const code of VALID_ORGS) out[code] = { weightedPct: null, count: 0 };

    const { data, error } = await context.supabase
      .from("kpis")
      .select("entity_code, achievement_pct, overall_pct, weight");
    if (error || !data) return out;

    const acc = new Map<string, { wSum: number; wxSum: number; count: number }>();
    for (const r of data) {
      const code = String(r.entity_code ?? "");
      if (!VALID_ORGS.includes(code as OrgCode)) continue;
      const raw = r.achievement_pct ?? r.overall_pct;
      if (raw == null) continue;
      const pct = Number(raw);
      if (!Number.isFinite(pct)) continue;
      const pct100 = pct <= 1 ? pct * 100 : pct;
      const w = Number(r.weight ?? 1) || 1;
      const cur = acc.get(code) ?? { wSum: 0, wxSum: 0, count: 0 };
      cur.wSum += w;
      cur.wxSum += pct100 * w;
      cur.count += 1;
      acc.set(code, cur);
    }
    for (const [code, v] of acc) {
      out[code] = {
        weightedPct: v.wSum > 0 ? Math.round((v.wxSum / v.wSum) * 10) / 10 : null,
        count: v.count,
      };
    }
    return out;
  });

/* ------------------------------------------------------------------ */
/* حفظ نقطة زمنية (البعد الزمني) — تُستدعى عند كل رفع ناجح لبيانات      */
/* الفجوات أو الحوكمة أو المؤشرات.                                     */
/* ------------------------------------------------------------------ */
export const saveTimelineEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    orgId: string;
    domain: "composite" | "gap" | "governance" | "kpi" | "financial";
    period: string;
    periodOrder: number;
    value: number;
    note?: string | null;
  }) => data)
  .handler(async ({ data, context }) => {
    if (!VALID_ORGS.includes(data.orgId as OrgCode)) {
      return { ok: false as const, error: "invalid org" };
    }
    const { error } = await context.supabase
      .from("timeline_entries")
      .upsert(
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
      .select("org_id, domain_index, domain_name, score, period, note")
      .order("domain_index", { ascending: true });
    if (error) return [];
    return data ?? [];
  });

export const updateGapScore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { orgId: string; domainIndex: number; domainName: string; score: number; period: string; note?: string }) => d,
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
