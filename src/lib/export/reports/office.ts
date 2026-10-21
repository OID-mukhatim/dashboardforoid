import type { Cell, Column } from "../types";
import { col, makeDoc, section, table } from "./common";

export type OfficeTab = "plans" | "meetings" | "visits" | "tasks";
type Row = Record<string, unknown>;
const c = (v: unknown): Cell => (v === null || v === undefined || v === "" ? null : typeof v === "number" ? v : Array.isArray(v) ? v.map((x) => (typeof x === "object" ? Object.values(x ?? {}).filter(Boolean).join(" - ") : String(x))).join("، ") : String(v));
const STATUS: Record<string, string> = { final: "معتمد", draft: "مسودة" };

/** Office work report for the open tab within a date range. */
export function buildOfficeDoc(input: { tab: OfficeTab; rows: Row[]; from: string; to: string; orgName: (id: unknown) => string | null; now?: string }) {
  const { tab, from, to } = input;
  const inRange = (d: unknown) => { const s = String(d ?? "").slice(0, 10); return !s || (s >= from && s <= to); };
  const def: Record<OfficeTab, { ar: string; en: string; date: string; cols: [string, Column][]; detail?: { key: string; ar: string; en: string; cols: [string, Column][] } }> = {
    meetings: { ar: "الاجتماعات", en: "Meetings", date: "date", cols: [["date", col("التاريخ", "Date")], ["title", col("العنوان", "Title")], ["meeting_type", col("النوع", "Type")], ["org_id", col("المؤسسة", "Institution")], ["location", col("المكان", "Location")], ["objective", col("الهدف", "Objective")], ["outputs", col("المخرجات", "Outputs")], ["status", col("الحالة", "Status")]],
      detail: { key: "meeting_decisions", ar: "القرارات", en: "Decisions", cols: [["decision", col("القرار", "Decision")], ["assigned_to", col("المكلف", "Assigned to")], ["due_date", col("الاستحقاق", "Due")]] } },
    visits: { ar: "الزيارات", en: "Visits", date: "date", cols: [["date", col("التاريخ", "Date")], ["org_id", col("المؤسسة", "Institution")], ["visit_type", col("النوع", "Type")], ["objective", col("الهدف", "Objective")], ["oid_delegate", col("مندوب المكتب", "OID delegate")], ["outputs", col("المخرجات", "Outputs")], ["challenges", col("التحديات", "Challenges")], ["status", col("الحالة", "Status")]],
      detail: { key: "visit_gaps", ar: "الفجوات", en: "Gaps", cols: [["gap", col("الفجوة", "Gap")], ["action", col("الإجراء", "Action")], ["priority", col("الأولوية", "Priority")], ["due_date", col("الاستحقاق", "Due")]] } },
    plans: { ar: "خطط المكتب", en: "Office plans", date: "created_at", cols: [["year", col("السنة", "Year")], ["quarter", col("الربع", "Quarter")], ["title", col("الخطة", "Plan")], ["objective", col("الهدف", "Objective")], ["status", col("الحالة", "Status")]],
      detail: { key: "plan_activities", ar: "الأنشطة", en: "Activities", cols: [["title", col("النشاط", "Activity")], ["assigned_to", col("المكلف", "Assigned to")], ["due_date", col("الاستحقاق", "Due")], ["status", col("الحالة", "Status")]] } },
    tasks: { ar: "متابعات المؤسسات", en: "Institution follow-ups", date: "due_date", cols: [["title", col("المهمة", "Task")], ["org_id", col("المؤسسة", "Institution")], ["priority", col("الأولوية", "Priority")], ["status", col("الحالة", "Status")], ["due_date", col("الاستحقاق", "Due")], ["assigned_to", col("المكلف", "Assigned to")], ["source_type", col("المصدر", "Source")]] },
  };
  const d = def[tab];
  const rows = input.rows.filter((r) => inRange(r[d.date]));
  const val = (r: Row, k: string) => (k === "org_id" ? input.orgName(r[k]) ?? c(r[k]) : k === "status" ? STATUS[String(r[k])] ?? c(r[k]) : c(r[k]));
  const blocks = rows.length ? [table(d.cols.map(([, x]) => x), rows.map((r) => d.cols.map(([k]) => val(r, k))))] : [];
  const detailRows = d.detail ? rows.flatMap((r) => ((r[d.detail!.key] as Row[]) ?? []).map((x) => [c(r.title ?? r.date ?? r.objective), ...d.detail!.cols.map(([k]) => c(x[k]))])) : [];
  return makeDoc({
    titleAr: `تقرير أعمال المكتب — ${d.ar}`, titleEn: `Office Work Report — ${d.en}`, slug: `Office-${tab}`,
    org: "كل المؤسسات", orgCode: "ALL", period: `${from}_${to}`, now: input.now,
    sections: [
      section(d.ar, d.en, blocks, "landscape"),
      ...(d.detail ? [section(d.detail.ar, d.detail.en, detailRows.length ? [table([col("المرجع", "Reference"), ...d.detail.cols.map(([, x]) => x)], detailRows)] : [], "landscape")] : []),
    ],
  });
}
