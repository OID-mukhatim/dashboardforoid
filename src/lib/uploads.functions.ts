import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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
  { id: "ZUST", name: "جامعة زمزم للعلوم والتكنولوجيا", patterns: [/جامعة\s*زمزم/, /zust/i] },
  { id: "ZAD", name: "زاد للتنمية", patterns: [/^\s*زاد/, /\bzad\b/i] },
  { id: "HAMDI", name: "منظمة حمدي للتنمية", patterns: [/حمدي/, /hamdi/i] },
];
function normalizeEntity(raw: string): { code: string; name: string } {
  const s = (raw ?? "").trim();
  for (const a of ENTITY_ALIASES) {
    if (a.patterns.some((re) => re.test(s))) return { code: a.id, name: a.name };
  }
  return { code: s, name: s };
}


export const parseUpload = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ uploadId: z.string().uuid(), filePath: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const XLSX = await import("xlsx");

    const { data: uploadRow } = await supabaseAdmin
      .from("uploads")
      .select("period")
      .eq("id", data.uploadId)
      .maybeSingle();
    const period = uploadRow?.period ?? "all";

    const { data: file, error: dlErr } = await supabaseAdmin.storage
      .from("uploads")
      .download(data.filePath);
    if (dlErr || !file) {
      await supabaseAdmin
        .from("uploads")
        .update({ status: "error", error_message: dlErr?.message ?? "download failed" })
        .eq("id", data.uploadId);
      throw new Error(dlErr?.message ?? "download failed");
    }

    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      const wb = XLSX.read(buf, { type: "array" });

      let lastSector: string | null = null;
      const kpiRows: Array<Record<string, unknown>> = [];
      const sheetsSummary: Array<{ name: string; rows: number; kpis: number }> = [];

      for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });
        const normalized = normalizeEntity(sheetName);
        const entityCode = normalized.code;
        const entityName = normalized.name;
        let kpiCount = 0;
        lastSector = null;

        for (const row of aoa) {
          if (!Array.isArray(row)) continue;
          const code = toStr(row[4]);
          const name = toStr(row[3]);
          // skip header / non-data rows
          if (!code || !name) continue;
          if (code === "الكود ID" || code === "الكود") continue;

          const sector = toStr(row[1]);
          if (sector) lastSector = sector;

          kpiRows.push({
            upload_id: data.uploadId,
            entity_code: entityCode,
            entity_name: entityName,
            sector: lastSector,
            objective: toStr(row[2]),
            kpi_code: code,
            kpi_name: name,
            kpi_type: toStr(row[5]),
            weight: toNum(row[6]),
            baseline: toNum(row[7]),
            annual_target: toNum(row[8]),
            q1_planned: toNum(row[9]),
            q2_planned: toNum(row[10]),
            q3_planned: toNum(row[11]),
            q4_planned: toNum(row[12]),
            total_planned: toNum(row[13]),
            q1_actual: toNum(row[14]),
            q2_actual: toNum(row[15]),
            q3_actual: toNum(row[16]),
            q4_actual: toNum(row[17]),
            total_actual: toNum(row[18]),
            achievement_pct: toNum(row[20]),
            overall_pct: toNum(row[21]),
            final_output: toStr(row[22]),
            period,
            raw: { row } as unknown as never,
          });
          kpiCount += 1;
        }
        sheetsSummary.push({ name: sheetName, rows: aoa.length, kpis: kpiCount });
      }

      // Deduplicate within the same file before upsert. PostgreSQL cannot update the
      // same conflict key twice in one INSERT statement; the latest row in the file wins.
      const uniqueRows = Array.from(
        new Map(
          kpiRows.map((row) => [JSON.stringify([row.entity_code, row.kpi_code, row.period]), row]),
        ).values(),
      );
      const duplicateCount = kpiRows.length - uniqueRows.length;

      // Upsert in chunks on (entity_code, kpi_code, period) — re-uploads update existing rows.
      let upserted = 0;
      const chunk = 200;
      for (let i = 0; i < uniqueRows.length; i += chunk) {
        const slice = uniqueRows.slice(i, i + chunk);
        const { error } = await supabaseAdmin
          .from("kpis")
          .upsert(slice as never, { onConflict: "entity_code,kpi_code,period" });
        if (error) throw error;
        upserted += slice.length;
      }

      await supabaseAdmin
        .from("uploads")
        .update({
          status: "processed",
          rows_extracted: upserted,
          extracted_summary: {
            sheets: sheetsSummary,
            kpis_read: kpiRows.length,
            kpis_upserted: upserted,
            duplicates_merged: duplicateCount,
          } as unknown as never,
          error_message: null,
        })
        .eq("id", data.uploadId);

      return { ok: true, upserted, sheets: sheetsSummary };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await supabaseAdmin
        .from("uploads")
        .update({ status: "error", error_message: msg })
        .eq("id", data.uploadId);
      throw e;
    }
  });

