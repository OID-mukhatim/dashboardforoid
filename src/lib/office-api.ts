/**
 * عمليات "أعمال المكتب": الاجتماعات، الزيارات، الخطط — عبر عميل Supabase مباشرة
 * (تُطبَّق صلاحيات RLS: القراءة لكل مصادق عليه، الكتابة للمدير/المطوّر).
 */
import { supabase } from "@/integrations/supabase/client";

export type Attendee = { name: string; role: string };

export type DecisionInput = {
  id?: string;
  decision: string;
  assigned_to?: string | null;
  due_date?: string | null;
  task_id?: string | null;
  converted?: boolean;
};

export type MeetingInput = {
  id?: string;
  title: string;
  date: string;
  duration?: string | null;
  location?: string | null;
  meeting_type: string;
  org_id?: string | null;
  objective?: string | null;
  minutes?: string | null;
  outputs?: string | null;
  attendees?: Attendee[];
  status?: string;
  decisions?: DecisionInput[];
};

export type GapInput = {
  id?: string;
  gap: string;
  action?: string | null;
  priority: string;
  due_date?: string | null;
  task_id?: string | null;
  converted?: boolean;
};

export type VisitInput = {
  id?: string;
  org_id: string;
  date: string;
  objective?: string | null;
  visit_type: string;
  oid_delegate?: string | null;
  org_delegate?: string | null;
  visual_identity?: string | null;
  discipline?: string | null;
  readiness?: string | null;
  prev_followups?: string | null;
  best_practices?: string | null;
  general_work?: string | null;
  outputs?: string | null;
  challenges?: string | null;
  performance?: string;
  guidance?: string | null;
  notes?: string | null;
  status?: string;
  gaps?: GapInput[];
};

function clean<T extends Record<string, any>>(o: T): T {
  const out: any = {};
  for (const [k, v] of Object.entries(o)) if (v !== undefined) out[k] = v;
  return out;
}

/* ══════════════ الاجتماعات ══════════════ */

