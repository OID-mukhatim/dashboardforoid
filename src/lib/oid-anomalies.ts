/**
 * المحور الرابع: كشف الشذوذات والتناقضات.
 *
 * يعتمد على المخرجات المركّبة من oid-composite + إشارات أخرى من البيانات
 * المتاحة. كل شذوذ يحمل:
 *  - severity: high | medium | low
 *  - category: تصنيف نوع الشذوذ
 *  - message: شرح للمستخدم
 *  - suggestion: إجراء مقترح
 */

import { ORGS, type OrgId, GAP_AXES } from "./oid-data";
import type { InstitutionProfile } from "./oid-composite";
import type { Lang } from "./i18n";

/** بيانات إضافية حية (من قاعدة البيانات) تُمرَّر من المستدعي عند توفرها. */
export type AnomalyExtras = {
  gapAxes?: (number | null)[]; // قيم المحاور السبعة الحية
};

export type AnomalySeverity = "high" | "medium" | "low";

export type AnomalyCategory =
  | "incomplete_data"
  | "component_imbalance"
  | "kpi_gap_contradiction"
  | "zero_in_critical"
  | "outlier_vs_peers";

export type Anomaly = {
  id: string;
  orgId: OrgId;
  severity: AnomalySeverity;
  category: AnomalyCategory;
  title: string;
  message: string;
  suggestion: string;
};

const CATEGORY_LABEL: Record<AnomalyCategory, string> = {
  incomplete_data: "بيانات غير مكتملة",
  component_imbalance: "اختلال بين المكوّنات",
  kpi_gap_contradiction: "تناقض بين KPI والفجوات",
  zero_in_critical: "صفر في مجال حرج",
  outlier_vs_peers: "خروج عن متوسط الشبكة",
};

export function getCategoryLabel(c: AnomalyCategory): string {
  return CATEGORY_LABEL[c];
}

const SEVERITY_META: Record<AnomalySeverity, { color: string; bg: string; label: string }> = {
  high: { color: "#b91c1c", bg: "#fee2e2", label: "حرج" },
  medium: { color: "#b45309", bg: "#fef3c7", label: "متوسط" },
  low: { color: "#1d4ed8", bg: "#dbeafe", label: "منخفض" },
};

export function getSeverityMeta(s: AnomalySeverity) {
  return SEVERITY_META[s];
}

