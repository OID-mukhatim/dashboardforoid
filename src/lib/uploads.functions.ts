import { createServerFn } from "@tanstack/react-start";
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

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[,%\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}
function toStr(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/\s+/g, " ").trim();
  return s.length ? s : null;
}

// Map raw sheet/entity names (Arabic short or English variants) to canonical org IDs.
const ENTITY_ALIASES: Array<{ id: string; name: string; patterns: RegExp[] }> = [
  { id: "TAYO", name: "تيو للتعليم", patterns: [/تيو/, /tayo/i] },
  { id: "KAFI", name: "كافي للتنمية", patterns: [/كافي/, /kafi/i] },
  { id: "ZF", name: "مؤسسة زمزم", patterns: [/^\s*زمزم\s*$/, /مؤسسة\s*زمزم/, /zamzam\s*foundation/i, /^\s*zf\s*$/i] },
  { id: "ZUST", name: "جامعة زمزم للعلوم والتكنولوجيا", patterns: [/جامعة\s*زمزم/, /^\s*(ال)?جامعة\s*$/, /zust/i] },
  { id: "ZAD", name: "زاد للتنمية", patterns: [/^\s*زاد/, /\bzad\b/i] },
  { id: "HAMDI", name: "منظمة حمدي للتنمية", patterns: [/حمد[يى]/, /hamdi/i] },
];
function normalizeEntity(raw: string): { code: string; name: string } {
  const s = (raw ?? "").trim();
  for (const a of ENTITY_ALIASES) {
    if (a.patterns.some((re) => re.test(s))) return { code: a.id, name: a.name };
  }
  return { code: s, name: s };
}

// Recognise a known org from any free-text cell (used when org is in a column,
// not the sheet name — e.g. the consolidated "Networks" sheet).
function detectKnownOrg(raw: unknown): { code: string; name: string } | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  for (const a of ENTITY_ALIASES) {
    if (a.patterns.some((re) => re.test(s))) return { code: a.id, name: a.name };
  }
  return null;
}

// Classify a header (axis name) into one of the institutional matrix buckets.
type MatrixBucket = "gap" | "gov" | "fin" | "maturity" | null;
function classifyAxis(header: string): { bucket: MatrixBucket; key: string } {
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

function looksLikeNetworksSheet(name: string): boolean {
  return /شبك(ات|ة)|البيانات\s*المؤسسية|مؤسسي|institutional|networks?/i.test(name);
}

function looksLikeGapFile(name: string): boolean {
  return /فجو|gap\b|gaps?/i.test(name);
}
function looksLikeGovFile(name: string): boolean {
  return /حوكم|امتثال|سياس(ات|ة)|policies|governance|compliance/i.test(name);
}

// Textual scales used in survey-style sheets
const GOV_TEXT_SCORE: Array<[RegExp, number]> = [
  [/موجود\s*ومفعّ?ل|existing\s*and\s*activated/i, 5],
  [/موجود\s*وغير\s*مفعّ?ل|existing\s*but\s*not\s*activated/i, 3],
  [/بحاجة\s*إلى\s*تحديث|needs\s*review/i, 2],
  [/قيد\s*الإعداد|under\s*development/i, 1.5],
  [/غير\s*موجود|not\s*exist/i, 0],
];
const AGREE_TEXT_SCORE: Array<[RegExp, number]> = [
  [/موافق\s*جدًا|strongly\s*agree/i, 5],
  [/غير\s*موافق\s*(إطلاقًا|تمامًا)|strongly\s*disagree/i, 1],
  [/نسبيًا|relatively/i, 3],
  [/غير\s*موافق|disagree/i, 2],
  [/موافق|agree/i, 4],
];
function textToScore(v: unknown, table: Array<[RegExp, number]>): number | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  for (const [re, n] of table) if (re.test(s)) return n;
  return null;
}

