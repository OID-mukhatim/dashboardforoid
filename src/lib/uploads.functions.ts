import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { parseQuarterlySheet } from "./quarterly-parse";

// Column index mapping from the KPI template (row 3 is header):
// 0: م (row number)  — sheet header is "مكتب الإشراف..."
// 1: المنظور (sector)
// 2: الهدف (objective)
// 3: مؤشر الأداء (kpi_name)
// 4: الكود (kpi_code)
// 5: النوع (kpi_type)
// 6: الوزن (weight)
// 7: خط الأساس (baseline)
// 8: المستهدف السنوي (annual_target)
// 9-12: Q1..Q4 planned
// 13: total_planned
// 14-17: Q1..Q4 actual
// 18: total_actual
// 19: another total
// 20: achievement_pct
// 21: overall_pct
// 22: final_output

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

// Map raw sheet/entity names (Arabic short or English variants) to canonical org IDs.
export const ENTITY_ALIASES: Array<{ id: string; name: string; patterns: RegExp[] }> = [
  { id: "TAYO", name: "تيو للتعليم", patterns: [/تيو/, /tayo/i] },
  { id: "KAFI", name: "كافي للتنمية", patterns: [/كافي/, /kafi/i] },
  { id: "ZF", name: "مؤسسة زمزم", patterns: [/^\s*زمزم\s*$/, /مؤسسة\s*زمزم/, /zamzam\s*foundation/i, /^\s*zf\s*$/i] },
  { id: "ZUST", name: "جامعة زمزم للعلوم والتكنولوجيا", patterns: [/جامعة\s*زمزم/, /^\s*(ال)?جامعة\s*$/, /zust/i] },
  { id: "ZAD", name: "زاد للتنمية", patterns: [/^\s*زاد/, /\bzad\b/i] },
  { id: "HAMDI", name: "منظمة حمدي للتنمية", patterns: [/حمد[يى]/, /hamdi/i] },
];
export function normalizeEntity(raw: string): { code: string; name: string } {
  const s = (raw ?? "").trim();
  for (const a of ENTITY_ALIASES) {
    if (a.patterns.some((re) => re.test(s))) return { code: a.id, name: a.name };
  }
  return { code: s, name: s };
}

// Recognise a known org from any free-text cell (used when org is in a column,
// not the sheet name — e.g. the consolidated "Networks" sheet).
export function detectKnownOrg(raw: unknown): { code: string; name: string } | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  for (const a of ENTITY_ALIASES) {
    if (a.patterns.some((re) => re.test(s))) return { code: a.id, name: a.name };
  }
  return null;
}

