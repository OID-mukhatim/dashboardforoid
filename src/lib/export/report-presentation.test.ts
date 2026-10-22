import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parseTemplate } from "../perf/parser";
import { buildReportSections } from "../reports/build";
import { buildComprehensiveDoc } from "./reports/comprehensive";
import { buildGovernanceDoc } from "./reports/oversight";
import { renderXlsx } from "./render-xlsx";
import { renderDocx } from "./render-docx";
import { renderPrintHtml } from "./render-html";
import * as XLSX from "xlsx";
import { unzipSync, strFromU8 } from "fflate";
import type { Plan, Report } from "../perf/types";
import type { ReportPeriod } from "../reports/build";
const fx = parseTemplate(new Uint8Array(readFileSync(new URL("../perf/fixture-zf-q2.xlsx", import.meta.url))), "ZF");
const plan = { org_id: "ZF", id: "p", plan_year: 2099, status: "matrix_approved" } as Plan;
const org = { id: "ZF", nameAr: "زمزم" };
const make = (period: ReportPeriod) => {
  const report = { ...fx.report, period } as Report;
  const live = buildReportSections({ plan, kpis: fx.kpis, activities: fx.activities, report, initiatives: [], period });
  return buildComprehensiveDoc({ plan, period, report, live, org, yearLabel: "2099", users: {} });
};
describe("Report export presentation", () => {
  it("Q2 exports S2 operands 1000 and 1080 alongside unchanged 108%", () => {
    const doc = make("Q2");
    const t = doc.sections[1].blocks.find((b) => b.type === "table" && b.rows.some((r) => r[0] === "ZF-S2"));
    if (t?.type !== "table") throw new Error("KPI table missing");
    expect(t.rows.find((r) => r[0] === "ZF-S2")?.slice(2, 5)).toEqual([1000, 1080, 108]);
  });
  it("annual exports the annual target and achieved, not just Q4 actual", () => {
    const t = make("annual").sections[1].blocks.find((b) => b.type === "table" && b.rows.some((r) => r[0] === "ZF-S2"));
    if (t?.type !== "table") throw new Error("KPI table missing");
    const s2 = fx.kpis.find((k) => k.code === "ZF-S2");
    expect(t.rows.find((r) => r[0] === "ZF-S2")?.[2]).toBe(s2?.annual_target);
    expect(t.rows.find((r) => r[0] === "ZF-S2")?.[3]).toBe(1080);
  });
  it("pending and absent records are unassessed; empty sector categories are omitted", () => {
    const d = buildGovernanceDoc({ orgs: [org], orgCode: "ZF", scores: { ZF: 4.2 }, status: (id) => id === "GP-01" ? "pending" : undefined,
      categories: [{ ar: "العامة", en: "General", policies: [{ id: "GP-01", name: "x" }, { id: "GP-02", name: "y" }] }, { ar: "التعليمية", en: "Education", policies: [{ id: "EP-01", name: "z" }] }] });
    const b = d.sections[1].blocks;
    expect(b).toHaveLength(2);
    expect(b[1].type === "table" && b[1].rows.map((r) => r[2])).toEqual(["غير مقيّم", "غير مقيّم"]);
  });
  it("numeric narrative values stay numeric in Excel and are formatted in Word/PDF", async () => {
    const d = make("annual");
    const stats = d.sections.find((s) => s.titleEn === "Annual statistics")?.blocks[0];
    const proposals = d.sections.at(-1)?.blocks[0];
    expect(stats?.type === "table" && stats.rows.some((r) => typeof r[2] === "number")).toBe(true);
    expect(proposals?.type === "table" && proposals.rows.some((r) => typeof r[4] === "number")).toBe(true);
    const wb = XLSX.read(await renderXlsx(d), { type: "array" });
    const ws = wb.Sheets[wb.SheetNames.at(-1) ?? ""];
    expect(ws.E8.t).toBe("n");
    expect(ws.E8.v).toBe(5000);
    const text = strFromU8(unzipSync(await renderDocx(d))["word/document.xml"]);
    expect(text).toContain("5,000");
    expect(renderPrintHtml(d)).toContain("5,000");
  });
  it("all exports display two decimals without rounding the document or snapshot", async () => {
    const d = make("Q2");
    const html = renderPrintHtml(d);
    expect(html).toContain("86.63"); expect(html).toContain("70.00"); expect(html).not.toContain("69.9987");
    const xml = strFromU8(unzipSync(await renderDocx(d))["word/document.xml"]);
    expect(xml).toContain("86.63"); expect(xml).toContain("70.00");
    const wb = XLSX.read(await renderXlsx(d), { type: "array", cellNF: true });
    const ws = wb.Sheets[wb.SheetNames[1]];
    expect(ws.B7.v).toBeCloseTo(86.625, 6);
    expect(ws.B7.z).toBe("#,##0.00");
  });
  it("legacy frozen snapshots never obtain operands from modified live data", () => {
    const live = buildReportSections({ plan, kpis: fx.kpis, activities: [], report: undefined, initiatives: [], period: "Q2" });
    const frozen = structuredClone(live);
    frozen.kpi?.kpis.forEach((k) => { delete k.planned; delete k.displayAchieved; });
    const before = JSON.stringify(frozen);
    const d = buildComprehensiveDoc({ plan, period: "Q2", report: { status: "approved", snapshot: frozen } as unknown as Report, live, org, yearLabel: "2099", users: {} });
    const t = d.sections[1].blocks.find((b) => b.type === "table" && b.rows.some((r) => r[0] === "ZF-S2"));
    expect(t?.type === "table" && t.rows.find((r) => r[0] === "ZF-S2")?.slice(2, 4)).toEqual([null, null]);
    expect(JSON.stringify(frozen)).toBe(before);
  });
});