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

import { ORGS, type OrgId, gapScores, GAP_AXES, kpiData } from "./oid-data";
import { computeProfile, type InstitutionProfile } from "./oid-composite";

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
export function detectAnomalies(orgId: OrgId, allProfiles: Record<OrgId, InstitutionProfile>): Anomaly[] {
  const p = allProfiles[orgId];
  const out: Anomaly[] = [];
  if (!p) return out;

  // 1) بيانات غير مكتملة
  if (p.dataCompleteness === 0) {
    out.push({
      id: `${orgId}-no-data`,
      orgId, severity: "high", category: "incomplete_data",
      title: "لا توجد بيانات",
      message: "لم تُرفع أي بيانات لهذه المؤسسة بعد.",
      suggestion: "ابدأ برفع نتائج تقييم الفجوات والحوكمة لتوليد الملف.",
    });
    return out;
  }
  if (p.dataCompleteness < 0.5 && p.compositeScore !== null) {
    out.push({
      id: `${orgId}-partial`,
      orgId, severity: "medium", category: "incomplete_data",
      title: "درجة محسوبة من بيانات جزئية",
      message: `الدرجة المركّبة (${p.compositeScore.toFixed(2)}) محسوبة من ${p.components.filter(c=>c.state==="achieved").length} مصادر فقط من 4.`,
      suggestion: "أكمل المصادر الناقصة لرفع موثوقية الدرجة.",
    });
  }

  // 2) اختلال بين المكوّنات (فرق > 1.5 بين أعلى وأدنى)
  const valid = p.components.filter((c) => c.state === "achieved" && c.score !== null);
  if (valid.length >= 2) {
    const scores = valid.map((c) => c.score as number);
    const max = Math.max(...scores);
    const min = Math.min(...scores);
    if (max - min >= 1.5) {
      const top = valid.find((c) => c.score === max)!;
      const bot = valid.find((c) => c.score === min)!;
      out.push({
        id: `${orgId}-imbalance`,
        orgId, severity: "medium", category: "component_imbalance",
        title: "اختلال واضح بين المكوّنات",
        message: `${top.label} (${max.toFixed(2)}) متقدّم بفارق ${(max-min).toFixed(2)} عن ${bot.label} (${min.toFixed(2)}).`,
        suggestion: `ركّز على رفع أداء "${bot.label}" لموازنة الملف المؤسسي.`,
      });
    }
  }

  // 3) تناقض KPI ↔ Gap في المالي/الحوكمة
  const kpiC = p.components.find((c) => c.source === "kpi");
  const gapC = p.components.find((c) => c.source === "gap");
  if (kpiC?.state === "achieved" && gapC?.state === "achieved" && kpiC.score! - gapC.score! >= 1.2) {
    out.push({
      id: `${orgId}-kpi-gap`,
      orgId, severity: "low", category: "kpi_gap_contradiction",
      title: "تقدّم KPI لا يعكسه تقييم الفجوات",
      message: `مؤشرات الأداء (${kpiC.score!.toFixed(2)}) أعلى من تقييم الفجوات (${gapC.score!.toFixed(2)}) — قد يدل على قياس سطحي.`,
      suggestion: "راجع منهجية حساب KPIs للتحقق من عمق القياس.",
    });
  }

  // 4) صفر في محور حوكمة حرج
  const axes = gapScores[orgId] ?? [];
  axes.forEach((v, i) => {
    if (v === 0) {
      out.push({
        id: `${orgId}-zero-${i}`,
        orgId, severity: "high", category: "zero_in_critical",
        title: `صفر في محور: ${GAP_AXES[i]}`,
        message: `سجّلت المؤسسة صفراً في "${GAP_AXES[i]}" — يستلزم تدخّلاً عاجلاً.`,
        suggestion: "ضع خطة طوارئ لمعالجة هذا المحور خلال الربع القادم.",
      });
    }
  });

  // 5) KPIs متوقفة (progress = 0)
  const stalled = kpiData.filter((k) => k.org === orgId && k.progress === 0 && (k as any).status !== "pending");
  if (stalled.length > 0) {
    out.push({
      id: `${orgId}-stalled`,
      orgId, severity: "medium", category: "zero_in_critical",
      title: `${stalled.length} مؤشر متوقف`,
      message: `${stalled.length} من مؤشرات الأداء عند 0% تقدّم.`,
      suggestion: "حدّد المسؤولين وأعد جدولة هذه المؤشرات.",
    });
  }

  // 6) خروج عن متوسط الشبكة (composite يبتعد > 1.0 عن المتوسط)
  const all = Object.values(allProfiles)
    .filter((x) => x.compositeScore !== null)
    .map((x) => x.compositeScore as number);
  if (all.length >= 3 && p.compositeScore !== null) {
    const mean = all.reduce((a, b) => a + b, 0) / all.length;
    const diff = p.compositeScore - mean;
    if (Math.abs(diff) >= 1.0) {
      out.push({
        id: `${orgId}-outlier`,
        orgId,
        severity: diff < 0 ? "high" : "low",
        category: "outlier_vs_peers",
        title: diff < 0 ? "أداء أدنى من متوسط الشبكة بفارق كبير" : "أداء يتجاوز متوسط الشبكة",
        message: `الدرجة ${p.compositeScore.toFixed(2)} مقابل متوسط الشبكة ${mean.toFixed(2)} (فرق ${diff > 0 ? "+" : ""}${diff.toFixed(2)}).`,
        suggestion: diff < 0
          ? "أدرج هذه المؤسسة ضمن أولويات الدعم."
          : "ادرس ممارساتها كنموذج للمشاركة مع باقي الشبكة.",
      });
    }
  }

  return out;
}

export function detectAllAnomalies(): Anomaly[] {
  const profiles = {} as Record<OrgId, InstitutionProfile>;
  for (const o of ORGS) profiles[o.id] = computeProfile(o.id);
  const out: Anomaly[] = [];
  for (const o of ORGS) out.push(...detectAnomalies(o.id, profiles));
  const order: Record<AnomalySeverity, number> = { high: 0, medium: 1, low: 2 };
  return out.sort((a, b) => order[a.severity] - order[b.severity]);
}
