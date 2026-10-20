import { PERSPECTIVES, type KPI, type Quarter, type Activity } from './types';
export const quarterIndex = (period: Quarter) => Number(period.slice(1));
const present = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v);
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
const average = (values: number[]) => sum(values) / values.length;
export function rating(pct: number | null) {
  return pct === null ? null : pct < 60 ? 'weak' : pct < 75 ? 'average' : pct < 90 ? 'good' : 'excellent';
}
export function percentage(actual: number | null, target: number | null, polarity: KPI['polarity']): number | null {
  if (!present(actual) || !present(target)) return null;
  if (polarity === 'desc') return actual === 0 ? 100 : target / actual * 100;
  return target === 0 ? null : actual / target * 100;
}
function actuals(kpi: KPI) { return [kpi.q1_actual, kpi.q2_actual, kpi.q3_actual, kpi.q4_actual]; }
function plans(kpi: KPI) { return [kpi.q1_plan, kpi.q2_plan, kpi.q3_plan, kpi.q4_plan]; }
export function annualResult(kpi: KPI) {
  const values = actuals(kpi).filter(present);
  let annual_achieved: number | null = null;
  if (values.length) {
    if (kpi.calc_method === 'annual') annual_achieved = kpi.q4_actual;
    else if (kpi.calc_method.endsWith('cumulative')) annual_achieved = values[values.length - 1] ?? null;
    else if (kpi.calc_method.endsWith('average')) annual_achieved = average(values);
    else annual_achieved = sum(values);
  }
  const total_bt = !present(kpi.baseline) || !present(kpi.annual_target) || kpi.calc_method.endsWith('average') || kpi.unit === 'likert' || kpi.measurement === 'qual' ? null : kpi.baseline + kpi.annual_target;
  const annual_pct = percentage(annual_achieved, kpi.annual_target, kpi.polarity);
  return { total_bt, annual_achieved, annual_pct, weighted: annual_pct === null ? null : Math.min(annual_pct, 100) / 100 * kpi.weight };
}
export function toDateResult(kpi: KPI, period: Quarter) {
  const planned = plans(kpi); const actual = actuals(kpi);
  const no_plan = !planned.some(present);
  if (period === 'Q4') {
    const annual = annualResult(kpi);
    return { due: true, missing: annual.annual_achieved === null, no_plan, pct: annual.annual_pct, weighted: annual.weighted };
  }
  const eligible = planned.map((v, i) => present(v) && i < quarterIndex(period) ? i : -1).filter(i => i >= 0);
  if (!eligible.length) return { due: false, missing: false, no_plan, pct: null, weighted: null };
  if (eligible.some(i => !present(actual[i]))) return { due: true, missing: true, no_plan, pct: 0, weighted: 0 };
  const a = eligible.map(i => actual[i]).filter(present); const p = eligible.map(i => planned[i]).filter(present);
  let achieved = sum(a); let target = sum(p);
  if (kpi.calc_method.endsWith('cumulative')) { achieved = a[a.length - 1] ?? 0; target = p[p.length - 1] ?? 0; }
  else if (kpi.calc_method.endsWith('average')) { achieved = average(a); target = average(p); }
  const pct = percentage(achieved, target, kpi.polarity);
  return { due: true, missing: false, no_plan, pct, weighted: pct === null ? null : Math.min(pct, 100) / 100 * kpi.weight };
}
export function scorePlan(kpis: KPI[], period: Quarter) {
  const rows = kpis.map(kpi => ({ kpi, annual: annualResult(kpi), toDate: toDateResult(kpi, period) }));
  const perspectives = PERSPECTIVES.map(id => {
    const group = rows.filter(r => r.kpi.perspective === id);
    const weight = sum(group.map(r => r.kpi.weight));
    const annual = sum(group.map(r => r.annual.weighted ?? 0));
    const due = group.filter(r => r.toDate.due);
    const dueWeight = sum(due.map(r => r.kpi.weight));
    const toDate = period === 'Q4' ? annual : !due.length || dueWeight === 0 ? null : sum(due.map(r => r.toDate.weighted ?? 0)) / dueWeight * 25;
    const annualPct = weight === 0 ? null : annual / weight * 100;
    return { id, weight, annual, annualPct, annualRating: rating(annualPct), toDate, toDatePct: toDate === null ? null : toDate / 25 * 100, dueWeight };
  });
  const annual = sum(perspectives.map(p => p.annual));
  const measured = perspectives.map(p => p.toDate).filter(present);
  const toDate = period === 'Q4' ? annual : measured.length ? sum(measured) / (25 * measured.length) * 100 : null;
  const due = rows.filter(r => r.toDate.due); const complete = due.filter(r => !r.toDate.missing).length;
  return { rows, perspectives, annual, annualRating: rating(annual), toDate, toDateRating: rating(toDate), due: due.length, complete, completeness: due.length ? complete / due.length : null };
}
export function activityResult(activity: Pick<Activity, 'planned' | 'achieved'>) {
  return !present(activity.planned) || activity.planned === 0 || !present(activity.achieved) ? null : activity.achieved / activity.planned * 100;
}
export function activityTotals(activities: Activity[]) {
  const aggregate = (rows: Activity[]) => {
    const beneficiaries = sum(rows.map(a => a.beneficiaries ?? 0)); const planned = sum(rows.map(a => a.planned ?? 0)); const achieved = sum(rows.map(a => a.achieved ?? 0));
    return { beneficiaries, planned, achieved, pct: activityResult({ planned, achieved }) };
  };
  return { program: aggregate(activities.filter(a => a.activity_type === 'program')), event: aggregate(activities.filter(a => a.activity_type === 'event')), training: aggregate(activities.filter(a => a.activity_type === 'training')), total: aggregate(activities) };
}
export function operationalSummary(activities: Activity[], period: Quarter, plannedBeneficiaries: number | null) {
  const totals = activityTotals(activities.filter(a => quarterIndex(a.quarter) <= quarterIndex(period)));
  const line = (planned: number | null, achieved: number) => { const pct = activityResult({ planned, achieved }); return { planned, achieved, pct, rating: rating(pct) }; };
  return { program: line(totals.program.planned, totals.program.achieved), beneficiaries: line(plannedBeneficiaries, totals.program.beneficiaries), event: line(totals.event.planned, totals.event.achieved), training: line(totals.training.planned, totals.training.achieved) };
}
