import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const id = z.string().uuid();
const period = z.enum(["Q1", "Q2", "Q3", "Q4", "annual"]);
const row = z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]));

export const loadReportExtras = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const [ini, ev, cor] = await Promise.all([
      sb.from("initiatives").select("id,title,domain,priority,status,timeline,org_ids"),
      sb.from("perf_report_events").select("*").order("changed_at", { ascending: false }),
      sb.from("perf_corrections").select("*").order("changed_at", { ascending: false }),
    ]);
    for (const r of [ini, ev, cor]) if (r.error) throw new Error(r.error.message);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: users } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    const emails: Record<string, string> = {};
    for (const u of users?.users ?? []) emails[u.id] = u.email ?? u.id;
    return { initiatives: ini.data ?? [], events: ev.data ?? [], corrections: cor.data ?? [], users: emails };
  });

export const saveReportContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      planId: id, period,
      values: z.object({
        executive_summary: z.string().max(20000).nullable().optional(),
        planned_beneficiaries: z.number().finite().nullable().optional(),
        annual_stats: z.array(row).max(100).optional(),
        achievements: z.array(row).max(200).optional(),
        challenges: z.array(row).max(200).optional(),
        proposals: z.array(row).max(200).optional(),
      }),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: existing, error: e1 } = await sb.from("perf_reports").select("id")
      .eq("plan_id", data.planId).eq("period", data.period).maybeSingle();
    if (e1) throw new Error(e1.message);
    const res = existing
      ? await sb.from("perf_reports").update(data.values as never).eq("id", existing.id)
      : await sb.from("perf_reports").insert({
          plan_id: data.planId, period: data.period, annual_stats: [], achievements: [], challenges: [], proposals: [],
          ...data.values,
        } as never);
    if (res.error) throw new Error(res.error.message);
    return { ok: true };
  });

export const approveReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ planId: id, period, snapshot: z.record(z.string(), z.unknown()) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rid, error } = await context.supabase.rpc("approve_perf_report", {
      p_plan: data.planId, p_period: data.period, p_snapshot: data.snapshot as never,
    });
    if (error) throw new Error(error.message);
    return { id: rid };
  });

export const reopenReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ reportId: id, reason: z.string().max(2000) }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("reopen_perf_report", { p_report: data.reportId, p_reason: data.reason });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const correctPerf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      planId: id, period, table: z.enum(["perf_kpis", "perf_activities"]), recordId: id.nullable(),
      field: z.string().max(40), value: z.unknown(), reason: z.string().max(2000),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: rid, error } = await context.supabase.rpc("perf_correct", {
      p_plan: data.planId, p_period: data.period, p_table: data.table, p_record: data.recordId as string,
      p_field: data.field, p_value: (data.value ?? null) as never, p_reason: data.reason,
    });
    if (error) throw new Error(error.message);
    return { id: rid };
  });
