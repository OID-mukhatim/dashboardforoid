import type { Quarter } from "../perf/types";
import type { ReportPeriod } from "./build";

type PlanLite = { id: string; org_id: string; plan_year: number; fiscal_type: string };
type ReportLite = { plan_id: string; period: string; status: string; approved_at: string | null; snapshot: any };

/** Last calendar day of a quarter for the org's fiscal calendar (academic year starts in October). */
export function quarterEnd(fiscal: string, year: number, q: Quarter): Date {
  const i = Number(q.slice(1));
  const startMonth = fiscal === "academic" ? 9 : 0; // 0-based
  const endMonthIndex = startMonth + i * 3; // first month after the quarter
  return new Date(Date.UTC(year, endMonthIndex, 0));
}

/** Latest approved report in the active year: annual wins, else latest approved quarter (to-date). */
export function latestApproved(reports: ReportLite[], planId: string) {
  const mine = reports.filter((r) => r.plan_id === planId && r.status === "approved" && r.snapshot);
  const annual = mine.find((r) => r.period === "annual");
  if (annual) return annual;
  return mine.filter((r) => r.period !== "annual").sort((a, b) => b.period.localeCompare(a.period))[0] ?? null;
}

/** KPI composite component (0–5) from the approved snapshot. */
export function kpiComponent(reports: ReportLite[], plan: PlanLite | undefined) {
  if (!plan) return null;
  const r = latestApproved(reports, plan.id);
  const overall = r?.snapshot?.kpi?.overall;
  if (!r || typeof overall !== "number") return null;
  return { score: overall / 20, period: r.period as ReportPeriod, approvedAt: r.approved_at };
}

export type ReportAlert =
  | { kind: "lateReport"; orgId: string; quarter: Quarter; year: number; daysLate: number }
  | { kind: "weakPerspective"; orgId: string; perspective: string; pct: number; period: string };

export function reportAlerts(input: {
  plans: PlanLite[]; reports: ReportLite[]; activeYears: Record<string, number>; activeOrgIds: string[]; now: Date;
}): ReportAlert[] {
  const out: ReportAlert[] = [];
  for (const org of input.activeOrgIds) {
    const year = input.activeYears[org];
    const plan = input.plans.find((p) => p.org_id === org && p.plan_year === year);
    if (!plan) continue;
    for (const q of ["Q1", "Q2", "Q3", "Q4"] as Quarter[]) {
      const days = Math.floor((input.now.getTime() - quarterEnd(plan.fiscal_type, year, q).getTime()) / 86400000);
      const approved = input.reports.some((r) => r.plan_id === plan.id && r.period === q && r.status === "approved");
      if (days > 30 && !approved) out.push({ kind: "lateReport", orgId: org, quarter: q, year, daysLate: days });
    }
    const last = latestApproved(input.reports, plan.id);
    for (const p of last?.snapshot?.kpi?.perspectives ?? []) {
      if (typeof p.pct === "number" && p.pct < 60)
        out.push({ kind: "weakPerspective", orgId: org, perspective: p.id, pct: p.pct, period: last!.period });
    }
  }
  return out;
}
