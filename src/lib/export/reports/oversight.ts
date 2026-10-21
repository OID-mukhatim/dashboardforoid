import { govStatusScore } from "../../gov-likert";
import { POLICY_STATUS_META, type PolicyRow, type PolicyStatus } from "../../oid-data";
import type { Cell } from "../types";
import { col, makeDoc, r2, section, table } from "./common";

type Org = { id: string; nameAr: string; abbr?: string };
const avg = (xs: (number | null)[]) => { const v = xs.filter((x): x is number => typeof x === "number"); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };

/** Governance & compliance: each policy's status per institution, then the Likert governance score and %. */
export function buildGovernanceDoc(input: {
  orgs: Org[]; categories: { ar: string; en: string; policies: PolicyRow[] }[];
  status: (policyId: string, orgId: string) => PolicyStatus; scores: Record<string, number | null>; orgCode: string; now?: string;
}) {
  const { orgs } = input;
  const label = (s: PolicyStatus) => { const n = govStatusScore(s); return n === null ? POLICY_STATUS_META[s].label : `${POLICY_STATUS_META[s].label} (${n})`; };
  const policyBlocks = input.categories.flatMap((c) => [
    { type: "subheading" as const, ar: c.ar, en: c.en },
    table([col("الرمز", "Code"), col("السياسة", "Policy"), ...orgs.map((o) => col(o.nameAr, o.abbr ?? o.id))],
      c.policies.map((p) => [p.id, p.name, ...orgs.map((o) => label(input.status(p.id, o.id)))])),
  ]);
  const scoreRows: Cell[][] = orgs.map((o) => { const s = input.scores[o.id] ?? null; return [o.nameAr, r2(s), s === null ? null : Math.round((s / 5) * 100)]; });
  const mean = avg(orgs.map((o) => input.scores[o.id] ?? null));
  return makeDoc({
    titleAr: "تقرير الحوكمة والامتثال", titleEn: "Governance and Compliance Report", slug: "Governance-Report",
    org: input.orgCode === "ALL" ? "كل المؤسسات" : orgs[0]?.nameAr ?? input.orgCode, orgCode: input.orgCode, now: input.now,
    sections: [
      section("درجة الحوكمة", "Governance score", [
        table([col("المؤسسة", "Institution"), col("الدرجة من 5", "Score / 5", true), col("النسبة %", "%", true)], scoreRows,
          orgs.length > 1 ? ["المتوسط", r2(mean), mean === null ? null : Math.round((mean / 5) * 100)] : undefined),
        { type: "text", value: "سلم ليكرت المعتمد: موجود ومفعّل 5، موجود وغير مفعّل 4، بحاجة إلى تحديث ومراجعة 3، قيد الإعداد 2، غير موجود 0؛ المعلّق والفارغ مستبعدان. النسبة = المتوسط ÷ 5 × 100." },
      ]),
      section("حالة السياسات", "Policy status", policyBlocks, "landscape"),
    ],
  });
}

/** Gap analysis: the seven domains per institution (latest period) and their mean. */
export function buildGapsDoc(input: { orgs: Org[]; axes: { ar: string; en: string }[]; value: (orgId: string, axisIndex: number) => number | null; orgCode: string; now?: string }) {
  const { orgs, axes } = input;
  const rows = axes.map((a, i) => { const vals = orgs.map((o) => r2(input.value(o.id, i))); return [a.ar, ...vals, r2(avg(vals))]; });
  const orgMeans = orgs.map((o) => r2(avg(axes.map((_, i) => input.value(o.id, i)))));
  return makeDoc({
    titleAr: "تقرير تحليل الفجوات", titleEn: "Gap Analysis Report", slug: "Gap-Analysis",
    org: input.orgCode === "ALL" ? "كل المؤسسات" : orgs[0]?.nameAr ?? input.orgCode, orgCode: input.orgCode, period: "أحدث فترة", now: input.now,
    sections: [section("درجات المجالات السبعة (من 5)", "Seven domain scores (out of 5)", [table(
      [col("المجال", "Domain"), ...orgs.map((o) => col(o.nameAr, o.abbr ?? o.id)), col("المتوسط", "Mean", true)], rows,
      ["متوسط المؤسسة", ...orgMeans, r2(avg(orgMeans))])], orgs.length > 3 ? "landscape" : "portrait")],
  });
}

export type InitiativeRow = { title: string; domain: string | null; priority: string | null; status: string | null; orgs: string; timeline: string | null; cost: number | string | null };
/** Development initiatives list. */
export function buildInitiativesDoc(input: { rows: InitiativeRow[]; orgName: string; orgCode: string; now?: string }) {
  return makeDoc({
    titleAr: "تقرير المبادرات التطويرية", titleEn: "Development Initiatives Report", slug: "Initiatives",
    org: input.orgName, orgCode: input.orgCode, now: input.now,
    sections: [section("المبادرات", "Initiatives", input.rows.length ? [table(
      [col("المبادرة", "Initiative"), col("المجال", "Domain"), col("الأولوية", "Priority"), col("الحالة", "Status"), col("المؤسسات", "Institutions"), col("الجدول الزمني", "Timeline"), col("التكلفة", "Cost")],
      input.rows.map((r) => [r.title, r.domain, r.priority, r.status, r.orgs, r.timeline, r.cost]))] : [], "landscape")],
  });
}
