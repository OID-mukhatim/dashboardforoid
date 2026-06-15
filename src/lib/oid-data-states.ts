/**
 * المحور الثاني: تمييز حالات البيانات بصرياً
 * - achieved : قيمة موجودة وصحيحة
 * - zero     : محقق ولكن قيمته صفر
 * - noData   : لم تُدخَل بيانات بعد
 * - na       : لا ينطبق على هذه المؤسسة
 */

export type DataStateCode = "achieved" | "zero" | "noData" | "na";

export const DATA_STATES: Record<Exclude<DataStateCode, "achieved">, {
  code: DataStateCode;
  label: string;
  display: string;
  color: string;
  bg: string;
  icon: string;
  tooltip: string;
}> = {
  zero: {
    code: "zero",
    label: "صفر — لم يتحقق شيء",
    display: "0",
    color: "#dc2626",
    bg: "#fee2e2",
    icon: "✗",
    tooltip: "محقق ولكن قيمته صفر",
  },
  noData: {
    code: "noData",
    label: "لم تُدخَل بيانات",
    display: "—",
    color: "#94a3b8",
    bg: "#f8fafc",
    icon: "⏳",
    tooltip: "البيانات لم تُرفع بعد",
  },
  na: {
    code: "na",
    label: "لا ينطبق",
    display: "N/A",
    color: "#64748b",
    bg: "#f1f5f9",
    icon: "◌",
    tooltip: "هذا المعيار لا ينطبق على هذه المؤسسة",
  },
};

/** يستنتج حالة قيمة عددية من قيمتها الخام. */
export function inferState(v: number | null | undefined, naFlag = false): DataStateCode {
  if (naFlag) return "na";
  if (v === null || v === undefined || Number.isNaN(v)) return "noData";
  if (v === 0) return "zero";
  return "achieved";
}

/** حساب متوسط ذكي يفصل بين الحالات الأربع. */
export function smartAverage(
  entries: { value: number | null; state: DataStateCode }[],
): {
  avg: number | null;
  achievedCount: number;
  zeroCount: number;
  noDataCount: number;
  naCount: number;
  dataQuality: number; // 0..1
} {
  const achieved = entries.filter((e) => e.state === "achieved" && e.value !== null);
  const zeros = entries.filter((e) => e.state === "zero");
  const noData = entries.filter((e) => e.state === "noData");
  const na = entries.filter((e) => e.state === "na");

  const denom = achieved.length + zeros.length;
  const avg =
    denom > 0
      ? (achieved.reduce((s, e) => s + (e.value as number), 0) + zeros.length * 0) / denom
      : null;

  const totalCountable = entries.length - na.length;
  const dataQuality = totalCountable > 0 ? achieved.length / totalCountable : 0;

  return {
    avg,
    achievedCount: achieved.length,
    zeroCount: zeros.length,
    noDataCount: noData.length,
    naCount: na.length,
    dataQuality,
  };
}
