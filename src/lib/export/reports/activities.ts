import { activityResult, activityTotals, operationalSummary } from "@/lib/perf/engine";
import { optionLabel } from "@/lib/perf/dictionary";
import { linkedCode } from "@/lib/perf/references";
import type { Activity, KPI, Plan, Quarter, Report } from "@/lib/perf/types";
import { col, makeDoc, r2, rate, section, table } from "./common";

/** Programs & activities log: the period log, period/year totals and the operational plan summary. */
export function buildActivitiesDoc(input: { plan: Plan; activities: Activity[]; kpis: KPI[]; period: Quarter; report?: Report; org: { id: string; nameAr: string }; yearLabel: string; now?: string }) {
  const { activities, period } = input;
  const inPeriod = activities.filter((a) => a.quarter === period);
  const upTo = activities.filter((a) => Number(a.quarter.slice(1)) <= Number(period.slice(1)));
  const type = (t: string) => optionLabel("activity_type", t, "ar");
  const totalsTable = (rows: Activity[]) => {
    const t = activityTotals(rows);
    const line = (label: string, x: typeof t.total) => [label, x.beneficiaries, x.planned, x.achieved, r2(x.pct)];
    return table([col("النوع", "Type"), col("المستفيدون", "Beneficiaries"), col("المخطط", "Planned"), col("المنجز", "Achieved"), col("النسبة %", "%", true)],
      [line(type("program"), t.program), line(type("event"), t.event), line(type("training"), t.training)], line("الإجمالي", t.total));
  };
  const op = operationalSummary(activities, period, input.report?.planned_beneficiaries ?? null);
  const opRows: [string, keyof typeof op][] = [["البرامج", "program"], ["المستفيدون", "beneficiaries"], ["الفعاليات", "event"], ["بناء القدرات", "training"]];
  return makeDoc({
    titleAr: "سجل البرامج والأنشطة", titleEn: "Programs and Activities Log", slug: "Activities-Log",
    org: input.org.nameAr, orgCode: input.org.id, year: input.yearLabel, period, preparedBy: input.plan.prepared_by,
    status: "live", now: input.now,
    sections: [
      section(`سجل الأنشطة — ${period}`, `Activities log — ${period}`, inPeriod.length ? [table(
        [col("الفترة", "Quarter"), col("النوع", "Type"), col("العنوان", "Title"), col("الفئة المستهدفة", "Target group"), col("المنفّذ", "Implementer"),
          col("المستفيدون", "Beneficiaries"), col("المخطط", "Planned"), col("المنجز", "Achieved"), col("النسبة %", "%", true), col("كود المؤشر", "KPI code")],
        inPeriod.map((a) => [a.quarter, type(a.activity_type), a.title, a.target_group, a.implementer, a.beneficiaries, a.planned, a.achieved,
          r2(activityResult(a)), linkedCode(a, input.kpis) ?? null]))] : [], "landscape"),
      section("إجماليات الفترة والسنة", "Period and year totals", [
        { type: "subheading", ar: `إجماليات ${period}`, en: `${period} totals` }, totalsTable(inPeriod),
        { type: "subheading", ar: `من بداية السنة حتى ${period}`, en: `Year to ${period}` }, totalsTable(upTo),
      ]),
      section("ملخص الخطة التشغيلية", "Operational plan summary", [table(
        [col("البند", "Item"), col("المخطط", "Planned"), col("الفعلي", "Actual"), col("النسبة %", "%", true), col("التقييم", "Rating", true)],
        opRows.map(([l, k]) => [l, op[k].planned, op[k].achieved, r2(op[k].pct), rate(op[k].rating)]))]),
    ],
  });
}
