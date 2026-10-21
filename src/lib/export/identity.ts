/** OID visual identity shared by every exported report. */
export const OFFICE_AR = "مكتب الإشراف والتطوير المؤسسي (OID)";
export const OFFICE_EN = "Oversight and Institutional Development";
export const COLORS = {
  office: "137B79", // office name row only (white text)
  title: "4472C4", // report title, section headings, totals rows (white text)
  header: "DAF2D0", // column headers and sub-headings (dark text)
  computed: "DEFAF9", // computed cells only
  text: "1A2332",
  white: "FFFFFF",
} as const;
export const FONTS = { heading: "29LT Azer Medium", body: "Tajawal" } as const;
/** Point sizes: headings 18/16/14, labels 12, data 11, totals 10 bold. */
export const SIZES = { h1: 18, h2: 16, h3: 14, label: 12, data: 11, totals: 10 } as const;
/** Excel row heights in points. */
export const ROW_HEIGHTS = { office: 30, title: 41.25, meta: 33.75, section: 40.5, header: 30.75, data: 20.25 } as const;
export const DRAFT_MARK = "مسودة — غير معتمد";
export const EMPTY_SECTION = "لا توجد بيانات للفترة";
export const STATUS_LABEL = { approved: "معتمد", draft: "مسودة", live: "بيانات حية" } as const;

import type { ReportDocument } from "./types";
export function metaLine(d: ReportDocument) {
  const m = d.meta;
  return [
    `المؤسسة: ${m.org}`,
    m.year != null ? `السنة: ${m.year}` : null,
    m.period ? `الفترة: ${m.period}` : null,
    `المعدّ: ${m.preparedBy ?? "—"}`,
    `المعتمِد: ${m.approvedBy ?? "—"}${m.approvedAt ? ` (${m.approvedAt.slice(0, 10)})` : ""}`,
    `الحالة: ${STATUS_LABEL[m.status]}`,
    `تاريخ الاستخراج: ${m.extractedAt.slice(0, 10)}`,
  ].filter(Boolean).join("   |   ");
}
