import { describe, expect, it } from "vitest";
import { quarterEnd, kpiComponent, reportAlerts, latestApproved } from "./integration";
import { buildReportSections } from "./build";

const plan = (fiscal: string, org = "ZF") => ({ id: `p-${org}`, org_id: org, plan_year: 2026, fiscal_type: fiscal });
const rep = (period: string, overall: number, status = "approved", perspectives: unknown[] = []) => ({
  plan_id: "p-ZF", period, status, approved_at: "2026-07-01T00:00:00Z", snapshot: { kpi: { overall, perspectives } },
});

describe("quarter ends by calendar", () => {
  it("calendar Q2 ends 30 June; academic Q1 ends 31 December, Q4 ends 30 September next year", () => {
    expect(quarterEnd("calendar", 2026, "Q2").toISOString().slice(0, 10)).toBe("2026-06-30");
    expect(quarterEnd("academic", 2026, "Q1").toISOString().slice(0, 10)).toBe("2026-12-31");
    expect(quarterEnd("academic", 2026, "Q4").toISOString().slice(0, 10)).toBe("2027-09-30");
  });
});

describe("KPI composite component from the latest approved report", () => {
  it("uses Q2, then Q4, then annual, converted ÷20", () => {
    const p = plan("calendar");
    expect(kpiComponent([rep("Q2", 86.625)], p)?.score).toBeCloseTo(4.33125);
    expect(kpiComponent([rep("Q2", 86.625), rep("Q4", 70)], p)?.period).toBe("Q4");
    expect(kpiComponent([rep("Q2", 86.625), rep("Q4", 70), rep("annual", 69.9987)], p)).toMatchObject({ period: "annual", score: 69.9987 / 20 });
  });
  it("ignores drafts and returns no data without an approved report", () => {
    expect(kpiComponent([rep("Q2", 80, "draft")], plan("calendar"))).toBeNull();
    expect(latestApproved([], "p-ZF")).toBeNull();
  });
});

describe("report alerts with fixed dates", () => {
  const base = { activeYears: { ZF: 2026, TAYO: 2026 }, activeOrgIds: ["ZF", "TAYO"] };
  it("flags quarters ended more than 30 days ago without an approved report", () => {
    const alerts = reportAlerts({ ...base, plans: [plan("calendar"), plan("academic", "TAYO")], reports: [rep("Q1", 80)], now: new Date("2026-08-15T00:00:00Z") });
    const late = alerts.filter((a) => a.kind === "lateReport").map((a) => `${a.orgId}-${a.quarter}`);
    expect(late).toEqual(["ZF-Q2"]); // Q1 approved; TAYO academic Q1 ends Dec 2026
  });
  it("academic org is late on Q1 from 31 January next year", () => {
    const alerts = reportAlerts({ ...base, activeOrgIds: ["TAYO"], plans: [plan("academic", "TAYO")], reports: [], now: new Date("2027-02-01T00:00:00Z") });
    expect(alerts.map((a) => a.kind === "lateReport" && a.quarter)).toEqual(["Q1"]);
  });
  it("flags perspectives below 60% in the latest approved report", () => {
    const alerts = reportAlerts({ ...base, activeOrgIds: ["ZF"], plans: [plan("calendar")], now: new Date("2026-04-01T00:00:00Z"),
      reports: [rep("Q1", 70, "approved", [{ id: "S", pct: 59.9 }, { id: "P", pct: 60 }])] });
    expect(alerts.filter((a) => a.kind === "weakPerspective").map((a) => a.kind === "weakPerspective" && a.perspective)).toEqual(["S"]);
  });
});

describe("annual report is independent of Q4", () => {
  const p = { id: "p", org_id: "ZF", plan_year: 2099, fiscal_type: "calendar", status: "matrix_approved" } as never;
  const report = (period: "Q4" | "annual") => ({ period, executive_summary: period, planned_beneficiaries: null, annual_stats: [{ category: "x" }], achievements: [], challenges: [], proposals: [] });
  it("annual statistics appear only in the annual report", () => {
    const q4 = buildReportSections({ plan: p, kpis: [], activities: [], report: report("Q4") as never, initiatives: [], period: "Q4" });
    const an = buildReportSections({ plan: p, kpis: [], activities: [], report: report("annual") as never, initiatives: [], period: "annual" });
    expect(q4.annual_stats).toBeNull();
    expect(an.annual_stats).toHaveLength(1);
    expect(an.executive).toBe("annual");
    expect(q4.executive).toBe("Q4");
  });
  it("initiatives are matched by org_ids", () => {
    const s = buildReportSections({ plan: p, kpis: [], activities: [], report: undefined, period: "Q1",
      initiatives: [{ id: "1", title: "a", domain: null, priority: "حرج", status: "مقترح", timeline: null, org_ids: ["ZF"] },
        { id: "2", title: "b", domain: null, priority: "حرج", status: "مقترح", timeline: null, org_ids: ["KAFI"] }] });
    expect(s.initiatives.map((i) => i.id)).toEqual(["1"]);
  });
});
