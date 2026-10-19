import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AuditRow = {
  id: string; table_name: string; record_id: string | null; org_id: string | null; action: string;
  changed_by: string | null; changed_at: string; old_data: Record<string, any> | null;
  new_data: Record<string, any> | null; changed_fields: string[] | null;
};

const filters = z.object({
  orgId: z.string().max(20).optional(),
  table: z.string().max(60).optional(),
  userId: z.string().uuid().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.number().int().min(0).max(100000),
});

/** سجل التغييرات — للمسؤول فقط (RLS + تحقق صريح). قراءة فقط. */
export const loadAuditLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => filters.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: role } = await sb.from("user_roles").select("role").eq("user_id", context.userId).eq("role", "admin").maybeSingle();
    if (!role) throw new Error("Forbidden: admin role required");
    const PAGE = 50;
    let q = sb.from("audit_log").select("*", { count: "exact" }).order("changed_at", { ascending: false });
    if (data.orgId) q = q.eq("org_id", data.orgId);
    if (data.table) q = q.eq("table_name", data.table);
    if (data.userId) q = q.eq("changed_by", data.userId);
    if (data.from) q = q.gte("changed_at", `${data.from}T00:00:00Z`);
    if (data.to) q = q.lte("changed_at", `${data.to}T23:59:59.999Z`);
    const { data: rows, error, count } = await q.range(data.page * PAGE, data.page * PAGE + PAGE - 1);
    if (error) throw new Error(error.message);
    // البريد الإلكتروني للمستخدمين (بعد التحقق من صلاحية المسؤول)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: users } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    const emails: Record<string, string> = {};
    for (const u of users?.users ?? []) emails[u.id] = u.email ?? u.id;
    return { rows: (rows ?? []) as AuditRow[], total: count ?? 0, pageSize: PAGE, users: emails };
  });
