import type { ExportFormat, ReportDocument } from "./types";
const safe = (s: string) => s.replace(/[\\/:*?"<>|\s]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
/** OID-<ORG|ALL>-<year>-<period|date>-<name>.<ext> */
export function exportFileName(d: ReportDocument, ext: ExportFormat) {
  const year = d.meta.year ?? d.meta.extractedAt.slice(0, 4);
  const when = d.meta.period ?? d.meta.extractedAt.slice(0, 10);
  return `OID-${safe(d.meta.orgCode || "ALL")}-${safe(String(year))}-${safe(when)}-${safe(d.slug)}.${ext}`;
}
