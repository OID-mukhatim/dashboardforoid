/**
 * محلّل قالب "تقرير الأداء الربعي" (Quarterly Performance Report).
 *
 * بنية الورقة:
 *   صف "اسم المؤسسة / الفترة / معدّ التقرير / مراجعة واعتماد" ثم صف قيمه.
 *   ثم أقسام يبدأ كلٌّ منها بصف رأس عموده الأول "#":
 *     - أهم الإنجازات والمبادرات والمشاريع
 *     - أهم المشاركات والفعاليات والبرامج التدريبية
 *     - التحديات والعوائق
 *     - التوصيات والمقترحات
 */

export type QuarterlyAchievement = {
  n: number | null;
  title: string;
  code: string | null;
  target: number | null;
  achieved: number | null;
  pct: number | null; // 0..100
  beneficiaries: number | null;
  location: string | null;
  budget: number | null;
  cost: number | null;
  variance: number | null;
  outcomes: string | null;
};

export type QuarterlyEvent = {
  n: number | null;
  title: string;
  code: string | null;
  target: number | null;
  achieved: number | null;
  pct: number | null;
  participants: number | null;
  location: string | null;
  evaluation: string | null;
};

export type QuarterlyChallenge = {
  n: number | null;
  title: string;
  impact: string | null;
  reasons: string | null;
  actions: string | null;
  status: string | null;
  requiredSupport: string | null;
};

export type QuarterlyReport = {
  orgName: string | null;
  quarter: string | null; // Q1..Q4
  reporter: string | null;
  approver: string | null;
  achievements: QuarterlyAchievement[];
  events: QuarterlyEvent[];
  challenges: QuarterlyChallenge[];
  recommendations: string[];
};

function s(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const t = String(v).replace(/\s+/g, " ").trim();
  return t.length ? t : null;
}
function n(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const x = typeof v === "number" ? v : Number(String(v).replace(/[,%\s]/g, ""));
  return Number.isFinite(x) ? x : null;
}
/** نسب الإنجاز مخزّنة ككسر (1.28) أو نسبة (128) — نوحّدها إلى 0..100+ */
function pct(v: unknown): number | null {
  const x = n(v);
  if (x === null) return null;
  const p = x <= 5 ? x * 100 : x;
  return Math.round(p * 10) / 10;
}

/** هل هذه الورقة على قالب التقرير الربعي؟ */
export function looksLikeQuarterlySheet(aoa: unknown[][]): boolean {
  const head = aoa.slice(0, 40).map((r) => (Array.isArray(r) ? r.map((c) => String(c ?? "")).join(" ") : "")).join(" | ");
  return /أهم\s*الإنجازات/.test(head) && /(الفترة|Period)/i.test(head);
}

export function looksLikeQuarterlyName(name: string): boolean {
  return /تقرير\s*الأداء\s*الربعي|التقرير\s*الربعي|ربعي|quarterly/i.test(name ?? "");
}

type SectionKind = "ach" | "ev" | "ch" | "rec" | null;
function sectionOf(label: string): SectionKind {
  if (/الإنجازات|achievements/i.test(label)) return "ach";
  if (/المشاركات|الفعاليات|البرامج\s*التدريبية|events|training/i.test(label)) return "ev";
  if (/التحديات|العوائق|challenges/i.test(label)) return "ch";
  if (/التوصيات|المقترحات|recommendation/i.test(label)) return "rec";
  return null;
}

export function parseQuarterlySheet(aoa: unknown[][]): QuarterlyReport | null {
  if (!looksLikeQuarterlySheet(aoa)) return null;

  const report: QuarterlyReport = {
    orgName: null, quarter: null, reporter: null, approver: null,
    achievements: [], events: [], challenges: [], recommendations: [],
  };

  // ── رأس التقرير ──
  for (let r = 0; r < Math.min(aoa.length, 15); r++) {
    const row = aoa[r];
    if (!Array.isArray(row)) continue;
    const joined = row.map((c) => String(c ?? "")).join(" ");
    if (/اسم\s*المؤسسة/.test(joined)) {
      const vals = aoa[r + 1];
      if (Array.isArray(vals)) {
        const cells = vals.map((c) => s(c)).filter(Boolean) as string[];
        report.orgName = cells[0] ?? null;
        const q = cells.find((c) => /^Q[1-4]$/i.test(c) || /الربع/.test(c));
        report.quarter = q ? (q.match(/Q[1-4]/i)?.[0]?.toUpperCase() ?? q) : null;
        report.reporter = cells[2] ?? null;
        report.approver = cells[3] ?? null;
      }
      break;
    }
  }

  // ── الأقسام ──
  let current: SectionKind = null;
  for (let r = 0; r < aoa.length; r++) {
    const row = aoa[r];
    if (!Array.isArray(row)) continue;
    const first = s(row[0]);
    const label = s(row[1]) ?? "";

    if (first === "#") { current = sectionOf(label); continue; }
    if (!current) continue;

    const idx = n(row[0]);
    const title = s(row[1]);
    if (idx === null || !title) continue;

    if (current === "ach") {
      report.achievements.push({
        n: idx, title, code: s(row[2]),
        target: n(row[3]), achieved: n(row[4]), pct: pct(row[5]),
        beneficiaries: n(row[6]), location: s(row[7]),
        budget: n(row[8]), cost: n(row[9]), variance: n(row[10]),
        outcomes: s(row[12]),
      });
    } else if (current === "ev") {
      report.events.push({
        n: idx, title, code: s(row[2]),
        target: n(row[3]), achieved: n(row[4]), pct: pct(row[5]),
        participants: n(row[6]), location: s(row[7]), evaluation: s(row[9]) ?? s(row[8]),
      });
    } else if (current === "ch") {
      report.challenges.push({
        n: idx, title, impact: s(row[2]), reasons: s(row[3]),
        actions: s(row[4]), status: s(row[5]), requiredSupport: s(row[6]),
      });
    } else if (current === "rec") {
      report.recommendations.push(title);
    }
  }

  const total = report.achievements.length + report.events.length + report.challenges.length + report.recommendations.length;
  return total > 0 ? report : null;
}
