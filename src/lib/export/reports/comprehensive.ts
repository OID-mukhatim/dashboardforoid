import type { ReportSnapshot, ReportPeriod } from "../../reports/build";
import type { Plan, Report, ReportValue } from "../../perf/types";
import type { Block, Cell } from "../types";
import { col, makeDoc, periodLabel, persp, r2, rate, section, table } from "./common";
import { reportNumericValue } from "../../reports/presentation";

const FLAG: Record<string, string> = { notDue: "غير مستحق", missing: "بيانات ناقصة", noPlan: "لا يوجد مخطط" };
const v = (x: ReportValue | undefined): Cell => (typeof x === "boolean" ? (x ? "نعم" : "لا") : x ?? null);

/** Comprehensive quarterly/annual report: same section order as the screen; approved reports always use the frozen snapshot. */
export function buildComprehensiveDoc(input: {
  plan: Plan; period: ReportPeriod; report: Report | undefined; live: ReportSnapshot;
  org: { id: string; nameAr: string }; yearLabel: string; users: Record<string, string>; kpiNames?: Record<string, string>; now?: string;
}) {
  const { plan, period, report, org } = input;
  const approved = report?.status === "approved";
  const s: ReportSnapshot = approved && report?.snapshot ? (report.snapshot as ReportSnapshot) : input.live;
  const sections = [];
  sections.push(section("الملخص التنفيذي", "Executive summary", s.executive?.trim() ? [{ type: "text", value: s.executive } as Block] : []));
  const k = s.kpi;
  const kpiBlocks: Block[] = k ? [
    { type: "kv", items: [
      { ar: k.basis === "toDate" ? "النتيجة حتى تاريخه" : "النتيجة السنوية", en: k.basis === "toDate" ? "Result to date" : "Annual result", value: r2(k.overall), computed: true },
      { ar: "التقييم", en: "Rating", value: rate(k.overallRating), computed: true },
      ...(k.basis === "toDate" ? [{ ar: "مقابل المستهدف السنوي", en: "Against annual target", value: r2(k.annualOverall), computed: true }] : []),
      { ar: "اكتمال البيانات %", en: "Data completeness %", value: k.completeness === null ? null : r2(k.completeness * 100), computed: true },
    ] },
    { type: "subheading", ar: "نتائج المناظير", en: "Perspective results" },
    table([col("المنظور", "Perspective"), col("الوزن", "Weight"), col("الدرجة المحققة %", "Achieved %", true), col("المرجحة", "Weighted", true), col("التقييم", "Rating", true)],
      k.perspectives.map((p) => [persp(p.id), r2(p.weight), r2(p.pct), r2(p.weighted), rate(p.rating)]),
      ["الإجمالي", r2(k.perspectives.reduce((a, p) => a + p.weight, 0)), null, r2(k.overall), rate(k.overallRating)]),
    { type: "subheading", ar: "نتائج المؤشرات", en: "KPI results" },
    table([col("الكود", "Code"), col("المؤشر", "KPI"), k.basis === "toDate" ? col("المخطط حتى تاريخه", "Planned to date") : col("المستهدف السنوي", "Annual target"), k.basis === "toDate" ? col("المنجز حتى تاريخه", "Achieved to date") : col("المنجز السنوي", "Annual achieved"), col("النسبة %", "%", true), col("الوسم", "Flag")],
      k.kpis.map((x) => [x.code, x.name, r2(x.planned), r2(x.displayAchieved === undefined && k.basis === "annual" ? x.achieved : x.displayAchieved), r2(x.pct), x.flag ? FLAG[x.flag] : null])),
  ] : [];
  sections.push(section("نتيجة مؤشرات الأداء", "KPI results", kpiBlocks, "landscape"));
  const o = s.operational;
  const opRows: [string, string, keyof NonNullable<typeof o>][] = [["البرامج", "Programs", "program"], ["المستفيدون", "Beneficiaries", "beneficiaries"], ["الفعاليات", "Events", "event"], ["بناء القدرات", "Capacity building", "training"]];
  sections.push(section("ملخص الخطة التشغيلية", "Operational plan summary", o ? [table(
    [col("البند", "Item"), col("المخطط", "Planned"), col("الفعلي", "Actual"), col("النسبة %", "%", true), col("التقييم", "Rating", true)],
    opRows.map(([a, , key]) => [a, o[key].planned, o[key].achieved, r2(o[key].pct), rate(o[key].rating)]))] : []));
  sections.push(section("المبادرات التطويرية", "Development initiatives", s.initiatives.length ? [table(
    [col("المبادرة", "Initiative"), col("المجال", "Domain"), col("الأولوية", "Priority"), col("الحالة", "Status"), col("الجدول الزمني", "Timeline")],
    s.initiatives.map((i) => [i.title, i.domain, i.priority, i.status, i.timeline]))] : []));
  if (period === "annual") {
    const rows = s.annual_stats ?? [];
    sections.push(section("الإحصاءات السنوية", "Annual statistics", rows.length ? [table(
      [col("البند", "Item"), col("السنة السابقة", "Previous year"), col("السنة الحالية", "Current year"), col("نسبة التغير %", "Change %", true), col("الملاحظة", "Note")],
       rows.map((r) => { const previous = reportNumericValue(r.previous), current = reportNumericValue(r.current); return [v(r.category), previous, current,
         previous !== null && current !== null && previous !== 0 ? r2(((current - previous) / previous) * 100) : null, v(r.note)]; }))] : []));
  }
  const narrative = (rows: Record<string, ReportValue>[], cols: [string, string, string][]) =>
    rows.length ? [table(cols.map(([, ar, en]) => col(ar, en)), rows.map((r) => cols.map(([key]) =>
       key === "kpi_id" ? (input.kpiNames?.[String(r.kpi_id)] ?? v(r.kpi_code)) : key === "cost" ? reportNumericValue(r[key]) : v(r[key]))))] : [];
  sections.push(section("أبرز الإنجازات", "Key achievements", narrative(s.achievements, [["achievement", "الإنجاز", "Achievement"], ["area", "المجال", "Area"], ["impact", "الأثر", "Impact"], ["kpi_id", "المؤشر الداعم", "Supporting KPI"], ["note", "الملاحظة", "Note"]]), "landscape"));
  sections.push(section("التحديات", "Challenges", narrative(s.challenges, [["challenge", "التحدي", "Challenge"], ["category", "التصنيف", "Category"], ["impact", "مدى التأثير", "Impact level"], ["reasons", "الأسباب", "Causes"], ["action", "الإجراء", "Action"], ["status", "الحالة", "Status"], ["notes", "الملاحظات", "Notes"]]), "landscape"));
  sections.push(section("المقترحات لمجلس الأمناء", "Proposals to the Board", narrative(s.proposals, [["proposal", "المقترح", "Proposal"], ["justification", "المبرر", "Justification"], ["impact", "الأثر المتوقع", "Expected impact"], ["priority", "الأولوية", "Priority"], ["cost", "التكلفة التقديرية", "Estimated cost"], ["timeline", "الجدول الزمني", "Timeline"], ["notes", "الملاحظات", "Notes"]]), "landscape"));
  return makeDoc({
    titleAr: period === "annual" ? "التقرير السنوي الشامل" : "التقرير الربعي الشامل",
    titleEn: period === "annual" ? "Comprehensive Annual Report" : "Comprehensive Quarterly Report",
    slug: "Comprehensive-Report", org: org.nameAr, orgCode: org.id, year: input.yearLabel, period: periodLabel(period),
    preparedBy: plan.prepared_by, approvedBy: approved && report?.approved_by ? (input.users[report.approved_by] ?? report.approved_by) : null,
    approvedAt: approved ? report?.approved_at ?? null : null, status: approved ? "approved" : "draft", now: input.now, sections,
  });
}
