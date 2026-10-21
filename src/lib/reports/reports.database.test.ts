import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { parseTemplate } from "../perf/parser";
import { buildReportSections } from "./build";
import type { Database } from "@/integrations/supabase/types";
// Opt-in real Data API acceptance journey (admin session); creates and deletes ZF 2099.
const enabled = process.env.PERF_DATABASE_TESTS === "1";
const sb = enabled ? createClient<Database>(process.env.SUPABASE_URL ?? "", process.env.SUPABASE_PUBLISHABLE_KEY ?? "", {
  global: { headers: { Authorization: `Bearer ${process.env.LOVABLE_BROWSER_SUPABASE_ACCESS_TOKEN ?? ""}` } }, auth: { persistSession: false },
}) : null;
const FIXTURE = process.env.PERF_FIXTURE ?? new URL("../perf/fixture-zf-q2.xlsx", import.meta.url).pathname;

describe.skipIf(!enabled)("Report approval, freeze, corrections and reopen", () => {
  const c = () => { if (!sb) throw new Error("session"); return sb; };
  const ok = <T,>(r: { data: T; error: { message: string } | null }) => { if (r.error) throw new Error(r.error.message); return r.data; };
  let planId = "", s2 = "";
  const snapshot = async (period: "Q2" | "Q4" | "annual") => {
    const [plan, kpis, acts, rep] = await Promise.all([
      c().from("perf_plans").select("*").eq("id", planId).single(), c().from("perf_kpis").select("*").eq("plan_id", planId).order("seq"),
      c().from("perf_activities").select("*").eq("plan_id", planId), c().from("perf_reports").select("*").eq("plan_id", planId).eq("period", period).maybeSingle(),
    ]);
    return buildReportSections({ plan: plan.data as never, kpis: (kpis.data ?? []) as never, activities: (acts.data ?? []) as never, report: (rep.data ?? undefined) as never, initiatives: [], period });
  };
  const approve = async (period: "Q2" | "Q4" | "annual") => c().rpc("approve_perf_report", { p_plan: planId, p_period: period, p_snapshot: (await snapshot(period)) as never });
  const report = async (period: string) => ok(await c().from("perf_reports").select("*").eq("plan_id", planId).eq("period", period).single())!;

  beforeAll(async () => {
    const fixture = parseTemplate(new Uint8Array(readFileSync(FIXTURE)), "ZF");
    if (ok(await c().from("perf_plans").select("id").eq("org_id", "ZF").eq("plan_year", 2099).maybeSingle())) throw new Error("2099 exists");
    const upload = ok(await c().from("uploads").select("id").eq("data_type", "قالب متابعة الأداء").order("created_at", { ascending: false }).limit(1).single());
    planId = ok(await c().rpc("commit_perf_import", { p_org: "ZF", p_year: 2099, p_upload: upload!.id, p_payload: fixture as never, p_allow_definitions: false, p_revision: null as never })) as string;
    s2 = ok(await c().from("perf_kpis").select("id").eq("plan_id", planId).eq("code", "ZF-S2").single())!.id;
    ok(await c().rpc("transition_perf_plan", { p_plan: planId, p_status: "objectives_approved", p_reason: null as never }));
    ok(await c().rpc("transition_perf_plan", { p_plan: planId, p_status: "matrix_approved", p_reason: null as never }));
  });
  afterAll(async () => { if (planId && !process.env.KEEP_PLAN) ok(await c().from("perf_plans").delete().eq("id", planId)); });

  it("writes file annual statistics to the annual report whatever the file period", async () => {
    const fixture = parseTemplate(new Uint8Array(readFileSync(FIXTURE)), "ZF");
    expect(fixture.period).toBe("Q2");
    expect(fixture.report.annual_stats.length).toBeGreaterThan(0);
    const annual = ok(await c().from("perf_reports").select("*").eq("plan_id", planId).eq("period", "annual").single())!;
    expect(annual.annual_stats).toEqual(fixture.report.annual_stats);
    const q2 = ok(await c().from("perf_reports").select("annual_stats").eq("plan_id", planId).eq("period", "Q2").single())!;
    expect(q2.annual_stats).toEqual([]);
  });
  it("approves Q2 with 86.625% to date and 69.9987% annual", async () => {
    ok(await c().from("perf_reports").update({ executive_summary: "ملخص تنفيذي للاختبار", achievements: [{ achievement: "إنجاز", kpi_id: s2 }] as never }).eq("plan_id", planId).eq("period", "Q2"));
    ok(await approve("Q2"));
    const r = await report("Q2");
    expect(r.status).toBe("approved");
    expect((r.snapshot as any).kpi.overall).toBeCloseTo(86.625, 3);
    expect((r.snapshot as any).kpi.annualOverall).toBeCloseTo(69.9987, 3);
    expect((r.snapshot as any).annual_stats).toBeNull();
  });
  it("rejects a direct Q2 actual edit and accepts a reasoned correction without changing the snapshot", async () => {
    const before = (await report("Q2")).snapshot;
    expect((await c().from("perf_kpis").update({ q2_actual: 1 }).eq("id", s2)).error).not.toBeNull();
    expect((await c().rpc("perf_correct", { p_plan: planId, p_period: "Q2", p_table: "perf_kpis", p_record: s2, p_field: "q2_actual", p_value: 1 as never, p_reason: "قصير" })).error).not.toBeNull();
    ok(await c().rpc("perf_correct", { p_plan: planId, p_period: "Q2", p_table: "perf_kpis", p_record: s2, p_field: "q2_actual", p_value: 1 as never, p_reason: "تصحيح خطأ إدخال في المنجز" }));
    const logged = ok(await c().from("perf_corrections").select("*").eq("plan_id", planId));
    expect(logged).toHaveLength(1);
    expect((await report("Q2")).snapshot).toEqual(before);
  });
  it("blocks narrative edits while approved; reopen needs a reason", async () => {
    expect((await c().from("perf_reports").update({ executive_summary: "x" }).eq("plan_id", planId).eq("period", "Q2")).error).not.toBeNull();
    const r = await report("Q2");
    expect((await c().rpc("reopen_perf_report", { p_report: r.id, p_reason: "" })).error).not.toBeNull();
    ok(await c().rpc("reopen_perf_report", { p_report: r.id, p_reason: "إعادة فتح لمراجعة البيانات" }));
    expect((await report("Q2")).status).toBe("draft");
    const ev = ok(await c().from("perf_report_events").select("*").eq("report_id", r.id).eq("to_status", "draft").single());
    expect(ev?.previous_snapshot).not.toBeNull();
  });
  it("annual report is independent and cannot be approved before Q4", async () => {
    expect((await approve("annual")).error?.message).toContain("Q4");
    ok(await approve("Q4"));
    const annual = await snapshot("annual");
    expect(annual.kpi?.overall).toBeCloseTo((await snapshot("Q4")).kpi!.overall!, 6);
    expect(annual.annual_stats).not.toBeNull();
    ok(await approve("annual"));
    expect((await report("annual")).id).not.toBe((await report("Q4")).id);
  });
  it("skips annual statistics on import once the annual report is approved", async () => {
    const before = (await report("annual")).annual_stats;
    const fixture = parseTemplate(new Uint8Array(readFileSync(FIXTURE)), "ZF");
    const changed = fixture.report.annual_stats.map((r, i) => (i === 0 ? { ...r, current: 9999 } : r));
    // المنجز في الحمولة يطابق القاعدة حتى لا يصطدم الاستيراد بقفل الربع المعتمد
    const current = ok(await c().from("perf_kpis").select("code,q1_actual,q2_actual,q3_actual,q4_actual").eq("plan_id", planId));
    const kpis = fixture.kpis.map((k) => {
      const db = current!.find((x) => x.code === k.code);
      return db ? { ...k, q1_actual: db.q1_actual, q2_actual: db.q2_actual, q3_actual: db.q3_actual, q4_actual: db.q4_actual } : k;
    });
    const payload = { ...fixture, kpis, period: "Q3", report: { ...fixture.report, period: "Q3", annual_stats: changed } };
    const upload = ok(await c().from("uploads").select("id").eq("data_type", "قالب متابعة الأداء").order("created_at", { ascending: false }).limit(1).single());
    const plan = ok(await c().from("perf_plans").select("updated_at").eq("id", planId).single());
    ok(await c().rpc("commit_perf_import", { p_org: "ZF", p_year: 2099, p_upload: upload!.id, p_payload: payload as never, p_allow_definitions: false, p_revision: plan!.updated_at as never }));
    expect((await report("annual")).annual_stats).toEqual(before);
    const q3 = ok(await c().from("perf_reports").select("annual_stats").eq("plan_id", planId).eq("period", "Q3").single())!;
    expect(q3.annual_stats).toEqual([]);
  });
});
