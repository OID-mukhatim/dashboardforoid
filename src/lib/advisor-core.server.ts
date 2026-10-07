/** Turns an uploaded monthly financial-advisor report into a new advisor snapshot.
 * Always appends (one row per source upload); organizations the report does not
 * mention keep their previous assessment/program so nothing is lost. */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ORG_IDS = ["ZUST", "ZAD", "TAYO", "KAFI", "ZF", "HAMDI"] as const;

export function looksLikeAdvisorReport(fileName: string, dataType: string, text: string): boolean {
  const head = text.slice(0, 3000);
  return /المستشار\s*المالي|ملخص\s*التقرير\s*المالي|التقرير\s*المالي\s*الشهري|financial\s*(advisor|consultant)|monthly\s*financial\s*report/i.test(
    `${fileName} ${dataType} ${head}`,
  );
}

type Assessment = { label: string; strengths: string[]; weaknesses: string[]; recommendations: string[]; nextMilestone: string };
type ProgramRow = { domain: string; status: "done" | "inProgress" | "delayed" | "notYet"; note: string };
type Extracted = {
  period: string;
  period_order: number;
  timeline_title: string;
  assessment: Record<string, Assessment>;
  program: Record<string, ProgramRow[]>;
};

const str = { type: "string" };
const strArr = { type: "array", items: str };
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["period", "period_order", "timeline_title", "assessments", "program"],
  properties: {
    period: str,
    period_order: { type: "integer" },
    timeline_title: str,
    assessments: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        required: ["org", "label", "strengths", "weaknesses", "recommendations", "nextMilestone"],
        properties: { org: { type: "string", enum: [...ORG_IDS] }, label: str, strengths: strArr, weaknesses: strArr, recommendations: strArr, nextMilestone: str },
      },
    },
    program: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        required: ["org", "domain", "status", "note"],
        properties: { org: { type: "string", enum: [...ORG_IDS] }, domain: str, status: { type: "string", enum: ["done", "inProgress", "delayed", "notYet"] }, note: str },
      },
    },
  },
};

async function extractWithAI(text: string, fileName: string): Promise<Extracted> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI key missing");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({
      model: "openai/gpt-6-astra",
      stream: true,
      store: false,
      reasoning: { effort: "low" },
      text: { format: { type: "json_schema", name: "advisor_report", strict: true, schema: SCHEMA } },
      instructions: `You read a monthly financial advisor report about Somali institutions and return JSON written in Arabic.
period = Arabic month and year the report covers (e.g. سبتمبر 2026); period_order = YYYYMM integer of that month; timeline_title = one short Arabic line summarizing the month's main work.
assessments: per organization covered — short status label, strengths, weaknesses, recommendations, next milestone with date.
program: per organization — work areas with status done|inProgress|delayed|notYet and a factual note.
ORG codes: ZUST (Zamzam University), ZAD, TAYO, KAFI, ZF (Zamzam Foundation), HAMDI. Only include organizations the report covers. Use only facts from the report; never invent numbers or ratings.`,
      input: [{ role: "user", content: `File: ${fileName}\n\n${text.slice(0, 60000)}` }],
    }),
  });
  if (!res.ok || !res.body) throw new Error(`AI request failed (${res.status})`);

  // Consume SSE stream and collect output text.
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "", out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const ev = JSON.parse(payload);
        if (ev.type === "response.output_text.delta") out += ev.delta ?? "";
        else if (ev.type === "response.failed" || ev.type === "error") throw new Error("AI extraction failed");
      } catch (e) {
        if (e instanceof Error && e.message === "AI extraction failed") throw e;
      }
    }
  }
  const raw = JSON.parse(out) as {
    period: string; period_order: number; timeline_title: string;
    assessments: (Assessment & { org: string })[]; program: (ProgramRow & { org: string })[];
  };
  if (!raw.period || !Number.isInteger(raw.period_order)) throw new Error("Could not read report month");
  const assessment: Record<string, Assessment> = {};
  for (const { org, ...a } of raw.assessments) assessment[org] = a;
  const program: Record<string, ProgramRow[]> = {};
  for (const { org, ...p } of raw.program) (program[org] ??= []).push(p);
  return { period: raw.period, period_order: raw.period_order, timeline_title: raw.timeline_title, assessment, program };
}

export async function processAdvisorReport(uploadId: string, fileName: string, text: string) {
  const x = await extractWithAI(text, fileName);
  const keep = (o: Record<string, unknown> | undefined) =>
    Object.fromEntries(Object.entries(o ?? {}).filter(([k]) => (ORG_IDS as readonly string[]).includes(k)));

  // Carry forward organizations not covered by this report from the latest earlier snapshot.
  const { data: prev } = await supabaseAdmin
    .from("advisor_snapshots")
    .select("assessment, program")
    .not("assessment", "is", null)
    .lte("period_order", x.period_order)
    .neq("source_upload_id", uploadId)
    .order("period_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const assessment = { ...((prev?.assessment as Record<string, unknown>) ?? {}), ...keep(x.assessment) };
  const program = { ...((prev?.program as Record<string, unknown>) ?? {}), ...keep(x.program) };

  const { error } = await supabaseAdmin.from("advisor_snapshots").upsert(
    {
      source_upload_id: uploadId,
      period: x.period,
      period_order: x.period_order,
      timeline_title: x.timeline_title,
      done: true,
      assessment: assessment as never,
      program: program as never,
    },
    { onConflict: "source_upload_id" },
  );
  if (error) throw error;
  // A real report replaces the planned placeholder for that month.
  await supabaseAdmin.from("advisor_snapshots").delete().eq("period_order", x.period_order).eq("done", false).is("source_upload_id", null);
  return { period: x.period };
}
