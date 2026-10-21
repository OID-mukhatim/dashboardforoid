import { annualResult, quarterIndex, toDateResult } from "../perf/engine";
import type { KPI, ReportValue } from "../perf/types";
import type { ReportPeriod } from "./build";

export const formatReportNumber = (v: unknown): string =>
  typeof v === "number" && Number.isFinite(v)
    ? v.toLocaleString("en-US", { maximumFractionDigits: 2 })
    : v === null || v === undefined || v === "" ? "—" : String(v);

/** Display operands only; scoring always remains in the unchanged engine. Q4 uses its annual basis. */
export function reportKpiOperands(k: KPI, period: ReportPeriod) {
  if (period === "annual" || period === "Q4")
    return { planned: k.annual_target, displayAchieved: annualResult(k).annual_achieved };
  const plans = [k.q1_plan, k.q2_plan, k.q3_plan, k.q4_plan];
  const actuals = [k.q1_actual, k.q2_actual, k.q3_actual, k.q4_actual];
  const indices = plans.flatMap((p, i) => typeof p === "number" && Number.isFinite(p) && i < quarterIndex(period) ? [i] : []);
  if (!indices.length) return { planned: null, displayAchieved: null };
  const aggregate = (values: number[]) => k.calc_method.endsWith("cumulative")
    ? values.at(-1) ?? null
    : k.calc_method.endsWith("average") ? values.reduce((a, b) => a + b, 0) / values.length
    : values.reduce((a, b) => a + b, 0);
  const planned = aggregate(indices.map((i) => plans[i]).filter((v): v is number => typeof v === "number"));
  const result = toDateResult(k, period);
  return { planned, displayAchieved: result.missing ? null : aggregate(indices.map((i) => actuals[i]).filter((v): v is number => typeof v === "number")) };
}

/** Convert only explicitly numeric narrative fields, never identifiers or free text. */
export function reportNumericValue(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value.replace(/,/g, "")) : NaN;
  return Number.isFinite(n) ? n : null;
}
export function numericNarrativeRows(rows: Record<string, ReportValue>[], keys: string[]) {
  return rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, keys.includes(k) ? reportNumericValue(v) : v])) as Record<string, ReportValue>);
}