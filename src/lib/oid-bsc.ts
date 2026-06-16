/**
 * مناظير بطاقة الأداء المتوازن (BSC) — أربعة فقط، معيارية.
 * أي نص "sector" في بيانات KPIs يُسقط على واحد منها عبر مطابقة كلمات مفتاحية.
 * النصوص غير المطابقة (أهداف، مخرجات، عناوين أقسام…) لا تُعتبر مناظير.
 */

export type BSCKey = "financial" | "stakeholder" | "internal" | "learning";

export const BSC_PERSPECTIVES: {
  key: BSCKey;
  label: string;
  aliases: string[];
  color: string;
  icon: string;
}[] = [
  { key: "financial",   label: "المنظور المالي",          aliases: ["المالي", "النتائج المالية", "الموارد المالية", "مالي"], color: "#7c3aed", icon: "💰" },
  { key: "stakeholder", label: "منظور أصحاب المصلحة",     aliases: ["أصحاب المصلحة", "المستفيدين", "المستفيدون", "العملاء", "الشركاء", "المانحين", "المجتمع"], color: "#0e7490", icon: "🤝" },
  { key: "internal",    label: "منظور العمليات الداخلية", aliases: ["العمليات الداخلية", "العمليات", "الإجراءات"], color: "#15803d", icon: "⚙️" },
  { key: "learning",    label: "منظور التعلم والنمو",      aliases: ["التعلم والنمو", "التعلم", "النمو", "التطوير", "البنية التحتية", "النظم", "الكفاءات", "رأس المال البشري"], color: "#d97706", icon: "🌱" },
];

export const BSC_LABELS = BSC_PERSPECTIVES.map(p => p.label);

export function matchPerspective(sector: string | null | undefined): BSCKey | null {
  if (!sector) return null;
  const s = String(sector).replace(/\s+/g, " ").trim();
  if (!s) return null;
  for (const p of BSC_PERSPECTIVES) if (p.aliases.some(a => s.includes(a))) return p.key;
  return null;
}

export function perspectiveLabelOf(sector: string | null | undefined): string | null {
  const k = matchPerspective(sector);
  return k ? BSC_PERSPECTIVES.find(p => p.key === k)!.label : null;
}
