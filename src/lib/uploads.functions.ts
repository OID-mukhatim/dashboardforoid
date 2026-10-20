import { GOV_LIKERT, GOV_TEXT_STATUS } from "./gov-likert";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[,%\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}
export function toStr(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/\s+/g, " ").trim();
  return s.length ? s : null;
}

export { ENTITY_ALIASES } from "./org-aliases";
import { matchOrganization } from "./org-aliases";
export function normalizeEntity(raw: string): { code: string; name: string } {
  const match = matchOrganization(raw);
  const text = (raw ?? "").trim();
  return match ? { code: match.id, name: match.name } : { code: text, name: text };
}
export function detectKnownOrg(raw: unknown): { code: string; name: string } | null {
  const match = matchOrganization(raw);
  return match ? { code: match.id, name: match.name } : null;
}

// Classify a header (axis name) into one of the institutional matrix buckets.
export type MatrixBucket = "gap" | "gov" | "fin" | "maturity" | null;
export function classifyAxis(header: string): { bucket: MatrixBucket; key: string } {
  const h = header.replace(/\s+/g, " ").trim();
  if (!h) return { bucket: null, key: h };
  // Maturity column
  if (/نضج|مستوى\s*النضج|maturity/i.test(h)) return { bucket: "maturity", key: "maturity" };
  // Governance
  if (/حوكمة|سياس|امتثال|governance|compliance/i.test(h))
    return { bucket: "gov", key: "governance" };
  // Financial assessment column
  if (/(تقييم|قدرة|إدارة)\s*مالي|financial\s*(assessment|score)/i.test(h))
    return { bucket: "fin", key: "financial" };
  // Seven-axis gap names
  if (
    /استراتيجي|قيادة|أداء|عمليات|مالية|بنية|infrastructure|strategy|leadership|operations/i.test(h)
  ) {
    return { bucket: "gap", key: h };
  }
  return { bucket: null, key: h };
}

export function looksLikeNetworksSheet(name: string): boolean {
  return /شبك(ات|ة)|البيانات\s*المؤسسية|مؤسسي|institutional|networks?/i.test(name);
}

export function looksLikeGapFile(name: string): boolean {
  return /فجو|gap\b|gaps?/i.test(name);
}
export function looksLikeGovFile(name: string): boolean {
  return /حوكم|امتثال|سياس(ات|ة)|policies|governance|compliance/i.test(name);
}

// Textual scales used in survey-style sheets
export const GOV_TEXT_SCORE: Array<[RegExp, number]> = GOV_TEXT_STATUS.map(([re, s]) => [
  re,
  GOV_LIKERT[s],
]);
export const AGREE_TEXT_SCORE: Array<[RegExp, number]> = [
  [/موافق\s*جدًا|strongly\s*agree/i, 5],
  [/غير\s*موافق\s*(إطلاقًا|تمامًا)|strongly\s*disagree/i, 1],
  [/نسبيًا|relatively/i, 3],
  [/غير\s*موافق|disagree/i, 2],
  [/موافق|agree/i, 4],
];
export function textToScore(v: unknown, table: Array<[RegExp, number]>): number | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  for (const [re, n] of table) if (re.test(s)) return n;
  return null;
}

// Normalize a domain label to one of the seven canonical OID axes.
export function normDomainKey(label: string): string | null {
  const s = label.replace(/\s+/g, " ").trim();
  if (!s) return null;
  if (/استراتيج|strategy|strategic/i.test(s)) return "الاستراتيجية";
  if (/حوكمة|سياس|امتثال|governance|compliance/i.test(s)) return "الحوكمة والامتثال";
  if (/قيادة|كفاء|leader|competency/i.test(s)) return "القيادة والكفاءات";
  if (/أداء|نتائج|performance/i.test(s)) return "الأداء والنتائج";
  if (/عمليات|أنظمة|operations|systems/i.test(s)) return "العمليات والأنظمة";
  if (/مالي|تمويل|financial|finance/i.test(s)) return "الاستدامة المالية";
  if (/بنية\s*تحتية|infrastructure/i.test(s)) return "البنية التحتية";
  return null;
}

