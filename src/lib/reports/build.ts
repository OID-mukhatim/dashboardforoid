import { scorePlan, operationalSummary, annualResult, toDateResult, rating } from "../perf/engine";
import { PERSPECTIVES, type Activity, type KPI, type Plan, type Quarter, type Report, type ReportValue } from "../perf/types";
import { reportKpiOperands } from "./presentation";

export type ReportPeriod = Quarter | "annual";
export const REPORT_PERIODS: ReportPeriod[] = ["Q1", "Q2", "Q3", "Q4", "annual"];
export type InitiativeLite = {
  id: string; title: string; domain: string | null; priority: string; status: string; timeline: string | null; org_ids: string[];
};
export type KpiFlag = "notDue" | "missing" | "noPlan" | null;

/** Default annual-statistics rows from the template. */
export const DEFAULT_ANNUAL_STATS = [
  "الطلاب/المستفيدون",
  "الموظفون/الكادر",
  "الخريجون/المشاركون الذين أكملوا البرامج",
  "الشراكات/الفعاليات",
  "الميزانية التشغيلية",
];

export function computeKpiResult(kpis: KPI[], period: ReportPeriod) {
  const annual = period === "annual";
  const s = scorePlan(kpis, annual ? "Q4" : period);
  const ordered = [...kpis].sort(
    (a, b) => PERSPECTIVES.indexOf(a.perspective) - PERSPECTIVES.indexOf(b.perspective) || a.seq - b.seq,
  );
  return {
    basis: annual ? ("annual" as const) : ("toDate" as const),
    overall: annual ? s.annual : s.toDate,
    overallRating: annual ? s.annualRating : s.toDateRating,
    annualOverall: s.annual,
    completeness: s.completeness,
    perspectives: s.perspectives.map((p) => ({
      id: p.id,
      weight: p.weight,
      pct: annual ? p.annualPct : p.toDatePct,
      weighted: annual ? p.annual : p.toDate,
      rating: annual ? p.annualRating : rating(p.toDatePct),
      annualPct: p.annualPct,
      annualWeighted: p.annual,
    })),
    kpis: ordered.map((k) => {
      const td = toDateResult(k, annual ? "Q4" : period);
      const an = annualResult(k);
      const achieved = annual
        ? an.annual_achieved
        : (k[`${period.toLowerCase()}_actual` as keyof KPI] as number | null);
      const flag: KpiFlag = td.no_plan ? "noPlan" : !td.due ? "notDue" : td.missing ? "missing" : null;
      const operands: { planned?: number | null; displayAchieved?: number | null } = reportKpiOperands(k, period);
      return { id: k.id ?? "", code: k.code, name: k.name, achieved, ...operands, pct: td.pct, flag };
    }),
  };
}

export function buildReportSections(input: {
  plan: Plan; kpis: KPI[]; activities: Activity[]; report: Report | undefined;
  initiatives: InitiativeLite[]; period: ReportPeriod;
}) {
  const { plan, kpis, activities, report, initiatives, period } = input;
  const annual = period === "annual";
  const list = (v: Record<string, ReportValue>[] | undefined) => v ?? [];
  return {
    executive: report?.executive_summary ?? null,
    kpi: kpis.length ? computeKpiResult(kpis, period) : null,
    operational: activities.length || report?.planned_beneficiaries != null
      ? operationalSummary(activities, annual ? "Q4" : period, report?.planned_beneficiaries ?? null)
      : null,
    initiatives: initiatives
      .filter((i) => i.org_ids.includes(plan.org_id))
      .map(({ id, title, domain, priority, status, timeline }) => ({ id, title, domain, priority, status, timeline })),
    annual_stats: annual ? list(report?.annual_stats) : null,
    achievements: list(report?.achievements),
    challenges: list(report?.challenges),
    proposals: list(report?.proposals),
  };
}
export type ReportSnapshot = ReturnType<typeof buildReportSections>;

/** Non-blocking pre-approval warnings. */
export function approvalWarnings(s: ReportSnapshot) {
  const w: string[] = [];
  if (s.kpi?.kpis.some((k) => k.flag === "missing")) w.push("missing");
  if (s.kpi?.kpis.some((k) => k.flag === "noPlan")) w.push("noPlan");
  if (!s.executive?.trim() || !s.achievements.length || !s.challenges.length || !s.proposals.length) w.push("emptyNarrative");
  return w;
}
