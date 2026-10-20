import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { Json } from "@/integrations/supabase/types";
export async function changeStructure(sb: SupabaseClient<Database>, planId: string, edit: (rows: Record<string, Json | undefined>[]) => Record<string, Json | undefined>[]) {
  const plan = await sb.from("perf_plans").select("updated_at,status").eq("id", planId).single();
  if (plan.error) throw new Error(plan.error.message);
  if (plan.data.status !== "draft") throw new Error("الخطة معتمدة — هذا الحقل مقفل");
  const result = await sb.from("perf_kpis").select("*").eq("plan_id", planId).order("perspective").order("seq");
  if (result.error) throw new Error(result.error.message);
  const saved = await sb.rpc("mutate_perf_kpis", { p_plan: planId, p_revision: plan.data.updated_at, p_rows: edit(result.data) as Json });
  if (saved.error) throw new Error(saved.error.message);
  return { ok: true };
}