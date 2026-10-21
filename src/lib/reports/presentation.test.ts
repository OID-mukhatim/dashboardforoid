import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parseTemplate } from "../perf/parser";
import { toDateResult, annualResult } from "../perf/engine";
import { computeKpiResult } from "./build";
import { formatReportNumber, numericNarrativeRows, reportKpiOperands } from "./presentation";

const fx = parseTemplate(new Uint8Array(readFileSync(new URL("../perf/fixture-zf-q2.xlsx", import.meta.url))), "ZF");
const s2 = fx.kpis.find((k) => k.code === "ZF-S2");
if (!s2) throw new Error("Missing ZF-S2 fixture");
describe("Report display operands without changing scoring", () => {
  it("ZF-S2 independent Q2 uses 1000 and 1080, with the engine's 108%", () => {
    expect(reportKpiOperands(s2, "Q2")).toEqual({ planned: 1000, displayAchieved: 1080 });
    expect(toDateResult(s2, "Q2").pct).toBe(108);
  });
  it("cumulative uses the last planned quarter, excluding unplanned actuals", () => {
    const k = { ...s2, calc_method: "quarter_cumulative" as typeof s2.calc_method, q1_plan: 400, q1_actual: 380, q2_plan: 1000, q2_actual: 1080, q3_plan: null, q3_actual: 5000 };
    expect(reportKpiOperands(k, "Q3")).toEqual({ planned: 1000, displayAchieved: 1080 });
    expect(toDateResult(k, "Q3").pct).toBe(108);
  });
  it("average uses eligible plan and actual averages", () => {
    const k = { ...s2, calc_method: "quarter_average" as typeof s2.calc_method, q1_plan: 100, q2_plan: 200, q1_actual: 110, q2_actual: 220 };
    expect(reportKpiOperands(k, "Q2")).toEqual({ planned: 150, displayAchieved: 165 });
    expect(toDateResult(k, "Q2").pct).toBeCloseTo(110);
  });
  it("annual and Q4 use the engine's annual achieved value and annual target", () => {
    const expected = { planned: s2.annual_target, displayAchieved: annualResult(s2).annual_achieved };
    expect(reportKpiOperands(s2, "annual")).toEqual(expected);
    expect(reportKpiOperands(s2, "Q4")).toEqual(expected);
  });
  it("missing actual remains unknown, not a misleading partial total", () => {
    expect(reportKpiOperands({ ...s2, q2_actual: null }, "Q2")).toEqual({ planned: 1000, displayAchieved: null });
    expect(toDateResult({ ...s2, q2_actual: null }, "Q2").pct).toBe(0);
  });
  it("presentation rounds normally while report results remain full precision", () => {
    expect(formatReportNumber(86.625)).toBe("86.63");
    expect(formatReportNumber(69.9987)).toBe("70.00");
    const r = computeKpiResult(fx.kpis, "Q2");
    expect(r.overall).toBeCloseTo(86.625, 6);
    expect(r.annualOverall).toBeCloseTo(69.9987, 3);
  });
  it("normalizes numeric narrative fields without coercing identifiers or text", () => {
    expect(numericNarrativeRows([{ cost: "12,345.67", proposal: "123", kpi_code: "ZF-S2" }], ["cost"])).toEqual([{ cost: 12345.67, proposal: "123", kpi_code: "ZF-S2" }]);
    expect(numericNarrativeRows([{ previous: "100", current: "0", note: "200" }], ["previous", "current"])).toEqual([{ previous: 100, current: 0, note: "200" }]);
  });
  it("workbook narrative cost, annual statistics and beneficiaries parse as numbers", () => {
    expect(typeof fx.report.planned_beneficiaries).toBe("number");
    const cost = fx.report.proposals.find((r) => r.cost !== null);
    expect(typeof cost?.cost).toBe("number");
    expect(fx.report.annual_stats.flatMap((r) => [r.previous, r.current]).filter((v) => v !== null).every((v) => typeof v === "number")).toBe(true);
    expect(fx.report.annual_stats.some((r) => typeof r.current === "number")).toBe(true);
  });
});