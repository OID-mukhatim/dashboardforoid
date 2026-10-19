import { govStatusScore, govAverage } from "./gov-likert";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { DashboardSnapshot, LiveMatrixEntry, LiveKpiEntry, OrgCode } from "./dashboard.functions";
import { activeOrgIds } from "./org-registry";
import { loadOrgRegistry } from "./org-registry.server";
function emptyMatrix(): LiveMatrixEntry { return { gaps: {}, gapAvg: null, govScore: null, govPct: null, finScore: null, maturity: null, source: null, sources: {} }; }
export async function readDashboardSnapshot(sb: SupabaseClient<Database>): Promise<DashboardSnapshot> {
    await loadOrgRegistry(sb);
    const VALID_ORGS: OrgCode[] = activeOrgIds();


    // 1) KPI aggregates per org — السنة النشطة فقط لكل مؤسسة (org_active_years)
    const [{ data: kpis, error: kpiErr }, { data: activeYearRows }] = await Promise.all([
      sb.from("kpis").select("entity_code, achievement_pct, overall_pct, weight, plan_year, upload_id"),
      sb.from("org_active_years").select("org_id, active_year"),
    ]);
    if (kpiErr) throw kpiErr;
    const activeYearOf = new Map<string, number>();
    for (const r of activeYearRows ?? []) activeYearOf.set(String(r.org_id), Number(r.active_year));

    const kpiAgg: Record<string, LiveKpiEntry> = {};
    for (const code of VALID_ORGS) kpiAgg[code] = { weightedAvgPct: null, weightedAvgScore: null, count: 0 };

    const byOrg = new Map<string, { wSum: number; wxSum: number; count: number }>();
    const kpiOrgUploads = new Map<string, Set<string>>();
    for (const r of kpis ?? []) {
      const code = String(r.entity_code ?? "");
      if (!VALID_ORGS.includes(code as OrgCode)) continue;
      const activeYear = activeYearOf.get(code);
      if (activeYear === undefined || Number(r.plan_year) !== activeYear) continue;
      if (r.upload_id) {
        if (!kpiOrgUploads.has(code)) kpiOrgUploads.set(code, new Set());
        kpiOrgUploads.get(code)!.add(String(r.upload_id));
      }
      const pctRaw = r.achievement_pct ?? r.overall_pct;
      if (pctRaw == null) continue;
      const pct = Number(pctRaw); // النسب تُخزَّن 0–100 كما هي — لا تحويل تلقائي
      if (!Number.isFinite(pct)) continue;
      const w = Number(r.weight ?? 1) || 1;
      const cur = byOrg.get(code) ?? { wSum: 0, wxSum: 0, count: 0 };
      cur.wSum += w;
      cur.wxSum += pct * w;
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

    // أسماء ملفات المؤشرات لشارة المصدر
    const kpiUploadIds = [...new Set([...kpiOrgUploads.values()].flatMap((s) => [...s]))];
    const uploadMeta = new Map<string, { file_name: string | null; created_at: string | null }>();
    if (kpiUploadIds.length > 0) {
      const { data: ups } = await sb
        .from("uploads")
        .select("id, file_name, created_at")
        .in("id", kpiUploadIds);
      for (const u of ups ?? []) uploadMeta.set(String(u.id), { file_name: u.file_name, created_at: u.created_at });
    }

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
      const gapVals = Object.values(cur.gaps).filter((v) => typeof v === "number" && Number.isFinite(v));
      if (gapVals.length) cur.gapAvg = Math.round((gapVals.reduce((a, b) => a + b, 0) / gapVals.length) * 100) / 100;
    }

    // 2b) Live governance policies + gap scores tables take precedence
    const { data: govRows } = await sb.from("governance_policies").select("org_id, status, updated_at");
    const { data: gapRows } = await sb
      .from("gap_scores")
      .select("org_id, domain_index, domain_name, score, period, updated_at")
      .order("updated_at", { ascending: false });

    for (const code of VALID_ORGS) {
      const cur = matrix[code];
      // سلم GOV_LIKERT المشترك؛ pending وغير المعروف يُستبعدان من البسط والمقام
      const orgPolicies = (govRows ?? []).filter((p) => p.org_id === code && govStatusScore(p.status) !== null);
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
          Math.round((periodRows.reduce((s, g) => s + Number(g.score), 0) / periodRows.length) * 100) / 100;
        cur.sources.gap = { label: `تقييم الفجوات — ${latestPeriod}`, updatedAt: orgGapRows[0].updated_at ?? null };
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
      let wSum = 0, wxSum = 0, idx = 0;
      for (const r of advRows ?? []) {
        const rows = ((r.program ?? {}) as Record<string, { status?: string }[]>)[code];
        if (!Array.isArray(rows) || rows.length === 0) continue;
        const pts = rows.map((x) => STATUS_PTS[String(x.status)] ?? 0);
        const avg = pts.reduce((a, b) => a + b, 0) / pts.length;
        idx += 1; // older reports count, newer ones count more
        wSum += idx; wxSum += avg * idx;
      }
      const advisor = wSum > 0 ? wxSum / wSum : null;
      let appr = 0, act = 0;
      for (const f of finRows ?? []) {
        if (f.org_id !== code) continue;
        const a = Number(f.approved_budget), b = Number(f.actual_spending);
        if (Number.isFinite(a) && a > 0 && Number.isFinite(b)) { appr += a; act += b; }
      }
      let budget: number | null = null;
      if (appr > 0) {
        const ratio = act / appr;
        budget = ratio <= 1 ? 5 * ratio : Math.max(0, 5 - (ratio - 1) * 10); // overspending is penalised
      }
      const fin =
        advisor !== null && budget !== null ? advisor * 0.6 + budget * 0.4 : advisor ?? budget;
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
        cur.sources.gap = { label: ex?.file_name ?? "ملف البيانات المؤسسية", updatedAt: ex?.created_at ?? null };
      }
      const upIds = kpiOrgUploads.get(code);
      if (upIds && upIds.size > 0) {
        let best: { file_name: string | null; created_at: string | null } | null = null;
        for (const id of upIds) {
          const m = uploadMeta.get(id);
          if (m && (!best || (m.created_at ?? "") > (best.created_at ?? ""))) best = m;
        }
        if (best) cur.sources.kpi = { label: best.file_name ?? "مصفوفة المؤشرات", updatedAt: best.created_at };
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
}
