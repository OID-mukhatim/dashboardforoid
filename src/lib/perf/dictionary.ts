export const OPTIONS = {
  perspective: { S: ['أصحاب المصلحة', 'Stakeholder'], P: ['العمليات الداخلية', 'Internal Process'], L: ['التعلّم والنّمو', 'Learning & Growth'], F: ['المالي', 'Financial'] },
  measurement: { pct: ['كمي نسبي', 'Quantitative %'], num: ['كمي عددي', 'Quantitative Number'], qual: ['نوعي', 'Qualitative'] },
  role: { leading: ['قيادي', 'Leading'], lagging: ['نتائج', 'Lagging'] },
  unit: { number: ['عدد', 'Number'], percent: ['نسبة %', 'Percentage'], amount: ['مبلغ $', 'Amount'], days: ['أيام', 'Days'], likert: ['مقياس ليكرت الخماسي', 'Likert 1-5'] },
  polarity: { asc: ['تصاعدي', 'Ascending'], desc: ['تنازلي', 'Descending'] },
  calc_method: { q_independent: ['ربعي - مستقل', 'Quarterly-Independent'], q_cumulative: ['ربعي - تراكمي', 'Quarterly-Cumulative'], q_average: ['ربعي - متوسط', 'Quarterly-Average'], h_independent: ['نصف سنوي - مستقل', 'Semi-Annual-Independent'], h_cumulative: ['نصف سنوي - تراكمي', 'Semi-Annual-Cumulative'], h_average: ['نصف سنوي - متوسط', 'Semi-Annual-Average'], annual: ['سنوي', 'Annual'] },
  activity_type: { program: ['برنامج / مشروع / نشاط', 'Program / Project / Activity'], event: ['فعالية مجتمعية', 'Community Event'], training: ['تدريب وبناء قدرات', 'Training & Capacity Building'] },
  rating: { weak: ['ضعيف', 'Weak'], average: ['متوسط', 'Average'], good: ['جيد', 'Good'], excellent: ['ممتاز', 'Excellent'] },
} as const;
export const normalize = (value: unknown) => String(value ?? '').replace(/[\u064B-\u065F]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
export function optionCode(group: keyof typeof OPTIONS, value: unknown): string | null {
  const text = normalize(value);
  for (const [key, labels] of Object.entries(OPTIONS[group])) {
    if ([key, labels[0], labels[1], `${labels[0]} ${labels[1]}`].some(v => normalize(v) === text)) return key;
  }
  return null;
}
export function optionLabel(group: keyof typeof OPTIONS, key: string, lang: 'ar' | 'en') {
  const entry = (OPTIONS[group] as Record<string, readonly string[]>)[key];
  return entry?.[lang === 'ar' ? 0 : 1] ?? key;
}
