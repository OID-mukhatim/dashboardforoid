/**
 * Server-fn wrapper for document extraction (Word, PowerPoint, PDF).
 * The heavy lifting lives in `documents-core.server.ts` so it can be reused
 * from `processUpload` without going through the RPC stub (which strips the
 * callee from the worker's server-fn manifest).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertEditor } from "./uploads.functions";



export const extractDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ uploadId: z.string().uuid(), filePath: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertEditor(context);
    const { runDocumentExtraction } = await import("./documents-core.server");
    return runDocumentExtraction(data.uploadId, data.filePath);
  });


export const getDocumentExtractions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("document_extractions" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return data ?? [];
  });
