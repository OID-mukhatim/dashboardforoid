// Central data for OID Dashboard. All editable arrays live here so future updates
// only touch this single file.

export type OrgId = "ZF" | "ZUST" | "ZAD" | "TAYO" | "KAFI" | "HAMDI";

export const ORGS: {
  id: OrgId;
  abbr: string;
  nameAr: string;
  nameEn: string;
  color: string;
}[] = [
  { id: "ZF", abbr: "ZF", nameAr: "مؤسسة زمزم", nameEn: "Zamzam Foundation", color: "#d97706" },
  { id: "ZUST", abbr: "ZU", nameAr: "جامعة زمزم للعلوم والتكنولوجيا", nameEn: "ZUST", color: "#1d4ed8" },
  { id: "ZAD", abbr: "ZD", nameAr: "زاد للتنمية", nameEn: "Zad for Development", color: "#ea580c" },
  { id: "TAYO", abbr: "TY", nameAr: "تيو للتعليم", nameEn: "Tayo for Education", color: "#2563eb" },
  { id: "KAFI", abbr: "KF", nameAr: "كافي للتنمية", nameEn: "Kafi for Development", color: "#15803d" },
  { id: "HAMDI", abbr: "HM", nameAr: "منظمة حمدي للتنمية", nameEn: "Hamdi Organization", color: "#94a3b8" },
];

export const orgName = (id: OrgId) => ORGS.find((o) => o.id === id)?.nameAr ?? id;

export const MATURITY_LABELS: Record<number, string> = {
  1: "أولي",
  2: "ناشئ",
  3: "متطور",
  4: "متقدم",
  5: "ريادي",
};

export const GAP_AXES = [
  "الاستراتيجية",
  "القيادة",
  "الأداء",
  "العمليات",
  "المالية",
  "البنية التحتية",
  "الحوكمة",
];

export const PERSPECTIVES = ["أصحاب المصلحة", "العمليات الداخلية", "التعلم والنمو", "المالي"];

export type PolicyStatus = "active" | "inactive" | "review" | "inDev" | "missing" | "pending";

export const POLICY_STATUS_META: Record<PolicyStatus, { label: string; icon: string; bg: string; fg: string }> = {
  active: { label: "موجود ومفعّل", icon: "✅", bg: "bg-green-50", fg: "text-green-700" },
  inactive: { label: "موجود غير مفعّل", icon: "🔵", bg: "bg-blue-50", fg: "text-blue-700" },
  review: { label: "بحاجة تحديث", icon: "🟡", bg: "bg-yellow-50", fg: "text-yellow-700" },
  inDev: { label: "قيد الإعداد", icon: "🟠", bg: "bg-orange-50", fg: "text-orange-700" },
  missing: { label: "غير موجود", icon: "❌", bg: "bg-red-50", fg: "text-red-700" },
  pending: { label: "بيانات ناقصة", icon: "⏳", bg: "bg-gray-100", fg: "text-gray-500" },
};

export type PolicyRow = { id: string; name: string };

export const generalPolicies: PolicyRow[] = [
  { id: "GP-01", name: "النظام الأساسي" },
  { id: "GP-02", name: "ميثاق مجلس الأمناء" },
  { id: "GP-03", name: "مصفوفة الصلاحيات" },
  { id: "GP-04", name: "سياسة إدارة الاستثمارات والأوقاف" },
  { id: "GP-05", name: "سياسة النشر والظهور الإعلامي" },
  { id: "GP-06", name: "سجل المخاطر المؤسسية" },
  { id: "GP-07", name: "الهيكل التنظيمي" },
  { id: "GP-08", name: "التوصيفات الوظيفية" },
  { id: "GP-09", name: "أدلة إجراءات العمل (SOPs)" },
  { id: "GP-10", name: "دليل الرقابة والتقييم (M&E)" },
  { id: "GP-11", name: "لائحة المشتريات والتعاقدات" },
  { id: "GP-12", name: "سياسة تضارب المصالح" },
  { id: "GP-13", name: "مدونة السلوك الأخلاقي" },
  { id: "GP-14", name: "سياسة الخصوصية وحماية البيانات" },
  { id: "GP-15", name: "سياسة أمن المعلومات" },
];

