import { scorePlan, annualResult, toDateResult } from "../../perf/engine";
import { optionLabel } from "../../perf/dictionary";
import { PERSPECTIVES, type KPI, type Plan, type Quarter } from "../../perf/types";
import { col, makeDoc, persEn, persp, r2, rate, section, table } from "./common";

/** Full KPI matrix per perspective (landscape) with to-date and annual results, then totals. */
export function buildKpiDoc(input: { plan: Plan; kpis: KPI[]; period: Quarter; org: { id: string; nameAr: string }; yearLabel: string; approvedBy?: string | null; now?: string }) {
  const { plan, kpis, period } = input;
  const score = scorePlan(kpis, period);
  const L = (g: Parameters<typeof optionLabel>[0], k: string) => optionLabel(g, k, "ar");
  const columns = [
    col("الكود", "Code"), col("الهدف", "Objective"), col("المؤشر", "KPI"), col("طبيعة القياس", "Measurement"), col("الدور", "Role"),
    col("الوحدة", "Unit"), col("القطبية", "Polarity"), col("طريقة الاحتساب", "Calc method"), col("الوزن", "Weight"),
    col("خط الأساس", "Baseline"), col("المستهدف السنوي", "Annual target"),
    col("مخطط Q1", "Q1 plan"), col("منجز Q1", "Q1 actual"), col("مخطط Q2", "Q2 plan"), col("منجز Q2", "Q2 actual"),
    col("مخطط Q3", "Q3 plan"), col("منجز Q3", "Q3 actual"), col("مخطط Q4", "Q4 plan"), col("منجز Q4", "Q4 actual"),
    col("حتى تاريخه %", "To date %", true), col("مرجح حتى تاريخه", "To-date weighted", true),
    col("المنجز السنوي", "Annual achieved", true), col("السنوي %", "Annual %", true), col("مرجح سنوي", "Annual weighted", true),
  ];
  const sections = PERSPECTIVES.map((p) => {
    const rows = kpis.filter((k) => k.perspective === p).sort((a, b) => a.seq - b.seq);
    const ps = score.perspectives.find((x) => x.id === p);
    return section(`منظور ${persp(p)}`, `${persEn(p)} perspective`, rows.length ? [table(columns, rows.map((k) => {
      const td = toDateResult(k, period), an = annualResult(k);
      return [k.code, k.objective, k.name, L("measurement", k.measurement), L("role", k.role), L("unit", k.unit), L("polarity", k.polarity),
        L("calc_method", k.calc_method), k.weight, k.baseline, k.annual_target, k.q1_plan, k.q1_actual, k.q2_plan, k.q2_actual,
        k.q3_plan, k.q3_actual, k.q4_plan, k.q4_actual, r2(td.pct), r2(td.weighted), r2(an.annual_achieved), r2(an.annual_pct), r2(an.weighted)];
    }), ["الإجمالي", ...Array(7).fill(null), r2(rows.reduce((a, k) => a + k.weight, 0)), ...Array(10).fill(null),
      r2(ps?.toDatePct), r2(ps?.toDate), null, r2(ps?.annualPct), r2(ps?.annual)])] : [], "landscape");
  });
  sections.push(section("إجمالي المناظير والمؤشر الكلي", "Perspective totals and overall score", [
    table([col("المنظور", "Perspective"), col("الوزن", "Weight"), col("حتى تاريخه %", "To date %", true), col("مرجح حتى تاريخه", "To-date weighted", true),
      col("السنوي %", "Annual %", true), col("مرجح سنوي", "Annual weighted", true), col("التقييم السنوي", "Annual rating", true)],
      score.perspectives.map((p) => [persp(p.id), r2(p.weight), r2(p.toDatePct), r2(p.toDate), r2(p.annualPct), r2(p.annual), rate(p.annualRating)]),
      ["المؤشر الكلي", r2(score.perspectives.reduce((a, p) => a + p.weight, 0)), null, r2(score.toDate), null, r2(score.annual), rate(score.annualRating)]),
    { type: "kv", items: [
      { ar: "النتيجة حتى تاريخه", en: "Result to date", value: r2(score.toDate), computed: true },
      { ar: "النتيجة السنوية", en: "Annual result", value: r2(score.annual), computed: true },
      { ar: "اكتمال البيانات %", en: "Data completeness %", value: score.completeness === null ? null : r2(score.completeness * 100), computed: true },
    ] },
  ]));
  const matrixApproved = plan.status === "matrix_approved";
  return makeDoc({
    titleAr: "تقرير مؤشرات الأداء", titleEn: "Key Performance Indicators Report", slug: "KPI-Report",
    org: input.org.nameAr, orgCode: input.org.id, year: input.yearLabel, period, preparedBy: plan.prepared_by,
    approvedBy: matrixApproved ? input.approvedBy ?? plan.approved_by : null, approvedAt: plan.matrix_approved_at ?? null,
    status: "live", now: input.now, sections,
  });
}