// Route an upload to the correct parser based on file extension
export const processUpload = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ uploadId: z.string().uuid(), filePath: z.string().min(1) }).parse(input))
  .handler(async ({ data }) => {
    const ext = data.filePath.split(".").pop()?.toLowerCase() || "";
    if (ext === "xlsx" || ext === "xls" || ext === "csv") {
      return parseUpload({ data });
    }
    // Word, PowerPoint, PDF → document extractor
    const { extractDocument } = await import("./documents.functions");
    return extractDocument({ data });
  });

// Re-run parsing for an existing upload (manual refresh)
export const reprocessUpload = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ uploadId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("uploads")
      .select("id,file_path")
      .eq("id", data.uploadId)
      .single();
    if (error || !row) throw new Error(error?.message ?? "upload not found");
    const result = await processUpload({ data: { uploadId: row.id, filePath: row.file_path } });
    return result;
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
  .inputValidator((input) => z.object({ filePath: z.string().min(1), period: z.string().optional() }).parse(input))
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

    const parsed: Array<Record<string, unknown>> = [];
    let rejected = 0;
    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });
      const norm = normalizeEntity(sheetName);
      let lastSector: string | null = null;
      for (const row of aoa) {
        if (!Array.isArray(row)) continue;
        const code = toStr(row[4]);
        const name = toStr(row[3]);
        if (!code || !name) { if (row[3] || row[4]) rejected++; continue; }
        if (code === "الكود ID" || code === "الكود") continue;
        const sector = toStr(row[1]);
        if (sector) lastSector = sector;
        parsed.push({
          entity_code: norm.code, entity_name: norm.name, sector: lastSector,
          objective: toStr(row[2]), kpi_code: code, kpi_name: name, kpi_type: toStr(row[5]),
          weight: toNum(row[6]), baseline: toNum(row[7]), annual_target: toNum(row[8]),
          q1_planned: toNum(row[9]), q2_planned: toNum(row[10]), q3_planned: toNum(row[11]), q4_planned: toNum(row[12]),
          total_planned: toNum(row[13]),
          q1_actual: toNum(row[14]), q2_actual: toNum(row[15]), q3_actual: toNum(row[16]), q4_actual: toNum(row[17]),
          total_actual: toNum(row[18]),
          achievement_pct: toNum(row[20]), overall_pct: toNum(row[21]), final_output: toStr(row[22]),
          period,
        });
      }
    }

    const uniq = Array.from(new Map(parsed.map(r => [`${r.entity_code}__${r.kpi_code}__${r.period}`, r])).values());
    const duplicatesInFile = parsed.length - uniq.length;

    const entityCodes = Array.from(new Set(uniq.map(r => r.entity_code as string)));
    const { data: existing, error: exErr } = await supabaseAdmin
      .from("kpis")
      .select("entity_code,kpi_code,period," + KPI_COMPARE_FIELDS.join(","))
      .in("entity_code", entityCodes.length ? entityCodes : [""])
      .eq("period", period);
    if (exErr) throw exErr;

    const exMap = new Map(
      (existing ?? []).map((r) => [`${(r as Record<string, unknown>).entity_code}__${(r as Record<string, unknown>).kpi_code}__${(r as Record<string, unknown>).period}`, r as Record<string, unknown>]),
    );

    const inserted: Array<{ entity_code: string; kpi_code: string; kpi_name: string }> = [];
    const updated: Array<{ entity_code: string; kpi_code: string; kpi_name: string; changes: Array<{ field: string; label: string; from: unknown; to: unknown }> }> = [];
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
      const changes: Array<{ field: string; label: string; from: unknown; to: unknown }> = [];
      for (const f of KPI_COMPARE_FIELDS) {
        const a = old[f] ?? null;
        const b = row[f] ?? null;
        if (JSON.stringify(a) !== JSON.stringify(b)) {
          changes.push({ field: f, label: FIELD_LABELS_AR[f] ?? f, from: a, to: b });
        }
      }
      if (changes.length === 0) unchanged++;
      else updated.push({ entity_code: row.entity_code as string, kpi_code: row.kpi_code as string, kpi_name: (row.kpi_name as string) ?? "", changes });
    }

    const stale = (existing ?? [])
      .filter((r) => !seen.has(`${(r as Record<string, unknown>).entity_code}__${(r as Record<string, unknown>).kpi_code}__${(r as Record<string, unknown>).period}`))
      .map((r) => ({ entity_code: (r as Record<string, unknown>).entity_code as string, kpi_code: (r as Record<string, unknown>).kpi_code as string }));

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


