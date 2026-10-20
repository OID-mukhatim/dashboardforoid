import { PERSPECTIVES, type KPI, type Plan, type Issue } from "./types";
import { validateMatrix } from "./validation";
export const CARD_FIELDS = [
  "description",
  "department",
  "calculation_formula",
  "data_sources",
  "related_kpis",
  "enablers",
  "notes",
] as const;
export const NUMERIC_FIELDS = [
  "weight",
  "baseline",
  "annual_target",
  "q1_plan",
  "q1_actual",
  "q2_plan",
  "q2_actual",
  "q3_plan",
  "q3_actual",
  "q4_plan",
  "q4_actual",
] as const;
export const EDIT_FIELDS = [
  "perspective",
  "objective",
  "name",
  "measurement",
  "role",
  "unit",
  "polarity",
  "calc_method",
  ...NUMERIC_FIELDS,
  ...CARD_FIELDS,
] as const;
export function fieldEditable(status: Plan["status"], field: string) {
  if (status === "draft") return true;
  if (status === "objectives_approved")
    return !["perspective", "objective", "name", "seq", "code"].includes(field);
  return /^q[1-4]_actual$/.test(field) || (CARD_FIELDS as readonly string[]).includes(field);
}
export function allowedUnits(kpi: Pick<KPI, "measurement">) {
  return kpi.measurement === "pct"
    ? ["percent"]
    : kpi.measurement === "num"
      ? ["number", "amount", "days"]
      : ["likert"];
}
export function allowedMethods(kpi: Pick<KPI, "measurement" | "unit">) {
  return kpi.measurement === "qual" || kpi.unit === "likert"
    ? ["q_average", "h_average", "annual"]
    : [
        "q_independent",
        "q_cumulative",
        "q_average",
        "h_independent",
        "h_cumulative",
        "h_average",
        "annual",
      ];
}
export function approvalIssues(kpis: KPI[], matrix: boolean) {
  const issues: Issue[] = PERSPECTIVES.filter((p) => !kpis.some((k) => k.perspective === p)).map(
    (p) => ({ code: "missing_perspective", detail: p }),
  );
  for (const k of kpis) {
    if (!k.name.trim() || !k.objective.trim())
      issues.push({ code: "objectives_incomplete", detail: k.code });
    if (matrix && k.annual_target === null)
      issues.push({ code: "target_required", detail: k.code });
  }
  return matrix ? [...issues, ...validateMatrix(kpis, []).errors] : issues;
}
export function exportCapacity(kpis: KPI[], activityCount: number) {
  return (
    activityCount <= 80 &&
    PERSPECTIVES.every((p) => kpis.filter((k) => k.perspective === p).length <= 30)
  );
}