export async function loadMeetings() {
  const { data, error } = await supabase
    .from("meetings")
    .select("*, meeting_decisions(*)")
    .order("date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function saveMeeting(input: MeetingInput) {
  const { decisions, ...rest } = input;
  const payload = clean({ ...rest, attendees: rest.attendees ?? [], status: rest.status ?? "draft" });
  const { data: meeting, error } = await supabase
    .from("meetings")
    .upsert(payload as any)
    .select()
    .single();
  if (error) throw error;

  if (decisions && meeting) {
    await supabase.from("meeting_decisions").delete().eq("meeting_id", meeting.id).is("task_id", null);
    const fresh = decisions.filter((d) => d.decision.trim() && !d.task_id);
    if (fresh.length > 0) {
      const { error: e2 } = await supabase.from("meeting_decisions").insert(
        fresh.map((d) => ({
          meeting_id: meeting.id,
          decision: d.decision.trim(),
          assigned_to: d.assigned_to || null,
          due_date: d.due_date || null,
        })),
      );
      if (e2) throw e2;
    }
  }
  return meeting;
}

export async function deleteMeeting(id: string) {
  const { error } = await supabase.from("meetings").delete().eq("id", id);
  if (error) throw error;
}

export async function convertDecisionToTask(args: {
  decisionId: string;
  meetingId: string;
  decision: string;
  assignedTo?: string | null;
  dueDate?: string | null;
  orgId?: string | null;
}) {
  const { data: task, error } = await supabase
    .from("office_tasks")
    .insert({
      title: args.decision,
      description: args.assignedTo ? `المكلف: ${args.assignedTo}` : null,
      org_id: args.orgId || null,
      section_ref: "meetings",
      source_type: "meeting",
      source_ref: args.meetingId,
      priority: "high",
      status: "open",
      due_date: args.dueDate || null,
    })
    .select()
    .single();
  if (error) throw error;
  const { error: e2 } = await supabase
    .from("meeting_decisions")
    .update({ task_id: task.id, converted: true })
    .eq("id", args.decisionId);
  if (e2) throw e2;
  return task;
}

/* ══════════════ الزيارات ══════════════ */

export async function loadVisits() {
  const { data, error } = await supabase
    .from("visits")
    .select("*, visit_gaps(*)")
    .order("date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** آخر زيارة معتمدة للمؤسسة مع فجواتها (للمتابعات السابقة). */
export async function loadPrevVisitGaps(orgId: string) {
  const { data, error } = await supabase
    .from("visits")
    .select("id, date, visit_gaps(*)")
    .eq("org_id", orgId)
    .order("date", { ascending: false })
    .limit(1);
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function saveVisit(input: VisitInput) {
  const { gaps, ...rest } = input;
  const { data: visit, error } = await supabase
    .from("visits")
    .upsert(clean(rest) as any)
    .select()
    .single();
  if (error) throw error;

  if (gaps && visit) {
    await supabase.from("visit_gaps").delete().eq("visit_id", visit.id).is("task_id", null);
    const fresh = gaps.filter((g) => g.gap.trim() && !g.task_id);
    if (fresh.length > 0) {
      const { error: e2 } = await supabase.from("visit_gaps").insert(
        fresh.map((g) => ({
          visit_id: visit.id,
          gap: g.gap.trim(),
          action: g.action || null,
          priority: g.priority || "normal",
          due_date: g.due_date || null,
        })),
      );
      if (e2) throw e2;
    }
  }
  return visit;
}

export async function deleteVisit(id: string) {
  const { error } = await supabase.from("visits").delete().eq("id", id);
  if (error) throw error;
}

export async function convertGapToTask(args: {
  gapId: string;
  visitId: string;
  gap: string;
  action?: string | null;
  priority: string;
  dueDate?: string | null;
  orgId: string;
}) {
  const { data: task, error } = await supabase
    .from("office_tasks")
    .insert({
      title: args.gap,
      description: args.action || null,
      org_id: args.orgId,
      section_ref: "visits",
      source_type: "visit",
      source_ref: args.visitId,
      priority: args.priority === "urgent" ? "critical" : "medium",
      status: "open",
      due_date: args.dueDate || null,
    })
    .select()
    .single();
  if (error) throw error;
  const { error: e2 } = await supabase
    .from("visit_gaps")
    .update({ task_id: task.id, converted: true })
    .eq("id", args.gapId);
  if (e2) throw e2;
  return task;
}

/* ══════════════ الخطط ══════════════ */

export async function loadPlans() {
  const { data, error } = await supabase
    .from("office_plans")
    .select("*, plan_activities(*)")
    .order("year", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function savePlan(input: {
  id?: string;
  title: string;
  year: number;
  quarter?: string | null;
  objective?: string | null;
  description?: string | null;
  status?: string;
}) {
  const { data, error } = await supabase.from("office_plans").upsert(clean(input) as any).select().single();
  if (error) throw error;
  return data;
}

export async function deletePlan(id: string) {
  const { error } = await supabase.from("office_plans").delete().eq("id", id);
  if (error) throw error;
}

export async function saveActivity(input: {
  id?: string;
  plan_id: string;
  title: string;
  description?: string | null;
  assigned_to?: string | null;
  due_date?: string | null;
  status?: string;
}) {
  const { data, error } = await supabase.from("plan_activities").upsert(clean(input) as any).select().single();
  if (error) throw error;
  return data;
}

export async function deleteActivity(id: string) {
  const { error } = await supabase.from("plan_activities").delete().eq("id", id);
  if (error) throw error;
}

export async function convertActivityToTask(args: {
  activityId: string;
  planId: string;
  title: string;
  description?: string | null;
  assignedTo?: string | null;
  dueDate?: string | null;
}) {
  const { data: task, error } = await supabase
    .from("office_tasks")
    .insert({
      title: args.title,
      description: args.description || (args.assignedTo ? `المكلف: ${args.assignedTo}` : null),
      section_ref: "plans",
      source_type: "plan",
      source_ref: args.planId,
      priority: "medium",
      status: "open",
      due_date: args.dueDate || null,
    })
    .select()
    .single();
  if (error) throw error;
  const { error: e2 } = await supabase
    .from("plan_activities")
    .update({ task_id: task.id })
    .eq("id", args.activityId);
  if (e2) throw e2;
  return task;
}
