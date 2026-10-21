import { govStatusScore, govAverage } from "./gov-likert";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type {
  DashboardSnapshot,
  LiveMatrixEntry,
  LiveKpiEntry,
  OrgCode,
} from "./dashboard.functions";
import { activeOrgIds } from "./org-registry";
import { loadOrgRegistry } from "./org-registry.server";
function emptyMatrix(): LiveMatrixEntry {
  return {
    gaps: {},
    gapAvg: null,
    govScore: null,
    govPct: null,
    finScore: null,
    maturity: null,
    source: null,
    sources: {},
  };
}
export async function readDashboardSnapshot(
  sb: SupabaseClient<Database>,
): Promise<DashboardSnapshot> {
  await loadOrgRegistry(sb);
  const VALID_ORGS: OrgCode[] = activeOrgIds();

  // 2) Institutional matrix from document_extractions
  const { data: extractions, error: exErr } = await sb
    .from("document_extractions")
    .select("kind, entity_code, payload, created_at, file_name")
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
    const gapVals = Object.values(cur.gaps).filter(
      (v) => typeof v === "number" && Number.isFinite(v),
    );
    if (gapVals.length)
      cur.gapAvg = Math.round((gapVals.reduce((a, b) => a + b, 0) / gapVals.length) * 100) / 100;
  }

  // 2b) Live governance policies + gap scores tables take precedence
  const { data: govRows } = await sb
    .from("governance_policies")
    .select("org_id, status, updated_at");
  const { data: gapRows } = await sb
    .from("gap_scores")
    .select("org_id, domain_index, domain_name, score, period, updated_at")
    .order("updated_at", { ascending: false });

  for (const code of VALID_ORGS) {
    const cur = matrix[code];
    // سلم GOV_LIKERT المشترك؛ pending وغير المعروف يُستبعدان من البسط والمقام
    const orgPolicies = (govRows ?? []).filter(
      (p) => p.org_id === code && govStatusScore(p.status) !== null,
    );
    if (orgPolicies.length > 0) {
      const raw = govAverage(orgPolicies.map((p) => govStatusScore(p.status)))!;
      cur.govScore = Math.round(raw * 100) / 100;
      const latest = orgPolicies.reduce<string | null>(
        (m, p) => (p.updated_at && (!m || p.updated_at > m) ? p.updated_at : m),
        null,
      );
      cur.sources.governance = { label: "تحديث السياسات", updatedAt: latest };
    }
    // أحدث فترة للمؤسسة بحسب updated_at — لا فلترة بفترة ثابتة
    const orgGapRows = (gapRows ?? []).filter((g) => g.org_id === code);
    if (orgGapRows.length > 0) {
      const latestPeriod = orgGapRows[0].period as string; // مرتبة تنازلياً بـ updated_at
      const periodRows = orgGapRows.filter((g) => g.period === latestPeriod);
      for (const g of periodRows) {
        const n = Number(g.score);
        if (Number.isFinite(n)) cur.gaps[String(g.domain_name)] = n;
      }
      cur.gapAvg =
        Math.round(
          (periodRows.reduce((s, g) => s + Number(g.score), 0) / periodRows.length) * 100,
        ) / 100;
      cur.sources.gap = {
        label: `تقييم الفجوات — ${latestPeriod}`,
        updatedAt: orgGapRows[0].updated_at ?? null,
      };
    }
    if (cur.govScore !== null) cur.govPct = Math.round((cur.govScore / 5) * 100);
  }

  // 2c) Financial score — computed live, updates automatically with every upload:
  //   60% cumulative advisor progress across ALL monthly advisor reports
  //       (recency-weighted average of program-status points per report),
  //   40% budget execution rate from financial reports (actual / approved).
  //   If only one source exists for an org, it is used alone.
  const STATUS_PTS: Record<string, number> = { done: 5, inProgress: 3, delayed: 1.5, notYet: 1 };
  const { data: advRows } = await sb
    .from("advisor_snapshots")
    .select("period_order, done, program, updated_at, period")
    .eq("done", true)
    .order("period_order", { ascending: true });
  const { data: finRows } = await sb
    .from("financial_reports")
    .select("org_id, approved_budget, actual_spending, updated_at");
  for (const code of VALID_ORGS) {
    let wSum = 0,
      wxSum = 0,
      idx = 0;
    for (const r of advRows ?? []) {
      const rows = ((r.program ?? {}) as Record<string, { status?: string }[]>)[code];
      if (!Array.isArray(rows) || rows.length === 0) continue;
      const pts = rows.map((x) => STATUS_PTS[String(x.status)] ?? 0);
      const avg = pts.reduce((a, b) => a + b, 0) / pts.length;
      idx += 1; // older reports count, newer ones count more
      wSum += idx;
      wxSum += avg * idx;
    }
    const advisor = wSum > 0 ? wxSum / wSum : null;
    let appr = 0,
      act = 0;
    for (const f of finRows ?? []) {
      if (f.org_id !== code) continue;
      const a = Number(f.approved_budget),
        b = Number(f.actual_spending);
      if (Number.isFinite(a) && a > 0 && Number.isFinite(b)) {
        appr += a;
        act += b;
      }
    }
    let budget: number | null = null;
    if (appr > 0) {
      const ratio = act / appr;
      budget = ratio <= 1 ? 5 * ratio : Math.max(0, 5 - (ratio - 1) * 10); // overspending is penalised
    }
    const fin =
      advisor !== null && budget !== null ? advisor * 0.6 + budget * 0.4 : (advisor ?? budget);
    if (fin !== null) matrix[code].finScore = Math.round(fin * 100) / 100;
    // مصدر المكوّن المالي: أحدث تحديث بين تقارير المستشار والتقارير المالية
    const orgFin = (finRows ?? []).filter((f) => f.org_id === code);
    const latestAdv = (advRows ?? []).reduce<string | null>(
      (m, r) => (r.updated_at && (!m || r.updated_at > m) ? r.updated_at : m),
      null,
    );
    const latestFin = orgFin.reduce<string | null>(
      (m, f) => (f.updated_at && (!m || f.updated_at > m) ? f.updated_at : m),
      null,
    );
    const latest = [latestAdv, latestFin].filter(Boolean).sort().pop() ?? null;
    if (latest) {
      matrix[code].sources.financial = {
        label: latestAdv && latestAdv === latest ? "تقارير المستشار المالي" : "التقارير المالية",
        updatedAt: latest,
      };
    }
  }

  // شارات المصدر المتبقية: الفجوات من الاستخراجات (عند غياب gap_scores) والمؤشرات من ملفات الرفع
  for (const code of VALID_ORGS) {
    const cur = matrix[code];
    if (!cur.sources.gap && Object.keys(cur.gaps).length > 0) {
      const ex = (extractions ?? []).find((r) => String(r.entity_code ?? "") === code);
      cur.sources.gap = {
        label: ex?.file_name ?? "ملف البيانات المؤسسية",
        updatedAt: ex?.created_at ?? null,
      };
    }
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

  // 4) KPI component: snapshot of the latest approved report in each org's active year
  const { kpiComponent } = await import("./reports/integration");
  const [plansRes, reportsRes, activeRes] = await Promise.all([
    sb.from("perf_plans").select("id, org_id, plan_year, fiscal_type"),
    sb.from("perf_reports").select("plan_id, period, status, approved_at, snapshot").eq("status", "approved"),
    sb.from("org_active_years").select("org_id, active_year"),
  ]);
  const activeYear = Object.fromEntries((activeRes.data ?? []).map((r) => [r.org_id, r.active_year]));
  const kpi: Record<string, LiveKpiEntry> = {};
  for (const code of VALID_ORGS) {
    const plan = (plansRes.data ?? []).find((p) => p.org_id === code && p.plan_year === activeYear[code]);
    const c = kpiComponent((reportsRes.data ?? []) as never, plan);
    if (!c) continue;
    kpi[code] = { weightedAvgPct: c.score * 20, weightedAvgScore: c.score, count: 1 };
    const label = c.period === "annual" ? "السنوي" : c.period;
    matrix[code].sources.kpi = { label: `تقرير ${label} المعتمد — ${c.approvedAt?.slice(0, 10) ?? ""}`, updatedAt: c.approvedAt };
  }

  const snap: DashboardSnapshot = {
    matrix,
    kpi,
    totals: {
      kpisCount: 0,
      orgsWithKpis: 0,
      extractionsCount: (extractions ?? []).length,
      initiativesCount: initiativesCount ?? 0,
      lastUploadAt: lastUpload?.[0]?.created_at ?? null,
    },
    generatedAt: new Date().toISOString(),
  };
  return snap;
}
