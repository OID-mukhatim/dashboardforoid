import type { KPI } from "./types";
export function linkedCode(link: { kpi_id?: unknown; kpi_code?: unknown }, kpis: KPI[]): string | null {
  if (link.kpi_id) return kpis.find(k => k.id === link.kpi_id)?.code ?? null;
  return typeof link.kpi_code === "string" ? link.kpi_code : null;
}