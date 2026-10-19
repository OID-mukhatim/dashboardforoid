import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type Initiative = {
  id: string;
  code: string | null;
  priority: string;
  status: string;
  domain: string | null;
  title: string;
  objective: string | null;
  gap: string | null;
  orgs: string[];
  timeline: string | null;
  cost: string | null;
  source: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export const listInitiatives = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as any)
      .from("initiatives")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as Initiative[];
  });

const initiativeInputSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().trim().max(50).nullable().optional(),
  priority: z.enum(["حرج", "عالٍ", "متوسط", "منخفض", "جارٍ"]),
  status: z.enum(["مقترح", "قيد التنفيذ", "مكتمل"]),
  domain: z.string().trim().max(60).nullable().optional(),
  title: z.string().trim().min(2).max(200),
  objective: z.string().trim().max(500).nullable().optional(),
  gap: z.string().trim().max(300).nullable().optional(),
  orgs: z.array(z.string().trim().max(100)).max(20).default([]),
  timeline: z.string().trim().max(80).nullable().optional(),
  cost: z.string().trim().max(80).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export const upsertInitiative = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => initiativeInputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const payload: any = { ...data };
    if (!payload.id) payload.created_by = context.userId;
    if (!payload.source) payload.source = "manual";
    const { data: row, error } = await (context.supabase as any)
      .from("initiatives")
      .upsert(payload, { onConflict: "id" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row as Initiative;
  });

export const deleteInitiative = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any)
      .from("initiatives")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateInitiativeStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["مقترح", "قيد التنفيذ", "مكتمل"]),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any)
      .from("initiatives")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Auto-generate initiatives from the latest live gap assessments.
 * Idempotent by `code` — won't duplicate already-generated rows.
 */
export const autoGenerateInitiatives = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await (await import("./org-registry.server")).loadOrgRegistry(context.supabase);
    const { data: roleRows } = await (context.supabase as any)
      .from("user_roles").select("role").eq("user_id", context.userId).in("role", ["admin", "developer"]);
    const isEditor = (roleRows ?? []).length > 0;
    if (!isEditor) throw new Error("صلاحيات غير كافية");

    const [{ data: gaps, error: gapError }, { data: existing, error: existingError }] = await Promise.all([
      context.supabase.from("gap_scores").select("org_id, domain_index, domain_name, score, period, updated_at"),
      context.supabase.from("initiatives").select("code, status"),
    ]);
    if (gapError) throw gapError;
    if (existingError) throw existingError;
    const { newGapInitiatives } = await import("./live-gap-rules");
    const { activeOrgIds } = await import("./org-registry");
    const active = new Set(activeOrgIds());
    const rows = newGapInitiatives((gaps ?? []).filter((g) => active.has(g.org_id)), existing ?? []).map((r) => ({ ...r, created_by: context.userId }));
    if (!rows.length) return { inserted: 0 };
    const { data, error } = await context.supabase.from("initiatives")
      .upsert(rows, { onConflict: "code", ignoreDuplicates: true }).select("id");
    if (error) throw error;
    return { inserted: data?.length ?? 0 };
  });
