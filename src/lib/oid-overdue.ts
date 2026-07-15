/**
 * كشف التواريخ المتجاوزة (Overdue detection).
 * يمسح نصوص عربية تحوي إشارات إلى شهر/ربع/سنة (مثلاً "مايو 2026"،
 * "الربع الثاني 2026"، "يونيو 2026") ويحدد ما إذا كانت المدة قد انقضت
 * مقارنةً بالتاريخ الحالي.
 */

const MONTHS_AR: Record<string, number> = {
  "يناير": 1, "فبراير": 2, "مارس": 3, "أبريل": 4, "ابريل": 4,
  "مايو": 5, "يونيو": 6, "يوليو": 7, "أغسطس": 8, "اغسطس": 8,
  "سبتمبر": 9, "أكتوبر": 10, "اكتوبر": 10, "نوفمبر": 11, "ديسمبر": 12,
};

const QUARTERS_AR: Record<string, number> = {
  "الأول": 1, "الاول": 1, "الثاني": 2, "الثالث": 3, "الرابع": 4,
};

export type OverdueInfo = {
  overdue: boolean;
  monthsLate: number;
  targetLabel: string | null; // e.g. "مايو 2026"
};

/** يعيد آخر شهر مذكور في النص كأحدث موعد نهائي (End of month). */
export function detectDeadline(text: string, now: Date = new Date()): OverdueInfo {
  if (!text) return { overdue: false, monthsLate: 0, targetLabel: null };

  let latestYear = 0;
  let latestMonth = 0;
  let latestLabel: string | null = null;

  // شهر + سنة (مايو 2026، مايو-يونيو 2026 → نأخذ الأخير يونيو)
  const monthRe = new RegExp(`(${Object.keys(MONTHS_AR).join("|")})(?:\\s*[-–]\\s*(${Object.keys(MONTHS_AR).join("|")}))?\\s*(20\\d{2})`, "g");
  for (const m of text.matchAll(monthRe)) {
    const year = parseInt(m[3], 10);
    const monthName = m[2] ?? m[1];
    const month = MONTHS_AR[monthName];
    if (year > latestYear || (year === latestYear && month > latestMonth)) {
      latestYear = year; latestMonth = month;
      latestLabel = `${monthName} ${year}`;
    }
  }

  // ربع + سنة (الربع الثاني 2026)
  const qRe = new RegExp(`الربع\\s+(${Object.keys(QUARTERS_AR).join("|")})\\s*(20\\d{2})`, "g");
  for (const m of text.matchAll(qRe)) {
    const year = parseInt(m[2], 10);
    const qEndMonth = QUARTERS_AR[m[1]] * 3; // نهاية الربع
    if (year > latestYear || (year === latestYear && qEndMonth > latestMonth)) {
      latestYear = year; latestMonth = qEndMonth;
      latestLabel = `الربع ${m[1]} ${year}`;
    }
  }

  if (!latestLabel) return { overdue: false, monthsLate: 0, targetLabel: null };

  // نهاية الشهر المستهدف
  const deadline = new Date(latestYear, latestMonth, 0, 23, 59, 59);
  const overdue = now.getTime() > deadline.getTime();
  const monthsLate = overdue
    ? (now.getFullYear() - latestYear) * 12 + (now.getMonth() + 1 - latestMonth)
    : 0;

  return { overdue, monthsLate, targetLabel: latestLabel };
}
