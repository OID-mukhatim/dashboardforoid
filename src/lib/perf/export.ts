import { unzipSync, zipSync, strFromU8, strToU8 } from "fflate";
import * as XLSX from "xlsx";
import {
  PERSPECTIVES,
  type KPI,
  type Activity,
  type Report,
  type Quarter,
  type Plan,
} from "./types";
import { OPTIONS, optionCode, normalize } from "./dictionary";
import { exportCapacity } from "./edit-rules";
import { fillSheet, readXml, writeXml } from "./xml";
import { linkedCode } from "./references";
export function exportTemplate(
  buffer: Uint8Array,
  input: {
    plan: Plan;
    orgName: string;
    orgAbbr: string;
    period: Quarter;
    kpis: KPI[];
    activities: Activity[];
    report?: Report;
  },
) {
  if (!exportCapacity(input.kpis, input.activities.length)) throw new Error("export_limit");
  const zip = unzipSync(buffer);
  const workbook = XLSX.read(buffer, { type: "array" });
  const data = workbook.Sheets.Data;
  if (!data) throw new Error("missing_sheets");
  const dataRows = XLSX.utils.sheet_to_json<unknown[]>(data, { header: 1, defval: null });
  const literals = (column: number) =>
    dataRows
      .slice(1)
      .map((r) => r[column])
      .filter((v): v is string => typeof v === "string");
  function literal(group: keyof typeof OPTIONS, key: string, column: number) {
    const value = literals(column).find((v) => optionCode(group, v) === key);
    if (!value) throw new Error("unknown_option");
    return value;
  }
  const institution =
    literals(0).find(
      (v) =>
        normalize(v) === normalize(input.orgName) ||
        normalize(v).includes(normalize(input.orgName)),
    ) ?? input.orgName;
  const k: Record<string, unknown> = {
    C3: input.plan.prepared_by,
    F3: institution,
    L3: input.plan.approved_by,
    P3: input.period,
  };
  const blocks = [6, 40, 74, 108];
  const cols: Record<string, string> = {
    objective: "B",
    name: "C",
    measurement: "E",
    role: "F",
    unit: "G",
    polarity: "H",
    calc_method: "I",
    weight: "J",
    baseline: "K",
    annual_target: "L",
    q1_plan: "N",
    q1_actual: "O",
    q2_plan: "P",
    q2_actual: "Q",
    q3_plan: "R",
    q3_actual: "S",
    q4_plan: "T",
    q4_actual: "U",
  };
  PERSPECTIVES.forEach((p, i) => {
    const rows = input.kpis.filter((r) => r.perspective === p).sort((a, b) => a.seq - b.seq);
    for (let j = 0; j < 30; j++) {
      const row = rows[j],
        r = blocks[i] + j;
      for (const [field, col] of Object.entries(cols)) {
        let value = row?.[field as keyof KPI] ?? null;
        // Guideline 6: the objective is written on the first row of its group only;
        // following rows of the same objective stay blank (the parser inherits it).
        if (row && field === "objective" && j > 0 && rows[j - 1]?.objective === row.objective)
          value = null;
        if (row && ["measurement", "role", "unit", "polarity", "calc_method"].includes(field))
          value = literal(
            field as keyof typeof OPTIONS,
            String(value),
            { measurement: 7, role: 9, unit: 11, polarity: 13, calc_method: 15 }[field] ?? 0,
          );
        k[`${col}${r}`] = value;
      }
    }
  });
  const a: Record<string, unknown> = {};
  const actCols: Record<string, string> = {
    quarter: "B",
    activity_type: "C",
    title: "D",
    target_group: "E",
    implementer: "F",
    beneficiaries: "G",
    planned: "H",
    achieved: "I",
    kpi_code: "K",
  };
  for (let i = 0; i < 80; i++)
    for (const [field, col] of Object.entries(actCols)) {
      const row = input.activities[i];
      a[`${col}${i + 7}`] = row
        ? field === "activity_type"
          ? literal("activity_type", row.activity_type, 32)
          : field === "kpi_code" ? linkedCode(row, input.kpis) : row[field as keyof Activity]
        : null;
    }
  const rep = input.report;
  // Summary amounts must be real numbers in the sheet, not numeric text.
  const numeric = (v: unknown) =>
    typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : v;
  const s: Record<string, unknown> = {
    D4: input.plan.prepared_by,
    E4: input.plan.approved_by,
    A6: rep?.executive_summary ?? null,
    C18: numeric(rep?.planned_beneficiaries ?? null),
  };
  const sections = [
    {
      key: "annual_stats",
      start: 26,
      count: 6,
      fields: { category: "B", previous: "C", current: "D", note: "F" },
    },
    {
      key: "achievements",
      start: 35,
      count: 8,
      fields: { achievement: "B", area: "C", impact: "D", kpi_code: "E", note: "F" },
    },
    {
      key: "challenges",
      start: 46,
      count: 6,
      fields: {
        challenge: "B",
        category: "C",
        impact: "D",
        reasons: "E",
        action: "F",
        status: "G",
        notes: "H",
      },
    },
    {
      key: "proposals",
      start: 55,
      count: 8,
      fields: {
        proposal: "B",
        justification: "C",
        impact: "D",
        priority: "E",
        cost: "F",
        timeline: "G",
        notes: "H",
      },
    },
  ] as const;
  for (const section of sections) {
    const rows = rep?.[section.key] ?? [];
    if (rows.length > section.count) throw new Error("summary_export_limit");
    for (let i = 0; i < section.count; i++)
      for (const [field, col] of Object.entries(section.fields)) {
        const value = field === "kpi_code" && rows[i] ? linkedCode(rows[i], input.kpis) : rows[i]?.[field] ?? null;
        const isAmount =
          (section.key === "annual_stats" && (field === "previous" || field === "current")) ||
          (section.key === "proposals" && field === "cost");
        s[`${col}${section.start + i}`] = isAmount ? numeric(value) : value;
      }
  }
  const workbookDoc = readXml(strFromU8(zip["xl/workbook.xml"]));
  const relDoc = readXml(strFromU8(zip["xl/_rels/workbook.xml.rels"]));
  const map = new Map<string, string>();
  for (const rel of Array.from(relDoc.getElementsByTagName("Relationship"))) {
    const target = rel.getAttribute("Target");
    if (target) map.set(rel.getAttribute("Id") ?? "", target.startsWith("/") ? target.slice(1) : `xl/${target}`);
  }
  const edits: Record<string, Record<string, unknown>> = { "KPI Tracking": k, "الأنشطة": a, "الملخص": s };
  const found = new Set<string>();
  for (const sheet of Array.from(workbookDoc.getElementsByTagName("sheet"))) {
    const name = sheet.getAttribute("name") ?? "";
    if (!(name in edits)) continue;
    const path = map.get(sheet.getAttribute("r:id") ?? "");
    if (!path || !zip[path]) throw new Error("missing_sheets");
    zip[path] = strToU8(fillSheet(strFromU8(zip[path]), edits[name]));
    found.add(name);
  }
  if (found.size !== 3) throw new Error("missing_sheets");
  let calc = workbookDoc.getElementsByTagName("calcPr")[0];
  if (!calc) {
    calc = workbookDoc.createElementNS(workbookDoc.documentElement?.namespaceURI ?? null, "calcPr");
    workbookDoc.documentElement?.appendChild(calc);
  }
  calc.setAttribute("fullCalcOnLoad", "1"); calc.setAttribute("forceFullCalc", "1"); calc.setAttribute("calcMode", "auto");
  zip["xl/workbook.xml"] = strToU8(writeXml(workbookDoc));
  return zipSync(zip);
}
