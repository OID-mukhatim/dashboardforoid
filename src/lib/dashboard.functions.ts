/**
 * Live dashboard aggregates — single round-trip snapshot loaded from DB.
 * Powers the main cards, performance map, governance summary, and the
 * composite-score cards. Falls back gracefully when a source is missing.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type OrgCode = "ZF" | "ZUST" | "ZAD" | "TAYO" | "KAFI" | "HAMDI";
const VALID_ORGS: OrgCode[] = ["ZF", "ZUST", "ZAD", "TAYO", "KAFI", "HAMDI"];

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

    const [{ data, error }, { data: activeYearRows }] = await Promise.all([
      context.supabase.from("kpis").select("entity_code, achievement_pct, overall_pct, weight, plan_year"),
      context.supabase.from("org_active_years").select("org_id, active_year"),
    ]);
    if (error || !data) return out;
    const activeYearOf = new Map<string, number>();
    for (const r of activeYearRows ?? []) activeYearOf.set(String(r.org_id), Number(r.active_year));

    const acc = new Map<string, { wSum: number; wxSum: number; count: number }>();
    for (const r of data) {
      const code = String(r.entity_code ?? "");
      if (!VALID_ORGS.includes(code as OrgCode)) continue;
      const activeYear = activeYearOf.get(code);
      if (activeYear === undefined || Number(r.plan_year) !== activeYear) continue;
      const raw = r.achievement_pct ?? r.overall_pct;
      if (raw == null) continue;
      const pct = Number(raw); // النسب تُخزَّن 0–100 كما هي — لا تحويل تلقائي
      if (!Number.isFinite(pct)) continue;
      const w = Number(r.weight ?? 1) || 1;
      const cur = acc.get(code) ?? { wSum: 0, wxSum: 0, count: 0 };
      cur.wSum += w;
      cur.wxSum += pct * w;
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
      .select("org_id, domain_index, domain_name, score, period, note, updated_at")
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

/** مؤشرات السنة النشطة فقط لكل مؤسسة. */
export const loadActiveKPIs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const { data: activeYears } = await sb.from("org_active_years").select("org_id, active_year");
    if (!activeYears || activeYears.length === 0) {
      const { data } = await sb.from("kpis").select("*");
      return data ?? [];
    }
    const results = await Promise.all(
      activeYears.map(({ org_id, active_year }) =>
        sb.from("kpis").select("*").eq("entity_code", org_id).eq("plan_year", active_year),
      ),
    );
    return results.flatMap((r) => r.data ?? []);
  });

/** كل السنوات المتاحة لمؤسسة (تنازلياً). */
export const loadAvailableYears = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orgId: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: years } = await context.supabase
      .from("kpis")
      .select("plan_year")
      .eq("entity_code", data.orgId)
      .not("plan_year", "is", null);
    const unique = Array.from(new Set((years ?? []).map((r) => r.plan_year).filter((y): y is number => typeof y === "number")));
    return unique.sort((a, b) => b - a);
  });

/** مؤشرات مؤسسة بسنة محددة (مقارنة يدوية). */
export const loadKPIsByYear = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orgId: string; year: number }) => d)
  .handler(async ({ data, context }) => {
    const { data: kpis } = await context.supabase
      .from("kpis")
      .select("*")
      .eq("entity_code", data.orgId)
      .eq("plan_year", data.year)
      .order("kpi_code");
    return kpis ?? [];
  });

/** تعيين السنة النشطة لمؤسسة. */
export const setActiveYear = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orgId: string; year: number }) => d)
  .handler(async ({ data, context }) => {
    const academic = ["ZUST", "TAYO", "HAMDI"].includes(data.orgId);
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
    if (!Array.isArray(d?.sections) || d.sections.some((s) => typeof s !== "string") || d.sections.length > 50) throw new Error("invalid");
    return { sections: d.sections };
  })
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any)
      .from("section_order")
      .upsert({ user_id: context.userId, sections: data.sections, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const loadSectionOrder = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await (context.supabase as any)
      .from("section_order").select("sections").eq("user_id", context.userId).maybeSingle();
    return (data?.sections as string[] | undefined) ?? null;
  });
