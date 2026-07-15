/**
 * Server-only core for document extraction (Word, PowerPoint, PDF).
 * Called from BOTH `extractDocument` (public server fn) and `processUpload`
 * (router). This avoids the TanStack "server function info not found"
 * manifest issue that happens when one server fn calls another server fn's
 * RPC stub from inside its handler.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** Strict entity matching — avoid false positives from generic Arabic words.
 *  "كافي" alone means "enough"; "زاد" means "increased"; "تيو" can appear in
 *  unrelated contexts. Require a qualifier ("للتنمية" / "مؤسسة" / "شركة") or
 *  an explicit section header pattern (e.g. "رابعا: كافي للتنمية"). */
function isValidEntity(name: string): { id: string; name: string } | null {
  const s = (name ?? "").trim();
  const aliases: Array<{ id: string; patterns: RegExp[] }> = [
    { id: "TAYO", patterns: [/مؤسسة\s*تيو/, /شركة\s*تيو/, /تيو\s*للتنمية/, /\bTAYO\b/] },
    { id: "KAFI", patterns: [/كافي\s*للتنمية/, /مؤسسة\s*كافي/, /شركة\s*كافي/, /\bKAFI\b/] },
    { id: "ZF", patterns: [/مؤسسة\s*زمزم/, /شركة\s*زمزم/, /زمزم\s*للتنمية/, /\bZamzam\b/, /^\s*ZF\s*$/] },
    { id: "ZUST", patterns: [/جامعة\s*زمزم/, /\bZUST\b/] },
    { id: "ZAD", patterns: [/مؤسسة\s*زاد/, /شركة\s*زاد/, /زاد\s*للتنمية/, /\bZAD\b/] },
    { id: "HAMDI", patterns: [/مؤسسة\s*حمد[يى]/, /شركة\s*حمد[يى]/, /حمد[يى]\s*للتنمية/, /\bHAMDI\b/i] },
  ];
  for (const a of aliases) {
    if (a.patterns.some((re) => re.test(s))) return { id: a.id, name: s };
  }
  return null;
}

/** Extract text from Word .docx by unzipping and reading document.xml.
 *  Uses fflate (pure JS, Worker-compatible) instead of `mammoth`, which
 *  depends on Node-only streams and fails on Cloudflare Workers.
 *  Walks the XML with indexOf so complex tables / nested runs don't leak
 *  raw markup into the extracted text. */
async function extractDocx(buf: ArrayBuffer): Promise<string> {
  const { unzipSync, strFromU8 } = await import("fflate");
  const files = unzipSync(new Uint8Array(buf), {
    filter: (f) => f.name === "word/document.xml" || f.name.startsWith("word/header") || f.name.startsWith("word/footer"),
  });
  const decodeEntities = (s: string) =>
    s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
     .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
  const parts: string[] = [];
  for (const name of Object.keys(files)) {
    const xml = strFromU8(files[name]);
    let i = 0;
    while (i < xml.length) {
      const openStart = xml.indexOf("<w:t", i);
      if (openStart < 0) break;
      const nextChar = xml[openStart + 4];
      if (nextChar !== " " && nextChar !== ">" && nextChar !== "/") { i = openStart + 4; continue; }
      const openEnd = xml.indexOf(">", openStart);
      if (openEnd < 0) break;
      if (xml[openEnd - 1] === "/") { i = openEnd + 1; continue; }
      const closeStart = xml.indexOf("</w:t>", openEnd);
      if (closeStart < 0) break;
      const inner = xml.slice(openEnd + 1, closeStart);
      const clean = decodeEntities(inner.replace(/<[^>]+>/g, ""));
      if (clean) parts.push(clean);
      i = closeStart + 6;
      const nextP = xml.indexOf("</w:p>", i);
      const nextT = xml.indexOf("<w:t", i);
      if (nextP >= 0 && (nextT < 0 || nextP < nextT)) parts.push("\n");
    }
    parts.push("\n");
  }
  return parts.join("").replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
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

    // Filename-derived org hints — only when the filename explicitly names the
    // institution ("كافي للتنمية" / "مؤسسة كافي" / uppercase code KAFI). A bare
    // word like "كافي" is NOT enough; it means "enough" in Arabic and would
    // wrongly attribute unrelated reports to كافي للتنمية.
    const filenameOrgs = new Set<string>();
    if (/كافي\s*للتنمية|مؤسسة\s*كافي|\bKAFI\b/.test(fileName)) filenameOrgs.add("KAFI");
    if (/مؤسسة\s*تيو|تيو\s*للتنمية|\bTAYO\b/.test(fileName)) filenameOrgs.add("TAYO");
    if (/مؤسسة\s*زاد|زاد\s*للتنمية|\bZAD\b/.test(fileName)) filenameOrgs.add("ZAD");
    if (/مؤسسة\s*حمد[يى]|حمد[يى]\s*للتنمية|\bHAMDI\b/i.test(fileName)) filenameOrgs.add("HAMDI");
    if (/جامعة\s*زمزم|\bZUST\b/.test(fileName)) filenameOrgs.add("ZUST");
    if ((/مؤسسة\s*زمزم|زمزم\s*للتنمية|\bZamzam\b|(^|[^A-Za-z])ZF([^A-Za-z]|$)/.test(fileName)) && !filenameOrgs.has("ZUST")) filenameOrgs.add("ZF");
    // NOTE: financial reports are no longer auto-attributed to كافي. Attribution
    // now requires the file name or content to explicitly reference the org.

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

    // Per-org rows so each institution's dashboard picks up the report
    const orgIds = Array.from(new Set([...analysis.orgMentions.map((o) => o.id), ...filenameOrgs]));
    if (orgIds.length) {
      const rows = orgIds.map((code) => ({
        upload_id: uploadId,
        file_path: filePath,
        file_name: fileName,
        text_preview: analysis.text.substring(0, 5000),
        entities: analysis.entities as unknown as never,
        org_mentions: analysis.orgMentions as unknown as never,
        numbers_found: analysis.numbers as unknown as never,
        summary: analysis.summary,
        kind: "document",
        entity_code: code,
      }));
      await supabaseAdmin.from("document_extractions").insert(rows);
    }

    await supabaseAdmin
      .from("uploads")
      .update({
        status: "processed",
        rows_extracted: analysis.entities.length,
        extracted_summary: {
          type: "document",
          file_type: ext,
          orgs_found: orgIds,
          numbers_count: analysis.numbers.length,
          text_length: analysis.text.length,
        } as unknown as never,
        error_message: null,
      })
      .eq("id", uploadId);

    return {
      ok: true,
      fileType: ext,
      orgsFound: orgIds,
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
