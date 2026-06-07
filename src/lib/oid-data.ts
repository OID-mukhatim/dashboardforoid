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

export const orgOverallScores = [
  { id: "KAFI", name: "كافي للتنمية", score: 4.06, maturity: 4, govScore: 4.4, govPct: 88, color: "#15803d" },
  { id: "ZUST", name: "جامعة زمزم", score: 3.72, maturity: 4, govScore: 3.11, govPct: 62, color: "#1d4ed8" },
  { id: "TAYO", name: "تيو للتعليم", score: 3.49, maturity: 3, govScore: 2.17, govPct: 43, color: "#2563eb" },
  { id: "ZF", name: "مؤسسة زمزم", score: 3.44, maturity: 3, govScore: 3.67, govPct: 73, color: "#d97706" },
  { id: "ZAD", name: "زاد للتنمية", score: 3.04, maturity: 3, govScore: 0.87, govPct: 17, color: "#ea580c" },
  { id: "HAMDI", name: "منظمة حمدي للتنمية", score: null, maturity: null, govScore: null, govPct: null, color: "#94a3b8", status: "pending" as const },
];

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

export const gapScores: Record<OrgId, (number | null)[]> = {
  ZF: [3.27, 3.0, 3.85, 3.2, 3.4, 3.93, 3.67],
  ZAD: [3.54, 2.75, 3.35, 1.95, 3.25, 3.4, 0.87],
  TAYO: [4.22, 4.35, 4.35, 1.8, 2.85, 3.48, 2.17],
  KAFI: [3.94, 4.25, 4.93, 2.75, 4.0, 4.48, 4.4],
  ZUST: [3.8, 3.95, 4.4, 2.3, 3.55, 4.48, 3.11],
  HAMDI: [null, null, null, null, null, null, null],
};

export const kpiData = [
  { code: "TAYO-S1", org: "TAYO", perspective: "أصحاب المصلحة", goal: "جودة التعليم", kpi: "نسبة الطلاب المحققين للمستوى الأكاديمي", type: "نتائج", weight: "5%", baseline: "60%", target: "70%", progress: 72 },
  { code: "TAYO-I1", org: "TAYO", perspective: "العمليات", goal: "رقمنة الإدارة", kpi: "نسبة أتمتة العمليات الإدارية", type: "نتائج", weight: "3%", baseline: "25%", target: "60%", progress: 45 },
  { code: "TAYO-F2", org: "TAYO", perspective: "المالي", goal: "تنويع التمويل", kpi: "عدد الشراكات مع المانحين الدوليين", type: "مخرجات", weight: "4%", baseline: "0", target: "4", progress: 30 },
  { code: "TAYO-L1", org: "TAYO", perspective: "التعلم", goal: "تطوير الكوادر", kpi: "نسبة تنفيذ البرامج التدريبية للمعلمين", type: "مخرجات", weight: "4%", baseline: "50%", target: "100%", progress: 65 },
  { code: "KAFI-S3", org: "KAFI", perspective: "أصحاب المصلحة", goal: "التمكين", kpi: "عدد الشباب المستفيد من التمكين", type: "أثر", weight: "3%", baseline: "50", target: "75", progress: 80 },
  { code: "KAFI-I1", org: "KAFI", perspective: "العمليات", goal: "مأسسة الأنظمة", kpi: "عدد الأدلة التشغيلية المكتملة والمفعّلة", type: "ناتج", weight: "3%", baseline: "0", target: "3", progress: 66 },
  { code: "KAFI-F2", org: "KAFI", perspective: "المالي", goal: "نمو التمويل", kpi: "عدد المشاريع الممولة خلال السنة", type: "ناتج", weight: "7%", baseline: "0", target: "12", progress: 50 },
  { code: "KAFI-L1", org: "KAFI", perspective: "التعلم", goal: "بناء القدرات", kpi: "عدد الموظفين المدربين على الأنظمة الجديدة", type: "مدخل", weight: "7%", baseline: "0", target: "4", progress: 75 },
  { code: "ZUST-S1", org: "ZUST", perspective: "أصحاب المصلحة", goal: "نمو الطلاب", kpi: "نسبة نمو التسجيل السنوي", type: "نتائج", weight: "5%", baseline: "0%", target: "10%", progress: 55 },
  { code: "ZUST-I3", org: "ZUST", perspective: "العمليات", goal: "البحث العلمي", kpi: "عدد الأبحاث المنشورة في مجلات محكمة", type: "مخرجات", weight: "4%", baseline: "7", target: "11", progress: 60 },
  { code: "ZUST-L1", org: "ZUST", perspective: "التعلم", goal: "التحول الرقمي", kpi: "كليات تستخدم المختبرات الافتراضية", type: "مخرجات", weight: "4%", baseline: "0", target: "4", progress: 25 },
  { code: "ZUST-F1", org: "ZUST", perspective: "المالي", goal: "ضبط المالية", kpi: "نسبة الانحراف في تنفيذ الميزانية", type: "نتائج", weight: "5%", baseline: "30%", target: "≤10%", progress: 70 },
  { code: "ZF-F1", org: "ZF", perspective: "المالي", goal: "نمو التمويل", kpi: "معدل نمو التمويل السنوي", type: "نتائج", weight: "2%", baseline: "0%", target: "10%", progress: 40 },
  { code: "ZF-S1", org: "ZF", perspective: "أصحاب المصلحة", goal: "التوسع", kpi: "عدد الأسر المستفيدة من برامج سبل العيش", type: "أثر", weight: "2%", baseline: "20,000", target: "30,000", progress: 58 },
  { code: "ZAD-L1", org: "ZAD", perspective: "التعلم", goal: "بناء القدرات", kpi: "عدد الموظفين المدربين على الإدارة المالية", type: "مدخل", weight: "4%", baseline: "0", target: "10", progress: 50 },
  { code: "HAMDI-*", org: "HAMDI", perspective: "—", goal: "—", kpi: "البيانات قيد الاستكمال", type: "—", weight: "—", baseline: "—", target: "—", progress: 0, status: "pending" as const },
];

