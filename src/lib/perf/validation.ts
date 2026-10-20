import { PERSPECTIVES, type KPI, type Activity, type Issue } from './types';
export function validateMatrix(kpis: KPI[], activities: Activity[]): { errors: Issue[]; warnings: Issue[] } {
  const errors: Issue[] = [], warnings: Issue[] = [];
  for (const perspective of PERSPECTIVES) {
    const weight = kpis.filter(k => k.perspective === perspective).reduce((n,k) => n + k.weight, 0);
    if (Math.abs(weight - 25) > 0.000001) errors.push({ code: 'perspective_weight', detail: `${perspective}: ${weight}` });
  }
  const total = kpis.reduce((n,k) => n + k.weight,0);
  if (Math.abs(total - 100) > 0.000001) errors.push({ code: 'total_weight', detail: String(total) });
  const codes = new Set(kpis.map(k => k.code));
  if (codes.size !== kpis.length) errors.push({ code: 'duplicate_code' });
  for (const k of kpis) {
    if (!Number.isFinite(k.weight) || k.weight < 0) errors.push({code:'invalid_number',kpi:k.code,detail:'weight'});
    const validUnit = k.measurement === 'pct' ? k.unit === 'percent' : k.measurement === 'num' ? ['number','amount','days'].includes(k.unit) : k.unit === 'likert';
    if (!validUnit) errors.push({code:'unit_conflict',kpi:k.code});
    if ((k.measurement === 'qual' || k.unit === 'likert') && !['q_average','h_average','annual'].includes(k.calc_method)) errors.push({code:'method_conflict',kpi:k.code});
    if ([k.q1_plan,k.q2_plan,k.q3_plan,k.q4_plan].every(v => v === null)) warnings.push({code:'no_plan',kpi:k.code});
  }
  for (const a of activities) if (a.kpi_code && !codes.has(a.kpi_code)) errors.push({code:'activity_code',detail:a.kpi_code});
  return {errors,warnings};
}
export const DEFINITION_FIELDS = ['perspective','seq','objective','name','measurement','role','unit','polarity','calc_method','weight','baseline','annual_target','q1_plan','q2_plan','q3_plan','q4_plan'] as const;
export type DefinitionDiff = { code: string; field: string; before: string | number | null; after: string | number | null };
export function definitionDiffs(existing: KPI[], incoming: KPI[]): DefinitionDiff[] {
  const changes: DefinitionDiff[] = [];
  for (const row of incoming) {
    const old = existing.find(k => k.code === row.code);
    if (!old) { changes.push({code:row.code,field:'added',before:null,after:row.name}); continue; }
    for (const field of DEFINITION_FIELDS) if ((old[field] ?? null) !== (row[field] ?? null)) changes.push({code:row.code,field,before:old[field] ?? null,after:row[field] ?? null});
  }
  for (const old of existing) if (!incoming.some(k => k.code === old.code)) changes.push({code:old.code,field:'removed',before:old.name,after:null});
  return changes;
}

export function mergeActuals(existing: KPI[], incoming: KPI[]) {
 return existing.map(old => {
  const row=incoming.find(k=>k.code===old.code);
  return row ? {...old,q1_actual:row.q1_actual,q2_actual:row.q2_actual,q3_actual:row.q3_actual,q4_actual:row.q4_actual} : old;
 });
}
