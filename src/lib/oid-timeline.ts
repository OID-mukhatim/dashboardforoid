/**
 * المحور الثالث: البعد الزمني — دوريات مرنة لكل مؤسسة/مجال.
 *
 * البنية مرنة: كل قيد يحمل (orgId, domain, period, value, recordedAt)
 * — period حر النص (مثلاً "2025-Q1", "2025-09", "2024", "أسبوع 12").
 *
 * عند رفع بيانات تاريخية لاحقاً، أضِفها إلى TIMELINE_SEED أو
 * استبدلها بقراءة من قاعدة البيانات. الواجهة تتعامل مع المصفوفة الفارغة.
 */

import type { OrgId } from "./oid-data";

export type TimelineDomain =
  | "composite"
  | "gap"
  | "governance"
  | "kpi"
  | "financial";

export type TimelineEntry = {
  orgId: OrgId;
  domain: TimelineDomain;
  period: string;        // مثلاً: "2025-Q1" أو "2025-09"
  periodOrder: number;   // ترتيب رقمي تصاعدي للترتيب الزمني
  value: number;         // 0..5 للدرجات، أو نسبة 0..100، حسب المجال
  recordedAt?: string;   // ISO date
  note?: string;
};

/** بذرة فارغة — تُملأ لاحقاً عند رفع بيانات تاريخية. */
export const TIMELINE_SEED: TimelineEntry[] = [];

export type TrendDirection = "up" | "down" | "flat" | "noData";

export type TrendResult = {
  direction: TrendDirection;
  delta: number | null;          // value(latest) - value(previous)
  pctChange: number | null;      // (delta / previous) * 100
  latest: TimelineEntry | null;
  previous: TimelineEntry | null;
  series: TimelineEntry[];
};

const EMPTY: TrendResult = {
  direction: "noData",
  delta: null,
  pctChange: null,
  latest: null,
  previous: null,
  series: [],
};

export function getSeries(
  orgId: OrgId,
  domain: TimelineDomain,
  source: TimelineEntry[] = TIMELINE_SEED,
): TimelineEntry[] {
  return source
    .filter((e) => e.orgId === orgId && e.domain === domain)
    .sort((a, b) => a.periodOrder - b.periodOrder);
}

export function computeTrend(
  orgId: OrgId,
  domain: TimelineDomain,
  source: TimelineEntry[] = TIMELINE_SEED,
): TrendResult {
  const series = getSeries(orgId, domain, source);
  if (series.length === 0) return EMPTY;
  const latest = series[series.length - 1];
  if (series.length === 1) {
    return { ...EMPTY, latest, series, direction: "flat", delta: 0, pctChange: 0 };
  }
  const previous = series[series.length - 2];
  const delta = latest.value - previous.value;
  const pctChange = previous.value !== 0 ? (delta / previous.value) * 100 : null;
  const direction: TrendDirection =
    Math.abs(delta) < 0.01 ? "flat" : delta > 0 ? "up" : "down";
  return { direction, delta, pctChange, latest, previous, series };
}