export const PERSPECTIVES = ["أصحاب المصلحة", "العمليات الداخلية", "التعلم والنمو", "المالي"];

export const q1Data = [
  { id: 1, title: "اعتماد QuickBooks وتسجيل معاملات 2025 — تيو", kpiCode: "TAYO-I1", org: "TAYO", target: "100%", done: "85%", pct: 85, beneficiaries: "—", budget: 0, cost: 0, deviation: 0, status: "inProgress" },
  { id: 2, title: "إرسال التقرير المالي 2025 للمدقق — جامعة زمزم", kpiCode: "ZUST-F1", org: "ZUST", target: "100%", done: "100%", pct: 100, beneficiaries: "—", budget: 0, cost: 0, deviation: 0, status: "done" },
  { id: 3, title: "جلسات تدريب موظفي المحاسبة — زاد", kpiCode: "ZAD-L1", org: "ZAD", target: "10 موظفين", done: "7", pct: 75, beneficiaries: "14", budget: 2000, cost: 1800, deviation: 200, status: "inProgress" },
  { id: 4, title: "استكمال دليل السياسات المالية — جامعة زمزم", kpiCode: "ZUST-I5", org: "ZUST", target: "100%", done: "90%", pct: 90, beneficiaries: "—", budget: 0, cost: 0, deviation: 0, status: "pendingApproval" },
  { id: 5, title: "اعتماد دليل الحسابات — تيو للتعليم", kpiCode: "TAYO-I2", org: "TAYO", target: "100%", done: "100%", pct: 100, beneficiaries: "10 مدارس", budget: 1200, cost: 1100, deviation: 100, status: "done" },
  { id: 6, title: "تدقيق خارجي قوائم 2025 — زاد", kpiCode: "ZAD-F1", org: "ZAD", target: "1 تقرير", done: "1", pct: 100, beneficiaries: "—", budget: 3500, cost: 3700, deviation: -200, status: "done" },
];

export const criticalGaps = [
  { rank: 1, name: "أتمتة العمليات", avg: 1.87, affected: "6/6", priority: "حرج جداً" },
  { rank: 2, name: "الحوكمة — زاد للتنمية", avg: 0.87, affected: "1/6", priority: "حرج جداً" },
  { rank: 3, name: "أدلة الإجراءات (SOPs)", avg: 2.3, affected: "5/6", priority: "حرج" },
  { rank: 4, name: "تنوع مصادر الدخل", avg: 2.47, affected: "6/6", priority: "عالٍ" },
  { rank: 5, name: "الحوكمة — تيو للتعليم", avg: 2.17, affected: "1/6", priority: "عالٍ" },
  { rank: 6, name: "نظام إدارة البيانات", avg: 2.27, affected: "6/6", priority: "عالٍ" },
];

