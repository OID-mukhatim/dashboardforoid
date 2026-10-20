import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
const input = z.object({ id: z.string().uuid() });
export const suggestPerfFormula = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d: unknown) => input.parse(d)).handler(async ({ data, context }) => {
  const roles = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
  if (roles.error || !roles.data?.some((r) => r.role === "admin" || r.role === "developer")) throw new Error("Forbidden");
  const result = await context.supabase.from("perf_kpis").select("*").eq("id", data.id).single();
  if (result.error) throw new Error(result.error.message);
  const { proposeFormula } = await import("./formula.server");
  const text = await proposeFormula(result.data);
  const saved = await context.supabase.from("perf_kpis").update({ calculation_formula: text }).eq("id", data.id);
  if (saved.error) throw new Error(saved.error.message);
  return { text };
});
export const approvePerfFormula = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d: unknown) => input.parse(d)).handler(async ({ data, context }) => {
  const result = await context.supabase.from("perf_kpis").update({ calc_formula_status: "approved" }).eq("id", data.id).select("id").single();
  if (result.error) throw new Error(result.error.message);
  return { ok: true };
});