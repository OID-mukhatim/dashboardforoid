/**
 * نظام استخراج البيانات من الملفات المرفوعة (Word, PowerPoint, PDF).
 * يستخرج النص الخام ثم يحلله لاستخراج بيانات منظمة (أرقام، أسماء، تواريخ).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/* ─── helpers ─── */
function isValidEntity(name: string): { id: string; name: string } | null {
  const s = (name ?? "").trim();
  const aliases: Array<{ id: string; patterns: RegExp[] }> = [
    { id: "TAYO", patterns: [/تيو/, /tayo/i] },
    { id: "KAFI", patterns: [/كافي/, /kafi/i] },
    { id: "ZF", patterns: [/زمزم/, /zamzam/i, /^\s*zf\s*$/i] },
    { id: "ZUST", patterns: [/جامعة\s*زمزم/, /zust/i] },
    { id: "ZAD", patterns: [/زاد/, /zad/i] },
    { id: "HAMDI", patterns: [/حمد[يى]/, /hamdi/i] },
  ];
  for (const a of aliases) {
    if (a.patterns.some((re) => re.test(s))) return { id: a.id, name: s };
  }
  return null;
}

/* ─── extract raw text from different file types ─── */

/** Extract text from Word .docx using mammoth */
async function extractDocx(buf: ArrayBuffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer: Buffer.from(buf) });
  return result.value;
}

/** Extract text from PowerPoint .pptx using unzipper + xml2js */
async function extractPptx(buf: ArrayBuffer): Promise<string> {
  const unzipper = await import("unzipper");
  const { parseStringPromise } = await import("xml2js");
  const readable = require("stream").Readable.from([Buffer.from(buf)]);

  const texts: string[] = [];
  await new Promise<void>((resolve, reject) => {
    readable
      .pipe(unzipper.Parse())
      .on("entry", (entry: any) => {
        const name: string = entry.path;
        if (name.endsWith(".xml") || name.endsWith(".rels")) {
          let chunks = "";
          entry.on("data", (d: Buffer) => { chunks += d.toString("utf8"); });
          entry.on("end", async () => {
            try {
              if (name.includes("ppt/slides/") || name.includes("ppt/notesSlides/")) {
                const parsed = await parseStringPromise(chunks);
                extractTextFromXml(parsed, texts);
              }
              // @ts-ignore
              entry.autodrain?.();
            } catch {
              entry.autodrain();
            }
          });
        } else {
          entry.autodrain();
        }
      })
      .on("close", resolve)
      .on("error", reject);
  });
  return texts.join("\n");
}

function extractTextFromXml(obj: any, out: string[]): void {
  if (!obj || typeof obj !== "object") return;
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (key === "a:t" || key === "_:t") {
      if (typeof val === "string") out.push(val);
      else if (Array.isArray(val)) val.forEach((v: any) => typeof v === "string" && out.push(v));
    } else if (Array.isArray(val)) {
      val.forEach((v: any) => extractTextFromXml(v, out));
    } else if (typeof val === "object") {
      extractTextFromXml(val, out);
    }
  }
}

/** Extract text from PDF using simple regex on buffer (Worker-safe) */
async function extractPdf(buf: ArrayBuffer): Promise<string> {
  // PDF text extraction in Worker environment: scan for text objects
  const bytes = new Uint8Array(buf);
  const decoder = new TextDecoder("utf-8");
  let text = "";
  
  // Try UTF-8 extraction first
  try {
    text = decoder.decode(bytes);
  } catch { /* ignore */ }
  
  // Extract text between BT/ET markers and from streams
  const fullString = decoder.decode(bytes);
  const lines: string[] = [];
  
  // Pattern 1: Text in parentheses within PDF streams
  const parenMatches = fullString.match(/\(([^)\\]{2,500})\)/g);
  if (parenMatches) {
    parenMatches.forEach((m) => {
      const clean = m.slice(1, -1).replace(/\\\(/g, "(").replace(/\\\)/g, ")").replace(/\\/g, "");
      if (clean.length > 2) lines.push(clean);
    });
  }
  
  // Pattern 2: Text after TJ/Tj operators
  const tjMatches = fullString.match(/\[([^\]]{3,500})\]\s*TJ|\(([^)\\]{3,500})\)\s*Tj/g);
  if (tjMatches) {
    tjMatches.forEach((m) => {
      const inner = m.match(/\(([^)\\]+)\)/g);
      if (inner) {
        inner.forEach((im) => {
          const clean = im.slice(1, -1).replace(/\\/g, "");
          if (clean.length > 2) lines.push(clean);
        });
      }
    });
  }
  
  // Also include any readable Arabic/English text sequences
  const readableMatches = fullString.match(/[\u0600-\u06FF\u0750-\u077FA-Za-z0-9.,;:@%$\s]{10,500}/g);
  if (readableMatches) {
    readableMatches.forEach((m) => {
      if (m.trim().length > 5 && !lines.includes(m.trim())) {
        lines.push(m.trim());
      }
    });
  }
  
  return lines.join("\n").substring(0, 50000);
}

