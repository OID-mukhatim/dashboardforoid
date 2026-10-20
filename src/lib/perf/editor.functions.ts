import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { EDIT_FIELDS } from "./edit-rules";
const id = z.string().uuid();
const values = z.record(z.union([z.string(), z.number().finite(), z.null()]));
export const createPerfPlan = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d: unknown) => z.object({ orgId: z.string(), year: z.number().int().min(1900).max(2200) }).parse(d)).handler(async ({ data, context }) => {
  const { data: org, error } = await context.supabase.from("organizations").select("fiscal_type").eq("id", data.orgId).eq("status", "active").single();
  if (error || !org) throw new Error("unknown_organization");
  const result = await context.supabase.from("perf_plans").insert({ org_id: data.orgId, plan_year: data.year, fiscal_type: org.fiscal_type }).select("id").single();
  if (result.error) throw new Error(result.error.message);
  return result.data;
});
export const savePerfKpi = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d: unknown) => z.object({ id: id.optional(), planId: id, values }).parse(d)).handler(async ({ data, context }) => {
  const patch = Object.fromEntries(Object.entries(data.values).filter(([k]) => (EDIT_FIELDS as readonly string[]).includes(k)));
  const result = data.id ? await context.supabase.from("perf_kpis").update(patch).eq("id", data.id).eq("plan_id", data.planId) : await context.supabase.from("perf_kpis").insert({ plan_id: data.planId, code: "", name: "", perspective: "S", seq: 1, measurement: "num", role: "leading", unit: "number", polarity: "asc", calc_method: "q_independent", weight: 0, ...patch } as any);
  if (result.error) throw new Error(result.error.message);
  return { ok: true };
});
export const reorderPerfKpis = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d: unknown) => z.object({ planId: id, ids: z.array(id) }).parse(d)).handler(async ({ data, context }) => {
  const result = await context.supabase.rpc("reorder_perf_kpis", { p_plan: data.planId, p_ids: data.ids });
  if (result.error) throw new Error(result.error.message);
  return { ok: true };
});
export const deletePerfKpi = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d: unknown) => z.object({ id, planId: id }).parse(d)).handler(async ({ data, context }) => {
  const result = await context.supabase.from("perf_kpis").delete().eq("id", data.id).eq("plan_id", data.planId);
  if (result.error) throw new Error(result.error.message);
  return { ok: true };
});
export const transitionPerfPlan = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d: unknown) => z.object({ planId: id, status: z.enum(["draft", "objectives_approved", "matrix_approved"]), reason: z.string().optional() }).parse(d)).handler(async ({ data, context }) => {
  const result = await context.supabase.rpc("transition_perf_plan", { p_plan: data.planId, p_status: data.status, p_reason: data.reason });
  if (result.error) throw new Error(result.error.message);
  return { ok: true };
});
export const savePerfActuals = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d: unknown) => z.object({ planId: id, quarter: z.number().int().min(1).max(4), rows: z.array(z.object({ id, actual: z.number().finite().nullable() })) }).parse(d)).handler(async ({ data, context }) => {
  const result = await context.supabase.rpc("save_perf_actuals", { p_plan: data.planId, p_quarter: data.quarter, p_rows: data.rows });
  if (result.error) throw new Error(result.error.message);
  return { ok: true };
});
export const savePerfActivity = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d: unknown) => z.object({ id: id.optional(), planId: id, values: z.object({ quarter: z.enum(["Q1", "Q2", "Q3", "Q4"]), activity_type: z.enum(["program", "event", "training"]), title: z.string(), target_group: z.string().nullable(), implementer: z.string().nullable(), beneficiaries: z.number().finite().nullable(), planned: z.number().finite().nullable(), achieved: z.number().finite().nullable(), kpi_code: z.string().nullable(), notes: z.string().nullable() }) }).parse(d)).handler(async ({ data, context }) => {
  const result = data.id ? await context.supabase.from("perf_activities").update(data.values).eq("id", data.id).eq("plan_id", data.planId) : await context.supabase.from("perf_activities").insert({ ...data.values, plan_id: data.planId });
  if (result.error) throw new Error(result.error.message);
  return { ok: true };
});
export const deletePerfActivity = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d: unknown) => z.object({ id, planId: id }).parse(d)).handler(async ({ data, context }) => {
  const result = await context.supabase.from("perf_activities").delete().eq("id", data.id).eq("plan_id", data.planId);
  if (result.error) throw new Error(result.error.message);
  return { ok: true };
});