import { exportFileName } from "./filename";
import type { ExportFormat, ReportDocument } from "./types";

const MIME = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
} as const;
export const PRINT_KEY = "oid-print-doc";

export function downloadBytes(bytes: Uint8Array, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type }));
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** PDF opens the print page (user picks "Save as PDF"); Word / Excel download directly. */
export async function deliverReport(doc: ReportDocument, format: ExportFormat) {
  if (format === "pdf") {
    sessionStorage.setItem(PRINT_KEY, JSON.stringify(doc));
    window.open("/print/report", "_blank");
    return;
  }
  const bytes = format === "xlsx"
    ? await (await import("./render-xlsx")).renderXlsx(doc)
    : await (await import("./render-docx")).renderDocx(doc);
  downloadBytes(bytes, exportFileName(doc, format), MIME[format]);
}