// Classify a header (axis name) into one of the institutional matrix buckets.
export type MatrixBucket = "gap" | "gov" | "fin" | "maturity" | null;
export function classifyAxis(header: string): { bucket: MatrixBucket; key: string } {
  const h = header.replace(/\s+/g, " ").trim();
  if (!h) return { bucket: null, key: h };
  // Maturity column
  if (/نضج|مستوى\s*النضج|maturity/i.test(h)) return { bucket: "maturity", key: "maturity" };
  // Governance
  if (/حوكمة|سياس|امتثال|governance|compliance/i.test(h)) return { bucket: "gov", key: "governance" };
  // Financial assessment column
  if (/(تقييم|قدرة|إدارة)\s*مالي|financial\s*(assessment|score)/i.test(h)) return { bucket: "fin", key: "financial" };
  // Seven-axis gap names
  if (/استراتيجي|قيادة|أداء|عمليات|مالية|بنية|infrastructure|strategy|leadership|operations/i.test(h)) {
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
export const GOV_TEXT_SCORE: Array<[RegExp, number]> = [
  [/موجود\s*ومفعّ?ل|existing\s*and\s*activated/i, 5],
  [/موجود\s*وغير\s*مفعّ?ل|existing\s*but\s*not\s*activated/i, 3],
  [/بحاجة\s*إلى\s*تحديث|needs\s*review/i, 2],
  [/قيد\s*الإعداد|under\s*development/i, 1.5],
  [/غير\s*موجود|not\s*exist/i, 0],
];
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

export function looksLikeKpiFile(name: string): boolean {
  return /مؤشرات\s*الأداء|مصفوفة\s*المؤشرات|مؤشر\s*الأداء|kpis?|performance\s*indicators?|balanced\s*scorecard|بطاقة\s*الأداء/i.test(name);
}

export function isInstitutionalDataType(dataType: string): boolean {
  return /البيانات\s*المؤسسية|بيانات\s*الفجوات|بيانات\s*الحوكمة|التقرير\s*المالي/i.test(dataType);
}

export function isKpiDataType(dataType: string): boolean {
  return /مؤشرات\s*الأداء|kpis?/i.test(dataType);
}

export function findKpiHeaderRow(aoa: unknown[][]): number {
  for (let r = 0; r < Math.min(aoa.length, 25); r++) {
    const row = aoa[r] ?? [];
    const cells = row.map((c) => String(c ?? "").replace(/\u0640/g, "").replace(/\s+/g, " ").trim());
    const joined = cells.join(" ");
    const fixedColumnsMatch =
      cells.some((c) => /^(مؤشر\s*الأداء|وصف\s*المؤشر|المؤشر)(\s|$)/i.test(c)) &&
      cells.some((c) => /^(الكود|code|id)(\s|$)/i.test(c));
    const labels = [
      /المنظور|perspective/i,
      /الهدف|objective/i,
      /مؤشر\s*الأداء|وصف\s*المؤشر|indicator/i,
      /الكود|code|id/i,
      /الوزن|weight/i,
      /خط\s*الأساس|baseline/i,
      /المستهدف|target/i,
    ].filter((re) => re.test(joined)).length;
    if (fixedColumnsMatch || labels >= 5) return r;
  }
  return -1;
}

/** Derive the org from a KPI code prefix (e.g. "ZAD-S1" → ZAD). */
export const KPI_CODE_ORGS = ["ZF", "ZUST", "ZAD", "TAYO", "KAFI", "HAMDI"];
export function entityFromKpiCode(code: string | null): string | null {
  if (!code) return null;
  const prefix = code.split(/[-_ ]/)[0]?.toUpperCase();
  return prefix && KPI_CODE_ORGS.includes(prefix) ? prefix : null;
}


/**
 * KPI workbooks vary: some omit the leading "م" column, some place الكود after
 * المنظور/الهدف/المؤشر, some add extra columns first. Resolve each text column
 * by its header label and anchor the numeric block on the الكود column.
 */
export type KpiCols = {
  sector: number; objective: number; name: number; code: number; type: number;
  unit: number; polarity: number; frequency: number;
  weight: number; baseline: number; target: number;
  q1p: number; q2p: number; q3p: number; q4p: number; totalPlanned: number;
  q1a: number; q2a: number; q3a: number; q4a: number; totalActual: number;
  achievement: number; overall: number; output: number;
};

export function findCol(row: unknown[], re: RegExp, exclude?: RegExp): number {
  return row.findIndex((c) => {
    const s = String(c ?? "").replace(/\u0640/g, "").replace(/\s+/g, " ").trim();
    if (!s) return false;
    if (exclude && exclude.test(s)) return false;
    return re.test(s);
  });
}

export function kpiColumnMap(aoa: unknown[][], headerIdx: number): KpiCols {
  const row = (headerIdx >= 0 ? (aoa[headerIdx] ?? []) : []) as unknown[];
  // NB: \b does not work after Arabic letters (they are not \w), so match on
  // an explicit separator/end instead — "الكود ID" must resolve here.
  const codeIdx = findCol(row, /^(الكود|code|id)(\s|$)/i);
  const code = codeIdx >= 0 ? codeIdx : 4;
  const off = code - 4; // numeric block keeps its relative layout after الكود
  const at = (base: number) => base + off;
  const pick = (re: RegExp, base: number, exclude?: RegExp) => {
    const i = findCol(row, re, exclude);
    // base -1 = optional column: when absent it must resolve to -1 (→ null),
    // never to a shifted numeric-block index.
    return i >= 0 ? i : base >= 0 ? at(base) : -1;
  };
  return {
    code,
    sector: pick(/^(المنظور|perspective)/i, 1),
    objective: pick(/^(الهدف|objective)/i, 2),
    name: pick(/(مؤشر\s*الأداء|وصف\s*المؤشر|^المؤشر$|indicator)/i, 3, /الكود|code/i),
    type: pick(/^(النوع|نوعه|type)/i, 5),
    unit: pick(/(الوحدة|وحدة\s*القياس|unit)/i, -1),
    polarity: pick(/(القطبية|الاتجاه|polarity)/i, -1),
    frequency: pick(/(التردد|التكرار|الدورية|frequency)/i, -1),
    weight: pick(/^(الوزن|weight)/i, 6),
    baseline: pick(/(خط\s*الأساس|baseline)/i, 7),
    target: pick(/(المستهدف\s*السنوي|annual\s*target)/i, 8),
    q1p: at(9), q2p: at(10), q3p: at(11), q4p: at(12), totalPlanned: at(13),
    q1a: at(14), q2a: at(15), q3a: at(16), q4a: at(17), totalActual: at(18),
    achievement: at(20), overall: at(21), output: at(22),
  };
}

export function hasKpiStructure(aoa: unknown[][]): boolean {
  const hi = findKpiHeaderRow(aoa);
  if (hi < 0) return false;
  const cols = kpiColumnMap(aoa, hi);
  const rows = aoa.slice(hi + 1, hi + 31);
  return rows.some((row) => Array.isArray(row) && isValidKpiRow(row, cols));
}

export const KPI_ROW_REJECT = /^(data|البيانات|تحليل|التحليل|جامعة|الجامعة|الربعي|ربع[يية]|الهدف|هدف|تعزيز\s*الشفافية|توسيع\s*قاعدة\s*المانحين|النتائج\s*المباشرة|نتائج\s*تقييم\s*السياسات|مؤشر\s*الأداء|الكود|الكود\s*id|المنظور)$/i;

export function isValidKpiRow(row: unknown[], cols: KpiCols): boolean {
  const code = toStr(row[cols.code]);
  const name = toStr(row[cols.name]);
  if (!code || !name) return false;
  if (KPI_ROW_REJECT.test(code) || KPI_ROW_REJECT.test(name)) return false;
  if (code.length > 48 || name.length < 4) return false;
  // KPI codes are compact identifiers. Descriptive Arabic section titles with spaces are not KPI codes.
  if (!/[A-Za-z0-9٠-٩۰-۹]/.test(code) && /\s/.test(code)) return false;
  return true;
}


export function spreadsheetTextPreview(aoa: unknown[][], maxRows = 20): string {
  return aoa
    .slice(0, maxRows)
    .map((row) => row.map((cell) => toStr(cell) ?? "").filter(Boolean).join(" | "))
    .filter(Boolean)
    .join("\n")
    .slice(0, 5000);
}


/** المؤسسات ذات التقويم الدراسي (أكتوبر–سبتمبر). */
export const ACADEMIC_ORGS = new Set(["ZUST", "TAYO", "HAMDI"]);
/** كود المؤشر يحمل دائماً لاحقة سنة الخطة: ORG-S1-2026 */
export function kpiCodeWithYear(code: string | null, year: number): string {
  const base = (code ?? "").trim();
  if (!base) return base;
  return /-20\d{2}$/.test(base) ? base : `${base}-${year}`;
}


/** Throws unless the caller holds the admin or developer role. */
export async function assertEditor(context: { supabase: any; userId: string }, roles: string[] = ["admin", "developer"]) {
  const { data, error } = await context.supabase
    .from("user_roles").select("role").eq("user_id", context.userId).in("role", roles);
  if (error || !data || data.length === 0) throw new Error("Forbidden");
}

export const parseUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ uploadId: z.string().uuid(), filePath: z.string().min(1), planYear: z.number().int().min(2000).max(2100).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertEditor(context);
    const { runParseUpload } = await import("./uploads-core.server");
    return runParseUpload(data);
  });


