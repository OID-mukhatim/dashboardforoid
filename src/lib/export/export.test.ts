import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import ExcelJS from "exceljs";
import * as XLSX from "xlsx";
import { unzipSync, strFromU8 } from "fflate";
import { parseTemplate } from "../perf/parser";
import type { Plan, Report } from "../perf/types";
import { buildReportSections } from "../reports/build";
import { buildComprehensiveDoc } from "./reports/comprehensive";
import { buildKpiDoc } from "./reports/kpis";
import { buildActivitiesDoc } from "./reports/activities";
import { buildGovernanceDoc } from "./reports/oversight";
import { renderXlsx } from "./render-xlsx";
import { renderDocx } from "./render-docx";
import { renderPrintHtml } from "./render-html";
import { exportFileName } from "./filename";
import { COLORS } from "./identity";
import type { ReportDocument } from "./types";
import { numericNarrativeRows, reportKpiOperands } from "../reports/presentation";
import { toDateResult } from "../perf/engine";

const fx = parseTemplate(new Uint8Array(readFileSync(new URL("../perf/fixture-zf-q2.xlsx", import.meta.url))), "ZF");
const plan = { id: "p", org_id: "ZF", plan_year: 2099, fiscal_type: "calendar", status: "matrix_approved", prepared_by: fx.prepared_by, approved_by: fx.approved_by } as unknown as Plan;
const org = { id: "ZF", nameAr: "مؤسسة زمزم" };
const now = "2099-07-15T00:00:00.000Z";
const kpis = fx.kpis.map((k, i) => ({ ...k, id: `k${i}` }));
const live = buildReportSections({ plan, kpis, activities: fx.activities, report: fx.report, initiatives: [], period: "Q2" });
const approvedReport = { ...fx.report, period: "Q2", status: "approved", approved_by: "u1", approved_at: "2099-07-10T00:00:00Z", snapshot: live } as Report;

const comprehensive = buildComprehensiveDoc({ plan, period: "Q2", report: approvedReport, live: { ...live, executive: "changed after approval" }, org, yearLabel: "2099", users: { u1: "admin@oid.org" }, now });
const kpiDoc = buildKpiDoc({ plan, kpis, period: "Q2", org, yearLabel: "2099", now });
const actDoc = buildActivitiesDoc({ plan, kpis, activities: fx.activities, period: "Q2", report: fx.report, org, yearLabel: "2099", now });
const govDoc = buildGovernanceDoc({
  orgs: [{ id: "ZF", nameAr: "مؤسسة زمزم" }, { id: "HAMDI", nameAr: "حمدي" }], orgCode: "ALL", now,
  categories: [{ ar: "السياسات العامة", en: "General", policies: [{ id: "GP-01", name: "النظام الأساسي" }, { id: "GP-02", name: "ميثاق مجلس الأمناء" }] }],
  status: (p, o) => (o === "ZF" ? "active" : p === "GP-01" ? "review" : "pending"), scores: { ZF: 4.2, HAMDI: 1.6 },
});
const kv = (d: ReportDocument, s: number) => d.sections[s].blocks.find((b) => b.type === "kv") as Extract<ReportDocument["sections"][0]["blocks"][0], { type: "kv" }>;