/** اكتشاف شذوذات مؤسسة واحدة. */
export function detectAnomalies(orgId: OrgId, allProfiles: Record<OrgId, InstitutionProfile>, lang: Lang = "ar", extras?: AnomalyExtras): Anomaly[] {
  const p = allProfiles[orgId];
  const out: Anomaly[] = [];
  if (!p) return out;

  // Exclude KPI completely from anomaly completeness, imbalance and peer scores.
  const eligible = p.components.filter((c) => c.source !== "kpi");
  const achieved = eligible.filter((c) => c.state === "achieved" && c.score !== null);
  const completeness = achieved.length / eligible.length;
  const scoreWithoutKpi = (profile: InstitutionProfile): number | null => {
    const parts = profile.components.filter((c) => c.source !== "kpi" && c.state === "achieved" && c.score !== null);
    const weight = parts.reduce((sum, c) => sum + c.weight, 0);
    return weight > 0 ? parts.reduce((sum, c) => sum + Number(c.score) * c.weight, 0) / weight : null;
  };
  const score = scoreWithoutKpi(p);

  // 1) بيانات غير مكتملة
  if (completeness === 0) {
    out.push({
      id: `${orgId}-no-data`,
      orgId, severity: "high", category: "incomplete_data",
      title: lang === "ar" ? "لا توجد بيانات" : "No data available",
      message: lang === "ar" ? "لم تُرفع أي بيانات لهذه المؤسسة بعد." : "No data has been uploaded for this institution yet.",
      suggestion: lang === "ar" ? "ابدأ برفع نتائج تقييم الفجوات والحوكمة لتوليد الملف." : "Upload gap and governance results to generate the profile.",
    });
    return out;
  }
  if (completeness < 0.5 && score !== null) {
    out.push({
      id: `${orgId}-partial`,
      orgId, severity: "medium", category: "incomplete_data",
      title: lang === "ar" ? "درجة محسوبة من بيانات جزئية" : "Score calculated from partial data",
      message: lang === "ar" ? `الدرجة المركّبة (${score?.toFixed(2)}) محسوبة من ${achieved.length} مصادر فقط من 3.` : `The composite score (${score?.toFixed(2)}) is calculated from only ${achieved.length} of 3 sources.`,
      suggestion: lang === "ar" ? "أكمل المصادر الناقصة لرفع موثوقية الدرجة." : "Complete the missing sources to improve score reliability.",
    });
  }

  // 2) اختلال بين المكوّنات (فرق > 1.5 بين أعلى وأدنى)
  const valid = achieved;
  if (valid.length >= 2) {
    const scores = valid.map((c) => c.score as number);
    const max = Math.max(...scores);
    const min = Math.min(...scores);
    if (max - min >= 1.5) {
      const top = valid.find((c) => c.score === max);
      const bot = valid.find((c) => c.score === min);
      if (top && bot) out.push({
        id: `${orgId}-imbalance`,
        orgId, severity: "medium", category: "component_imbalance",
        title: lang === "ar" ? "اختلال واضح بين المكوّنات" : "Clear imbalance between components",
        message: lang === "ar" ? `${top.label} (${max.toFixed(2)}) متقدّم بفارق ${(max-min).toFixed(2)} عن ${bot.label} (${min.toFixed(2)}).` : `The highest component (${max.toFixed(2)}) leads the lowest (${min.toFixed(2)}) by ${(max-min).toFixed(2)} points.`,
        suggestion: lang === "ar" ? `ركّز على رفع أداء "${bot.label}" لموازنة الملف المؤسسي.` : "Focus on improving the lowest component to balance the institutional profile.",
      });
    }
  }

  // 4) صفر في محور حوكمة حرج (من قيم المحاور الحية إن وُجدت)
  const axes = extras?.gapAxes ?? [];
  axes.forEach((v, i) => {
    if (v === 0) {
      out.push({
        id: `${orgId}-zero-${i}`,
        orgId, severity: "high", category: "zero_in_critical",
        title: lang === "ar" ? `صفر في محور: ${GAP_AXES[i]}` : "Zero score in a critical dimension",
        message: lang === "ar" ? `سجّلت المؤسسة صفراً في "${GAP_AXES[i]}" — يستلزم تدخّلاً عاجلاً.` : "The institution recorded zero in a critical dimension, requiring urgent intervention.",
        suggestion: lang === "ar" ? "ضع خطة طوارئ لمعالجة هذا المحور خلال الربع القادم." : "Create an urgent action plan for this dimension during the next quarter.",
      });
    }
  });

  // 6) خروج عن متوسط الشبكة (composite يبتعد > 1.0 عن المتوسط)
  const all = Object.values(allProfiles)
    .map(scoreWithoutKpi)
    .filter((x): x is number => x !== null);
  if (all.length >= 3 && score !== null) {
    const mean = all.reduce((a, b) => a + b, 0) / all.length;
    const diff = score - mean;
    if (Math.abs(diff) >= 1.0) {
      out.push({
        id: `${orgId}-outlier`,
        orgId,
        severity: diff < 0 ? "high" : "low",
        category: "outlier_vs_peers",
        title: lang === "ar" ? (diff < 0 ? "أداء أدنى من متوسط الشبكة بفارق كبير" : "أداء يتجاوز متوسط الشبكة") : (diff < 0 ? "Performance is significantly below the network average" : "Performance exceeds the network average"),
        message: lang === "ar" ? `الدرجة دون المؤشرات ${score?.toFixed(2)} مقابل متوسط الشبكة دون المؤشرات ${mean.toFixed(2)} (فرق ${diff > 0 ? "+" : ""}${diff.toFixed(2)}).` : `Score excluding KPIs ${score?.toFixed(2)} versus network average excluding KPIs ${mean.toFixed(2)} (difference ${diff > 0 ? "+" : ""}${diff.toFixed(2)}).`,
        suggestion: lang === "ar" ? (diff < 0 ? "أدرج هذه المؤسسة ضمن أولويات الدعم." : "ادرس ممارساتها كنموذج للمشاركة مع باقي الشبكة.") : (diff < 0 ? "Prioritize this institution for support." : "Study its practices as a model to share across the network."),
      });
    }
  }

  return out;
}

export function detectAllAnomalies(
  profiles: Record<OrgId, InstitutionProfile>,
  lang: Lang = "ar",
  extrasByOrg?: Partial<Record<OrgId, AnomalyExtras>>,
): Anomaly[] {
  const out: Anomaly[] = [];
  for (const o of ORGS) out.push(...detectAnomalies(o.id, profiles, lang, extrasByOrg?.[o.id]));
  const order: Record<AnomalySeverity, number> = { high: 0, medium: 1, low: 2 };
  return out.sort((a, b) => order[a.severity] - order[b.severity]);
}
