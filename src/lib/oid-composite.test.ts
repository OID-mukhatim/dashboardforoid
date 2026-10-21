import { seedTestOrganizations } from "./org-fixture";
seedTestOrganizations();
import { describe, expect, it } from "vitest";
import { computeProfileFromLive } from "./oid-composite";

describe("composite score with the KPI component restored", () => {
  it("uses the original 35:25:25:15 weights", () => {
    const p = computeProfileFromLive("ZF", {});
    expect(p.components.map((c) => c.weight)).toEqual([0.35, 0.25, 0.25, 0.15]);
  });
  it("includes the KPI score converted to 5 (÷20)", () => {
    expect(computeProfileFromLive("ZF", { gapAvg: 4, govScore: 3, finScore: 2, kpiScorePct: 0 }).compositeScore).toBe(2.45);
    expect(computeProfileFromLive("ZF", { gapAvg: 4, govScore: 3, finScore: 2, kpiScorePct: 100 }).compositeScore).toBe(3.7);
    expect(computeProfileFromLive("ZF", { kpiScorePct: 100 }).kpiScore).toBe(5);
  });
  it("normalizes over available sources only", () => {
    expect(computeProfileFromLive("ZF", { gapAvg: 4, govScore: 2 }).dataCompleteness).toBe(2 / 4);
  });
});