/* ─── smart extraction (numbers, dates, names) ─── */

interface ExtractedEntity {
  type: "org" | "number" | "date" | "email" | "phone" | "text";
  value: string;
  label?: string;
  confidence: number;
}

interface DocumentExtraction {
  text: string;
  entities: ExtractedEntity[];
  orgMentions: Array<{ id: string; name: string; context: string }>;
  numbers: Array<{ value: number; unit?: string; context: string }>;
  summary: string;
}

/** Main extraction pipeline */
function analyzeDocument(text: string): DocumentExtraction {
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const fullText = lines.join("\n");

  // 1) Find org mentions
  const orgMentions: DocumentExtraction["orgMentions"] = [];
  const seenOrgs = new Set<string>();
  for (const line of lines) {
    const match = isValidEntity(line);
    if (match && !seenOrgs.has(match.id)) {
      seenOrgs.add(match.id);
      const idx = lines.indexOf(line);
      const context = lines.slice(Math.max(0, idx - 1), Math.min(lines.length, idx + 2)).join(" | ");
      orgMentions.push({ id: match.id, name: match.name, context });
    }
  }

  // 2) Extract numbers with context
  const numbers: DocumentExtraction["numbers"] = [];
  for (const line of lines) {
    const matches = line.match(/(?:[$€£]?\s*[\d,]+(?:\.\d+)?(?:\s*(?:USD|\$|€|£|٪|%))?)/g);
    if (matches) {
      for (const m of matches) {
        const n = parseFloat(m.replace(/[^\d.]/g, ""));
        if (Number.isFinite(n) && n > 0) {
          const unit = m.includes("USD") || m.includes("$") ? "USD" : m.includes("%") || m.includes("٪") ? "%" : undefined;
          numbers.push({ value: n, unit, context: line.substring(0, 120) });
        }
      }
    }
  }
  const uniqueNumbers = [];
  const seenNums = new Set<string>();
  for (const n of numbers) {
    const key = `${n.value.toFixed(2)}_${n.unit || ""}`;
    if (!seenNums.has(key)) { seenNums.add(key); uniqueNumbers.push(n); }
  }

  // 3) Generate a brief summary
  const summary = lines.slice(0, 5).join(". ").substring(0, 300);

  const entities: ExtractedEntity[] = [];
  for (const o of orgMentions) {
    entities.push({ type: "org", value: o.name, label: o.id, confidence: 0.9 });
  }
  for (const n of uniqueNumbers.slice(0, 20)) {
    entities.push({ type: "number", value: String(n.value), label: n.unit, confidence: 0.85 });
  }

  return { text: fullText, entities, orgMentions, numbers: uniqueNumbers.slice(0, 20), summary };
}

/* ─── Server Functions ─── */

export const extractDocument = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ uploadId: z.string().uuid(), filePath: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

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
      const buf = await file.arrayBuffer();
      const fileName = data.filePath.split("/").pop() || "";
      const ext = fileName.split(".").pop()?.toLowerCase() || "";

      let rawText = "";
      if (ext === "docx") {
        rawText = await extractDocx(buf);
      } else if (ext === "pptx") {
        rawText = await extractPptx(buf);
      } else if (ext === "pdf") {
        rawText = await extractPdf(buf);
      } else {
        throw new Error(`Unsupported file type: .${ext}`);
      }

      const analysis = analyzeDocument(rawText);

      // Store extracted data
      await supabaseAdmin.from("document_extractions" as any).insert({
        upload_id: data.uploadId,
        file_path: data.filePath,
        file_name: fileName,
        text_preview: analysis.text.substring(0, 5000),
        entities: analysis.entities as any,
        org_mentions: analysis.orgMentions as any,
        numbers_found: analysis.numbers as any,
        summary: analysis.summary,
      } as any);

      // Update upload status
      await supabaseAdmin
        .from("uploads")
        .update({
          status: "processed",
          rows_extracted: analysis.entities.length,
          extracted_summary: {
            type: "document",
            file_type: ext,
            orgs_found: analysis.orgMentions.map((o) => o.id),
            numbers_count: analysis.numbers.length,
            text_length: analysis.text.length,
          } as any,
          error_message: null,
        })
        .eq("id", data.uploadId);

      return {
        ok: true,
        fileType: ext,
        orgsFound: analysis.orgMentions.map((o) => o.id),
        numbersCount: analysis.numbers.length,
        textLength: analysis.text.length,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await supabaseAdmin
        .from("uploads")
        .update({ status: "error", error_message: msg })
        .eq("id", data.uploadId);
      throw e;
    }
  });

export const getDocumentExtractions = createServerFn({ method: "GET" })
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
