/**
 * المحور السابع (أساسيات): مقياس النضج المرجعي 0-5
 */

export type MaturityLevel = {
  min: number;
  max: number;
  level: number;
  labelAr: string;
  color: string;
  bg: string;
  description: string;
};

export const MATURITY_SCALE: MaturityLevel[] = [
  { min: 0, max: 1.9, level: 1, labelAr: "مبتدئ",
    color: "#dc2626", bg: "#fee2e2",
    description: "لا توجد ممارسات ممنهجة — تعمل بردود الفعل" },
  { min: 2.0, max: 2.9, level: 2, labelAr: "ناشئ",
    color: "#d97706", bg: "#fef3c7",
    description: "بدأت الممارسات لكنها غير منتظمة أو موثقة" },
  { min: 3.0, max: 3.4, level: 3, labelAr: "متطور",
    color: "#ca8a04", bg: "#fefce8",
    description: "ممارسات موثقة ومنتظمة نسبياً لكن غير مكتملة" },
  { min: 3.5, max: 4.4, level: 4, labelAr: "متقدم",
    color: "#2563eb", bg: "#dbeafe",
    description: "ممارسات راسخة وقابلة للقياس" },
  { min: 4.5, max: 5.0, level: 5, labelAr: "ريادي",
    color: "#16a34a", bg: "#dcfce7",
    description: "نموذج يُحتذى به — يُحسَّن باستمرار" },
];

export function getMaturityLevel(score: number | null | undefined): MaturityLevel | null {
  if (score === null || score === undefined || Number.isNaN(score)) return null;
  return MATURITY_SCALE.find((m) => score >= m.min && score <= m.max) ?? null;
}
