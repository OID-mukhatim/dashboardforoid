import { COLORS, OFFICE_AR, OFFICE_EN, DRAFT_MARK, EMPTY_SECTION, metaLine } from "./identity";
import type { Cell, ReportDocument } from "./types";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);
const fmt = (v: Cell) => (v === null || v === "" ? "—" : typeof v === "number" ? v.toLocaleString("en-US", { maximumFractionDigits: 4 }) : esc(v));
const bi = (ar: string, en: string) => `${esc(ar)}<br><span class="en">${esc(en)}</span>`;

/** Self-contained print page (Tajawal, RTL, landscape pages, page numbers, draft watermark). */
export function renderPrintHtml(doc: ReportDocument): string {
  const body = doc.sections.map((s, i) => {
    const blocks = s.blocks.length ? s.blocks.map((b) => {
      if (b.type === "subheading") return `<div class="sub">${bi(b.ar, b.en)}</div>`;
      if (b.type === "text") return `<p class="text">${esc(b.value)}</p>`;
      if (b.type === "kv") return `<table><tbody>${b.items.map((it) => `<tr><th>${bi(it.ar, it.en)}</th><td class="${it.computed ? "calc" : ""}">${fmt(it.value)}</td></tr>`).join("")}</tbody></table>`;
      const rows = b.rows.length ? b.rows.map((r) => `<tr>${b.columns.map((c, j) => `<td class="${c.computed ? "calc" : ""} ${typeof r[j] === "number" ? "num" : ""}">${fmt(r[j] ?? null)}</td>`).join("")}</tr>`).join("")
        : `<tr><td colspan="${b.columns.length}">${EMPTY_SECTION}</td></tr>`;
      const tot = b.totalsRow ? `<tr class="total">${b.columns.map((_, j) => `<td>${fmt(b.totalsRow?.[j] ?? null)}</td>`).join("")}</tr>` : "";
      return `<table><thead><tr>${b.columns.map((c) => `<th>${bi(c.ar, c.en)}</th>`).join("")}</tr></thead><tbody>${rows}${tot}</tbody></table>`;
    }).join("") : `<p class="text">${EMPTY_SECTION}</p>`;
    const head = i === 0 ? `<div class="office">${esc(OFFICE_AR)}<br><span class="en">${esc(OFFICE_EN)}</span></div>
      <div class="title">${bi(doc.titleAr, doc.titleEn)}</div><div class="meta">${esc(metaLine(doc))}</div>` : "";
    return `<section class="${s.orientation}">${head}<h2>${bi(s.titleAr, s.titleEn)}</h2>${blocks}</section>`;
  }).join("");
  return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${esc(doc.titleAr)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap" rel="stylesheet">
<style>
@page { size: A4 portrait; margin: 12mm 10mm 16mm; @bottom-center { content: counter(page) " / " counter(pages); font-family: Tajawal; font-size: 9pt; } }
@page wide { size: A4 landscape; }
*{box-sizing:border-box} body{font-family:Tajawal,Arial,sans-serif;direction:rtl;color:#${COLORS.text};margin:0;font-size:11pt;-webkit-print-color-adjust:exact;print-color-adjust:exact}
section{page-break-after:always;padding:4mm 0} section:last-child{page-break-after:auto} section.landscape{page:wide}
.office{background:#${COLORS.office};color:#fff;text-align:center;font-weight:800;font-size:18pt;padding:8px}
.title{background:#${COLORS.title};color:#fff;text-align:center;font-weight:700;font-size:16pt;padding:8px;margin-top:2px}
.meta{font-size:10pt;padding:6px 0;border-bottom:1px solid #ddd;margin-bottom:6px}
h2{background:#${COLORS.title};color:#fff;font-size:14pt;padding:6px 10px;margin:8px 0}
.sub{background:#${COLORS.header};font-weight:700;padding:5px 10px;margin:6px 0;font-size:12pt}
.en{font-size:.82em;opacity:.85;font-weight:400}
table{width:100%;border-collapse:collapse;margin:6px 0 10px;font-size:10pt} th,td{border:1px solid #bfbfbf;padding:4px 6px;text-align:right;vertical-align:middle}
thead{display:table-header-group} tr{break-inside:avoid}
th{background:#${COLORS.header};font-weight:700;text-align:center;font-size:10.5pt} td.num{text-align:center;font-variant-numeric:tabular-nums}
td.calc{background:#${COLORS.computed}} tr.total td{background:#${COLORS.title};color:#fff;font-weight:700;font-size:10pt}
.text{white-space:pre-wrap;line-height:1.7}
.draft{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:9}
.draft span{transform:rotate(-30deg);font-size:72pt;font-weight:800;color:rgba(192,0,0,.12);white-space:nowrap}
</style></head><body>${doc.meta.status === "draft" ? `<div class="draft"><span>${DRAFT_MARK}</span></div>` : ""}${body}</body></html>`;
}
