/**
 * محرّك حساب نسب الإنجاز للمؤشرات:
 * مؤشر → هدف → منظور (25% لكل منظور) → الأداء العام للمؤسسة.
 */
import { formatKPIValue } from "./oid-data";

export type MeasurementNature = "quantitative_ratio" | "quantitative_number" | "qualitative";
export type Polarity = "ascending" | "descending";
// driving = موجهات (Leading) — output = مخرجات (Lagging)
export type IndicatorRole = "driving" | "output";

export type KPICalcResult = {
  rawPct: number | null; // نسبة الإنجاز الفعلية (قد تتجاوز 100%)
  cappedPct: number | null; // النسبة المقيَّدة بـ 100% (تُستخدم في الحساب)
  exceeded: number | null; // نسبة التجاوز فوق 100%
  displayValue: string;
  status: "green" | "yellow" | "red" | "gray";
  statusLabel: string;
};

const EMPTY: KPICalcResult = {
  rawPct: null,
  cappedPct: null,
  exceeded: null,
  displayValue: "—",
  status: "gray",
  statusLabel: "—",
};

const toNum = (v: string | number | null | undefined): number => {
  if (v === null || v === undefined || v === "") return NaN;
  return parseFloat(String(v).replace("%", "").replace(",", ".").trim());
};

/** طبيعة القياس المعتمدة للمؤشر (مع اشتقاق افتراضي من الحقول القديمة). */
export const natureOf = (kpi: any): MeasurementNature => {
  const n = kpi?.measurement_nature;
  if (n === "quantitative_ratio" || n === "quantitative_number" || n === "qualitative") return n;
  const t = `${kpi?.unit ?? ""} ${kpi?.kpi_type ?? ""}`;
  if (/نوع|qualit|ليكرت/i.test(t)) return "qualitative";
  if (/عدد|number|count/i.test(t)) return "quantitative_number";
  return "quantitative_ratio";
};

export const polarityOf = (kpi: any): Polarity =>
  kpi?.polarity === "descending" || String(kpi?.polarity ?? "").includes("تنازلي") ? "descending" : "ascending";

/** حساب نسبة إنجاز مؤشر واحد. */
export const computeKPIAchievement = (
  kpi: {
    measurement_nature: MeasurementNature;
    polarity: Polarity;
    threshold_red?: string | null;
    threshold_green?: string | null;
    unit?: string | null;
  },
  target: string | number | null | undefined,
  achieved: string | number | null | undefined,
): KPICalcResult => {
  const targetNum = toNum(target);
  const achievedNum = toNum(achieved);
  if (!Number.isFinite(achievedNum)) return EMPTY;

  let rawPct: number;
  if (kpi.measurement_nature === "qualitative") {
    rawPct = (achievedNum / 5) * 100;
  } else if (!Number.isFinite(targetNum) || targetNum === 0) {
    return EMPTY;
  } else if (kpi.polarity === "ascending") {
    rawPct = (achievedNum / targetNum) * 100;
  } else {
    if (achievedNum === 0) return EMPTY;
    rawPct = (targetNum / achievedNum) * 100;
  }
  if (!Number.isFinite(rawPct)) return EMPTY;

  const cappedPct = Math.min(rawPct, 100);
  const exceeded = rawPct > 100 ? parseFloat((rawPct - 100).toFixed(1)) : null;

  const parseThreshold = (v: string | null | undefined, fallback: number) => {
    if (!v) return fallback;
    const n = parseFloat(String(v).replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) ? n : fallback;
  };
  const redVal = parseThreshold(kpi.threshold_red, 60);
  const greenVal = parseThreshold(kpi.threshold_green, 90);

  const status: KPICalcResult["status"] = cappedPct >= greenVal ? "green" : cappedPct >= redVal ? "yellow" : "red";
  const statusLabel = status === "green" ? "ممتاز" : status === "yellow" ? "جيد" : "متأخر";

  return {
    rawPct: parseFloat(rawPct.toFixed(1)),
    cappedPct: parseFloat(cappedPct.toFixed(1)),
    exceeded,
    displayValue: formatKPIValue(achieved ?? null, kpi.unit),
    status,
    statusLabel,
  };
};

/** حساب إنجاز مؤشر من صف قاعدة البيانات مباشرة (آخر ربع متوفر). */
export const computeRowAchievement = (kpi: any): KPICalcResult => {
  const achieved = kpi.q4_actual ?? kpi.q3_actual ?? kpi.q2_actual ?? kpi.q1_actual ?? kpi.total_actual ?? null;
  const target = kpi.annual_target ?? kpi.total_planned ?? null;
  return computeKPIAchievement(
    {
      measurement_nature: natureOf(kpi),
      polarity: polarityOf(kpi),
      threshold_red: kpi.threshold_red,
      threshold_green: kpi.threshold_green,
      unit: kpi.unit ?? kpi.kpi_type ?? null,
    },
    target,
    achieved,
  );
};