export const universityPolicies: PolicyRow[] = [
  { id: "UP-01", name: "لائحة الدراسة والاختبارات" },
  { id: "UP-02", name: "سياسة النزاهة الأكاديمية" },
  { id: "UP-03", name: "دليل ضمان الجودة والاعتماد" },
  { id: "UP-04", name: "لائحة شؤون أعضاء هيئة التدريس" },
  { id: "UP-05", name: "سياسة أخلاقيات البحث العلمي" },
  { id: "UP-06", name: "سياسة الملكية الفكرية" },
  { id: "UP-07", name: "ميثاق حقوق وواجبات الطالب" },
];

export const humanitarianPolicies: PolicyRow[] = [
  { id: "HP-01", name: "سياسة حماية المستفيدين (PSEA)" },
  { id: "HP-02", name: "سياسة حماية الطفل" },
  { id: "HP-03", name: "سياسة مكافحة الاحتيال والفساد" },
  { id: "HP-04", name: "سياسة مكافحة غسيل الأموال (AML/CFT)" },
  { id: "HP-05", name: "سياسة اختيار المستفيدين" },
  { id: "HP-06", name: "آلية الشكاوى والتغذية الراجعة (FCRM)" },
  { id: "HP-07", name: "سياسة السلامة والأمن الميداني" },
  { id: "HP-08", name: "سياسة إدارة المنح والشركاء" },
  { id: "HP-09", name: "سياسة جمع التبرعات وحماية المتبرعين" },
  { id: "HP-10", name: "سياسة الإفصاح والشفافية" },
];

export const educationPolicies: PolicyRow[] = [
  { id: "EP-01", name: "لائحة السلوك والمواظبة" },
  { id: "EP-02", name: "دليل الأمن والسلامة المدرسية (HSE)" },
  { id: "EP-03", name: "سياسة التقييم والترقية الدراسية" },
  { id: "EP-04", name: "ميثاق العلاقة مع أولياء الأمور" },
  { id: "EP-05", name: "لائحة الكادر التعليمي والإداري" },
];

};

/** التحقق من أن كل منظور = 25% والمجموع الكلي = 100%. */
export const validateWeights = (
  rows: Record<string, unknown>[],
): { valid: boolean; errors: string[]; warnings: string[] } => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const PERSPECTIVE_KEYS = ["المنظور", "Sector", "sector", "perspective"];
  const WEIGHT_KEYS = ["الوزن", "الوزن النسبي", "Weight", "Weight %", "weight"];

  const byPerspective = new Map<string, number>();
  let total = 0;

  rows.forEach((row) => {
    const perspective = pickField(row, PERSPECTIVE_KEYS) || "غير مصنّف";
    const weight = toWeight(pickField(row, WEIGHT_KEYS));
    byPerspective.set(perspective, (byPerspective.get(perspective) ?? 0) + weight);
    total += weight;
  });

  byPerspective.forEach((sum, name) => {
    const diff = Math.abs(sum - WEIGHT_RULES.perspectiveWeight);
    if (diff > WEIGHT_RULES.tolerance) {
      errors.push(
        `منظور "${name}": مجموع الأوزان ${sum.toFixed(2)}% — يجب أن يساوي ${WEIGHT_RULES.perspectiveWeight}% بالضبط`,
      );
    }
  });

  if (byPerspective.size !== 4) {
    warnings.push(`عدد المناظير في الملف ${byPerspective.size} — المتوقع 4 مناظير`);
  }

  if (Math.abs(total - WEIGHT_RULES.totalWeight) > WEIGHT_RULES.tolerance) {
    errors.push(`المجموع الكلي للأوزان: ${total.toFixed(2)}% — يجب أن يساوي 100% بالضبط`);
  }

  return { valid: errors.length === 0, errors, warnings };
};

const numFrom = (v: unknown): number => {
  if (v === null || v === undefined) return NaN;
  const n = parseFloat(
    String(v).replace("%", "").replace("<", "").replace(">", "").replace("أقل من", "").replace("أكثر من", "").trim(),
  );
  return n;
};

