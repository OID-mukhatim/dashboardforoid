import type { ReactNode } from "react";
import type { ReportSnapshot } from "@/lib/reports/build";
import { DataTable } from "@/components/perf/PerformanceTables";
import { formatNumber } from "@/lib/perf/ui-text";
import { optionLabel } from "@/lib/perf/dictionary";
import type { Lang } from "@/lib/i18n";
import type { Column } from "./RowsEditor";

const PERSPECTIVE: Record<string, [string, string]> = {
  S: ["المستفيدون والمجتمع", "Stakeholders"], P: ["العمليات الداخلية", "Internal processes"],
  L: ["التعلم والنمو", "Learning & growth"], F: ["المالي", "Financial"],
};
const pct = (v: number | null | undefined) => (typeof v === "number" ? `${formatNumber(v)}%` : "—");
const none = (lang: Lang) => <p className="text-sm text-muted-foreground">{lang === "ar" ? "لا توجد بيانات للفترة" : "No data for this period"}</p>;

export const PRIORITY = ["عالية", "متوسطة", "منخفضة"].map((v) => ({ value: v, label: v }));
export const IMPACT = ["مرتفع", "متوسط", "منخفض"].map((v) => ({ value: v, label: v }));
export const COLUMNS: Record<"annual_stats" | "achievements" | "challenges" | "proposals", Column[]> = {
  annual_stats: [
    { key: "category", ar: "البند", en: "Item" }, { key: "previous", ar: "السنة السابقة", en: "Previous year", type: "number" },
    { key: "current", ar: "السنة الحالية", en: "Current year", type: "number" },
    { key: "change", ar: "نسبة التغير", en: "Change %", compute: (r) => typeof r.previous === "number" && typeof r.current === "number" && r.previous !== 0 ? `${formatNumber(((r.current - r.previous) / r.previous) * 100)}%` : "—" }, { key: "note", ar: "الملاحظة", en: "Note" },
  ],
  achievements: [
    { key: "achievement", ar: "الإنجاز", en: "Achievement" }, { key: "area", ar: "المجال", en: "Area" },
    { key: "impact", ar: "الأثر", en: "Impact" }, { key: "kpi_id", ar: "المؤشر الداعم", en: "Supporting KPI" }, { key: "note", ar: "الملاحظة", en: "Note" },
  ],
  challenges: [
    { key: "challenge", ar: "التحدي", en: "Challenge" }, { key: "category", ar: "التصنيف", en: "Category" },
    { key: "impact", ar: "مدى التأثير", en: "Impact level", options: IMPACT }, { key: "reasons", ar: "الأسباب", en: "Causes" },
    { key: "action", ar: "الإجراء", en: "Action" }, { key: "status", ar: "الحالة", en: "Status" }, { key: "notes", ar: "الملاحظات", en: "Notes" },
  ],
  proposals: [
    { key: "proposal", ar: "المقترح", en: "Proposal" }, { key: "justification", ar: "المبرر", en: "Justification" },
    { key: "impact", ar: "الأثر المتوقع", en: "Expected impact" }, { key: "priority", ar: "الأولوية", en: "Priority", options: PRIORITY },
    { key: "cost", ar: "التكلفة التقديرية", en: "Estimated cost", type: "number" }, { key: "timeline", ar: "الجدول الزمني", en: "Timeline" },
    { key: "notes", ar: "الملاحظات", en: "Notes" },
  ],
};

