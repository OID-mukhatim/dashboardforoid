import { describe, expect, it } from "vitest";
import { buildLiveAlerts } from "./alerts-core";
import { latestGapRows, gapInitiativeCandidates, newGapInitiatives, type GapRow } from "./live-gap-rules";
import { matchOrganization, matchOrganizations } from "./org-aliases";
import { computeAllProfilesFromLive } from "./oid-composite";
import { detectAllAnomalies } from "./oid-anomalies";

const gap = (org: string, score: number, index = 0, period = "Q2-2026", date = "2026-09-07"): GapRow => ({ org_id: org, score, domain_index: index, domain_name: "الاستراتيجية", period, updated_at: date });
const inst = (date: string) => [{ id: "KAFI", name_ar: "كافي للتنمية", name_en: "Kafi for Development", license_expiry: date }];
const alerts = (date: string) => buildLiveAlerts(inst(date), [], {}, "ar", "2026-10-19");

describe("live alerts", () => {
  it("marks licenses strictly before today critical", () => { expect(alerts("2026-10-18")[0]?.severity).toBe("critical"); expect(alerts("2026-10-19")[0]?.severity).toBe("warning"); });
  it("warns through 60 days, not 61", () => { expect(alerts("2026-12-18")[0]?.severity).toBe("warning"); expect(alerts("2026-12-19")).toHaveLength(0); });
  it("flags governance below 40 percent, not 40", () => { expect(buildLiveAlerts([], [], { KAFI: { govPct: 39 } }, "ar", "2026-10-19")[0]?.severity).toBe("critical"); expect(buildLiveAlerts([], [], { KAFI: { govPct: 40 } }, "ar", "2026-10-19")).toHaveLength(0); });
  it("warns only below 2 in the latest period", () => { const rows = [gap("ZF", 0, 0, "Q1", "2026-01-01"), gap("ZF", 2), gap("KAFI", 1.99)]; expect(buildLiveAlerts([], rows, {}, "ar", "2026-10-19").map((r) => r.org_id)).toEqual(["KAFI"]); });
  it("keeps stable ids across languages", () => { expect(buildLiveAlerts(inst("2026-10-07"), [], {}, "en", "2026-10-19")[0]?.id).toBe(alerts("2026-10-07")[0]?.id); });
});

describe("live gap initiatives", () => {
  it("selects the latest period separately for each org", () => { expect(latestGapRows([gap("ZF", 1), gap("ZF", 4, 0, "Q3", "2026-10-01"), gap("KAFI", 2)]).map((r) => Number(r.score))).toEqual([4, 2]); });
  it("generates network proposals below 2.5 with only affected orgs", () => { const rows = [gap("ZF", 1), gap("KAFI", 2), gap("ZAD", 3)]; const r = gapInitiativeCandidates(rows).find((x) => x.code === "AUTO-0-NET"); expect(r?.orgs).toEqual(["KAFI", "ZF"]); expect(gapInitiativeCandidates([gap("ZF", 2.5)]).some((x) => x.code.endsWith("NET"))).toBe(false); });
  it("generates institutional proposals strictly below 1.5", () => { expect(gapInitiativeCandidates([gap("ZF", 1.49)]).some((x) => x.code === "AUTO-0-ZF")).toBe(true); expect(gapInitiativeCandidates([gap("ZF", 1.5)]).some((x) => x.code === "AUTO-0-ZF")).toBe(false); });
  it("preserves all existing codes including approved initiatives", () => { const rows = [gap("ZF", 1)]; const existing = gapInitiativeCandidates(rows).map((r) => ({ code: r.code, status: "قيد التنفيذ" })); expect(newGapInitiatives(rows, existing)).toHaveLength(0); expect(newGapInitiatives(rows, existing.map((r) => ({ ...r, status: "مقترح" })))).toHaveLength(0); });
  it("uses proposed status and auto source", () => { const r = gapInitiativeCandidates([gap("ZF", 1)])[0]; expect(r?.status).toBe("مقترح"); expect(r?.source).toBe("auto"); expect(r?.objective).toContain("3.5+"); });
});

describe("shared organization matching", () => {
  it.each([["تيو للتعليم", "TAYO"], ["مدارس تيو", "TAYO"], ["منظمة حمدي", "HAMDI"], ["حمدي للرعاية", "HAMDI"], ["Hamdi Organization", "HAMDI"], ["Tayo for Education", "TAYO"], ["Zad for Development", "ZAD"], ["Kafi for Development", "KAFI"], ["جامعة زمزم للعلوم والتكنولوجيا", "ZUST"], ["Zamzam University", "ZUST"]])("recognizes %s", (name, code) => { expect(matchOrganization(name)?.id).toBe(code); });
  it.each(["كافي", "زاد", "تيو", "التمويل كافي للمشروع", "زاد عدد المستفيدين"])('rejects generic text %s', (text) => { expect(matchOrganization(text)).toBeNull(); });
  it("does not attribute a university to the foundation", () => { expect(matchOrganizations("Zamzam University").map((x) => x.id)).toEqual(["ZUST"]); expect(matchOrganizations("جامعة زمزم للعلوم والتكنولوجيا").map((x) => x.id)).toEqual(["ZUST"]); });
});

it("ignores KPI values in every anomaly rule", () => {
  const low = computeAllProfilesFromLive({ ZF: { gapAvg: 3, govScore: 3, finScore: 3, kpiScorePct: 0 }, KAFI: { gapAvg: 3, govScore: 3, finScore: 3 } });
  const high = computeAllProfilesFromLive({ ZF: { gapAvg: 3, govScore: 3, finScore: 3, kpiScorePct: 500 }, KAFI: { gapAvg: 3, govScore: 3, finScore: 3 } });
  expect(detectAllAnomalies(low)).toEqual(detectAllAnomalies(high));
  expect(detectAllAnomalies(high).some((r) => r.category === "kpi_gap_contradiction")).toBe(false);
});