export type PolicyStatus = "active" | "inactive" | "review" | "inDev" | "missing" | "pending";

export const POLICY_STATUS_META: Record<PolicyStatus, { label: string; icon: string; bg: string; fg: string }> = {
  active: { label: "موجود ومفعّل", icon: "✅", bg: "bg-green-50", fg: "text-green-700" },
  inactive: { label: "موجود غير مفعّل", icon: "🔵", bg: "bg-blue-50", fg: "text-blue-700" },
  review: { label: "بحاجة تحديث", icon: "🟡", bg: "bg-yellow-50", fg: "text-yellow-700" },
  inDev: { label: "قيد الإعداد", icon: "🟠", bg: "bg-orange-50", fg: "text-orange-700" },
  missing: { label: "غير موجود", icon: "❌", bg: "bg-red-50", fg: "text-red-700" },
  pending: { label: "بيانات ناقصة", icon: "⏳", bg: "bg-gray-100", fg: "text-gray-500" },
};

type PolicyRow = { id: string; name: string; values: Partial<Record<OrgId, PolicyStatus>> };

export const generalPolicies: PolicyRow[] = [
  { id: "GP-01", name: "النظام الأساسي", values: { ZF: "review", ZAD: "review", TAYO: "review", KAFI: "active", ZUST: "active", HAMDI: "pending" } },
  { id: "GP-02", name: "ميثاق مجلس الأمناء", values: { ZF: "review", ZAD: "missing", TAYO: "missing", KAFI: "missing", ZUST: "inactive", HAMDI: "pending" } },
  { id: "GP-03", name: "مصفوفة الصلاحيات", values: { ZF: "active", ZAD: "review", TAYO: "inactive", KAFI: "active", ZUST: "active", HAMDI: "pending" } },
  { id: "GP-04", name: "سياسة إدارة الاستثمارات والأوقاف", values: { ZF: "missing", ZAD: "missing", TAYO: "missing", KAFI: "inDev", ZUST: "missing", HAMDI: "pending" } },
  { id: "GP-05", name: "سياسة النشر والظهور الإعلامي", values: { ZF: "review", ZAD: "inDev", TAYO: "review", KAFI: "active", ZUST: "review", HAMDI: "pending" } },
  { id: "GP-06", name: "سجل المخاطر المؤسسية", values: { ZF: "inactive", ZAD: "missing", TAYO: "review", KAFI: "active", ZUST: "missing", HAMDI: "pending" } },
  { id: "GP-07", name: "الهيكل التنظيمي", values: { ZF: "active", ZAD: "inactive", TAYO: "review", KAFI: "active", ZUST: "active", HAMDI: "pending" } },
  { id: "GP-08", name: "التوصيفات الوظيفية", values: { ZF: "active", ZAD: "active", TAYO: "review", KAFI: "active", ZUST: "active", HAMDI: "pending" } },
  { id: "GP-09", name: "أدلة إجراءات العمل (SOPs)", values: { ZF: "active", ZAD: "missing", TAYO: "missing", KAFI: "active", ZUST: "inDev", HAMDI: "pending" } },
  { id: "GP-10", name: "دليل الرقابة والتقييم (M&E)", values: { ZF: "active", ZAD: "missing", TAYO: "review", KAFI: "active", ZUST: "missing", HAMDI: "pending" } },
  { id: "GP-11", name: "لائحة المشتريات والتعاقدات", values: { ZF: "active", ZAD: "inactive", TAYO: "missing", KAFI: "active", ZUST: "missing", HAMDI: "pending" } },
  { id: "GP-12", name: "سياسة تضارب المصالح", values: { ZF: "active", ZAD: "inactive", TAYO: "missing", KAFI: "active", ZUST: "review", HAMDI: "pending" } },
  { id: "GP-13", name: "مدونة السلوك الأخلاقي", values: { ZF: "active", ZAD: "inactive", TAYO: "missing", KAFI: "inDev", ZUST: "active", HAMDI: "pending" } },
  { id: "GP-14", name: "سياسة الخصوصية وحماية البيانات", values: { ZF: "active", ZAD: "inactive", TAYO: "active", KAFI: "active", ZUST: "active", HAMDI: "pending" } },
  { id: "GP-15", name: "سياسة أمن المعلومات", values: { ZF: "active", ZAD: "missing", TAYO: "review", KAFI: "active", ZUST: "inDev", HAMDI: "pending" } },
];