export function KpiResultView({ data, lang }: { data: ReportSnapshot["kpi"]; lang: Lang }) {
  if (!data) return none(lang);
  const ar = lang === "ar";
  const toDate = data.basis === "toDate";
  const flag = (f: string | null) => !f ? "" : ar ? { notDue: "غير مستحق", missing: "بيانات ناقصة", noPlan: "لا يوجد مخطط" }[f] : { notDue: "Not due", missing: "Missing data", noPlan: "No plan" }[f];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-6 text-sm">
        <div><span className="text-muted-foreground">{toDate ? (ar ? "النتيجة حتى تاريخه" : "Result to date") : (ar ? "النتيجة السنوية" : "Annual result")}: </span>
          <strong className="text-xl tabular-nums" data-testid="report-overall">{pct(data.overall)}</strong>
          <span className="ms-2">{data.overallRating ? optionLabel("rating", data.overallRating, lang) : ""}</span></div>
        {toDate && <div><span className="text-muted-foreground">{ar ? "مقابل المستهدف السنوي" : "Against annual target"}: </span>
          <strong className="tabular-nums" data-testid="report-annual">{pct(data.annualOverall)}</strong></div>}
        <div><span className="text-muted-foreground">{ar ? "اكتمال البيانات" : "Data completeness"}: </span>
          {data.completeness === null ? "—" : `${formatNumber(data.completeness * 100)}%`}</div>
      </div>
      <table className="oid-table">
        <thead><tr>
          <th>{ar ? "المنظور" : "Perspective"}</th><th>{ar ? "الوزن" : "Weight"}</th>
          <th>{ar ? "الدرجة المحققة" : "Achieved"}</th><th>{ar ? "المرجحة" : "Weighted"}</th><th>{ar ? "التقييم" : "Rating"}</th>
          {toDate && <th>{ar ? "مقابل المستهدف السنوي" : "Against annual"}</th>}
        </tr></thead>
        <tbody>{data.perspectives.map((p) => (
          <tr key={p.id}>
            <td>{PERSPECTIVE[p.id]?.[ar ? 0 : 1] ?? p.id}</td><td className="tabular-nums">{formatNumber(p.weight)}</td>
            <td className="tabular-nums">{pct(p.pct)}</td><td className="tabular-nums">{typeof p.weighted === "number" ? formatNumber(p.weighted) : "—"}</td>
            <td>{p.rating ? optionLabel("rating", p.rating, lang) : "—"}</td>
            {toDate && <td className="tabular-nums">{pct(p.annualPct)}</td>}
          </tr>))}</tbody>
      </table>
      <table className="oid-table">
        <thead><tr><th>{ar ? "الكود" : "Code"}</th><th>{ar ? "المؤشر" : "KPI"}</th><th>{ar ? "المنجز" : "Achieved"}</th><th>{ar ? "النسبة" : "%"}</th><th>{ar ? "الوسم" : "Flag"}</th></tr></thead>
        <tbody>{data.kpis.map((k) => (
          <tr key={k.id || k.code}><td dir="ltr">{k.code}</td><td>{k.name}</td>
            <td className="tabular-nums">{typeof k.achieved === "number" ? formatNumber(k.achieved) : "—"}</td>
            <td className="tabular-nums">{pct(k.pct)}</td><td>{flag(k.flag)}</td></tr>))}</tbody>
      </table>
    </div>
  );
}

export function OperationalView({ data, lang }: { data: ReportSnapshot["operational"]; lang: Lang }) {
  if (!data) return none(lang);
  const ar = lang === "ar";
  const rows: [string, string, keyof NonNullable<ReportSnapshot["operational"]>][] = [
    ["البرامج", "Programs", "program"], ["المستفيدون", "Beneficiaries", "beneficiaries"],
    ["الفعاليات", "Events", "event"], ["بناء القدرات", "Capacity building", "training"],
  ];
  return (
    <table className="oid-table">
      <thead><tr><th>{ar ? "البند" : "Item"}</th><th>{ar ? "المخطط" : "Planned"}</th><th>{ar ? "الفعلي" : "Actual"}</th><th>{ar ? "النسبة" : "%"}</th><th>{ar ? "التقييم" : "Rating"}</th></tr></thead>
      <tbody>{rows.map(([a, e, k]) => { const l = data[k]; return (
        <tr key={k}><td>{ar ? a : e}</td><td className="tabular-nums">{l.planned === null ? "—" : formatNumber(l.planned)}</td>
          <td className="tabular-nums">{formatNumber(l.achieved)}</td><td className="tabular-nums">{pct(l.pct)}</td>
          <td>{l.rating ? optionLabel("rating", l.rating, lang) : "—"}</td></tr>); })}</tbody>
    </table>
  );
}

export function InitiativesView({ data, lang }: { data: ReportSnapshot["initiatives"]; lang: Lang }): ReactNode {
  if (!data.length) return none(lang);
  return <DataTable label="initiatives" columns={["title", "domain", "priority", "status", "timeline"]} rows={data} />;
}
