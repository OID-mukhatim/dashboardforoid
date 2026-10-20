import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { EDIT_FIELDS } from "./edit-rules";
import type { Database } from "@/integrations/supabase/types";
const id = z.string().uuid();
const values = z.record(z.union([z.string(), z.number().finite(), z.null()]));
export const createPerfPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ orgId: z.string(), year: z.number().int().min(1900).max(2200) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: org, error } = await context.supabase
      .from("organizations")
      .select("fiscal_type")
      .eq("id", data.orgId)
      .eq("status", "active")
      .single();
    if (error || !org) throw new Error("unknown_organization");
    const result = await context.supabase
      .from("perf_plans")
      .insert({ org_id: data.orgId, plan_year: data.year, fiscal_type: org.fiscal_type })
      .select("id")
      .single();
    if (result.error) throw new Error(result.error.message);
    return result.data;
  });
export const savePerfKpi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: id.optional(), planId: id, values }).parse(d))
  .handler(async ({ data, context }) => {
    const patch = Object.fromEntries(
      Object.entries(data.values).filter(([k]) => (EDIT_FIELDS as readonly string[]).includes(k)),
    ) as Database["public"]["Tables"]["perf_kpis"]["Update"];
    if (!data.id || "perspective" in patch || "seq" in patch) {
      const { changeStructure } = await import("./structure.server");
      return changeStructure(context.supabase, data.planId, rows => {
        if (!data.id) return [...rows, patch];
        if (!rows.some(r => r.id === data.id)) throw new Error("identity_missing");
        const changed = rows.find(r => r.id === data.id);
        if (!changed) throw new Error("identity_missing");
        const rest = rows.filter(r => r.id !== data.id);
        const moved = { ...changed, ...patch };
        // Moving perspective appends to the target perspective; seq/code never come from the browser.
        return [...rest, moved];
      });
    }
    const result = await context.supabase.from("perf_kpis").update(patch).eq("id", data.id).eq("plan_id", data.planId).select("id").single();
    if (result.error) throw new Error(result.error.message);
    return { ok: true };
  });
export const reorderPerfKpis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ planId: id, ids: z.array(id) }).parse(d))
  .handler(async ({ data, context }) => {
    const result = await context.supabase.rpc("reorder_perf_kpis", {
      p_plan: data.planId,
      p_ids: data.ids,
    });
    if (result.error) throw new Error(result.error.message);
    return { ok: true };
  });
export const deletePerfKpi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id, planId: id }).parse(d))
  .handler(async ({ data, context }) => {
    const { changeStructure } = await import("./structure.server");
    return changeStructure(context.supabase, data.planId, rows => {
      if (!rows.some(r => r.id === data.id)) throw new Error("identity_missing");
      return rows.filter(r => r.id !== data.id);
    });
  });
export const transitionPerfPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        planId: id,
        status: z.enum(["draft", "objectives_approved", "matrix_approved"]),
        reason: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const result = await context.supabase.rpc("transition_perf_plan", {
      p_plan: data.planId,
      p_status: data.status,
      p_reason: data.reason,
    });
    if (result.error) throw new Error(result.error.message);
    return { ok: true };
  });
export const savePerfActuals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        planId: id,
        quarter: z.number().int().min(1).max(4),
        rows: z.array(z.object({ id, actual: z.number().finite().nullable() })),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const result = await context.supabase.rpc("save_perf_actuals", {
      p_plan: data.planId,
      p_quarter: data.quarter,
      p_rows: data.rows,
    });
    if (result.error) throw new Error(result.error.message);
    return { ok: true };
  });
export const savePerfActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: id.optional(),
        planId: id,
        values: z.object({
          quarter: z.enum(["Q1", "Q2", "Q3", "Q4"]),
          activity_type: z.enum(["program", "event", "training"]),
          title: z.string(),
          target_group: z.string().nullable(),
          implementer: z.string().nullable(),
          beneficiaries: z.number().finite().nullable(),
          planned: z.number().finite().nullable(),
          achieved: z.number().finite().nullable(),
          kpi_code: z.string().nullable(),
          kpi_id: id.nullable().optional(),
          notes: z.string().nullable(),
        }),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const activityValues = { ...data.values, kpi_code: data.values.kpi_id ? null : data.values.kpi_code };
    const result = data.id
      ? await context.supabase
          .from("perf_activities")
          .update(activityValues)
          .eq("id", data.id)
          .eq("plan_id", data.planId)
      : await context.supabase
          .from("perf_activities")
          .insert({ ...activityValues, plan_id: data.planId });
    if (result.error) throw new Error(result.error.message);
    return { ok: true };
  });
export const deletePerfActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id, planId: id }).parse(d))
  .handler(async ({ data, context }) => {
    const result = await context.supabase
      .from("perf_activities")
      .delete()
      .eq("id", data.id)
      .eq("plan_id", data.planId);
    if (result.error) throw new Error(result.error.message);
    return { ok: true };
  });