describe("ReportDocument per report — ZF 2099", () => {
  it("comprehensive Q2 uses the frozen snapshot and approver email: 86.625% to date, 69.9987% annual", () => {
    expect(comprehensive.meta).toMatchObject({ status: "approved", approvedBy: "admin@oid.org", orgCode: "ZF", period: "Q2" });
    expect(comprehensive.sections.map((s) => s.titleAr)).toEqual(["الملخص التنفيذي", "نتيجة مؤشرات الأداء", "ملخص الخطة التشغيلية", "المبادرات التطويرية", "أبرز الإنجازات", "التحديات", "المقترحات لمجلس الأمناء"]);
    expect(JSON.stringify(comprehensive.sections[0])).not.toContain("changed after approval");
    expect(kv(comprehensive, 1).items[0].value).toBeCloseTo(86.625, 6);
    expect(kv(comprehensive, 1).items[2].value).toBeCloseTo(69.9987, 3);
    expect(comprehensive.sections[3].blocks).toEqual([]);
  });
  it("draft comprehensive report is marked draft", () => {
    const d = buildComprehensiveDoc({ plan, period: "Q2", report: { ...fx.report, period: "Q2" }, live, org, yearLabel: "2099", users: {}, now });
    expect(d.meta.status).toBe("draft");
  });
  it("KPI report: one landscape section per perspective with 11 KPIs, overall annual 69.9987", () => {
    const tables = kpiDoc.sections.slice(0, 4);
    expect(tables.every((s) => s.orientation === "landscape")).toBe(true);
    expect(tables.reduce((n, s) => n + (s.blocks[0]?.type === "table" ? s.blocks[0].rows.length : 0), 0)).toBe(11);
    expect(kv(kpiDoc, 4).items[1].value).toBeCloseTo(69.9987, 3);
    expect(kv(kpiDoc, 4).items[0].value).toBeCloseTo(86.625, 6);
  });
  it("activities report lists the Q2 log and totals", () => {
    const log = actDoc.sections[0].blocks[0];
    expect(log.type === "table" && log.rows.length).toBe(fx.activities.filter((a) => a.quarter === "Q2").length);
    expect(actDoc.sections.map((s) => s.titleEn)).toEqual(["Activities log — Q2", "Period and year totals", "Operational plan summary"]);
  });
  it("governance report: Likert statuses, score and % with mean", () => {
    const t = govDoc.sections[0].blocks[0];
    expect(t.type === "table" && t.rows).toEqual([["مؤسسة زمزم", 4.2, 84], ["حمدي", 1.6, 32]]);
    expect(t.type === "table" && t.totalsRow).toEqual(["المتوسط", 2.9, 58]);
    const p = govDoc.sections[1].blocks[1];
    expect(p.type === "table" && p.rows[0]).toEqual(["GP-01", "النظام الأساسي", "موجود ومفعّل (5)", "بحاجة تحديث (3)"]);
    expect(p.type === "table" && p.rows[1][3]).toBe("غير مقيّم");
  });
  it("file name follows OID-<ORG>-<year>-<period>-<name>", () => {
    expect(exportFileName(comprehensive, "pdf")).toBe("OID-ZF-2099-Q2-Comprehensive-Report.pdf");
    expect(exportFileName(govDoc, "xlsx")).toBe("OID-ALL-2099-2099-07-15-Governance-Report.xlsx");
  });
});

const fillOf = (c: XLSX.CellObject | undefined) => (c?.s as { fgColor?: { rgb?: string } } | undefined)?.fgColor?.rgb;
describe("renderers", () => {
  it("Excel: RTL sheets, four colours in place, numbers are numbers", async () => {
    const bytes = await renderXlsx(kpiDoc);
    const wb = XLSX.read(bytes, { type: "array", cellStyles: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    expect(fillOf(ws.A1)).toBe(COLORS.office);
    expect(fillOf(ws.A2)).toBe(COLORS.title);
    expect(fillOf(ws.A5)).toBe(COLORS.title); // section heading
    expect(fillOf(ws.A6)).toBe(COLORS.header); // column header
    expect(fillOf(ws.T7)).toBe(COLORS.computed); // to-date % column
    expect(fillOf(ws.A7)).toBeUndefined();
    expect(ws.I7.t).toBe("n");
    const ex = new ExcelJS.Workbook();
    await ex.xlsx.load(bytes.buffer as ArrayBuffer);
    ex.worksheets.forEach((s) => expect(s.views[0]).toMatchObject({ rightToLeft: true }));
    expect(ex.worksheets[0].getCell("A1").alignment.readingOrder).toBe("rtl");
    expect(ex.worksheets[0].getRow(2).height).toBe(41.25);
  });
  it("Excel draft shows a clear draft line in the header", async () => {
    const d = { ...kpiDoc, meta: { ...kpiDoc.meta, status: "draft" as const } };
    const wb = XLSX.read(await renderXlsx(d), { type: "array" });
    expect(String(wb.Sheets[wb.SheetNames[0]].A4.v)).toContain("مسودة — غير معتمد");
  });
  it("Word: bidi paragraphs, rtl runs, landscape sections and colours", async () => {
    const files = unzipSync(await renderDocx({ ...comprehensive, meta: { ...comprehensive.meta, status: "draft" } }));
    const xml = strFromU8(files["word/document.xml"]);
    expect(xml).toContain("<w:bidi");
    expect(xml).toContain("<w:rtl");
    expect(xml).toContain('w:orient="landscape"');
    for (const c of [COLORS.office, COLORS.title, COLORS.header, COLORS.computed]) expect(xml).toContain(`w:fill="${c}"`);
    const headers = Object.keys(files).filter((f) => f.startsWith("word/header")).map((f) => strFromU8(files[f])).join("");
    expect(headers).toContain("مسودة — غير معتمد");
  });
  it("PDF print page: RTL, landscape pages, page numbers, colours", () => {
    const html = renderPrintHtml(govDoc);
    expect(html).toContain('dir="rtl"');
    expect(html).toContain("size: A4 landscape");
    expect(html).toContain("counter(page)");
    for (const c of [COLORS.office, COLORS.title, COLORS.header, COLORS.computed]) expect(html).toContain(`#${c}`);
    expect(html).not.toContain("مسودة — غير معتمد");
  });
});