export const universityPolicies: PolicyRow[] = [
  { id: "UP-01", name: "لائحة الدراسة والاختبارات", values: { ZUST: "active" } },
  { id: "UP-02", name: "سياسة النزاهة الأكاديمية", values: { ZUST: "active" } },
  { id: "UP-03", name: "دليل ضمان الجودة والاعتماد", values: { ZUST: "active" } },
  { id: "UP-04", name: "لائحة شؤون أعضاء هيئة التدريس", values: { ZUST: "active" } },
  { id: "UP-05", name: "سياسة أخلاقيات البحث العلمي", values: { ZUST: "active" } },
  { id: "UP-06", name: "سياسة الملكية الفكرية", values: { ZUST: "missing" } },
  { id: "UP-07", name: "ميثاق حقوق وواجبات الطالب", values: { ZUST: "active" } },
];

export const humanitarianPolicies: PolicyRow[] = [
  { id: "HP-01", name: "سياسة حماية المستفيدين (PSEA)", values: { ZF: "active", ZAD: "missing", KAFI: "active" } },
  { id: "HP-02", name: "سياسة حماية الطفل", values: { ZF: "active", ZAD: "review", KAFI: "active" } },
  { id: "HP-03", name: "سياسة مكافحة الاحتيال والفساد", values: { ZF: "active", ZAD: "inactive", KAFI: "active" } },
  { id: "HP-04", name: "سياسة مكافحة غسيل الأموال (AML/CFT)", values: { ZF: "active", ZAD: "missing", KAFI: "active" } },
  { id: "HP-05", name: "سياسة اختيار المستفيدين", values: { ZF: "active", ZAD: "missing", KAFI: "active" } },
  { id: "HP-06", name: "آلية الشكاوى والتغذية الراجعة (FCRM)", values: { ZF: "active", ZAD: "missing", KAFI: "active" } },
  { id: "HP-07", name: "سياسة السلامة والأمن الميداني", values: { ZF: "active", ZAD: "missing", KAFI: "active" } },
  { id: "HP-08", name: "سياسة إدارة المنح والشركاء", values: { ZF: "missing", ZAD: "missing", KAFI: "active" } },
  { id: "HP-09", name: "سياسة جمع التبرعات وحماية المتبرعين", values: { ZF: "missing", ZAD: "missing", KAFI: "inDev" } },
  { id: "HP-10", name: "سياسة الإفصاح والشفافية", values: { ZF: "missing", ZAD: "missing", KAFI: "active" } },
];

export const educationPolicies: PolicyRow[] = [
  { id: "EP-01", name: "لائحة السلوك والمواظبة", values: { TAYO: "active", HAMDI: "pending" } },
  { id: "EP-02", name: "دليل الأمن والسلامة المدرسية (HSE)", values: { TAYO: "active", HAMDI: "pending" } },
  { id: "EP-03", name: "سياسة التقييم والترقية الدراسية", values: { TAYO: "active", HAMDI: "pending" } },
  { id: "EP-04", name: "ميثاق العلاقة مع أولياء الأمور", values: { TAYO: "active", HAMDI: "pending" } },
  { id: "EP-05", name: "لائحة الكادر التعليمي والإداري", values: { TAYO: "active", HAMDI: "pending" } },
];

