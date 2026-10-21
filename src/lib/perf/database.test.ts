import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { parseTemplate } from "./parser";
import type { Database } from "@/integrations/supabase/types";
// Opt-in real Data API tests. Use an injected editor session; never persist tokens.
const enabled = process.env.PERF_DATABASE_TESTS === "1";
const sb = enabled ? createClient<Database>(process.env.SUPABASE_URL ?? "", process.env.SUPABASE_PUBLISHABLE_KEY ?? "", {
  global: { headers: { Authorization: `Bearer ${process.env.LOVABLE_BROWSER_SUPABASE_ACCESS_TOKEN ?? ""}` } }, auth: { persistSession: false },
}) : null;
describe.skipIf(!enabled)("Database performance locks and stable identities", () => {
  let planId = "", uploadId = "", firstId = "", secondId = "";
  const fixture = parseTemplate(new Uint8Array(readFileSync(new URL("./fixture-zf-q2.xlsx", import.meta.url))), "ZF");
  const client = () => { if (!sb) throw new Error("session required"); return sb; };
  const ok = <T,>(r: { data: T; error: { message: string } | null }) => { if (r.error) throw new Error(r.error.message); return r.data; };
  const rows = async () => ok(await client().from("perf_kpis").select("*").eq("plan_id", planId).order("seq")) ?? [];
  const structure = async (data: unknown[]) => {
    const p = ok(await client().from("perf_plans").select("updated_at").eq("id", planId).single());
    if (!p) throw new Error("plan");
    return client().rpc("mutate_perf_kpis", { p_plan: planId, p_revision: p.updated_at, p_rows: data as never });
  };
  const transition = (status: string, reason?: string) => client().rpc("transition_perf_plan", { p_plan: planId, p_status: status, p_reason: reason });
  beforeAll(async () => {
    const upload = ok(await client().from("uploads").select("id").eq("file_name", "fixture-zf-q2.xlsx").order("created_at", { ascending: false }).limit(1).single());
    if (!upload) throw new Error("upload"); uploadId = upload.id;
    const existing = ok(await client().from("perf_plans").select("id").eq("org_id", "ZF").eq("plan_year", 2098).maybeSingle());
    if (existing) throw new Error("2098 already exists; never overwrite a real plan");
    const p = ok(await client().rpc("commit_perf_import", { p_org: "ZF", p_year: 2098, p_upload: uploadId, p_payload: fixture as never, p_allow_definitions: false, p_revision: null as never }));
    if (!p) throw new Error("plan"); planId = p;
    const all = await rows(); firstId = all.find(k => k.code === "ZF-S1")?.id ?? ""; secondId = all.find(k => k.code === "ZF-S2")?.id ?? "";
  });
  afterAll(async () => {
    if (planId) ok(await client().from("perf_plans").delete().eq("id", planId));
  });
  it("resolves imported activities and achievements to IDs in the same plan", async () => {
    const activities = ok(await client().from("perf_activities").select("*").eq("plan_id", planId)) ?? [];
    expect(activities).toHaveLength(5);
    expect(activities.filter(a => a.kpi_code).every(a => a.kpi_id)).toBe(true);
    const report = ok(await client().from("perf_reports").select("achievements").eq("plan_id", planId).eq("period", "Q2").single());
    expect((report?.achievements as { kpi_id: string }[])[0]?.kpi_id).toBe(secondId);
  });
  it("swaps S1 and S2 without moving links or changing free text", async () => {
    const original = await rows(); const a = original.find(k => k.id === firstId), b = original.find(k => k.id === secondId);
    if (!a || !b) throw new Error("fixture");
    ok(await client().from("perf_kpis").update({ related_kpis: "ZF-S1 نص حر" }).eq("id", firstId));
    const activity = ok(await client().from("perf_activities").select("*").eq("plan_id", planId).eq("kpi_id", secondId).limit(1).single());
    const swapped = original.map(k => k.id === firstId ? { id: secondId } : k.id === secondId ? { id: firstId } : { id: k.id });
    ok(await structure(swapped));
    const fresh = await rows(); expect(fresh.find(k => k.id === firstId)?.code).toBe("ZF-S2"); expect(fresh.find(k => k.id === secondId)?.code).toBe("ZF-S1");
    const linked = ok(await client().from("perf_activities").select("kpi_id,kpi_code").eq("id", activity?.id ?? "").single());
    expect(linked).toEqual({ kpi_id: secondId, kpi_code: "ZF-S1" });
    const report = ok(await client().from("perf_reports").select("achievements").eq("plan_id", planId).eq("period", "Q2").single());
    expect((report?.achievements as { kpi_id: string; kpi_code: string }[])[0]).toMatchObject({ kpi_id: secondId, kpi_code: "ZF-S1" });
    expect(fresh.find(k => k.id === firstId)?.related_kpis).toBe("ZF-S1 نص حر");
    ok(await structure(original.map(k => ({ id: k.id }))));
  });
  it("rejects direct seq/perspective/code edits, inserts and deletes in draft", async () => {
    for (const patch of [{ seq: 1000 }, { perspective: "P" }, { code: "FORGED" }]) expect((await client().from("perf_kpis").update(patch).eq("id", firstId)).error).not.toBeNull();
    expect((await client().from("perf_kpis").delete().eq("id", firstId)).error).not.toBeNull();
    const base = (await rows())[0]; if (!base) throw new Error("fixture");
    expect((await client().from("perf_kpis").insert({ ...base, id: crypto.randomUUID(), code: "FAKE" })).error).not.toBeNull();
  });
  it("deletion compacts sequences and clears linked ID/code", async () => {
    const original = await rows();
    ok(await structure([...original.map(k => ({ id: k.id })), { perspective: "S", name: "temporary", objective: "test" }]));
    const added = (await rows()).find(k => k.name === "temporary"); if (!added) throw new Error("added");
    ok(await client().from("perf_activities").insert({ plan_id: planId, quarter: "Q2", activity_type: "event", title: "delete-link-test", kpi_id: added.id }));
    ok(await structure(original.map(k => ({ id: k.id }))));
    expect((await rows()).filter(k => k.perspective === "S").map(k => k.seq)).toEqual([1, 2, 3]);
    const a = ok(await client().from("perf_activities").select("kpi_id,kpi_code").eq("plan_id", planId).eq("title", "delete-link-test").single());
    expect(a).toEqual({ kpi_id: null, kpi_code: null });
    ok(await client().from("perf_activities").delete().eq("plan_id", planId).eq("title", "delete-link-test"));
  });
  it("moves perspective with contiguous numbering on both sides", async () => {
    const original = await rows(); ok(await structure([...original.map(k => ({ id: k.id })), { perspective: "S", name: "move-test", weight: 0 }]));
    const added = (await rows()).find(k => k.name === "move-test"); if (!added) throw new Error("added");
    ok(await structure((await rows()).map(k => k.id === added.id ? { id: k.id, perspective: "P" } : { id: k.id })));
    const fresh = await rows(); expect(fresh.filter(k => k.perspective === "S").map(k => k.seq)).toEqual([1, 2, 3]); expect(fresh.filter(k => k.perspective === "P").map(k => k.seq)).toEqual([1, 2, 3, 4]);
    ok(await structure(original.map(k => ({ id: k.id }))));
  });
  it("objective approval blocks identity/add/delete/order but permits weight, target, actual and card fields", async () => {
    ok(await transition("objectives_approved"));
    for (const patch of [{ name: "changed" }, { objective: "changed" }, { perspective: "P" }, { seq: 5 }]) expect((await client().from("perf_kpis").update(patch).eq("id", firstId)).error).not.toBeNull();
    expect((await structure((await rows()).map(k => ({ id: k.id })))).error).not.toBeNull();
    expect((await client().from("perf_kpis").delete().eq("id", firstId)).error).not.toBeNull();
    ok(await client().from("perf_kpis").update({ annual_target: 81, q3_actual: 2, description: "allowed" }).eq("id", firstId));
    ok(await client().from("perf_kpis").update({ annual_target: 80 }).eq("id", firstId));
  });
  it("matrix approval locks every definition and allows unplanned Q3 actuals, card fields and formula approval", async () => {
    ok(await transition("matrix_approved"));
    for (const patch of [{ weight: 9 }, { annual_target: 999 }, { q3_plan: 4 }, { name: "changed" }, { baseline: 2 }, { calc_method: "annual" }]) expect((await client().from("perf_kpis").update(patch).eq("id", firstId)).error).not.toBeNull();
    ok(await client().rpc("save_perf_actuals", { p_plan: planId, p_quarter: 3, p_rows: [{ id: firstId, actual: 7 }] }));
    expect((await rows()).find(k => k.id === firstId)?.q3_actual).toBe(7);
    ok(await client().from("perf_kpis").update({ calculation_formula: "عدد المنجز مقسوماً على المستهدف" }).eq("id", firstId));
    ok(await client().from("perf_kpis").update({ calc_formula_status: "approved" }).eq("id", firstId));
    expect((await rows()).find(k => k.id === firstId)?.calc_formula_status).toBe("approved");
    ok(await client().from("perf_activities").update({ notes: "allowed after approval" }).eq("plan_id", planId));
  });
  it("formula approval metadata is server-owned and removed on text/status changes", async () => {
    const approved = (await rows()).find(k => k.id === firstId); expect(approved?.calc_formula_approved_by).toBe("531fe4be-ee99-42cb-893a-7f9ec07e744c"); expect(approved?.calc_formula_approved_at).toBeTruthy();
    ok(await client().from("perf_kpis").update({ calc_formula_approved_by: crypto.randomUUID(), calc_formula_approved_at: "2000-01-01" }).eq("id", firstId));
    expect((await rows()).find(k => k.id === firstId)?.calc_formula_approved_at).toBe(approved?.calc_formula_approved_at);
    ok(await client().from("perf_kpis").update({ calculation_formula: "صيغة جديدة", calc_formula_status: "approved", calc_formula_approved_by: crypto.randomUUID() }).eq("id", firstId));
    let k = (await rows()).find(k => k.id === firstId); expect([k?.calc_formula_status, k?.calc_formula_approved_by, k?.calc_formula_approved_at]).toEqual(["suggested", null, null]);
    ok(await client().from("perf_kpis").update({ calc_formula_status: "approved" }).eq("id", firstId));
    ok(await client().from("perf_kpis").update({ calc_formula_status: "suggested", calc_formula_approved_by: crypto.randomUUID(), calc_formula_approved_at: "2000-01-01" }).eq("id", firstId));
    k = (await rows()).find(k => k.id === firstId); expect([k?.calc_formula_approved_by, k?.calc_formula_approved_at]).toEqual([null, null]);
  });
  it("reopening rejects no/short reasons and jumping two steps; records valid one-step reopen", async () => {
    expect((await transition("objectives_approved")).error?.message).toBe("reason_required"); expect((await transition("objectives_approved", "short")).error?.message).toBe("reason_required"); expect((await transition("draft", "سبب إعادة فتح للاختبار")).error?.message).toBe("invalid_transition");
    ok(await transition("objectives_approved", "سبب إعادة فتح للاختبار")); ok(await transition("draft", "سبب إعادة فتح للاختبار"));
    const events = ok(await client().from("perf_plan_events").select("*").eq("plan_id", planId)) ?? [];
    expect(events).toHaveLength(4); expect(events.every(e => e.changed_by && e.changed_at)).toBe(true);
  });
  it("handles existing S1 and S1000 with no temporary-code collision", async () => {
    const original = await rows();
    const thousand = Array.from({ length: 1000 }, (_, i) => ({ perspective: "S", name: `boundary-${i + 1}`, objective: "test", weight: 0 }));
    ok(await structure(thousand));
    const all = await rows(); expect(all).toHaveLength(1000); const first = all[0], last = all[999]; if (!first || !last) throw new Error("1000 rows");
    expect([first.code, last.code]).toEqual(["ZF-S1", "ZF-S1000"]);
    ok(await client().from("perf_activities").insert({ plan_id: planId, quarter: "Q2", activity_type: "event", title: "boundary-link", kpi_id: first.id }));
    ok(await structure(all.map((k, i) => ({ id: i === 0 ? last.id : i === 999 ? first.id : k.id }))));
    const link = ok(await client().from("perf_activities").select("kpi_id,kpi_code").eq("plan_id", planId).eq("title", "boundary-link").single());
    expect(link).toEqual({ kpi_id: first.id, kpi_code: "ZF-S1000" });
    // Test fixture replacement can safely detach deleted IDs; plan is removed by afterAll.
    expect(original).toHaveLength(11);
  }, 120000);
});