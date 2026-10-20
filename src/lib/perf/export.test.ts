import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { unzipSync, strFromU8, zipSync, strToU8 } from "fflate";
import { XMLValidator } from "fast-xml-parser";
import * as XLSX from "xlsx";
import { exportTemplate } from "./export";
import { parseTemplate } from "./parser";
import { scorePlan } from "./engine";
import { fillSheet, readXml, writeXml } from "./xml";
import { exportCapacity, fieldEditable } from "./edit-rules";
const original = new Uint8Array(readFileSync(new URL("./fixture-zf-q2.xlsx", import.meta.url)));
const fixture = parseTemplate(original, "ZF");
const input = {
  plan: { id: "test", org_id: "ZF", plan_year: 2099, fiscal_type: "calendar", status: "draft" as const, updated_at: "", source_upload_id: null, prepared_by: fixture.prepared_by, approved_by: fixture.approved_by },
  orgName: fixture.orgName, orgAbbr: "ZF", period: fixture.period,
  kpis: fixture.kpis, activities: fixture.activities, report: fixture.report,
};
describe("Original template round trip", () => {
  it("preserves 11 KPIs, institution, five activities, full summary and exact engine results", () => {
    const result = exportTemplate(original, input);
    for (const [path, bytes] of Object.entries(unzipSync(result))) {
      if (path.endsWith(".xml")) expect(XMLValidator.validate(strFromU8(bytes))).toBe(true);
    }
    const parsed = parseTemplate(result, "ZF");
    expect(parsed.errors).toEqual([]);
    expect(parsed.kpis).toHaveLength(11);
    expect(parsed.kpis).toEqual(fixture.kpis);
    expect(parsed.orgName).toBe("مؤسسة زمزم Zamzam Foundation");
    expect(parsed.activities).toHaveLength(5);
    expect(parsed.activities).toEqual(fixture.activities);
    expect(parsed.report).toEqual(fixture.report);
    expect(parsed.prepared_by).toBe(fixture.prepared_by);
    expect(parsed.approved_by).toBe(fixture.approved_by);
    expect(scorePlan(parsed.kpis, "Q2")).toEqual(scorePlan(fixture.kpis, "Q2"));
    expect(scorePlan(parsed.kpis, "Q2").annual).toBeCloseTo(69.9987, 4);
    expect(scorePlan(parsed.kpis, "Q2").toDate).toBe(86.625);
  });
  it("fills the blank original template with exact fixture input and identical results", () => {
    const blank = new Uint8Array(readFileSync(new URL("../../../public/templates/performance-template.xlsx", import.meta.url)));
    const exported = exportTemplate(blank, input);
    const parsed = parseTemplate(exported, "ZF");
    expect(parsed.kpis).toEqual(fixture.kpis);
    expect(parsed.activities).toEqual(fixture.activities);
    expect(parsed.report).toEqual(fixture.report);
    expect(parsed.orgName).toBe(fixture.orgName);
    expect(scorePlan(parsed.kpis, "Q2").annual).toBeCloseTo(69.9987, 4);
    expect(scorePlan(parsed.kpis, "Q2").toDate).toBe(86.625);
  });
  it("never changes original formulas, styles, validation or conditional formatting", () => {
    const before = unzipSync(original), after = unzipSync(exportTemplate(original, input));
    for (const path of Object.keys(before).filter(p => p.startsWith("xl/worksheets/") && p.endsWith(".xml"))) {
      const a = readXml(strFromU8(before[path])), b = readXml(strFromU8(after[path]));
      expect(Array.from(b.getElementsByTagName("f")).map(f => f.textContent)).toEqual(Array.from(a.getElementsByTagName("f")).map(f => f.textContent));
      const cells = new Map(Array.from(b.getElementsByTagName("c")).map(c => [c.getAttribute("r"), c]));
      for (const cell of Array.from(a.getElementsByTagName("c"))) {
        if (cell.hasAttribute("s")) expect(cells.get(cell.getAttribute("r"))?.getAttribute("s")).toBe(cell.getAttribute("s"));
      }
      for (const tag of ["dataValidations", "conditionalFormatting"]) expect(Array.from(b.getElementsByTagName(tag)).map(n => n.toString())).toEqual(Array.from(a.getElementsByTagName(tag)).map(n => n.toString()));
    }
  });
  it("stops when any required sheet is absent", () => {
    const zip = unzipSync(original);
    const doc = readXml(strFromU8(zip["xl/workbook.xml"]));
    const sheet = Array.from(doc.getElementsByTagName("sheet")).find(s => s.getAttribute("name") === "الملخص");
    sheet?.parentNode?.removeChild(sheet);
    zip["xl/workbook.xml"] = strToU8(writeXml(doc));
    expect(() => exportTemplate(zipSync(zip), input)).toThrow("missing_sheets");
  });
  it("exports current linked codes, not stale compatibility text", () => {
    const kpis = fixture.kpis.map((k, i) => ({ ...k, id: String(i) }));
    const activities = fixture.activities.map(a => ({ ...a, kpi_id: "0", kpi_code: "STALE" }));
    const parsed = parseTemplate(exportTemplate(original, { ...input, kpis, activities }), "ZF");
    expect(parsed.activities.map(a => a.kpi_code)).toEqual(Array(5).fill("ZF-S1"));
  });
});
describe("Cell writer", () => {
  it("handles self-closing styled cells and creates sorted missing cells and rows", () => {
    const xml = '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="2"><c r="C2" s="7"/><c r="F2"><f>1+1</f><v>2</v></c></row></sheetData></worksheet>';
    const doc = readXml(fillSheet(xml, { C2: 'عربي & <نص>', B2: 5, A1: 3, G3: 'جديد', F2: 99 }));
    expect(Array.from(doc.getElementsByTagName("row")).map(r => r.getAttribute("r"))).toEqual(["1", "2", "3"]);
    expect(Array.from(doc.getElementsByTagName("c")).map(c => c.getAttribute("r"))).toEqual(["A1", "B2", "C2", "F2", "G3"]);
    expect(doc.getElementsByTagName("c")[2]?.getAttribute("s")).toBe("7");
    expect(doc.getElementsByTagName("f")[0]?.textContent).toBe("1+1");
    expect(doc.getElementsByTagName("c")[3]?.getElementsByTagName("v").length).toBe(0);
  });
  it("rejects malformed source XML", () => expect(() => fillSheet('<worksheet><c></worksheet>', {})).toThrow("invalid_export_xml"));
});
describe("Approval and export limits", () => {
  it("limits every perspective to 30 and activities to 80", () => {
    const k = fixture.kpis[0]; if (!k) throw new Error("fixture");
    expect(exportCapacity(Array.from({ length: 30 }, () => k), 80)).toBe(true);
    expect(exportCapacity(Array.from({ length: 31 }, () => k), 80)).toBe(false);
    expect(exportCapacity([k], 81)).toBe(false);
  });
  it("locks identity at objective approval and definitions at matrix approval", () => {
    expect(fieldEditable("objectives_approved", "name")).toBe(false);
    expect(fieldEditable("matrix_approved", "weight")).toBe(false);
    expect(fieldEditable("matrix_approved", "q3_actual")).toBe(true);
    expect(fieldEditable("matrix_approved", "calculation_formula")).toBe(true);
  });
});