export const financialAssessment = {
  ZUST: {
    rating: 3.2,
    label: "متوسط-جيد",
    strengths: [
      "أول تدقيق خارجي في تاريخ الجامعة — خطوة نوعية",
      "دليل السياسات المالية مكتمل في محتواه",
      "تسجيل الأصول الثابتة مدرج في قوائم 2025",
    ],
    weaknesses: [
      "أخطاء تاريخية في QuickBooks منذ 2018 — يحتاج تصحيحاً شاملاً",
      "الميزانية الربعية الموحدة غائبة — ضعف في التخطيط المالي",
      "دليل السياسات في انتظار اعتماد الإدارة منذ شهور",
    ],
    recommendations: [
      "اعتماد دليل السياسات المالية خلال مايو 2026 — أولوية قصوى",
      "تنفيذ ورشة الميزانية الربعية في مايو 2026",
      "إصدار تقارير مالية شهرية مبسّطة للقيادة",
    ],
    nextMilestone: "اعتماد دليل السياسات المالية — مايو 2026",
  },
  ZAD: {
    rating: 3.8,
    label: "جيد",
    strengths: [
      "أقوى منظومة رقابة مالية في الشبكة",
      "قوائم مالية 2025 مدققة ومنشورة رسمياً",
      "QuickBooks Online فاعل ومطبّق",
    ],
    weaknesses: [
      "ورشة اعتماد دليل السياسات المالية لا تزال معلقة",
      "الميزانية الربعية مؤجلة لأسباب متكررة",
      "أكاديمية هالل بدون نظام محاسبي مناسب",
    ],
    recommendations: [
      "إتمام ورشة اعتماد دليل السياسات في يونيو 2026",
      "خطة اختيار نظام محاسبي لأكاديمية هالل — الربع الثالث",
      "إطلاق تقارير ميزانية ربعية مبسّطة كبداية",
    ],
    nextMilestone: "اعتماد دليل السياسات المالية — يونيو 2026",
  },
  TAYO: {
    rating: 2.9,
    label: "متوسط",
    strengths: [
      "أول مؤسسة أكملت اعتماد دليل الحسابات (فبراير 2026)",
      "تسجيل كامل لمعاملات 2025 في QuickBooks",
      "تسجيل الأصول الثابتة لجميع المدارس مكتمل",
    ],
    weaknesses: [
      "لا يوجد تدقيق خارجي حتى الآن",
      "الميزانية الربعية لم تبدأ بعد",
      "دليل السياسات لن يبدأ قبل الربع الثاني 2026",
      "ضعف قدرات الفريق المالي على مستوى المدارس",
    ],
    recommendations: [
      "البدء في تدقيق خارجي لقوائم 2025 — أولوية",
      "إعداد دليل إجراءات مبسط لرسوم المدارس وضبط النفقات",
      "تدريب مسؤولي المالية في المدارس خلال مايو 2026",
    ],
    nextMilestone: "إطلاق دليل إجراءات مالية مبسّط للمدارس — يونيو 2026",
  },
} as const;

export type ProgramStatus = "done" | "inProgress" | "delayed" | "notYet";
export const PROGRAM_STATUS_META: Record<ProgramStatus, { label: string; color: string }> = {
  done: { label: "مكتمل", color: "bg-green-100 text-green-700 border-green-300" },
  inProgress: { label: "قيد التنفيذ", color: "bg-blue-100 text-blue-700 border-blue-300" },
  delayed: { label: "مؤجل", color: "bg-orange-100 text-orange-700 border-orange-300" },
  notYet: { label: "لم يبدأ", color: "bg-gray-100 text-gray-600 border-gray-300" },
};

