import { seedTestOrganizations } from "./org-fixture";
seedTestOrganizations();
import { describe, expect, it } from "vitest";
import { computeProfileFromLive } from "./oid-composite";

describe("temporary composite KPI exclusion", () => {
  it("excludes KPI values without changing their standalone score", () => {
    const low = computeProfileFromLive("ZF", { gapAvg: 4, govScore: 3, finScore: 2, kpiScorePct: 0 });
    const high = computeProfileFromLive("ZF", { gapAvg: 4, govScore: 3, finScore: 2, kpiScorePct: 100 });
    expect(low.compositeScore).toBe(3.27);
    expect(high.compositeScore).toBe(3.27);
    expect(low.kpiScore).toBe(0);
    expect(high.kpiScore).toBe(5);
    expect(computeProfileFromLive("ZF", { kpiScorePct: 100 }).compositeScore).toBeNull();
  });

  it("redistributes the remaining weights in their original 35:25:15 proportions", () => {
    const p = computeProfileFromLive("ZF", {});
    expect(p.components.map((c) => c.weight)).toEqual([35 / 75, 25 / 75, 0, 15 / 75]);
    expect(p.components.reduce((sum, c) => sum + c.weight, 0)).toBeCloseTo(1);
  });

  it("retains available-source normalization and excludes KPI from completeness", () => {
    const p = computeProfileFromLive("ZF", { gapAvg: 4, govScore: 2, kpiScorePct: 100 });
    expect(p.compositeScore).toBe(3.17);
    expect(p.dataCompleteness).toBe(2 / 3);
    expect(computeProfileFromLive("ZF", { gapAvg: 4, govScore: 2 }).dataCompleteness).toBe(2 / 3);
  });
});