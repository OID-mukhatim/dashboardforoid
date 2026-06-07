import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Parse an uploaded Excel/CSV file from the 'uploads' bucket and update
 * the corresponding row in public.uploads with an extracted summary.
 */
export const parseUpload = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ uploadId: z.string().uuid(), filePath: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const XLSX = await import("xlsx");

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
      const sheets = wb.SheetNames.map((name) => {
        const ws = wb.Sheets[name];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null });
        const headers = rows.length ? Object.keys(rows[0]) : [];
        return { name, rowCount: rows.length, headers, sample: rows.slice(0, 5) };
      });
      const totalRows = sheets.reduce((acc, s) => acc + s.rowCount, 0);

      await supabaseAdmin
        .from("uploads")
        .update({
          status: "processed",
          rows_extracted: totalRows,
          extracted_summary: { sheets },
          error_message: null,
        })
        .eq("id", data.uploadId);

      return { ok: true, totalRows, sheets: sheets.map((s) => ({ name: s.name, rows: s.rowCount })) };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await supabaseAdmin
        .from("uploads")
        .update({ status: "error", error_message: msg })
        .eq("id", data.uploadId);
      throw e;
    }
  });