export const financialProgram = {
  ZUST: [
    { domain: "دليل الحسابات", status: "inProgress", note: "شبه مكتمل، بانتظار موافقة الإدارة" },
    { domain: "النظام المحاسبي (QuickBooks)", status: "done", note: "معتمد يناير 2026، تدريب مستمر" },
    { domain: "مستند مناولة النقد", status: "inProgress", note: "مراجعة جارية حتى أبريل 2026" },
    { domain: "تسجيل الأصول الثابتة", status: "done", note: "مدرج في قوائم 2025" },
    { domain: "سياسة الاستهلاك", status: "notYet", note: "تنتظر اعتماد دليل السياسات" },
    { domain: "الميزانية الربعية الموحدة", status: "delayed", note: "مؤجل للربع الثاني 2026" },
    { domain: "دليل الإجراءات المالية", status: "inProgress", note: "مكتمل، بانتظار اعتماد مجلس الإدارة" },
    { domain: "التقرير المالي السنوي 2025", status: "done", note: "أول تدقيق خارجي — جارٍ" },
  ],
  ZAD: [
    { domain: "دليل الحسابات", status: "done", note: "شبه مكتمل، بانتظار موافقة الإدارة" },
    { domain: "النظام المحاسبي (QBO)", status: "done", note: "QuickBooks Online فاعل" },
    { domain: "مستند مناولة النقد", status: "inProgress", note: "جارٍ توحيد الوثائق" },
    { domain: "الميزانية الربعية", status: "delayed", note: "مؤجل لمايو 2026" },
    { domain: "دليل الإجراءات المالية", status: "inProgress", note: "مراجعة مكتملة، ورشة الاعتماد معلقة" },
    { domain: "التقرير المالي السنوي 2025", status: "done", note: "أُرسل للمدقق" },
    { domain: "القوائم المالية المدققة 2025", status: "done", note: "منشورة رسمياً" },
    { domain: "أكاديمية هالل — النظام المحاسبي", status: "inProgress", note: "اختيار نظام — محدودية ميزانية" },
  ],
  TAYO: [
    { domain: "دليل الحسابات", status: "done", note: "QuickBooks Desktop 2018 — فبراير 2026" },
    { domain: "النظام المحاسبي", status: "inProgress", note: "تسجيل 2025 مكتمل، تدريب جارٍ" },
    { domain: "مستند مناولة النقد", status: "inProgress", note: "مؤجل لأبريل 2026" },
    { domain: "تسجيل الأصول الثابتة", status: "inProgress", note: "مسجّل، استهلاك لم يبدأ" },
    { domain: "سياسة الاستهلاك", status: "notYet", note: "تعتمد على دليل السياسات المالية" },
    { domain: "الميزانية الربعية", status: "notYet", note: "لم تبدأ بعد" },
    { domain: "دليل الإجراءات المالية", status: "notYet", note: "يبدأ الربع الثاني 2026" },
    { domain: "التقرير المالي السنوي 2025", status: "done", note: "قوائم 2025 مكتملة" },
    { domain: "تدريب مسؤولي المدارس", status: "notYet", note: "مجدول لمايو 2026" },
  ],
} as Record<"ZUST" | "ZAD" | "TAYO", { domain: string; status: ProgramStatus; note: string }[]>;

export const financialTimeline = [
  { period: "نوف-ديس 2025", title: "تقييم أولي", done: true },
  { period: "يناير 2026", title: "إنجاز الأساسيات", done: true },
  { period: "فبراير 2026", title: "تقدم ملحوظ", done: true },
  { period: "مارس-أبريل 2026", title: "تقدم كبير", done: true },
  { period: "مايو-يونيو 2026", title: "الاكتمال المستهدف", done: false },
];

export const partnerships = [
  { id: "P001", name: "الهيئة الخيرية الإسلامية — قطر", type: "استراتيجية", status: "فاعلة", geography: "عربي", linkedOrgs: ["KAFI"] },
  { id: "P002", name: "مؤسسة زمزم", type: "مذكرة تفاهم", status: "فاعلة", geography: "محلي — الصومال", linkedOrgs: ["KAFI"] },
  { id: "P003", name: "زاد للتنمية", type: "مذكرة تفاهم", status: "فاعلة", geography: "محلي — الصومال", linkedOrgs: ["KAFI"] },
  { id: "P004", name: "مركز بناء للتدريب", type: "تشغيلية", status: "فاعلة", geography: "محلي — الصومال", linkedOrgs: ["KAFI"] },
  { id: "P005", name: "IHHNL", type: "استراتيجية", status: "فاعلة", geography: "دولي", linkedOrgs: ["ZAD"] },
  { id: "P006", name: "AHAD — منتدى التعاون والتنمية", type: "استراتيجية", status: "فاعلة", geography: "دولي", linkedOrgs: ["ZAD"] },
  { id: "P007", name: "Al Khattab Foundation / FOCUS", type: "تشغيلية", status: "فاعلة", geography: "دولي", linkedOrgs: ["ZAD"] },
  { id: "P008", name: "Zad Turkey", type: "مذكرة تفاهم", status: "فاعلة", geography: "دولي", linkedOrgs: ["ZAD"] },
  { id: "P009", name: "MyCare", type: "تشغيلية", status: "فاعلة", geography: "دولي", linkedOrgs: ["ZAD"] },
  { id: "P010", name: "رابطة الجامعات الأفريقية (AAU)", type: "عضوية", status: "فاعلة", geography: "إقليمي — أفريقيا", linkedOrgs: ["ZUST"] },
  { id: "P011", name: "رابطة الجامعات العربية (AARU)", type: "عضوية", status: "فاعلة", geography: "عربي", linkedOrgs: ["ZUST"] },
  { id: "P012", name: "رابطة الجامعات الصومالية (ASU)", type: "عضوية", status: "فاعلة", geography: "محلي — الصومال", linkedOrgs: ["ZUST"] },
  { id: "P013", name: "TIKA — الوكالة التركية للتعاون", type: "تنموية", status: "فاعلة", geography: "دولي", linkedOrgs: ["ZUST"] },
  { id: "P014", name: "المجلس النرويجي للاجئين (NRC)", type: "تنموية", status: "فاعلة", geography: "دولي", linkedOrgs: ["ZUST"] },
  { id: "P015", name: "جامعة توكات غازي عثمان باشا", type: "أكاديمية", status: "فاعلة", geography: "دولي", linkedOrgs: ["ZUST"] },
  { id: "P016", name: "جامعة جيبوتي", type: "أكاديمية", status: "فاعلة", geography: "إقليمي — أفريقيا", linkedOrgs: ["ZUST"] },
];