/** الوزن كنسبة مئوية (يُخزَّن أحياناً ككسر 0.04). */
const weightPct = (w: unknown): number => {
  const n = Number(w);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n <= 1 ? n * 100 : n;
};

/** أداء الهدف من مؤشراته الموزونة (0–100). */
export const computeGoalPerformance = (
  goalKPIs: { weight: number; cappedPct: number | null }[],
): number | null => {
  const valid = goalKPIs.filter((k) => k.cappedPct !== null && k.weight > 0);
  if (valid.length === 0) return null;
  const totalWeight = valid.reduce((s, k) => s + k.weight, 0);
  if (totalWeight === 0) return null;
  const weightedSum = valid.reduce((s, k) => s + k.cappedPct! * k.weight, 0);
  return parseFloat((weightedSum / totalWeight).toFixed(1));
};

/** أداء المنظور من أهدافه الموزونة — النتيجة من 25%. */
export const computePerspectivePerformance = (
  goals: { weight: number; performance: number | null }[],
): number | null => {
  const valid = goals.filter((g) => g.performance !== null && g.weight > 0);
  if (valid.length === 0) return null;
  const totalWeight = valid.reduce((s, g) => s + g.weight, 0);
  if (totalWeight === 0) return null;
  const weightedSum = valid.reduce((s, g) => s + g.performance! * g.weight, 0);
  return parseFloat(((weightedSum / totalWeight / 100) * 25).toFixed(1));
};

/** الأداء العام = مجموع أداء المناظير (كل منظور من 25%). */
export const computeOverallPerformance = (
  perspectives: { name: string; performance: number | null }[],
): { overall: number | null; byPerspective: Record<string, number | null> } => {
  const byPerspective: Record<string, number | null> = {};
  let total = 0;
  let validCount = 0;
  perspectives.forEach((p) => {
    byPerspective[p.name] = p.performance;
    if (p.performance !== null) {
      total += p.performance;
      validCount += 1;
    }
  });
  return { overall: validCount > 0 ? parseFloat(Math.min(total, 100).toFixed(1)) : null, byPerspective };
};

/** حساب شامل لمؤسسة كاملة من صفوف kpis. */
export const computeOrgKPIPerformance = (
  kpis: any[],
): {
  kpiResults: Record<string, KPICalcResult>;
  goalPerformance: Record<string, number | null>;
  perspPerformance: Record<string, number | null>;
  overall: number | null;
} => {
  const kpiResults: Record<string, KPICalcResult> = {};
  kpis.forEach((k) => {
    kpiResults[k.id] = computeRowAchievement(k);
  });

  const perspOf = (k: any) => k.perspective ?? k.sector ?? "غير مصنّف";
  const goalOf = (k: any) => k.objective ?? k.related_goal ?? "—";

  // تجميع حسب الهدف
  const goalMap = new Map<string, any[]>();
  kpis.forEach((k) => {
    const key = `${perspOf(k)}__${goalOf(k)}`;
    if (!goalMap.has(key)) goalMap.set(key, []);
    goalMap.get(key)!.push(k);
  });

  const goalPerformance: Record<string, number | null> = {};
  const goalWeight: Record<string, number> = {};
  goalMap.forEach((goalKPIs, key) => {
    goalPerformance[key] = computeGoalPerformance(
      goalKPIs.map((k) => ({ weight: weightPct(k.weight), cappedPct: kpiResults[k.id]?.cappedPct ?? null })),
    );
    // وزن الهدف = وزن معرَّف في kpi_goals إن وُجد، وإلا مجموع أوزان مؤشراته
    const defined = goalKPIs.map((k) => weightPct(k.goal_weight)).find((w) => w > 0);
    goalWeight[key] = defined ?? goalKPIs.reduce((s, k) => s + weightPct(k.weight), 0);
  });

  const perspMap = new Map<string, { weight: number; performance: number | null }[]>();
  goalMap.forEach((goalKPIs, key) => {
    const persp = perspOf(goalKPIs[0]);
    if (!perspMap.has(persp)) perspMap.set(persp, []);
    perspMap.get(persp)!.push({ weight: goalWeight[key], performance: goalPerformance[key] });
  });

  const perspPerformance: Record<string, number | null> = {};
  perspMap.forEach((goals, persp) => {
    perspPerformance[persp] = computePerspectivePerformance(goals);
  });

  const { overall } = computeOverallPerformance(
    [...perspMap.keys()].map((name) => ({ name, performance: perspPerformance[name] })),
  );

  return { kpiResults, goalPerformance, perspPerformance, overall };
};