/** نسبة الإنجاز ولون العتبة لمؤشر واحد. */
export const computeKPIStatus = (
  kpi: { annual_target?: unknown; threshold_red?: string | null; threshold_green?: string | null },
  achieved: unknown,
): { pct: number | null; color: "green" | "yellow" | "red" | "gray"; label: string } => {
  const achievedNum = numFrom(achieved);
  const targetNum = numFrom(kpi.annual_target);
  if (!Number.isFinite(achievedNum) || !Number.isFinite(targetNum) || targetNum === 0) {
    return { pct: null, color: "gray", label: "—" };
  }
  const pct = (achievedNum / targetNum) * 100;

  const redVal = kpi.threshold_red ? numFrom(kpi.threshold_red) : NaN;
  const greenVal = kpi.threshold_green ? numFrom(kpi.threshold_green) : NaN;
  if (Number.isFinite(redVal) || Number.isFinite(greenVal)) {
    if (Number.isFinite(redVal) && pct < redVal) return { pct, color: "red", label: `🔴 ${pct.toFixed(0)}%` };
    if (Number.isFinite(greenVal) && pct >= greenVal) return { pct, color: "green", label: `🟢 ${pct.toFixed(0)}%` };
    return { pct, color: "yellow", label: `🟡 ${pct.toFixed(0)}%` };
  }

  if (pct >= 90) return { pct, color: "green", label: `🟢 ${pct.toFixed(0)}%` };
  if (pct >= 70) return { pct, color: "yellow", label: `🟡 ${pct.toFixed(0)}%` };
  return { pct, color: "red", label: `🔴 ${pct.toFixed(0)}%` };
};

/* ============ عرض القيم حسب وحدة المؤشر ============ */
export const isPercentUnit = (unit?: string | null): boolean =>
  !!unit &&
  (unit.trim() === "%" ||
    unit.includes("%") ||
    unit.includes("نسب") ||
    unit.includes("مئو") ||
    unit.toLowerCase().includes("percent") ||
    unit.toLowerCase().trim() === "pct");

const smartNumber = (n: number): string =>
  Number.isInteger(n) ? String(n) : String(parseFloat(n.toFixed(2)));

/** عرض قيمة مؤشر بشكل صحيح حسب وحدته (بدون أصفار زائدة). */
export const formatKPIValue = (
  value: string | number | null | undefined,
  unit?: string | null,
): string => {
  if (value === null || value === undefined || value === "") return "—";
  const asText = String(value).trim();
  const percent = isPercentUnit(unit) || asText.includes("%");
  const n = parseFloat(asText.replace("%", "").replace(",", "."));
  if (!Number.isFinite(n)) return asText;
  const corrected = percent && n > 0 && n < 1 ? n * 100 : n;
  return percent ? `${smartNumber(corrected)}%` : smartNumber(corrected);
};

/** تحذير عند تناقض القيمة مع نوع المؤشر. */
export const validateKPIValue = (
  value: string | number | null | undefined,
  unit: string | null | undefined,
  kpiName: string,
): { valid: boolean; warning: string | null } => {
  if (value === null || value === undefined || String(value).trim() === "") return { valid: true, warning: null };
  const asText = String(value).trim();
  const percent = isPercentUnit(unit);
  const hasPercent = asText.includes("%");
  const n = parseFloat(asText.replace("%", "").replace(",", "."));
  if (!Number.isFinite(n)) return { valid: true, warning: null };

  if (percent && n > 100) {
    return { valid: false, warning: `"${kpiName}": قيمة نسبية تتجاوز 100% — تحقق من الإدخال` };
  }
  if (percent && n > 0 && n < 1) {
    return { valid: false, warning: `"${kpiName}": القيمة ${n} تبدو مقلوبة — هل تقصد ${smartNumber(n * 100)}%؟` };
  }
  if (!percent && hasPercent) {
    return { valid: false, warning: `"${kpiName}": مؤشر عددي لكن القيمة تحتوي على % — تحقق من الوحدة` };
  }
  return { valid: true, warning: null };
};