// Delete one or more uploads — removes storage objects, related kpis/extractions, and the upload row.
export const deleteUploads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ uploadIds: z.array(z.string().uuid()).min(1) }).parse(input))
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
    await supabaseAdmin.from("kpis").delete().in("upload_id", data.uploadIds);
    await supabaseAdmin.from("document_extractions").delete().in("upload_id", data.uploadIds);
    const { error: delErr } = await supabaseAdmin.from("uploads").delete().in("id", data.uploadIds);
    if (delErr) throw delErr;
    return { ok: true, deleted: data.uploadIds.length };
  });

// Route an upload to the correct parser based on file extension
export const processUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ uploadId: z.string().uuid(), filePath: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
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

// Preview an Excel KPI upload without writing: returns diff vs existing DB rows.
const KPI_COMPARE_FIELDS = [
  "kpi_name", "kpi_type", "unit", "polarity", "frequency", "sector", "objective",
  "weight", "baseline", "annual_target",
  "q1_planned", "q2_planned", "q3_planned", "q4_planned", "total_planned",
  "q1_actual", "q2_actual", "q3_actual", "q4_actual", "total_actual",
  "achievement_pct", "overall_pct", "final_output",
] as const;

const FIELD_LABELS_AR: Record<string, string> = {
  kpi_name: "وصف المؤشر", kpi_type: "النوع", unit: "الوحدة", polarity: "القطبية", frequency: "التكرار", sector: "المنظور", objective: "الهدف",
  weight: "الوزن", baseline: "خط الأساس", annual_target: "المستهدف السنوي",
  q1_planned: "مخطط ر1", q2_planned: "مخطط ر2", q3_planned: "مخطط ر3", q4_planned: "مخطط ر4",
  total_planned: "إجمالي مخطط",
  q1_actual: "منجز ر1", q2_actual: "منجز ر2", q3_actual: "منجز ر3", q4_actual: "منجز ر4",
  total_actual: "إجمالي منجز",
  achievement_pct: "نسبة الإنجاز", overall_pct: "النسبة الكلية", final_output: "المخرج النهائي",
};