// Normalize a domain label to one of the seven canonical OID axes.
function normDomainKey(label: string): string | null {
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
function detectProfileLayout(
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

function looksLikeKpiFile(name: string): boolean {
  return /مؤشرات\s*الأداء|مصفوفة\s*المؤشرات|مؤشر\s*الأداء|kpis?|performance\s*indicators?|balanced\s*scorecard|بطاقة\s*الأداء/i.test(name);
}

function isInstitutionalDataType(dataType: string): boolean {
  return /البيانات\s*المؤسسية|بيانات\s*الفجوات|بيانات\s*الحوكمة|التقرير\s*المالي/i.test(dataType);
}

function isKpiDataType(dataType: string): boolean {
  return /مؤشرات\s*الأداء|kpis?/i.test(dataType);
}

function findKpiHeaderRow(aoa: unknown[][]): number {
  for (let r = 0; r < Math.min(aoa.length, 25); r++) {
    const row = aoa[r] ?? [];
    const joined = row.map((cell) => toStr(cell) ?? "").join(" ");
    const fixedColumnsMatch = /مؤشر\s*الأداء|وصف\s*المؤشر/i.test(String(row[3] ?? "")) && /الكود|code|id/i.test(String(row[4] ?? ""));
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

/**
 * KPI workbooks vary: some omit the leading "م" column, some place الكود after
 * المنظور/الهدف/المؤشر, some add extra columns first. Resolve each text column
 * by its header label and anchor the numeric block on the الكود column.
 */
export type KpiCols = {
  sector: number; objective: number; name: number; code: number; type: number;
  weight: number; baseline: number; target: number;
  q1p: number; q2p: number; q3p: number; q4p: number; totalPlanned: number;
  q1a: number; q2a: number; q3a: number; q4a: number; totalActual: number;
  achievement: number; overall: number; output: number;
};

function findCol(row: unknown[], re: RegExp, exclude?: RegExp): number {
  return row.findIndex((c) => {
    const s = String(c ?? "").replace(/\s+/g, " ").trim();
    if (!s) return false;
    if (exclude && exclude.test(s)) return false;
    return re.test(s);
  });
}

export function kpiColumnMap(aoa: unknown[][], headerIdx: number): KpiCols {
  const row = (headerIdx >= 0 ? (aoa[headerIdx] ?? []) : []) as unknown[];
  const codeIdx = findCol(row, /^(الكود|code|id)\b|^الكود\b/i);
  const code = codeIdx >= 0 ? codeIdx : 4;
  const off = code - 4; // numeric block keeps its relative layout after الكود
  const at = (base: number) => base + off;
  const pick = (re: RegExp, base: number, exclude?: RegExp) => {
    const i = findCol(row, re, exclude);
    return i >= 0 ? i : at(base);
  };
  return {
    code,
    sector: pick(/^(المنظور|perspective)/i, 1),
    objective: pick(/^(الهدف|objective)/i, 2),
    name: pick(/(مؤشر\s*الأداء|وصف\s*المؤشر|^المؤشر$|indicator)/i, 3, /الكود|code/i),
    type: pick(/^(النوع|نوعه|type)/i, 5),
    weight: pick(/^(الوزن|weight)/i, 6),
    baseline: pick(/(خط\s*الأساس|baseline)/i, 7),
    target: pick(/(المستهدف\s*السنوي|annual\s*target)/i, 8),
    q1p: at(9), q2p: at(10), q3p: at(11), q4p: at(12), totalPlanned: at(13),
    q1a: at(14), q2a: at(15), q3a: at(16), q4a: at(17), totalActual: at(18),
    achievement: at(20), overall: at(21), output: at(22),
  };
}

function hasKpiStructure(aoa: unknown[][]): boolean {
  const hi = findKpiHeaderRow(aoa);
  if (hi < 0) return false;
  const cols = kpiColumnMap(aoa, hi);
  const rows = aoa.slice(hi + 1, hi + 31);
  return rows.some((row) => Array.isArray(row) && isValidKpiRow(row, cols));
}

const KPI_ROW_REJECT = /^(data|البيانات|تحليل|التحليل|جامعة|الجامعة|الربعي|ربع[يية]|الهدف|هدف|تعزيز\s*الشفافية|توسيع\s*قاعدة\s*المانحين|النتائج\s*المباشرة|نتائج\s*تقييم\s*السياسات|مؤشر\s*الأداء|الكود|الكود\s*id|المنظور)$/i;

function isValidKpiRow(row: unknown[], cols: KpiCols): boolean {
  const code = toStr(row[cols.code]);
  const name = toStr(row[cols.name]);
  if (!code || !name) return false;
  if (KPI_ROW_REJECT.test(code) || KPI_ROW_REJECT.test(name)) return false;
  if (code.length > 48 || name.length < 4) return false;
  // KPI codes are compact identifiers. Descriptive Arabic section titles with spaces are not KPI codes.
  if (!/[A-Za-z0-9٠-٩۰-۹]/.test(code) && /\s/.test(code)) return false;
  return true;
}


function spreadsheetTextPreview(aoa: unknown[][], maxRows = 20): string {
  return aoa
    .slice(0, maxRows)
    .map((row) => row.map((cell) => toStr(cell) ?? "").filter(Boolean).join(" | "))
    .filter(Boolean)
    .join("\n")
    .slice(0, 5000);
}


export const parseUpload = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ uploadId: z.string().uuid(), filePath: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const XLSX = await import("xlsx");

    const startedAt = Date.now();
    const PHASES = ["downloading", "reading_sheets", "matching", "upserting", "done"] as const;
    type Phase = typeof PHASES[number];
    const PHASE_LABELS: Record<Phase, string> = {
      downloading: "تنزيل الملف",
      reading_sheets: "قراءة الأوراق",
      matching: "مطابقة وتجهيز",
      upserting: "حفظ في قاعدة البيانات",
      done: "اكتمل",
    };
    async function setProgress(phase: Phase, percent: number, message?: string) {
      const elapsed = Date.now() - startedAt;
      const eta_ms = percent > 5 && percent < 100 ? Math.round((elapsed / percent) * (100 - percent)) : null;
      await supabaseAdmin
        .from("uploads")
        .update({
          status: phase === "done" ? "processed" : "processing",
          progress: {
            phase,
            label: PHASE_LABELS[phase],
            percent,
            message: message ?? null,
            elapsed_ms: elapsed,
            eta_ms,
            started_at: new Date(startedAt).toISOString(),
            updated_at: new Date().toISOString(),
          } as unknown as never,
        })
        .eq("id", data.uploadId);
    }

    await setProgress("downloading", 5);

    const { data: uploadRow } = await supabaseAdmin
      .from("uploads")
      .select("period, file_name, data_type, org_id")
      .eq("id", data.uploadId)
      .maybeSingle();
    const period = uploadRow?.period ?? "all";
    const originalFileName = uploadRow?.file_name ?? data.filePath;
    const selectedDataType = uploadRow?.data_type ?? "";

    const { data: file, error: dlErr } = await supabaseAdmin.storage
      .from("uploads")
      .download(data.filePath);
    if (dlErr || !file) {
      await supabaseAdmin
        .from("uploads")
        .update({ status: "error", error_message: dlErr?.message ?? "download failed", progress: null })
        .eq("id", data.uploadId);
      throw new Error(dlErr?.message ?? "download failed");
    }

    await setProgress("reading_sheets", 20);

    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      const wb = XLSX.read(buf, { type: "array" });

      const fileIsInstitutional = isInstitutionalDataType(selectedDataType) || looksLikeNetworksSheet(originalFileName) || looksLikeNetworksSheet(data.filePath);
      const fileIsKpi = isKpiDataType(selectedDataType) || looksLikeKpiFile(originalFileName) || looksLikeKpiFile(data.filePath);
      const fileIsGap = looksLikeGapFile(originalFileName) || looksLikeGapFile(data.filePath);
      const fileIsGov = looksLikeGovFile(originalFileName) || looksLikeGovFile(data.filePath);

      let lastSector: string | null = null;
      const kpiRows: Array<Record<string, unknown>> = [];
      const sheetsSummary: Array<{ name: string; rows: number; kpis: number; matrix?: number; skipped?: boolean; reason?: string }> = [];
      const matrixRows: Array<Record<string, unknown>> = [];
      const spreadsheetExtracts: Array<Record<string, unknown>> = [];
      const quarterlyRows: Array<Record<string, unknown>> = [];

      // Per-org accumulator for Gaps/Governance template files.
      // Merged into matrixRows after the per-sheet loop.
      type OrgAccum = {
        name: string;
        gapDomain: Record<string, number[]>; // canonical domain → samples (0..5)
        gapOverall: number[]; // overall gap samples (when only a single avg is available)
        govSamples: number[];
        sources: Set<string>;
      };
      const orgAccum: Record<string, OrgAccum> = {};
      const ensureOrg = (code: string, name: string): OrgAccum => {
        if (!orgAccum[code]) orgAccum[code] = { name, gapDomain: {}, gapOverall: [], govSamples: [], sources: new Set() };
        return orgAccum[code];
      };


      const totalSheets = wb.SheetNames.length;
      for (let si = 0; si < totalSheets; si++) {
        const sheetName = wb.SheetNames[si];
        const ws = wb.Sheets[sheetName];
        const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });
        const normalized = normalizeEntity(sheetName);
        const entityCode = normalized.code;
        const entityName = normalized.name;
        let kpiCount = 0;
        let matrixCount = 0;
        lastSector = null;
        const kpiHeaderIdx = findKpiHeaderRow(aoa);
        const sheetLooksKpi = kpiHeaderIdx >= 0 && (fileIsKpi || looksLikeKpiFile(sheetName) || hasKpiStructure(aoa));

        // ── Gaps / Governance template branch ────────────────────────────────
        // Handles three layouts found in OID Gaps & Governance workbooks:
        //  A) "Domain report": sections headed by "محور …" then a header row
        //     containing "الجهة" and ending with "متوسط المحور".
        //  B) "Org-columns matrix": row with ≥3 known orgs as column headers
        //     and criterion labels in the leftmost label column (numeric or
        //     textual cell values).
        //  C) "Org-rows survey" (Form1): each data row is one org response
        //     with a long series of textual answers.
        if (fileIsGap || fileIsGov) {
          let consumed = false;
          let consumedRows = 0;

          // (A) Domain-section layout — taqreer "البيانات".
          for (let r = 0; r < aoa.length; r++) {
            const row = aoa[r];
            if (!Array.isArray(row)) continue;
            const first = toStr(row[0]) ?? "";
            const second = toStr(row[1]) ?? "";
            // Section title cell ("محور …") sitting alone in column A.
            const titleCell = first || second;
            if (!/^محور\s+/.test(titleCell)) continue;
            const domain = normDomainKey(titleCell);
            if (!domain) continue;
            // Find next header row containing "الجهة" with an average column.
            let hdr = -1;
            for (let h = r + 1; h < Math.min(r + 4, aoa.length); h++) {
              const hr = aoa[h];
              if (!Array.isArray(hr)) continue;
              if (hr.some((v) => /الجهة|المؤسسة/.test(String(v ?? "")))) { hdr = h; break; }
            }
            if (hdr < 0) continue;
            const hdrRow = aoa[hdr] as unknown[];
            const avgIdx = hdrRow.findIndex((v) => /متوسط\s*المحور|average/i.test(String(v ?? "")));
            const orgIdx = hdrRow.findIndex((v) => /الجهة|المؤسسة|entity|organization/i.test(String(v ?? "")));
            for (let d = hdr + 1; d < aoa.length; d++) {
              const dr = aoa[d];
              if (!Array.isArray(dr)) break;
              const orgCell = orgIdx >= 0 ? dr[orgIdx] : dr[1];
              const org = detectKnownOrg(orgCell);
              if (!org) {
                // Stop when we hit the next section header.
                if (typeof orgCell === "string" && /^محور\s+/.test(orgCell)) break;
                if (dr.every((v) => v === null || v === undefined || String(v).trim() === "")) break;
                continue;
              }
              let avg: number | null = null;
              if (avgIdx >= 0) avg = toNum(dr[avgIdx]);
              if (avg === null) {
                // Compute from criterion columns (numeric cells between org and end).
                const nums: number[] = [];
                for (let c = (orgIdx >= 0 ? orgIdx + 1 : 2); c < dr.length; c++) {
                  const n = toNum(dr[c]);
                  if (n !== null && n <= 5) nums.push(n);
                }
                if (nums.length) avg = nums.reduce((a, b) => a + b, 0) / nums.length;
              }
              if (avg === null) continue;
              const acc = ensureOrg(org.code, org.name);
              acc.sources.add(sheetName);
              (acc.gapDomain[domain] ??= []).push(avg);
              if (domain === "الحوكمة والامتثال") acc.govSamples.push(avg);
              consumedRows += 1;
            }
            consumed = true;
          }

          // (B) Orgs-as-columns criterion matrix — bayanat "تقرير مفصل"/
          //     "النتائج المباشرة" or taqreer "نتائج تقييم السياسات".
          if (!consumed) {
            for (let r = 0; r < Math.min(aoa.length, 12); r++) {
              const row = aoa[r];
              if (!Array.isArray(row)) continue;
              const orgCols: Array<{ idx: number; code: string; name: string }> = [];
              const seen = new Set<string>();
              for (let c = 0; c < row.length; c++) {
                const hit = detectKnownOrg(row[c]);
                if (hit && !seen.has(hit.code)) { seen.add(hit.code); orgCols.push({ idx: c, ...hit }); }
              }
              if (orgCols.length < 3) continue;
              // Accumulate per-org averages over subsequent criterion rows.
              const perOrg: Record<string, number[]> = {};
              for (const o of orgCols) perOrg[o.code] = [];
              for (let d = r + 1; d < aoa.length; d++) {
                const dr = aoa[d];
                if (!Array.isArray(dr)) continue;
                if (dr.every((v) => v === null || v === undefined || String(v).trim() === "")) continue;
                for (const o of orgCols) {
                  const raw = dr[o.idx];
                  let v = toNum(raw);
                  if (v === null) v = textToScore(raw, GOV_TEXT_SCORE) ?? textToScore(raw, AGREE_TEXT_SCORE);
                  if (v === null) continue;
                  if (v > 5) v = Math.max(0, Math.min(5, v / 20));
                  perOrg[o.code].push(v);
                }
              }
              let anyCaptured = false;
              for (const o of orgCols) {
                const vs = perOrg[o.code];
                if (!vs.length) continue;
                const avg = vs.reduce((a, b) => a + b, 0) / vs.length;
                const acc = ensureOrg(o.code, o.name);
                acc.sources.add(sheetName);
                if (fileIsGov) acc.govSamples.push(avg);
                else acc.gapOverall.push(avg);
                anyCaptured = true;
                consumedRows += 1;
              }
              if (anyCaptured) { consumed = true; break; }
            }
          }

          // (C) Orgs-as-rows survey form (Form1) — each row is one respondent.
          if (!consumed) {
            // Find the org-name column in the first 4 rows.
            for (let r = 0; r < Math.min(aoa.length, 4); r++) {
              const row = aoa[r];
              if (!Array.isArray(row)) continue;
              const orgColIdx = row.findIndex((v) => /اسم\s*المؤسسة|entity\s*name|organization\s*name/i.test(String(v ?? "")));
              if (orgColIdx < 0) continue;
              const scaleTable = fileIsGov ? GOV_TEXT_SCORE : AGREE_TEXT_SCORE;
              for (let d = r + 1; d < aoa.length; d++) {
                const dr = aoa[d];
                if (!Array.isArray(dr)) continue;
                const org = detectKnownOrg(dr[orgColIdx]);
                if (!org) continue;
                const vals: number[] = [];
                for (let c = orgColIdx + 1; c < dr.length; c++) {
                  const v = textToScore(dr[c], scaleTable);
                  if (v !== null) vals.push(v);
                }
                if (!vals.length) continue;
                const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
                const acc = ensureOrg(org.code, org.name);
                acc.sources.add(sheetName);
                if (fileIsGov) acc.govSamples.push(avg);
                else acc.gapOverall.push(avg);
                consumedRows += 1;
              }
              if (consumedRows > 0) { consumed = true; break; }
            }
          }

          if (consumed) {
            sheetsSummary.push({ name: sheetName, rows: aoa.length, kpis: 0, matrix: consumedRows });
            const sheetPct = 20 + Math.round(((si + 1) / totalSheets) * 30);
            await setProgress("reading_sheets", sheetPct, `ورقة ${si + 1}/${totalSheets}: ${sheetName} (${fileIsGov ? "حوكمة" : "فجوات"})`);
            continue;
          }
        }


        // ── Profile layout branch (نموذج 1 — orgs as columns, fields as rows) ──
        if (fileIsInstitutional || looksLikeNetworksSheet(sheetName)) {
          const profile = detectProfileLayout(aoa);
          if (profile) {
            const perOrg: Record<string, Record<string, string>> = {};
            const orgNames: Record<string, string> = {};
            for (const o of profile.orgCols) { perOrg[o.code] = {}; orgNames[o.code] = o.name; }
            let currentSection: string | null = null;
            for (let r = profile.headerIdx + 1; r < aoa.length; r++) {
              const row = aoa[r];
              if (!Array.isArray(row)) continue;
              const label = toStr(row[1]) ?? toStr(row[0]);
              if (!label) continue;
              const numCol = toStr(row[0]) ?? "";
              const isSection = numCol === "#" || profile.orgCols.every((o) => {
                const v = row[o.idx];
                return v === null || v === undefined || String(v).trim() === "";
              });
              if (isSection && numCol === "#") { currentSection = label; continue; }
              for (const o of profile.orgCols) {
                const v = row[o.idx];
                if (v === null || v === undefined) continue;
                const str = v instanceof Date
                  ? v.toISOString().slice(0, 10)
                  : String(v).replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
                if (!str) continue;
                const key = currentSection ? `${currentSection} › ${label}` : label;
                perOrg[o.code][key] = str;
              }
            }
            let saved = 0;
            for (const o of profile.orgCols) {
              const fields = perOrg[o.code];
              const count = Object.keys(fields).length;
              if (count === 0) continue;
              matrixRows.push({
                upload_id: data.uploadId,
                kind: "institutional_profile",
                entity_code: o.code,
                file_path: data.filePath,
                file_name: originalFileName,
                payload: { fields, source_sheet: sheetName, field_count: count } as unknown as never,
                summary: `ملف مؤسسي — ${o.name} (${count} حقل)`,
                org_mentions: [o.code] as unknown as never,
                entities: [{ code: o.code, name: o.name }] as unknown as never,
                numbers_found: [] as unknown as never,
              });
              saved += 1;
              matrixCount += 1;
            }
            if (saved > 0) {
              sheetsSummary.push({ name: sheetName, rows: aoa.length, kpis: 0, matrix: saved });
              const sheetPct = 20 + Math.round(((si + 1) / totalSheets) * 30);
              await setProgress("reading_sheets", sheetPct, `ورقة ${si + 1}/${totalSheets}: ${sheetName} (ملفات مؤسسية: ${saved})`);
              continue;
            }
          }
        }

        // ── Institutional matrix branch (Networks/الشبكات consolidated sheet) ──
        // Detects: org name in any early column + axis headers in remaining columns.
        if (fileIsInstitutional || looksLikeNetworksSheet(sheetName)) {
          // Find the header row: the first row that contains at least one axis we can classify.

          let headerIdx = -1;
          let headerCols: { idx: number; bucket: MatrixBucket; key: string }[] = [];
          let orgColIdx = -1;
          for (let r = 0; r < Math.min(aoa.length, 15); r++) {
            const row = aoa[r];
            if (!Array.isArray(row)) continue;
            const classified = row.map((cell, idx) => ({ idx, ...classifyAxis(toStr(cell) ?? "") }));
            const axes = classified.filter((c) => c.bucket !== null);
            if (axes.length >= 3) {
              headerIdx = r;
              headerCols = axes;
              // Org column is the first non-empty, non-axis text column.
              for (let c = 0; c < row.length; c++) {
                if (axes.some((a) => a.idx === c)) continue;
                const t = toStr(row[c]) ?? "";
                if (/مؤسسة|الكيان|المنظمة|entity|organization|اسم/i.test(t)) { orgColIdx = c; break; }
              }
              if (orgColIdx < 0) orgColIdx = 0;
              break;
            }
          }

          if (headerIdx >= 0) {
            for (let r = headerIdx + 1; r < aoa.length; r++) {
              const row = aoa[r];
              if (!Array.isArray(row)) continue;
              // Try the candidate org cell first, then scan any cell for a known org.
              let org = detectKnownOrg(row[orgColIdx]);
              if (!org) {
                for (const cell of row) {
                  const hit = detectKnownOrg(cell);
                  if (hit) { org = hit; break; }
                }
              }
              if (!org) continue;

              const payload: { gaps: Record<string, number>; gov?: number; fin?: number; maturity?: number } = { gaps: {} };
              for (const h of headerCols) {
                const raw = toNum(row[h.idx]);
                if (raw === null) continue;
                // Normalise to 0..5 scale (accept percentages too).
                const score = raw > 5 ? Math.max(0, Math.min(5, raw / 20)) : raw;
                if (h.bucket === "gap") payload.gaps[h.key] = score;
                else if (h.bucket === "gov") payload.gov = score;
                else if (h.bucket === "fin") payload.fin = score;
                else if (h.bucket === "maturity") payload.maturity = Math.round(raw);
              }
              if (Object.keys(payload.gaps).length === 0 && payload.gov == null && payload.fin == null && payload.maturity == null) continue;

              matrixRows.push({
                upload_id: data.uploadId,
                kind: "institutional_matrix",
                entity_code: org.code,
                file_path: data.filePath,
                file_name: originalFileName,
                payload: payload as unknown as never,
                summary: `مصفوفة مؤسسية — ${org.name}`,
                org_mentions: [org.code] as unknown as never,
                entities: [{ code: org.code, name: org.name }] as unknown as never,
                numbers_found: [] as unknown as never,
              });
              matrixCount += 1;
            }
          }
          if (matrixCount === 0) {
            const preview = spreadsheetTextPreview(aoa);
            if (preview) {
              spreadsheetExtracts.push({
                upload_id: data.uploadId,
                kind: "institutional_spreadsheet",
                entity_code: uploadRow?.org_id && uploadRow.org_id !== "الكل" ? uploadRow.org_id : null,
                file_path: data.filePath,
                file_name: originalFileName,
                text_preview: preview,
                payload: { sheet_name: sheetName, rows: aoa.length, selected_data_type: selectedDataType } as unknown as never,
                summary: `بيانات مؤسسية جدولية — ${sheetName}`,
                org_mentions: [] as unknown as never,
                entities: [] as unknown as never,
                numbers_found: [] as unknown as never,
              });
            }
          }
          sheetsSummary.push({ name: sheetName, rows: aoa.length, kpis: 0, matrix: matrixCount, skipped: matrixCount === 0, reason: matrixCount === 0 ? "بيانات مؤسسية غير مطابقة لقالب المصفوفة" : undefined });
          const sheetPct = 20 + Math.round(((si + 1) / totalSheets) * 30);
          await setProgress("reading_sheets", sheetPct, `ورقة ${si + 1}/${totalSheets}: ${sheetName} (مصفوفة مؤسسية)`);
          continue;
        }

        // ── قالب التقرير الربعي ──────────────────────────────────────────────
        {
          const qr = parseQuarterlySheet(aoa);
          if (qr) {
            const orgHit = detectKnownOrg(qr.orgName ?? "") ?? detectKnownOrg(originalFileName);
            const yearMatch = (originalFileName + " " + data.filePath).match(/20\d{2}/);
            const quarterMatch = qr.quarter ?? ((originalFileName + " " + data.filePath).match(/Q[1-4]/i)?.[0]?.toUpperCase() ?? null);
            quarterlyRows.push({
              upload_id: data.uploadId,
              kind: "quarterly_report",
              entity_code: orgHit?.code ?? null,
              file_path: data.filePath,
              file_name: originalFileName,
              text_preview: spreadsheetTextPreview(aoa),
              payload: {
                ...qr,
                quarter: quarterMatch,
                year: yearMatch ? Number(yearMatch[0]) : null,
                org_code: orgHit?.code ?? null,
                sheet_name: sheetName,
              } as unknown as never,
              summary: `تقرير ربعي — ${orgHit?.name ?? qr.orgName ?? originalFileName} (${quarterMatch ?? "?"})`,
              org_mentions: (orgHit ? [orgHit.code] : []) as unknown as never,
              entities: (orgHit ? [{ code: orgHit.code, name: orgHit.name }] : []) as unknown as never,
              numbers_found: [] as unknown as never,
            });
            sheetsSummary.push({
              name: sheetName,
              rows: aoa.length,
              kpis: 0,
              reason: `تقرير ربعي: ${qr.achievements.length} إنجاز، ${qr.events.length} فعالية، ${qr.challenges.length} تحدٍ، ${qr.recommendations.length} توصية`,
            });
            const sheetPct = 20 + Math.round(((si + 1) / totalSheets) * 30);
            await setProgress("reading_sheets", sheetPct, `ورقة ${si + 1}/${totalSheets}: ${sheetName} (تقرير ربعي)`);
            continue;
          }
        }


        if (!sheetLooksKpi) {
          const preview = spreadsheetTextPreview(aoa);
          if (preview) {
            spreadsheetExtracts.push({
              upload_id: data.uploadId,
              kind: "spreadsheet_data",
              entity_code: uploadRow?.org_id && uploadRow.org_id !== "الكل" ? uploadRow.org_id : null,
              file_path: data.filePath,
              file_name: originalFileName,
              text_preview: preview,
              payload: { sheet_name: sheetName, rows: aoa.length, selected_data_type: selectedDataType } as unknown as never,
              summary: `بيانات جدولية غير مصنفة كمؤشرات — ${sheetName}`,
              org_mentions: [] as unknown as never,
              entities: [] as unknown as never,
              numbers_found: [] as unknown as never,
            });
          }
          sheetsSummary.push({ name: sheetName, rows: aoa.length, kpis: 0, skipped: true, reason: "ليست قالب مؤشرات أداء" });
          const sheetPct = 20 + Math.round(((si + 1) / totalSheets) * 30);
          await setProgress("reading_sheets", sheetPct, `ورقة ${si + 1}/${totalSheets}: ${sheetName} (ليست مؤشرات)`);
          continue;
        }

        const off = kpiColumnOffset(aoa, kpiHeaderIdx);
        const rowsToParse = kpiHeaderIdx >= 0 ? aoa.slice(kpiHeaderIdx + 1) : aoa;
        for (const row of rowsToParse) {
          if (!Array.isArray(row)) continue;
          if (!isValidKpiRow(row, off)) continue;
          const code = toStr(row[4 + off]);
          const name = toStr(row[3 + off]);

          const sector = toStr(row[1 + off]);
          if (sector) lastSector = sector;

          const rowOrg = entityFromKpiCode(code);
          kpiRows.push({
            upload_id: data.uploadId,
            entity_code: rowOrg ?? entityCode,
            entity_name: rowOrg && rowOrg !== entityCode ? normalizeEntity(rowOrg).name : entityName,
            sector: lastSector,
            objective: toStr(row[2 + off]),
            kpi_code: code,
            kpi_name: name,
            kpi_type: toStr(row[5 + off]),
            weight: toNum(row[6 + off]),
            baseline: toNum(row[7 + off]),
            annual_target: toNum(row[8 + off]),
            q1_planned: toNum(row[9 + off]),
            q2_planned: toNum(row[10 + off]),
            q3_planned: toNum(row[11 + off]),
            q4_planned: toNum(row[12 + off]),
            total_planned: toNum(row[13 + off]),
            q1_actual: toNum(row[14 + off]),
            q2_actual: toNum(row[15 + off]),
            q3_actual: toNum(row[16 + off]),
            q4_actual: toNum(row[17 + off]),
            total_actual: toNum(row[18 + off]),
            achievement_pct: toNum(row[20 + off]),
            overall_pct: toNum(row[21 + off]),
            final_output: toStr(row[22 + off]),
            period,
            raw: { row } as unknown as never,
          });
          kpiCount += 1;
        }
        sheetsSummary.push({ name: sheetName, rows: aoa.length, kpis: kpiCount });
        const sheetPct = 20 + Math.round(((si + 1) / totalSheets) * 30); // 20→50
        await setProgress("reading_sheets", sheetPct, `ورقة ${si + 1}/${totalSheets}: ${sheetName}`);
      }

      // Flush Gap/Governance accumulator into institutional_matrix rows.
      const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
      for (const [code, acc] of Object.entries(orgAccum)) {
        const gaps: Record<string, number> = {};
        for (const [domain, samples] of Object.entries(acc.gapDomain)) {
          if (samples.length) gaps[domain] = Math.round(avg(samples) * 100) / 100;
        }
        if (acc.gapOverall.length) {
          gaps["متوسط عام"] = Math.round(avg(acc.gapOverall) * 100) / 100;
        }
        const payload: { gaps: Record<string, number>; gov?: number; fin?: number } = { gaps };
        if (acc.govSamples.length) payload.gov = Math.round(avg(acc.govSamples) * 100) / 100;
        if (gaps["الاستدامة المالية"] != null) payload.fin = gaps["الاستدامة المالية"];
        if (Object.keys(gaps).length === 0 && payload.gov == null) continue;
        matrixRows.push({
          upload_id: data.uploadId,
          kind: "institutional_matrix",
          entity_code: code,
          file_path: data.filePath,
          file_name: originalFileName,
          payload: payload as unknown as never,
          summary: `${fileIsGov ? "حوكمة" : "فجوات"} — ${acc.name}`,
          org_mentions: [code] as unknown as never,
          entities: [{ code, name: acc.name }] as unknown as never,
          numbers_found: [] as unknown as never,
        });
      }


      // Reprocessing must remove stale derived rows from the same upload first.
      await supabaseAdmin.from("kpis").delete().eq("upload_id", data.uploadId);
      await supabaseAdmin.from("document_extractions").delete().eq("upload_id", data.uploadId);

      // Persist institutional matrix rows (replace previous for same upload).
      if (matrixRows.length) {
        const { error: mErr } = await supabaseAdmin
          .from("document_extractions")
          .insert(matrixRows as never);
        if (mErr) throw mErr;
      }

      if (quarterlyRows.length) {
        const { error: qErr } = await supabaseAdmin
          .from("document_extractions")
          .insert(quarterlyRows as never);
        if (qErr) throw qErr;
      }

      if (spreadsheetExtracts.length) {
        const { error: sErr } = await supabaseAdmin
          .from("document_extractions")
          .insert(spreadsheetExtracts as never);
        if (sErr) throw sErr;
      }


      await setProgress("matching", 55, kpiRows.length ? `${kpiRows.length} صف للمطابقة` : "لا توجد صفوف مؤشرات مطابقة");

      const uniqueRows = Array.from(
        new Map(
          kpiRows.map((row) => [JSON.stringify([row.entity_code, row.kpi_code, row.period]), row]),
        ).values(),
      );
      const duplicateCount = kpiRows.length - uniqueRows.length;

      await setProgress("upserting", 60, `${uniqueRows.length} مؤشر فريد`);

      let upserted = 0;
      const chunk = 200;
      const totalChunks = Math.max(1, Math.ceil(uniqueRows.length / chunk));
      for (let i = 0; i < uniqueRows.length; i += chunk) {
        const slice = uniqueRows.slice(i, i + chunk);
        const { error } = await supabaseAdmin
          .from("kpis")
          .upsert(slice as never, { onConflict: "entity_code,kpi_code,period" });
        if (error) throw error;
        upserted += slice.length;
        const chunkIdx = Math.floor(i / chunk) + 1;
        const pct = 60 + Math.round((chunkIdx / totalChunks) * 38); // 60→98
        await setProgress("upserting", pct, `دفعة ${chunkIdx}/${totalChunks} (${upserted}/${uniqueRows.length})`);
      }

      await supabaseAdmin
        .from("uploads")
        .update({
          status: "processed",
          rows_extracted: upserted || matrixRows.length || quarterlyRows.length || spreadsheetExtracts.length,
          extracted_summary: {
            sheets: sheetsSummary,
            quarterly_reports: quarterlyRows.length,
            classification: quarterlyRows.length ? "quarterly_report" : matrixRows.length ? "institutional_matrix" : kpiRows.length ? "kpi" : fileIsInstitutional ? "institutional_spreadsheet" : "spreadsheet_data",
            selected_data_type: selectedDataType,
            matrix_rows: matrixRows.length,
            spreadsheet_extractions: spreadsheetExtracts.length,
            kpis_read: kpiRows.length,
            kpis_upserted: upserted,
            duplicates_merged: duplicateCount,
          } as unknown as never,
          error_message: null,
          progress: {
            phase: "done",
            label: PHASE_LABELS.done,
            percent: 100,
            elapsed_ms: Date.now() - startedAt,
            eta_ms: 0,
            started_at: new Date(startedAt).toISOString(),
            updated_at: new Date().toISOString(),
          } as unknown as never,
        })
        .eq("id", data.uploadId);

      return { ok: true, upserted, sheets: sheetsSummary };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await supabaseAdmin
        .from("uploads")
        .update({ status: "error", error_message: msg, progress: null })
        .eq("id", data.uploadId);
      throw e;
    }
  });

