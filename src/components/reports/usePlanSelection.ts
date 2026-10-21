import { useState } from "react";
import { ORGS } from "@/lib/org-registry";
import type { Plan } from "@/lib/perf/types";

/** Shared org / year selection over performance plans (activities log and reports). */
export function usePlanSelection(plans: Plan[], activeYears: Record<string, number>) {
  const [selectedOrg, setOrg] = useState("");
  const [selectedYear, setYear] = useState("");
  const orgId = selectedOrg || ORGS[0]?.id || "";
  const available = plans.filter((p) => p.org_id === orgId);
  const year = available.some((p) => String(p.plan_year) === selectedYear)
    ? selectedYear
    : String(available[0]?.plan_year ?? activeYears[orgId] ?? new Date().getFullYear());
  const plan = available.find((p) => String(p.plan_year) === year);
  const yearLabel = (y: number) => (plan?.fiscal_type === "academic" ? `${y}/${y + 1}` : String(y));
  return {
    orgId, year, plan, available, yearLabel,
    setOrg: (v: string) => { setOrg(v); setYear(""); },
    setYear,
    yearOptions: (available.length ? available.map((p) => p.plan_year) : [Number(year)]).map((y) => ({ value: String(y), label: yearLabel(y) })),
  };
}
