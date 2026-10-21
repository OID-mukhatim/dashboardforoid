import ExcelJS from "exceljs";
import { COLORS, FONTS, SIZES, ROW_HEIGHTS, OFFICE_AR, OFFICE_EN, DRAFT_MARK, EMPTY_SECTION, metaLine } from "./identity";
import type { Block, Cell, ReportDocument } from "./types";

const fill = (c: string): ExcelJS.Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb: `FF${c}` } });
const thin: Partial<ExcelJS.Borders> = Object.fromEntries(
  (["top", "left", "bottom", "right"] as const).map((k) => [k, { style: "thin", color: { argb: "FFBFBFBF" } }]),
);
const sheetName = (s: string, used: Set<string>) => {
  let n = s.replace(/[\\/?*[\]:]/g, " ").slice(0, 28).trim() || "Sheet";
  let i = 2;
  while (used.has(n)) n = `${n.slice(0, 25)} ${i++}`;
  used.add(n);
  return n;
};
const width = (b: Block) => (b.type === "table" ? b.columns.length : b.type === "kv" ? 2 : 1);

export async function renderXlsx(doc: ReportDocument): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = OFFICE_EN;
  const used = new Set<string>();
  for (const section of doc.sections) {
    const cols = Math.max(4, ...section.blocks.map(width));
    const ws = wb.addWorksheet(sheetName(section.titleAr, used), {
      views: [{ rightToLeft: true }],
      pageSetup: { orientation: section.orientation, fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
    });
    ws.columns = Array.from({ length: cols }, () => ({ width: 22 }));
    const band = (text: string, color: string | null, font: Partial<ExcelJS.Font>, height: number) => {
      const row = ws.addRow([text]);
      ws.mergeCells(row.number, 1, row.number, cols);
      row.height = height;
      const c = row.getCell(1);
      c.font = font;
      c.alignment = { horizontal: "center", vertical: "middle", wrapText: true, readingOrder: "rtl" };
      if (color) c.fill = fill(color);
      return row;
    };
    const white = { argb: `FF${COLORS.white}` };
    band(`${OFFICE_AR}\n${OFFICE_EN}`, COLORS.office, { name: FONTS.heading, size: SIZES.h1, bold: true, color: white }, ROW_HEIGHTS.office);
    band(`${doc.titleAr}\n${doc.titleEn}`, COLORS.title, { name: FONTS.heading, size: SIZES.h2, bold: true, color: white }, ROW_HEIGHTS.title);
    band(metaLine(doc), null, { name: FONTS.body, size: SIZES.label }, ROW_HEIGHTS.meta);
    if (doc.meta.status === "draft")
      band(`⚠ ${DRAFT_MARK} ⚠`, null, { name: FONTS.body, size: SIZES.h3, bold: true, color: { argb: "FFC00000" } }, ROW_HEIGHTS.meta);
    ws.addRow([]);
    band(`${section.titleAr} — ${section.titleEn}`, COLORS.title, { name: FONTS.heading, size: SIZES.h3, bold: true, color: white }, ROW_HEIGHTS.section);
    const styleCell = (c: ExcelJS.Cell, v: Cell, opts: { computed?: boolean; header?: boolean; total?: boolean }) => {
      c.value = v ?? "";
      c.border = thin;
      c.alignment = { horizontal: typeof v === "number" ? "center" : "right", vertical: "middle", wrapText: true, readingOrder: "rtl" };
      if (opts.header) { c.fill = fill(COLORS.header); c.font = { name: FONTS.body, size: SIZES.label, bold: true }; c.alignment = { ...c.alignment, horizontal: "center" }; }
      else if (opts.total) { c.fill = fill(COLORS.title); c.font = { name: FONTS.body, size: SIZES.totals, bold: true, color: white }; }
      else { c.font = { name: FONTS.body, size: SIZES.data }; if (opts.computed) c.fill = fill(COLORS.computed); }
      if (typeof v === "number" && !Number.isInteger(v)) c.numFmt = "#,##0.00";
      else if (typeof v === "number") c.numFmt = "#,##0";
    };
    if (!section.blocks.length) band(EMPTY_SECTION, null, { name: FONTS.body, size: SIZES.data }, ROW_HEIGHTS.data);
    for (const b of section.blocks) {
      if (b.type === "subheading") {
        const r = band(`${b.ar} — ${b.en}`, COLORS.header, { name: FONTS.heading, size: SIZES.label, bold: true, color: { argb: `FF${COLORS.text}` } }, ROW_HEIGHTS.header);
        r.getCell(1).alignment = { horizontal: "right", vertical: "middle", readingOrder: "rtl" };
      } else if (b.type === "text") {
        const r = band(b.value, null, { name: FONTS.body, size: SIZES.data }, Math.max(ROW_HEIGHTS.data, Math.ceil(b.value.length / 120) * 16));
        r.getCell(1).alignment = { horizontal: "right", vertical: "top", wrapText: true, readingOrder: "rtl" };
      } else if (b.type === "kv") {
        for (const it of b.items) {
          const r = ws.addRow([]);
          r.height = ROW_HEIGHTS.data;
          styleCell(r.getCell(1), `${it.ar}\n${it.en}`, { header: true });
          styleCell(r.getCell(2), it.value, { computed: it.computed });
          r.height = ROW_HEIGHTS.header;
        }
      } else {
        const h = ws.addRow([]);
        h.height = ROW_HEIGHTS.header;
        b.columns.forEach((c, i) => styleCell(h.getCell(i + 1), `${c.ar}\n${c.en}`, { header: true }));
        if (!b.rows.length) band(EMPTY_SECTION, null, { name: FONTS.body, size: SIZES.data }, ROW_HEIGHTS.data);
        for (const row of b.rows) {
          const r = ws.addRow([]);
          r.height = ROW_HEIGHTS.data;
          row.forEach((v, i) => styleCell(r.getCell(i + 1), v, { computed: b.columns[i]?.computed }));
        }
        if (b.totalsRow) {
          const r = ws.addRow([]);
          r.height = ROW_HEIGHTS.data;
          b.totalsRow.forEach((v, i) => styleCell(r.getCell(i + 1), v, { total: true }));
        }
      }
      ws.addRow([]);
    }
  }
  return new Uint8Array(await wb.xlsx.writeBuffer());
}