// Detect "profile layout": a row near the top that contains ≥2 known org names
// across columns (each org becomes a column of values). Used by the institutional
// data form (نموذج 1: استمارة البيانات المؤسسية).
export function detectProfileLayout(
  aoa: unknown[][],
): { headerIdx: number; orgCols: Array<{ idx: number; code: string; name: string }> } | null {
  for (let r = 0; r < Math.min(aoa.length, 20); r++) {
    const row = aoa[r];
    if (!Array.isArray(row)) continue;
    const seen = new Set<string>();
    const orgCols: Array<{ idx: number; code: string; name: string }> = [];
    for (let c = 0; c < row.length; c++) {
      const hit = detectKnownOrg(row[c]);
      if (hit && !seen.has(hit.code)) {
        seen.add(hit.code);
        orgCols.push({ idx: c, ...hit });
      }
    }
    if (orgCols.length >= 2) return { headerIdx: r, orgCols };
  }
  return null;
}

export function isInstitutionalDataType(dataType: string): boolean {
  return /البيانات\s*المؤسسية|بيانات\s*الفجوات|بيانات\s*الحوكمة|التقرير\s*المالي/i.test(dataType);
}

export function spreadsheetTextPreview(aoa: unknown[][], maxRows = 20): string {
  return aoa
    .slice(0, maxRows)
    .map((row) =>
      row
        .map((cell) => toStr(cell) ?? "")
        .filter(Boolean)
        .join(" | "),
    )
    .filter(Boolean)
    .join("\n")
    .slice(0, 5000);
}

/** Throws unless the caller holds the admin or developer role. */
export async function assertEditor(
  context: { supabase: any; userId: string },
  roles: string[] = ["admin", "developer"],
) {
  const { data, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .in("role", roles);
  if (error || !data || data.length === 0) throw new Error("Forbidden");
}

export const parseUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        uploadId: z.string().uuid(),
        filePath: z.string().min(1),
        planYear: z.number().int().min(2000).max(2100).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await (await import("./org-registry.server")).loadOrgRegistry(context.supabase);
    await assertEditor(context);
    const { runParseUpload } = await import("./uploads-core.server");
    return runParseUpload(data);
  });

// Delete one or more uploads — removes storage objects, related kpis/extractions, and the upload row.
export const deleteUploads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ uploadIds: z.array(z.string().uuid()).min(1) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertEditor(context, ["admin"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("uploads")
      .select("id,file_path")
      .in("id", data.uploadIds);
    if (error) throw error;
    const paths = (rows ?? []).map((r) => r.file_path).filter(Boolean) as string[];
    if (paths.length) {
      await supabaseAdmin.storage.from("uploads").remove(paths);
    }
    // Cascade: remove derived data linked to these uploads.
    await supabaseAdmin.from("document_extractions").delete().in("upload_id", data.uploadIds);
    const { error: delErr } = await supabaseAdmin.from("uploads").delete().in("id", data.uploadIds);
    if (delErr) throw delErr;
    return { ok: true, deleted: data.uploadIds.length };
  });

// Route an upload to the correct parser based on file extension
export const processUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ uploadId: z.string().uuid(), filePath: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await (await import("./org-registry.server")).loadOrgRegistry(context.supabase);
    await assertEditor(context);
    const ext = data.filePath.split(".").pop()?.toLowerCase() || "";
    if (ext === "xlsx" || ext === "xls" || ext === "csv") {
      const { runParseUpload } = await import("./uploads-core.server");
      return runParseUpload(data);
    }
    // Word, PowerPoint, PDF → document extractor (call the server-only helper
    // directly; routing through another server fn's RPC stub breaks the
    // TanStack worker manifest and yields "Server function info not found").
    const { runDocumentExtraction } = await import("./documents-core.server");
    return runDocumentExtraction(data.uploadId, data.filePath);
  });
