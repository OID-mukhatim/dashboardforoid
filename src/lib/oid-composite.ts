/**
 * المحور الأول: محرك الحساب المركّب (Composite Maturity Score)
 * يجمع 4 مصادر بنسبة 35:25:25:15؛ المؤشرات من آخر تقرير معتمد.
 *
 * قاعدة البيانات هي المصدر الوحيد للأرقام: كل المدخلات تأتي حية من
 * loadDashboardSnapshot (gap_scores / governance_policies / kpis /
 * advisor_snapshots + financial_reports). لا توجد أي قيم ثابتة هنا.
 */

import { ORGS, type OrgId } from "./oid-data";
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

export type LiveInputs = {
  gapAvg?: number | null;
  govScore?: number | null;
  kpiScorePct?: number | null; // 0..100
  finScore?: number | null;
};

/** يبني ملف المؤسسة من مدخلات حية فقط؛ أي مصدر غائب يظهر كـ "بيانات ناقصة". */
export function computeProfileFromLive(orgId: OrgId, live: LiveInputs): InstitutionProfile {
  const gap = typeof live.gapAvg === "number" && Number.isFinite(live.gapAvg) ? live.gapAvg : null;
  const gov = typeof live.govScore === "number" && Number.isFinite(live.govScore) ? live.govScore : null;
  const kpi =
    typeof live.kpiScorePct === "number" && Number.isFinite(live.kpiScorePct)
      ? Math.round((live.kpiScorePct / 20) * 100) / 100
      : null;
  const fin = typeof live.finScore === "number" && Number.isFinite(live.finScore) ? live.finScore : null;

  const components: ProfileComponent[] = [
    { source: "gap", label: "الفجوات المؤسسية", weight: WEIGHTS.gap, score: gap, state: inferState(gap) },
    { source: "governance", label: "الحوكمة والامتثال", weight: WEIGHTS.gov, score: gov, state: inferState(gov) },
    { source: "kpi", label: "تحقيق مؤشرات الأداء", weight: WEIGHTS.kpi, score: kpi, state: inferState(kpi) },
    { source: "financial", label: "الإدارة المالية", weight: WEIGHTS.fin, score: fin, state: inferState(fin) },
  ];

  const core = components.filter((c) => c.weight > 0 && c.state === "achieved" && c.score !== null);
  const totalWeight = core.reduce((s, c) => s + c.weight, 0);
  const composite =
    totalWeight > 0
      ? core.reduce((s, c) => s + (c.score as number) * c.weight, 0) / totalWeight
      : null;

  const dataCompleteness = core.length / components.filter((c) => c.weight > 0).length;
  const maturity = getMaturityLevel(composite);

  return {
    orgId,
    compositeScore: composite !== null ? Math.round(composite * 100) / 100 : null,
    gapScore: gap !== null ? Math.round(gap * 100) / 100 : null,
    govScore: gov,
    kpiScore: kpi,
    finScore: fin,
    components,
    dataCompleteness,
    maturityLabel: maturity?.labelAr ?? null,
    maturityLevel: maturity?.level ?? null,
    maturityColor: maturity?.color ?? null,
  };
}

/** ملفات كل المؤسسات من snapshot حي (مفاتيحه ناتج loadDashboardSnapshot). */
export function computeAllProfilesFromLive(
  liveByOrg: Partial<Record<OrgId, LiveInputs>>,
): Record<OrgId, InstitutionProfile> {
  const out = {} as Record<OrgId, InstitutionProfile>;
  for (const o of ORGS) out[o.id] = computeProfileFromLive(o.id, liveByOrg[o.id] ?? {});
  return out;
}