// Delete one or more uploads — removes storage objects, related kpis/extractions, and the upload row.
export const deleteUploads = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ uploadIds: z.array(z.string().uuid()).min(1) }).parse(input))
  .handler(async ({ data }) => {
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
  .inputValidator((input) => z.object({ uploadId: z.string().uuid(), filePath: z.string().min(1) }).parse(input))
  .handler(async ({ data }) => {
    const ext = data.filePath.split(".").pop()?.toLowerCase() || "";
    if (ext === "xlsx" || ext === "xls" || ext === "csv") {
      return parseUpload({ data });
    }
    // Word, PowerPoint, PDF → document extractor (call the server-only helper
    // directly; routing through another server fn's RPC stub breaks the
    // TanStack worker manifest and yields "Server function info not found").
    const { runDocumentExtraction } = await import("./documents-core.server");
    return runDocumentExtraction(data.uploadId, data.filePath);

  });

// Preview an Excel KPI upload without writing: returns diff vs existing DB rows.
const KPI_COMPARE_FIELDS = [
  "kpi_name", "kpi_type", "sector", "objective",
  "weight", "baseline", "annual_target",
  "q1_planned", "q2_planned", "q3_planned", "q4_planned", "total_planned",
  "q1_actual", "q2_actual", "q3_actual", "q4_actual", "total_actual",
  "achievement_pct", "overall_pct", "final_output",
] as const;

const FIELD_LABELS_AR: Record<string, string> = {
  kpi_name: "وصف المؤشر", kpi_type: "النوع", sector: "المنظور", objective: "الهدف",
  weight: "الوزن", baseline: "خط الأساس", annual_target: "المستهدف السنوي",
  q1_planned: "مخطط ر1", q2_planned: "مخطط ر2", q3_planned: "مخطط ر3", q4_planned: "مخطط ر4",
  total_planned: "إجمالي مخطط",
  q1_actual: "منجز ر1", q2_actual: "منجز ر2", q3_actual: "منجز ر3", q4_actual: "منجز ر4",
  total_actual: "إجمالي منجز",
  achievement_pct: "نسبة الإنجاز", overall_pct: "النسبة الكلية", final_output: "المخرج النهائي",
};

export const previewKpiUpload = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ filePath: z.string().min(1), period: z.string().optional(), fileName: z.string().optional(), dataType: z.string().optional() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const XLSX = await import("xlsx");

    const { data: file, error: dlErr } = await supabaseAdmin.storage
      .from("uploads")
      .download(data.filePath);
    if (dlErr || !file) throw new Error(dlErr?.message ?? "download failed");

    const buf = new Uint8Array(await file.arrayBuffer());
    const wb = XLSX.read(buf, { type: "array" });
    const period = data.period || "all";
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
      const off = kpiColumnOffset(aoa, headerIdx);
      let lastSector: string | null = null;
      const rowsToParse = headerIdx >= 0 ? aoa.slice(headerIdx + 1) : aoa;
      for (const row of rowsToParse) {
        if (!Array.isArray(row)) continue;
        if (!isValidKpiRow(row, off)) { if (row[3 + off] || row[4 + off]) rejected++; continue; }
        const code = toStr(row[4 + off]);
        const name = toStr(row[3 + off]);
        const sector = toStr(row[1 + off]);
        if (sector) lastSector = sector;
        const rowOrg = entityFromKpiCode(code);
        parsed.push({
          entity_code: rowOrg ?? norm.code,
          entity_name: rowOrg && rowOrg !== norm.code ? normalizeEntity(rowOrg).name : norm.name,
          sector: lastSector,
          objective: toStr(row[2 + off]), kpi_code: code, kpi_name: name, kpi_type: toStr(row[5 + off]),
          weight: toNum(row[6 + off]), baseline: toNum(row[7 + off]), annual_target: toNum(row[8 + off]),
          q1_planned: toNum(row[9 + off]), q2_planned: toNum(row[10 + off]), q3_planned: toNum(row[11 + off]), q4_planned: toNum(row[12 + off]),
          total_planned: toNum(row[13 + off]),
          q1_actual: toNum(row[14 + off]), q2_actual: toNum(row[15 + off]), q3_actual: toNum(row[16 + off]), q4_actual: toNum(row[17 + off]),
          total_actual: toNum(row[18 + off]),
          achievement_pct: toNum(row[20 + off]), overall_pct: toNum(row[21 + off]), final_output: toStr(row[22 + off]),
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


    return {
      summary: {
        totalInFile: uniq.length,
        inserted: inserted.length,
        updated: updated.length,
        unchanged,
        rejected,
        duplicatesInFile,
        stale: stale.length,
      },
      inserted, updated, stale,
    };
  });


