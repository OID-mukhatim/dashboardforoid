import type { Block, Cell } from "../types";
import { col, makeDoc, r2, section, table } from "./common";

type Org = { id: string; nameAr: string };
type Assessment = { label?: string; strengths?: string[]; weaknesses?: string[]; nextMilestone?: string; recommendations?: string[] };
type ProgramItem = { domain?: string; status?: string; note?: string };
export type FinReport = { org_id: string; plan_year: number; quarter: string; approved_budget: number; actual_spending: number; surplus_deficit: number; status: string };
const STATUS: Record<string, string> = { done: "مكتمل", inProgress: "قيد التنفيذ", delayed: "مؤجل", notYet: "لم يبدأ" };

/** Financial performance — current section content as is: advisor assessment & program for the shown period, plus financial reports. */
export function buildFinancialDoc(input: {
  orgs: Org[]; orgCode: string; advisorPeriod: string | null; assessment: Record<string, Assessment>; program: Record<string, ProgramItem[]>;
  timeline: { period: string; title: string | null; done: boolean | null }[]; reports: FinReport[]; year: number; now?: string;
}) {
  const list = (xs?: string[]) => (xs?.length ? xs.map((x) => `• ${x}`).join("\n") : null);
  const advisor: Block[] = input.orgs.flatMap((o) => {
    const a = input.assessment[o.id];
    const p = input.program[o.id] ?? [];
    if (!a && !p.length) return [];
    return [
      { type: "subheading", ar: o.nameAr, en: o.id },
      ...(a ? [{ type: "kv", items: [
        { ar: "التقييم", en: "Assessment", value: a.label ?? null }, { ar: "نقاط القوة", en: "Strengths", value: list(a.strengths) },
        { ar: "نقاط الضعف", en: "Weaknesses", value: list(a.weaknesses) }, { ar: "المحطة القادمة", en: "Next milestone", value: a.nextMilestone ?? null },
        { ar: "التوصيات", en: "Recommendations", value: list(a.recommendations) },
      ] } as Block] : []),
      ...(p.length ? [table([col("المجال", "Domain"), col("الحالة", "Status"), col("الملاحظة", "Note")], p.map((x) => [x.domain ?? null, STATUS[x.status ?? ""] ?? x.status ?? null, x.note ?? null]))] : []),
    ] as Block[];
  });
  const reps = input.reports.filter((r) => input.orgs.some((o) => o.id === r.org_id));
  const name = (id: string) => input.orgs.find((o) => o.id === id)?.nameAr ?? id;
  const sum = (k: "approved_budget" | "actual_spending" | "surplus_deficit") => reps.reduce((a, r) => a + Number(r[k] ?? 0), 0);
  const rows: Cell[][] = reps.map((r) => [name(r.org_id), r.quarter, Number(r.approved_budget), Number(r.actual_spending), Number(r.surplus_deficit),
    Number(r.approved_budget) ? r2((Number(r.actual_spending) / Number(r.approved_budget)) * 100) : null, r.status]);
  return makeDoc({
    titleAr: "تقرير الأداء المالي", titleEn: "Financial Performance Report", slug: "Financial",
    org: input.orgCode === "ALL" ? "كل المؤسسات" : input.orgs[0]?.nameAr ?? input.orgCode, orgCode: input.orgCode, year: input.year, period: input.advisorPeriod, now: input.now,
    sections: [
      section("أعمال المستشار المالي", "Financial advisor work", advisor),
      section("المسار الزمني", "Timeline", input.timeline.length ? [table([col("الفترة", "Period"), col("العنوان", "Title"), col("الحالة", "Status")],
        input.timeline.map((t) => [t.period, t.title, t.done ? "منجز" : "قادم"]))] : []),
      section("التقارير المالية", "Financial reports", rows.length ? [table(
        [col("المؤسسة", "Institution"), col("الربع", "Quarter"), col("الموازنة المعتمدة", "Approved budget"), col("الإنفاق الفعلي", "Actual spending"),
          col("الفائض / العجز", "Surplus / deficit", true), col("نسبة التنفيذ %", "Execution %", true), col("الحالة", "Status")], rows,
        ["الإجمالي", null, sum("approved_budget"), sum("actual_spending"), sum("surplus_deficit"), sum("approved_budget") ? r2((sum("actual_spending") / sum("approved_budget")) * 100) : null, null])] : [], "landscape"),
    ],
  });
}
