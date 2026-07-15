/**
 * Server-only core for document extraction (Word, PowerPoint, PDF).
 * Called from BOTH `extractDocument` (public server fn) and `processUpload`
 * (router). This avoids the TanStack "server function info not found"
 * manifest issue that happens when one server fn calls another server fn's
 * RPC stub from inside its handler.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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

/** Extract text from Word .docx by unzipping and reading document.xml.
 *  Uses fflate (pure JS, Worker-compatible) instead of `mammoth`, which
 *  depends on Node-only streams and fails on Cloudflare Workers. */
async function extractDocx(buf: ArrayBuffer): Promise<string> {
  const { unzipSync, strFromU8 } = await import("fflate");
  const files = unzipSync(new Uint8Array(buf), {
    filter: (f) => f.name === "word/document.xml" || f.name.startsWith("word/header") || f.name.startsWith("word/footer"),
  });
  const parts: string[] = [];
  for (const name of Object.keys(files)) {
    const xml = strFromU8(files[name]);
    // Concatenate every <w:t>…</w:t> run in document order and treat
    // paragraph breaks (<w:p>) as newlines.
    const withBreaks = xml
      .replace(/<w:p[ >]/g, "\n<w:p ")
      .replace(/<w:br\s*\/>/g, "\n");
    const matches = withBreaks.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) ?? [];
    for (const m of matches) {
      const inner = m.replace(/<w:t[^>]*>/, "").replace(/<\/w:t>$/, "");
      parts.push(inner.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"'));
    }
    parts.push("\n");
  }
  return parts.join("").replace(/\n{3,}/g, "\n\n").trim();
}

/** Extract text from PowerPoint .pptx by unzipping slide XML. */
async function extractPptx(buf: ArrayBuffer): Promise<string> {
  const { unzipSync, strFromU8 } = await import("fflate");
  const files = unzipSync(new Uint8Array(buf), {
    filter: (f) => /^ppt\/(slides|notesSlides)\/[^/]+\.xml$/.test(f.name),
  });
  const names = Object.keys(files).sort();
  const parts: string[] = [];
  for (const name of names) {
    const xml = strFromU8(files[name]);
    const matches = xml.match(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g) ?? [];
    for (const m of matches) {
      const inner = m.replace(/<a:t[^>]*>/, "").replace(/<\/a:t>$/, "");
      parts.push(inner.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"'));
    }
    parts.push("\n");
  }
  return parts.join(" ").replace(/\s{2,}/g, " ").trim();
}

/** Extract text from PDF using regex on the raw buffer (Worker-safe). */
async function extractPdf(buf: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buf);
  const decoder = new TextDecoder("utf-8");
  let fullString = "";
  try { fullString = decoder.decode(bytes); } catch { /* ignore */ }
  const lines: string[] = [];

  const parenMatches = fullString.match(/\(([^)\\]{2,500})\)/g);
  if (parenMatches) {
    parenMatches.forEach((m) => {
      const clean = m.slice(1, -1).replace(/\\\(/g, "(").replace(/\\\)/g, ")").replace(/\\/g, "");
      if (clean.length > 2) lines.push(clean);
    });
  }
  const readableMatches = fullString.match(/[\u0600-\u06FF\u0750-\u077FA-Za-z0-9.,;:@%$\s]{10,500}/g);
  if (readableMatches) {
    readableMatches.forEach((m) => {
      if (m.trim().length > 5 && !lines.includes(m.trim())) lines.push(m.trim());
    });
  }
  return lines.join("\n").substring(0, 50000);
}

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

function analyzeDocument(text: string): DocumentExtraction {
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const fullText = lines.join("\n");

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
  const uniqueNumbers: DocumentExtraction["numbers"] = [];
  const seenNums = new Set<string>();
  for (const n of numbers) {
    const key = `${n.value.toFixed(2)}_${n.unit || ""}`;
    if (!seenNums.has(key)) { seenNums.add(key); uniqueNumbers.push(n); }
  }

  const summary = lines.slice(0, 5).join(". ").substring(0, 300);
  const entities: ExtractedEntity[] = [];
  for (const o of orgMentions) entities.push({ type: "org", value: o.name, label: o.id, confidence: 0.9 });
  for (const n of uniqueNumbers.slice(0, 20)) entities.push({ type: "number", value: String(n.value), label: n.unit, confidence: 0.85 });

  return { text: fullText, entities, orgMentions, numbers: uniqueNumbers.slice(0, 20), summary };
}

export async function runDocumentExtraction(uploadId: string, filePath: string) {
  const { data: file, error: dlErr } = await supabaseAdmin.storage
    .from("uploads")
    .download(filePath);
  if (dlErr || !file) {
    await supabaseAdmin
      .from("uploads")
      .update({ status: "error", error_message: dlErr?.message ?? "download failed" })
      .eq("id", uploadId);
    throw new Error(dlErr?.message ?? "download failed");
  }

  try {
    const buf = await file.arrayBuffer();
    const fileName = filePath.split("/").pop() || "";
    const ext = fileName.split(".").pop()?.toLowerCase() || "";

    let rawText = "";
    if (ext === "docx") rawText = await extractDocx(buf);
    else if (ext === "pptx") rawText = await extractPptx(buf);
    else if (ext === "pdf") rawText = await extractPdf(buf);
    else throw new Error(`Unsupported file type: .${ext}`);

    const analysis = analyzeDocument(rawText);

    await supabaseAdmin.from("document_extractions").insert({
      upload_id: uploadId,
      file_path: filePath,
      file_name: fileName,
      text_preview: analysis.text.substring(0, 5000),
      entities: analysis.entities as unknown as never,
      org_mentions: analysis.orgMentions as unknown as never,
      numbers_found: analysis.numbers as unknown as never,
      summary: analysis.summary,
      kind: "document",
    });

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
        } as unknown as never,
        error_message: null,
      })
      .eq("id", uploadId);

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
      .eq("id", uploadId);
    throw e;
  }
}
