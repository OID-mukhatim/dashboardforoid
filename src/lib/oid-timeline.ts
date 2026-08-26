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

/** بيانات تاريخية أولية (fallback) — تُستبدل تلقائياً ببيانات قاعدة البيانات عند توفرها. */
export const TIMELINE_SEED: TimelineEntry[] = [
  // مؤسسة زمزم — الفجوات
  { orgId: "ZF", domain: "gap", period: "H2-2025", periodOrder: 1, value: 3.30, note: "تقييم تأسيسي" },
  { orgId: "ZF", domain: "gap", period: "Q1-2026", periodOrder: 2, value: 3.44, note: "تحديث ربع أول" },
  // جامعة زمزم
  { orgId: "ZUST", domain: "gap", period: "H2-2025", periodOrder: 1, value: 3.55, note: "تقييم تأسيسي" },
  { orgId: "ZUST", domain: "gap", period: "Q1-2026", periodOrder: 2, value: 3.72, note: "تحديث ربع أول" },
  { orgId: "ZUST", domain: "governance", period: "2026-01", periodOrder: 1, value: 2.80, note: "أول تقييم حوكمي" },
  { orgId: "ZUST", domain: "governance", period: "2026-04", periodOrder: 2, value: 3.11, note: "بعد ورش العمل" },
  { orgId: "ZUST", domain: "financial", period: "Q4-2025", periodOrder: 1, value: 2.50, note: "تقييم تأسيسي" },
  { orgId: "ZUST", domain: "financial", period: "Q1-2026", periodOrder: 2, value: 3.00, note: "اعتماد QuickBooks" },
  { orgId: "ZUST", domain: "financial", period: "Q2-2026", periodOrder: 3, value: 3.20, note: "تقدم دليل السياسات" },
  // زاد للتنمية
  { orgId: "ZAD", domain: "gap", period: "H2-2025", periodOrder: 1, value: 2.85, note: "تقييم تأسيسي" },
  { orgId: "ZAD", domain: "gap", period: "Q1-2026", periodOrder: 2, value: 3.04, note: "تحديث ربع أول" },
  { orgId: "ZAD", domain: "governance", period: "2026-01", periodOrder: 1, value: 0.70, note: "أول تقييم حوكمي" },
  { orgId: "ZAD", domain: "governance", period: "2026-04", periodOrder: 2, value: 0.87, note: "تحديث أبريل" },
  // تيو للتعليم
  { orgId: "TAYO", domain: "gap", period: "H2-2025", periodOrder: 1, value: 3.30, note: "تقييم تأسيسي" },
  { orgId: "TAYO", domain: "gap", period: "Q1-2026", periodOrder: 2, value: 3.49, note: "تحديث ربع أول" },
  { orgId: "TAYO", domain: "financial", period: "Q4-2025", periodOrder: 1, value: 1.80, note: "قبل QuickBooks" },
  { orgId: "TAYO", domain: "financial", period: "Q1-2026", periodOrder: 2, value: 2.50, note: "اعتماد دليل الحسابات" },
  { orgId: "TAYO", domain: "financial", period: "Q2-2026", periodOrder: 3, value: 2.90, note: "تحديث Q2" },
  // كافي للتنمية
  { orgId: "KAFI", domain: "gap", period: "H2-2025", periodOrder: 1, value: 3.90, note: "تقييم تأسيسي" },
  { orgId: "KAFI", domain: "gap", period: "Q1-2026", periodOrder: 2, value: 4.06, note: "تحديث ربع أول" },
  { orgId: "KAFI", domain: "governance", period: "2026-01", periodOrder: 1, value: 4.20, note: "تقييم أولي" },
  { orgId: "KAFI", domain: "governance", period: "2026-04", periodOrder: 2, value: 4.40, note: "تحديث أبريل" },
];

/**
 * مصدر حي من قاعدة البيانات (timeline_entries). يُملأ عبر useLiveTimeline()،
 * ويُستخدم تلقائياً كمصدر افتراضي بدل TIMELINE_SEED عند توفره.
 */
let LIVE_TIMELINE: TimelineEntry[] | null = null;

export function setLiveTimeline(entries: TimelineEntry[] | null) {
  LIVE_TIMELINE = entries && entries.length > 0 ? entries : null;
}

export function activeTimeline(): TimelineEntry[] {
  return LIVE_TIMELINE ?? TIMELINE_SEED;
}

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
  source: TimelineEntry[] = activeTimeline(),
): TimelineEntry[] {
  return source
    .filter((e) => e.orgId === orgId && e.domain === domain)
    .sort((a, b) => a.periodOrder - b.periodOrder);
}

export function computeTrend(
  orgId: OrgId,
  domain: TimelineDomain,
  source: TimelineEntry[] = activeTimeline(),
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