export const institutions = [
  { id: "ZF", abbr: "ZF", color: "#d97706", nameAr: "مؤسسة زمزم", nameEn: "Zamzam Foundation", founded: null, license: null, licenseExpiry: null, phone: "+252770500031", email: "info@zamzamsom.org", execAr: null, staff: { total: null }, budget: null, sector: "تنمية إنسانية شاملة", score: 3.44, govScore: 3.67, branches: "بيانات قيد الاستكمال", alerts: [] as string[] },
  { id: "ZUST", abbr: "ZU", color: "#1d4ed8", nameAr: "جامعة زمزم للعلوم والتكنولوجيا", nameEn: "ZUST", founded: "أغسطس 2014", license: "وزارة التربية", licenseExpiry: null, phone: "+252612224054", email: "Rector@zust.edu.so", execAr: "حسن محمد محمد", staff: { m: 79, f: 8, total: 87 }, budget: 1166083, sector: "تعليم عالٍ وبحث", score: 3.72, govScore: 3.11, branches: "3 أفرع — 2509 طالب — 6 كليات", alerts: [] as string[] },
  { id: "ZAD", abbr: "ZD", color: "#ea580c", nameAr: "زاد للتنمية", nameEn: "Zad for Development", founded: "20/12/2005", license: "MoIFAR/NGOD/0681", licenseExpiry: "23/10/2026", phone: "0615583258", email: "omar@zadsom.org", execAr: "عمر عبدالرزاق يوسف", staff: { m: 12, f: 2, total: 14 }, budget: 1800000, sector: "صحة وتعليم وتمكين اقتصادي", score: 3.04, govScore: 0.87, branches: "+ أكاديمية هالل الدولية", alerts: ["⚠️ الحوكمة: 17% — أولوية عاجلة"] },
  { id: "TAYO", abbr: "TY", color: "#2563eb", nameAr: "تيو للتعليم", nameEn: "Tayo for Education", founded: "05/09/2017", license: "/0123NGOD/MoIFAR", licenseExpiry: "21/02/2027", phone: "+252618454544", email: "tayoeducation7@gmail.com", execAr: "علي معلم حسن", staff: { m: 251, f: 38, total: 289 }, budget: 914668, sector: "تعليم أساسي وثانوي", score: 3.49, govScore: 2.17, branches: "10 مدارس — 7299 طالب", alerts: [] as string[] },
  { id: "KAFI", abbr: "KF", color: "#15803d", nameAr: "كافي للتنمية", nameEn: "Kafi for Development", founded: "01/02/2020", license: "508O/NGOD/MoIEAR", licenseExpiry: "07/10/2026", phone: "+252614293111", email: "info@kafii.org", execAr: "عبد الرحمن بشر السنوسي", staff: { m: 3, f: 1, total: 4 }, budget: 1423000, sector: "تنمية مجتمعية وتمويل أصغر", score: 4.06, govScore: 4.4, branches: "لا توجد فروع", alerts: [] as string[] },
  { id: "HAMDI", abbr: "HM", color: "#94a3b8", nameAr: "منظمة حمدي للتنمية", nameEn: "Hamdi Organization", founded: "مارس 1993", license: "0287/2020", licenseExpiry: "09/12/2021", phone: "+252615372878", email: "xordorg@gmail.com", execAr: "د. زعيمة عبد الله حاج عبد الله", staff: { m: 42, f: 17, total: 59 }, budget: 170000, sector: "تعليم وإغاثة", score: null, govScore: null, branches: "4 مدارس", dataStatus: "pending" as const, alerts: ["🔴 ترخيص منتهٍ منذ 2021 — يحتاج تجديداً فورياً (5,000$)", "⚠️ هيكل تنظيمي قديم — يحتاج تحديثاً"] },
];

