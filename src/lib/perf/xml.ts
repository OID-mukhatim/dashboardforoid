import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { XMLValidator } from "fast-xml-parser";

export function readXml(xml: string) {
  if (XMLValidator.validate(xml) !== true) throw new Error("invalid_export_xml");
  return new DOMParser({ onError: () => { throw new Error("invalid_export_xml"); } })
    .parseFromString(xml, "application/xml");
}
export function writeXml(doc: ReturnType<typeof readXml>) {
  const xml = new XMLSerializer().serializeToString(doc);
  // A different parser validates the final bytes, not merely the DOM we edited.
  if (XMLValidator.validate(xml) !== true) throw new Error("invalid_export_xml");
  return xml;
}
const column = (ref: string) => {
  let n = 0;
  for (const c of ref) {
    if (c >= "A" && c <= "Z") n = n * 26 + c.charCodeAt(0) - 64;
    else break;
  }
  return n;
};
export function fillSheet(xml: string, values: Record<string, unknown>) {
  const doc = readXml(xml);
  const sheet = doc.getElementsByTagName("sheetData")[0];
  if (!sheet) throw new Error("invalid_export_xml");
  const ns = sheet.namespaceURI;
  const create = (name: string) => doc.createElementNS(ns, name);
  // Never rewrite formula text; only invalidate Excel's cached result.
  for (const cell of Array.from(doc.getElementsByTagName("c"))) {
    if (cell.getElementsByTagName("f").length) {
      for (const v of Array.from(cell.getElementsByTagName("v"))) cell.removeChild(v);
    }
  }
  for (const [ref, value] of Object.entries(values)) {
    const rowNumber = Number(ref.slice(ref.search(/[0-9]/)));
    let row = Array.from(sheet.getElementsByTagName("row")).find(r => Number(r.getAttribute("r")) === rowNumber);
    if (!row) {
      row = create("row"); row.setAttribute("r", String(rowNumber));
      const next = Array.from(sheet.getElementsByTagName("row")).find(r => Number(r.getAttribute("r")) > rowNumber);
      sheet.insertBefore(row, next ?? null);
    }
    let cell = Array.from(row.getElementsByTagName("c")).find(c => c.getAttribute("r") === ref);
    if (!cell) {
      cell = create("c"); cell.setAttribute("r", ref);
      const next = Array.from(row.getElementsByTagName("c")).find(c => column(c.getAttribute("r") ?? "") > column(ref));
      row.insertBefore(cell, next ?? null);
    }
    if (cell.getElementsByTagName("f").length) continue;
    // Keep s and all other template attributes; replace only the cell value/type.
    for (const child of Array.from(cell.childNodes)) cell.removeChild(child);
    cell.removeAttribute("t");
    if (value === null || value === undefined || value === "") continue;
    if (typeof value === "number") {
      const v = create("v"); v.appendChild(doc.createTextNode(String(value))); cell.appendChild(v);
    } else {
      cell.setAttribute("t", "inlineStr");
      const inline = create("is"), t = create("t");
      t.setAttribute("xml:space", "preserve"); t.appendChild(doc.createTextNode(String(value)));
      inline.appendChild(t); cell.appendChild(inline);
    }
  }
  return writeXml(doc);
}