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

async function extractWithAI(text: string, fileName: string): Promise<Extracted> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI key missing");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You read a monthly financial advisor report about Somali institutions and return ONLY JSON in Arabic:
{"period":"<Arabic month and year the report covers, e.g. سبتمبر 2026>","period_order":<YYYYMM integer of that month>,"timeline_title":"<one short Arabic line summarizing the month's main work>",
"assessment":{"<ORG>":{"label":"<short status line>","strengths":[..],"weaknesses":[..],"recommendations":[..],"nextMilestone":"<next step with date>"}},
"program":{"<ORG>":[{"domain":"<work area>","status":"done|inProgress|delayed|notYet","note":"<factual note>"}]}}
ORG codes: ZUST (Zamzam University), ZAD (Zad), TAYO (Tayo), KAFI (Kafi), ZF (Zamzam Foundation), HAMDI. Include only organizations the report covers. Use only facts from the report; never invent numbers or ratings.`,
        },
        { role: "user", content: `File: ${fileName}\n\n${text.slice(0, 60000)}` },
      ],
    }),
  });
  if (!res.ok) throw new Error(`AI request failed (${res.status})`);
  const json = await res.json();
  const parsed = JSON.parse(json.choices?.[0]?.message?.content ?? "{}") as Extracted;
  if (!parsed.period || !Number.isInteger(parsed.period_order)) throw new Error("Could not read report month");
  return parsed;
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
  return { period: x.period };
}
