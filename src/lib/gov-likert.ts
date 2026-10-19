/** سلم ليكرت المعتمد لدرجات الحوكمة — المصدر الوحيد في المنصة. pending والخلايا الفارغة تُستبعد. */
export const GOV_LIKERT = { active: 5, inactive: 4, review: 3, inDev: 2, missing: 0 } as const;
export type ScoredGovStatus = keyof typeof GOV_LIKERT;

/** درجة الحالة، أو null إن كانت pending/غير معروفة (تُستبعد من البسط والمقام). */
export function govStatusScore(status: string | null | undefined): number | null {
  const s = String(status ?? "") as ScoredGovStatus;
  return s in GOV_LIKERT ? GOV_LIKERT[s] : null;
}

/** متوسط الدرجات المقيّمة (من 5) أو null. */
export function govAverage(scores: Array<number | null>): number | null {
  const vs = scores.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  return vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null;
}

export const govPctOf = (score: number | null): number | null => (score === null ? null : Math.round((score / 5) * 100));

/** نص الإجابة في ملف التقييم → حالة (الترتيب مهم: «غير موجود» بعد «موجود وغير مفعّل»). */
export const GOV_TEXT_STATUS: Array<[RegExp, ScoredGovStatus]> = [
  [/موجود\s*ومفعّ?ل|existing\s*and\s*activated/i, "active"],
  [/موجود\s*وغير\s*مفعّ?ل|existing\s*but\s*not\s*activated/i, "inactive"],
  [/بحاجة\s*إلى\s*تحديث|needs\s*review/i, "review"],
  [/قيد\s*الإعداد|under\s*development/i, "inDev"],
  [/غير\s*موجود|not\s*exist/i, "missing"],
];

/** أقرب حالة لدرجة إجمالية (للعرض المستنتج فقط). */
export function nearestGovStatus(score: number | null | undefined): ScoredGovStatus | null {
  if (typeof score !== "number" || !Number.isFinite(score)) return null;
  let best: ScoredGovStatus = "missing";
  for (const [k, v] of Object.entries(GOV_LIKERT) as Array<[ScoredGovStatus, number]>) {
    if (Math.abs(v - score) < Math.abs(GOV_LIKERT[best] - score)) best = k;
  }
  return best;
}
