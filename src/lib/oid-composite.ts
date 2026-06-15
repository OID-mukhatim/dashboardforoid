/**
 * المحور الأول: محرك الحساب المركّب (Composite Maturity Score)
 * يجمع 4 مصادر بأوزان: الفجوات 35% / الحوكمة 25% / KPIs 25% / المالي 15%
 */

import { ORGS, type OrgId, gapScores, orgOverallScores, kpiData } from "./oid-data";
import { inferState, type DataStateCode } from "./oid-data-states";
import { getMaturityLevel } from "./oid-maturity";

export type ProfileComponent = {
  score: number | null;
  state: DataStateCode;
  weight: number;
  label: string;
  source: "gap" | "governance" | "kpi" | "financial";
};

export type InstitutionProfile = {
  orgId: OrgId;
  compositeScore: number | null;
  gapScore: number | null;
  govScore: number | null;
  kpiScore: number | null;
  finScore: number | null;
  components: ProfileComponent[];
  dataCompleteness: number; // 0..1
  maturityLabel: string | null;
  maturityLevel: number | null;
  maturityColor: string | null;
};

const WEIGHTS = { gap: 0.35, gov: 0.25, kpi: 0.25, fin: 0.15 };

function gapAvg(orgId: OrgId): number | null {
  const arr = gapScores[orgId] ?? [];
  const valid = arr.filter((v) => v !== null && v !== undefined) as number[];
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function govScoreOf(orgId: OrgId): number | null {
  const o = orgOverallScores.find((s) => s.id === orgId);
  return o?.govScore ?? null;
}

function kpiScoreOf(orgId: OrgId): number | null {
  const items = kpiData.filter(
    (k) => k.org === orgId && (k as any).status !== "pending",
  );
  if (items.length === 0) return null;
  // progress is 0..100 → نحوّل إلى 0..5
  const totalWeight = items.reduce((s, k) => {
    const w = parseFloat(String(k.weight).replace("%", "")) || 1;
    return s + w;
  }, 0);
  const weightedSum = items.reduce((s, k) => {
    const w = parseFloat(String(k.weight).replace("%", "")) || 1;
    return s + ((k.progress / 100) * 5) * w;
  }, 0);
  return totalWeight > 0 ? weightedSum / totalWeight : null;
}

// المالي حالياً: لا تتوفر درجة شاملة موثوقة — يُعاد null للمؤسسات
// حتى يتم رفع بيانات المستشار المالي.
function finScoreOf(_orgId: OrgId): number | null {
  return null;
}

export function computeProfile(orgId: OrgId): InstitutionProfile {
  const gap = gapAvg(orgId);
  const gov = govScoreOf(orgId);
  const kpi = kpiScoreOf(orgId);
  const fin = finScoreOf(orgId);

  const components: ProfileComponent[] = [
    { source: "gap", label: "الفجوات المؤسسية", weight: WEIGHTS.gap, score: gap, state: inferState(gap) },
    { source: "governance", label: "الحوكمة والامتثال", weight: WEIGHTS.gov, score: gov, state: inferState(gov) },
    { source: "kpi", label: "تحقيق مؤشرات الأداء", weight: WEIGHTS.kpi, score: kpi, state: inferState(kpi) },
    { source: "financial", label: "الإدارة المالية", weight: WEIGHTS.fin, score: fin, state: inferState(fin) },
  ];

  const valid = components.filter((c) => c.state === "achieved" && c.score !== null);
  const totalWeight = valid.reduce((s, c) => s + c.weight, 0);
  const composite =
    totalWeight > 0
      ? valid.reduce((s, c) => s + (c.score as number) * c.weight, 0) / totalWeight
      : null;

  const dataCompleteness = valid.length / components.length;
  const maturity = getMaturityLevel(composite);

  return {
    orgId,
    compositeScore: composite !== null ? Math.round(composite * 100) / 100 : null,
    gapScore: gap !== null ? Math.round(gap * 100) / 100 : null,
    govScore: gov,
    kpiScore: kpi !== null ? Math.round(kpi * 100) / 100 : null,
    finScore: fin,
    components,
    dataCompleteness,
    maturityLabel: maturity?.labelAr ?? null,
    maturityLevel: maturity?.level ?? null,
    maturityColor: maturity?.color ?? null,
  };
}

export function computeAllProfiles(): Record<OrgId, InstitutionProfile> {
  const out = {} as Record<OrgId, InstitutionProfile>;
  for (const o of ORGS) out[o.id] = computeProfile(o.id);
  return out;
}
