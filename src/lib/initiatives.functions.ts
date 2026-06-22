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
 * Auto-generate initiatives from the critical gaps catalogue.
 * Idempotent by `code` — won't duplicate already-generated rows.
 */
export const autoGenerateInitiatives = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const isEditor =
      (await (context.supabase as any).rpc("has_role", { _user_id: context.userId, _role: "admin" })).data ||
      (await (context.supabase as any).rpc("has_role", { _user_id: context.userId, _role: "developer" })).data;
    if (!isEditor) throw new Error("صلاحيات غير كافية");

    const gaps = [
      { rank: 1, name: "أتمتة العمليات", avg: 1.87, affected: "6/6", priority: "حرج", domain: "تقني", orgs: ["الجميع"], timeline: "12-18 شهراً", cost: "$45,000-$80,000" },
      { rank: 2, name: "الحوكمة — زاد للتنمية", avg: 0.87, affected: "1/6", priority: "حرج", domain: "حوكمة", orgs: ["زاد للتنمية"], timeline: "12 شهراً", cost: "$6,000-$10,000" },
      { rank: 3, name: "أدلة الإجراءات (SOPs)", avg: 2.3, affected: "5/6", priority: "حرج", domain: "حوكمة", orgs: ["زاد", "تيو", "حمدي"], timeline: "6 أشهر", cost: "$8,000-$15,000" },
      { rank: 4, name: "تنوع مصادر الدخل", avg: 2.47, affected: "6/6", priority: "عالٍ", domain: "مالي", orgs: ["تيو", "جامعة زمزم", "زاد"], timeline: "18 شهراً", cost: "$10,000-$18,000" },
      { rank: 5, name: "الحوكمة — تيو للتعليم", avg: 2.17, affected: "1/6", priority: "عالٍ", domain: "حوكمة", orgs: ["تيو للتعليم"], timeline: "9 أشهر", cost: "$5,000-$8,000" },
      { rank: 6, name: "نظام إدارة البيانات", avg: 2.27, affected: "6/6", priority: "عالٍ", domain: "بيانات", orgs: ["الجميع"], timeline: "12 شهراً", cost: "$15,000-$25,000" },
    ];

    const rows = gaps.map((g) => ({
      code: `AUTO-G${g.rank.toString().padStart(3, "0")}`,
      title: `معالجة فجوة: ${g.name}`,
      objective: `رفع المؤشر من ${g.avg}/5 إلى 3.5+/5`,
      gap: `${g.name} — متوسط ${g.avg}/5 — يؤثر على ${g.affected}`,
      priority: g.priority,
      status: "مقترح",
      domain: g.domain,
      orgs: g.orgs,
      timeline: g.timeline,
      cost: g.cost,
      source: "auto",
      created_by: context.userId,
    }));

    const { data, error } = await (context.supabase as any)
      .from("initiatives")
      .upsert(rows, { onConflict: "code", ignoreDuplicates: false })
      .select();
    if (error) throw new Error(error.message);
    return { inserted: data?.length ?? 0 };
  });