export const initiatives = [
  { id: "INI-001", priority: "حرج", status: "مقترح", domain: "تقني", title: "برنامج التحول الرقمي للشبكة", objective: "رفع أتمتة العمليات من 1.87 إلى 3.5", gap: "العمليات (1.87/5) — 6/6 مؤسسات", orgs: ["الجميع"], timeline: "12-18 شهراً", cost: "$45,000-$80,000" },
  { id: "INI-002", priority: "حرج", status: "مقترح", domain: "حوكمة", title: "إعادة بناء منظومة الحوكمة — زاد للتنمية", objective: "رفع مؤشر الحوكمة من 17% إلى 60%+", gap: "الحوكمة (0.87/5) — أدنى مستوى", orgs: ["زاد للتنمية"], timeline: "12 شهراً", cost: "$6,000-$10,000" },
  { id: "INI-003", priority: "حرج", status: "قيد التنفيذ", domain: "قانوني", title: "تجديد ترخيص منظمة حمدي", objective: "معالجة الترخيص المنتهي فوراً", gap: "ترخيص منتهٍ منذ 2021", orgs: ["منظمة حمدي"], timeline: "1-3 أشهر", cost: "$5,000" },
  { id: "INI-004", priority: "عالٍ", status: "مقترح", domain: "حوكمة", title: "توحيد أدلة الإجراءات التشغيلية (SOPs)", objective: "إعداد SOPs معيارية في المؤسسات الأضعف", gap: "أدلة الإجراءات (2.30/5) — 5/6 مؤسسات", orgs: ["زاد", "تيو", "حمدي"], timeline: "6 أشهر", cost: "$8,000-$15,000" },
  { id: "INI-005", priority: "عالٍ", status: "مقترح", domain: "مالي", title: "إطار تنويع مصادر التمويل", objective: "رفع الدخل الذاتي من 20% إلى 40%", gap: "تنوع الدخل (2.47/5) — 6/6 مؤسسات", orgs: ["تيو", "جامعة زمزم", "زاد"], timeline: "18 شهراً", cost: "$10,000-$18,000" },
  { id: "INI-006", priority: "عالٍ", status: "مقترح", domain: "بشري", title: "برنامج تطوير الخط القيادي الثاني", objective: "3-5 قيادات وسطى مؤهلة في كل مؤسسة", gap: "التعاقب القيادي (3.20/5)", orgs: ["مؤسسة زمزم", "زاد", "جامعة زمزم"], timeline: "12 شهراً", cost: "$12,000-$20,000" },
  { id: "INI-007", priority: "جارٍ", status: "قيد التنفيذ", domain: "مالي", title: "استكمال برنامج الإدارة المالية", objective: "اعتماد الأدلة، الميزانيات، إتمام التدقيق", gap: "متعدد الأبعاد", orgs: ["ZUST", "ZAD", "TAYO", "KAFI"], timeline: "ربع 2-3/2026", cost: "ضمن ميزانية المكتب" },
  { id: "INI-008", priority: "جارٍ", status: "قيد التنفيذ", domain: "بيانات", title: "استكمال بيانات منظمة حمدي وإدماجها", objective: "جمع وتوثيق كامل بيانات حمدي", gap: "بيانات ناقصة", orgs: ["منظمة حمدي"], timeline: "1-2 شهر", cost: "لا يحتاج ميزانية" },
];

export const alerts = [
  { level: "danger", title: "ترخيص منظمة حمدي منتهٍ منذ 2021", action: "يحتاج تجديداً فورياً" },
  { level: "danger", title: "مؤشر الحوكمة في زاد للتنمية 17%", action: "أولوية عاجلة" },
  { level: "warning", title: "أتمتة العمليات 1.87/5 على مستوى الشبكة", action: "إطلاق برنامج التحول الرقمي" },
  { level: "warning", title: "تنوع مصادر الدخل 2.47/5", action: "إعداد إطار تنويع التمويل" },
  { level: "success", title: "أول تدقيق خارجي لجامعة زمزم — جارٍ", action: "خطوة نوعية" },
  { level: "success", title: "كافي حققت 88% في مؤشر الحوكمة", action: "نموذج يُحتذى" },
];
