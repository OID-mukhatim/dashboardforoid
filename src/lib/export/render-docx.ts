import {
  AlignmentType, Document, Footer, Header, PageNumber, PageOrientation, Packer, Paragraph, ShadingType,
  Table, TableCell, TableRow, TextRun, WidthType, type ISectionOptions,
} from "docx";
import { COLORS, FONTS, SIZES, OFFICE_AR, OFFICE_EN, DRAFT_MARK, EMPTY_SECTION, metaLine } from "./identity";
import type { Cell, ReportDocument } from "./types";

const pt = (n: number) => n * 2; // docx sizes are half-points
type RunOpts = { size?: number; bold?: boolean; color?: string; heading?: boolean };
const lines = (text: string, o: RunOpts = {}) =>
  text.split("\n").map((l, i) => new TextRun({ text: l, rightToLeft: true, bold: o.bold, color: o.color, size: pt(o.size ?? SIZES.data), font: o.heading ? FONTS.heading : FONTS.body, break: i ? 1 : undefined }));
const para = (text: string, o: RunOpts & { shade?: string; align?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {}) =>
  new Paragraph({
    bidirectional: true,
    alignment: o.align ?? AlignmentType.RIGHT,
    shading: o.shade ? { type: ShadingType.CLEAR, color: "auto", fill: o.shade } : undefined,
    spacing: { before: 60, after: 60 },
    children: lines(text, o),
  });
const fmt = (v: Cell) => (v === null || v === "" ? "—" : typeof v === "number" ? v.toLocaleString("en-US", { maximumFractionDigits: 2 }) : v);
const cell = (v: Cell, o: { shade?: string; bold?: boolean; color?: string; size?: number } = {}) =>
  new TableCell({
    shading: o.shade ? { type: ShadingType.CLEAR, color: "auto", fill: o.shade } : undefined,
    children: [para(fmt(v), { ...o, shade: undefined, align: typeof v === "number" ? AlignmentType.CENTER : AlignmentType.RIGHT })],
  });
const full = { size: 100, type: WidthType.PERCENTAGE };

export async function renderDocx(doc: ReportDocument): Promise<Uint8Array> {
  const draft = doc.meta.status === "draft";
  const sections: ISectionOptions[] = doc.sections.map((s, idx) => {
    const children: (Paragraph | Table)[] = [];
    if (idx === 0) {
      children.push(
        para(`${OFFICE_AR}\n${OFFICE_EN}`, { shade: COLORS.office, color: COLORS.white, bold: true, size: SIZES.h1, heading: true, align: AlignmentType.CENTER }),
        para(`${doc.titleAr}\n${doc.titleEn}`, { shade: COLORS.title, color: COLORS.white, bold: true, size: SIZES.h2, heading: true, align: AlignmentType.CENTER }),
        para(metaLine(doc), { size: SIZES.label }),
      );
    }
    children.push(para(`${s.titleAr} — ${s.titleEn}`, { shade: COLORS.title, color: COLORS.white, bold: true, size: SIZES.h3, heading: true }));
    if (!s.blocks.length) children.push(para(EMPTY_SECTION));
    for (const b of s.blocks) {
      if (b.type === "subheading") children.push(para(`${b.ar} — ${b.en}`, { shade: COLORS.header, bold: true, size: SIZES.label, heading: true }));
      else if (b.type === "text") children.push(para(b.value));
      else if (b.type === "kv")
        children.push(new Table({ width: full, visuallyRightToLeft: true, rows: b.items.map((it) => new TableRow({ children: [
          cell(`${it.ar}\n${it.en}`, { shade: COLORS.header, bold: true, size: SIZES.label }),
          cell(it.value, { shade: it.computed ? COLORS.computed : undefined }),
        ] })) }));
      else {
        const rows = [
          new TableRow({ tableHeader: true, children: b.columns.map((c) => cell(`${c.ar}\n${c.en}`, { shade: COLORS.header, bold: true, size: SIZES.label })) }),
          ...b.rows.map((r) => new TableRow({ children: b.columns.map((c, i) => cell(r[i] ?? null, { shade: c.computed ? COLORS.computed : undefined })) })),
        ];
        if (b.totalsRow) rows.push(new TableRow({ children: b.columns.map((_, i) => cell(b.totalsRow?.[i] ?? null, { shade: COLORS.title, color: COLORS.white, bold: true, size: SIZES.totals })) }));
        children.push(new Table({ width: full, visuallyRightToLeft: true, rows }));
        if (!b.rows.length) children.push(para(EMPTY_SECTION));
      }
      children.push(new Paragraph({ children: [] }));
    }
    return {
      properties: { page: { size: { orientation: s.orientation === "landscape" ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT }, margin: { top: 720, bottom: 720, left: 720, right: 720 } } },
      headers: draft ? { default: new Header({ children: [para(DRAFT_MARK, { bold: true, size: 28, color: "D9D9D9", align: AlignmentType.CENTER })] }) } : undefined,
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [
        new TextRun({ children: [PageNumber.CURRENT, " / ", PageNumber.TOTAL_PAGES], font: FONTS.body, size: pt(9) }),
      ] })] }) },
      children,
    };
  });
  const d = new Document({ creator: OFFICE_EN, title: doc.titleAr, styles: { default: { document: { run: { font: FONTS.body, rightToLeft: true } } } }, sections });
  return new Uint8Array(await (await Packer.toBlob(d)).arrayBuffer());
}