export const previewKpiUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ filePath: z.string().min(1), period: z.string().optional(), fileName: z.string().optional(), dataType: z.string().optional(), planYear: z.number().int().min(2000).max(2100).optional() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertEditor(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const XLSX = await import("xlsx");

    const { data: file, error: dlErr } = await supabaseAdmin.storage
      .from("uploads")
      .download(data.filePath);
    if (dlErr || !file) throw new Error(dlErr?.message ?? "download failed");

    const buf = new Uint8Array(await file.arrayBuffer());
    const wb = XLSX.read(buf, { type: "array" });
    const period = data.period || "all";
    const planYear = data.planYear ?? Number(String(period).match(/20\d{2}/)?.[0] ?? 2026);
    const fileName = data.fileName ?? data.filePath;
    if (isInstitutionalDataType(data.dataType ?? "") || looksLikeNetworksSheet(fileName)) {
      throw new Error("هذا الملف مصنّف كبيانات مؤسسية، وليس ملف مؤشرات أداء. ستتم معالجته دون إدخاله في جدول المؤشرات.");
    }

    const parsed: Array<Record<string, unknown>> = [];
    let rejected = 0;
    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });
      const headerIdx = findKpiHeaderRow(aoa);
      const sheetLooksKpi = headerIdx >= 0 && (isKpiDataType(data.dataType ?? "") || looksLikeKpiFile(fileName) || looksLikeKpiFile(sheetName) || hasKpiStructure(aoa));
      if (!sheetLooksKpi) continue;
      const norm = normalizeEntity(sheetName);
      const cols = kpiColumnMap(aoa, headerIdx);
      let lastSector: string | null = null;
      const rowsToParse = headerIdx >= 0 ? aoa.slice(headerIdx + 1) : aoa;
      // كشف النسبة من تنسيق خلية Excel (cell.z يحتوي %) — بديل القاعدة التلقائية ≤1×100
      const pctVal = (row: unknown[], ri: number, colIdx: number): number | null => {
        if (colIdx < 0) return null;
        const n = toNum(row[colIdx]);
        if (n === null) return null;
        const sheetRow = (headerIdx >= 0 ? headerIdx + 1 : 0) + ri;
        const cell = (ws as Record<string, { z?: string } | undefined>)[XLSX.utils.encode_cell({ r: sheetRow, c: colIdx })];
        return typeof cell?.z === "string" && cell.z.includes("%") ? n * 100 : n;
      };
      for (const [ri, row] of rowsToParse.entries()) {
        if (!Array.isArray(row)) continue;
        if (!isValidKpiRow(row, cols)) { if (row[cols.name] || row[cols.code]) rejected++; continue; }
        const code = toStr(row[cols.code]);
        const name = toStr(row[cols.name]);
        const sector = toStr(row[cols.sector]);
        if (sector) lastSector = sector;
        const rowOrg = entityFromKpiCode(code);
        const rowEntity = rowOrg ?? norm.code;
        parsed.push({
          entity_code: rowEntity,
          entity_name: rowOrg && rowOrg !== norm.code ? normalizeEntity(rowOrg).name : norm.name,
          sector: lastSector,
          objective: toStr(row[cols.objective]), kpi_code: kpiCodeWithYear(code, planYear), kpi_name: name, kpi_type: toStr(row[cols.type]),
          unit: cols.unit >= 0 ? toStr(row[cols.unit]) : null, polarity: cols.polarity >= 0 ? toStr(row[cols.polarity]) : null, frequency: cols.frequency >= 0 ? toStr(row[cols.frequency]) : null,
          plan_year: planYear, is_baseline: false, fiscal_type: ACADEMIC_ORGS.has(rowEntity) ? "academic" : "calendar",
          weight: toNum(row[cols.weight]), baseline: toNum(row[cols.baseline]), annual_target: toNum(row[cols.target]),
          q1_planned: toNum(row[cols.q1p]), q2_planned: toNum(row[cols.q2p]), q3_planned: toNum(row[cols.q3p]), q4_planned: toNum(row[cols.q4p]),
          total_planned: toNum(row[cols.totalPlanned]),
          q1_actual: toNum(row[cols.q1a]), q2_actual: toNum(row[cols.q2a]), q3_actual: toNum(row[cols.q3a]), q4_actual: toNum(row[cols.q4a]),
          total_actual: toNum(row[cols.totalActual]),
          achievement_pct: pctVal(row, ri, cols.achievement), overall_pct: pctVal(row, ri, cols.overall), final_output: toStr(row[cols.output]),
          period,
        });
      }
    }

    if (parsed.length === 0) {
      throw new Error("لم يتم العثور على قالب مؤشرات أداء داخل الملف؛ لن يتم اعتباره مؤشرات جديدة.");
    }

    const uniq = Array.from(new Map(parsed.map(r => [`${r.entity_code}__${r.kpi_code}__${r.period}`, r])).values());
    const duplicatesInFile = parsed.length - uniq.length;

    const entityCodes = Array.from(new Set(uniq.map(r => r.entity_code as string)));
    const { data: existingData, error: exErr } = await supabaseAdmin
      .from("kpis")
      .select("entity_code,kpi_code,period," + KPI_COMPARE_FIELDS.join(","))
      .in("entity_code", entityCodes.length ? entityCodes : [""])
      .eq("period", period);
    if (exErr) throw exErr;
    const existing = (existingData ?? []) as unknown as Array<Record<string, string | number | null>>;

    const exMap = new Map(
      existing.map((r) => [`${r.entity_code}__${r.kpi_code}__${r.period}`, r]),
    );

    type Scalar = string | number | null;
    const inserted: Array<{ entity_code: string; kpi_code: string; kpi_name: string }> = [];
    const updated: Array<{ entity_code: string; kpi_code: string; kpi_name: string; changes: Array<{ field: string; label: string; from: Scalar; to: Scalar }> }> = [];
    let unchanged = 0;
    const seen = new Set<string>();

    for (const row of uniq) {
      const key = `${row.entity_code}__${row.kpi_code}__${row.period}`;
      seen.add(key);
      const old = exMap.get(key);
      if (!old) {
        inserted.push({ entity_code: row.entity_code as string, kpi_code: row.kpi_code as string, kpi_name: (row.kpi_name as string) ?? "" });
        continue;
      }
      const changes: Array<{ field: string; label: string; from: Scalar; to: Scalar }> = [];
      for (const f of KPI_COMPARE_FIELDS) {
        const a = (old[f] ?? null) as Scalar;
        const b = (row[f] ?? null) as Scalar;
        if (JSON.stringify(a) !== JSON.stringify(b)) {
          changes.push({ field: f, label: FIELD_LABELS_AR[f] ?? f, from: a, to: b });
        }
      }
      if (changes.length === 0) unchanged++;
      else updated.push({ entity_code: row.entity_code as string, kpi_code: row.kpi_code as string, kpi_name: (row.kpi_name as string) ?? "", changes });
    }

    const stale = existing
      .filter((r) => !seen.has(`${r.entity_code}__${r.kpi_code}__${r.period}`))
      .map((r) => ({ entity_code: r.entity_code as string, kpi_code: r.kpi_code as string }));


    // فحص الأوزان النسبية لكل مؤسسة: كل منظور 25% والمجموع 100%
    const { validateWeights } = await import("@/lib/oid-data");
    const { perspectiveLabelOf } = await import("@/lib/oid-bsc");
    const byEntity = new Map<string, Array<Record<string, unknown>>>();
    for (const row of uniq) {
      const e = row.entity_code as string;
      if (!byEntity.has(e)) byEntity.set(e, []);
      byEntity.get(e)!.push({
        "المنظور": perspectiveLabelOf((row.sector as string) ?? null) ?? "غير مصنّف",
        "الوزن": row.weight ?? 0,
      });
    }
    const weightChecks = Array.from(byEntity.entries()).map(([entity, rows]) => {
      const v = validateWeights(rows);
      const perspectives = new Map<string, number>();
      rows.forEach((r) => {
        const n = Number(String(r["الوزن"] ?? 0));
        const w = Number.isFinite(n) ? (n > 0 && n <= 1 ? n * 100 : n) : 0;
        const key = String(r["المنظور"]);
        perspectives.set(key, (perspectives.get(key) ?? 0) + w);
      });
      return {
        entity,
        valid: v.valid,
        errors: v.errors,
        warnings: v.warnings,
        perspectives: Array.from(perspectives.entries()).map(([name, sum]) => ({ name, sum })),
      };
    });

    return {
      summary: {
        totalInFile: uniq.length,
        inserted: inserted.length,
        updated: updated.length,
        unchanged,
        rejected,
        duplicatesInFile,
        stale: stale.length,
        weightsValid: weightChecks.every((w) => w.valid),
      },
      inserted, updated, stale, weightChecks,
    };
  });


