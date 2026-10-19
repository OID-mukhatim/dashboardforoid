/** Server-only spreadsheet parsing shared by parseUpload and processUpload. */
import { z } from "zod";
import { parseQuarterlySheet } from "./quarterly-parse";
import { toNum, toStr, normalizeEntity, detectKnownOrg, classifyAxis, looksLikeNetworksSheet, looksLikeGapFile, looksLikeGovFile, GOV_TEXT_SCORE, AGREE_TEXT_SCORE, textToScore, normDomainKey, detectProfileLayout, looksLikeKpiFile, isInstitutionalDataType, isKpiDataType, findKpiHeaderRow, entityFromKpiCode, kpiColumnMap, hasKpiStructure, isValidKpiRow, spreadsheetTextPreview, ACADEMIC_ORGS, kpiCodeWithYear } from "./uploads.functions";
import type { MatrixBucket } from "./uploads.functions";

export async function runParseUpload(data: { uploadId: string; filePath: string; planYear?: number }) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const XLSX = await import("xlsx");

    const startedAt = Date.now();
    const PHASES = ["downloading", "reading_sheets", "matching", "upserting", "done"] as const;
    type Phase = typeof PHASES[number];
    const PHASE_LABELS: Record<Phase, string> = {
      downloading: "تنزيل الملف",
      reading_sheets: "قراءة الأوراق",
      matching: "مطابقة وتجهيز",
      upserting: "حفظ في قاعدة البيانات",
      done: "اكتمل",
    };
    async function setProgress(phase: Phase, percent: number, message?: string) {
      const elapsed = Date.now() - startedAt;
      const eta_ms = percent > 5 && percent < 100 ? Math.round((elapsed / percent) * (100 - percent)) : null;
      await supabaseAdmin
        .from("uploads")
        .update({
          status: phase === "done" ? "processed" : "processing",
          progress: {
            phase,
            label: PHASE_LABELS[phase],
            percent,
            message: message ?? null,
            elapsed_ms: elapsed,
            eta_ms,
            started_at: new Date(startedAt).toISOString(),
            updated_at: new Date().toISOString(),
          } as unknown as never,
        })
        .eq("id", data.uploadId);
    }

    await setProgress("downloading", 5);

    const { data: uploadRow } = await supabaseAdmin
      .from("uploads")
      .select("period, file_name, data_type, org_id")
      .eq("id", data.uploadId)
      .maybeSingle();
    const period = uploadRow?.period ?? "all";
    const planYear = data.planYear ?? Number(String(period).match(/20\d{2}/)?.[0] ?? 2026);
    const originalFileName = uploadRow?.file_name ?? data.filePath;
    const selectedDataType = uploadRow?.data_type ?? "";

    const { data: file, error: dlErr } = await supabaseAdmin.storage
      .from("uploads")
      .download(data.filePath);
    if (dlErr || !file) {
      await supabaseAdmin
        .from("uploads")
        .update({ status: "error", error_message: dlErr?.message ?? "download failed", progress: null })
        .eq("id", data.uploadId);
      throw new Error(dlErr?.message ?? "download failed");
    }

    await setProgress("reading_sheets", 20);

    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      const wb = XLSX.read(buf, { type: "array" });

      const fileIsInstitutional = isInstitutionalDataType(selectedDataType) || looksLikeNetworksSheet(originalFileName) || looksLikeNetworksSheet(data.filePath);
      const fileIsKpi = isKpiDataType(selectedDataType) || looksLikeKpiFile(originalFileName) || looksLikeKpiFile(data.filePath);
      const fileIsGap = looksLikeGapFile(originalFileName) || looksLikeGapFile(data.filePath);
      const fileIsGov = looksLikeGovFile(originalFileName) || looksLikeGovFile(data.filePath);

      let lastSector: string | null = null;
      const kpiRows: Array<Record<string, unknown>> = [];
      const sheetsSummary: Array<{ name: string; rows: number; kpis: number; matrix?: number; skipped?: boolean; reason?: string }> = [];
      const matrixRows: Array<Record<string, unknown>> = [];
      const spreadsheetExtracts: Array<Record<string, unknown>> = [];
      const quarterlyRows: Array<Record<string, unknown>> = [];

      // Per-org accumulator for Gaps/Governance template files.
      // Merged into matrixRows after the per-sheet loop.
      type OrgAccum = {
        name: string;
        gapDomain: Record<string, number[]>; // canonical domain → samples (0..5)
        gapOverall: number[]; // overall gap samples (when only a single avg is available)
        govSamples: number[];
        sources: Set<string>;
      };
      const orgAccum: Record<string, OrgAccum> = {};
      const ensureOrg = (code: string, name: string): OrgAccum => {
        if (!orgAccum[code]) orgAccum[code] = { name, gapDomain: {}, gapOverall: [], govSamples: [], sources: new Set() };
        return orgAccum[code];
      };


      const totalSheets = wb.SheetNames.length;
      for (let si = 0; si < totalSheets; si++) {
        const sheetName = wb.SheetNames[si];
        const ws = wb.Sheets[sheetName];
        const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });
        const normalized = normalizeEntity(sheetName);
        const entityCode = normalized.code;
        const entityName = normalized.name;
        let kpiCount = 0;
        let matrixCount = 0;
        lastSector = null;
        const kpiHeaderIdx = findKpiHeaderRow(aoa);
        const sheetLooksKpi = kpiHeaderIdx >= 0 && (fileIsKpi || looksLikeKpiFile(sheetName) || hasKpiStructure(aoa));

        // ── Gaps / Governance template branch ────────────────────────────────
        // Handles three layouts found in OID Gaps & Governance workbooks:
        //  A) "Domain report": sections headed by "محور …" then a header row
        //     containing "الجهة" and ending with "متوسط المحور".
        //  B) "Org-columns matrix": row with ≥3 known orgs as column headers
        //     and criterion labels in the leftmost label column (numeric or
        //     textual cell values).
        //  C) "Org-rows survey" (Form1): each data row is one org response
        //     with a long series of textual answers.
        if (fileIsGap || fileIsGov) {
          let consumed = false;
          let consumedRows = 0;

          // (A) Domain-section layout — taqreer "البيانات".
          for (let r = 0; r < aoa.length; r++) {
            const row = aoa[r];
            if (!Array.isArray(row)) continue;
            const first = toStr(row[0]) ?? "";
            const second = toStr(row[1]) ?? "";
            // Section title cell ("محور …") sitting alone in column A.
            const titleCell = first || second;
            if (!/^محور\s+/.test(titleCell)) continue;
            const domain = normDomainKey(titleCell);
            if (!domain) continue;
            // Find next header row containing "الجهة" with an average column.
            let hdr = -1;
            for (let h = r + 1; h < Math.min(r + 4, aoa.length); h++) {
              const hr = aoa[h];
              if (!Array.isArray(hr)) continue;
              if (hr.some((v) => /الجهة|المؤسسة/.test(String(v ?? "")))) { hdr = h; break; }
            }
            if (hdr < 0) continue;
            const hdrRow = aoa[hdr] as unknown[];
            const avgIdx = hdrRow.findIndex((v) => /متوسط\s*المحور|average/i.test(String(v ?? "")));
            const orgIdx = hdrRow.findIndex((v) => /الجهة|المؤسسة|entity|organization/i.test(String(v ?? "")));
            for (let d = hdr + 1; d < aoa.length; d++) {
              const dr = aoa[d];
              if (!Array.isArray(dr)) break;
              const orgCell = orgIdx >= 0 ? dr[orgIdx] : dr[1];
              const org = detectKnownOrg(orgCell);
              if (!org) {
                // Stop when we hit the next section header.
                if (typeof orgCell === "string" && /^محور\s+/.test(orgCell)) break;
                if (dr.every((v) => v === null || v === undefined || String(v).trim() === "")) break;
                continue;
              }
              let avg: number | null = null;
              if (avgIdx >= 0) avg = toNum(dr[avgIdx]);
              if (avg === null) {
                // Compute from criterion columns (numeric cells between org and end).
                const nums: number[] = [];
                for (let c = (orgIdx >= 0 ? orgIdx + 1 : 2); c < dr.length; c++) {
                  const n = toNum(dr[c]);
                  if (n !== null && n <= 5) nums.push(n);
                }
                if (nums.length) avg = nums.reduce((a, b) => a + b, 0) / nums.length;
              }
              if (avg === null) continue;
              const acc = ensureOrg(org.code, org.name);
              acc.sources.add(sheetName);
              (acc.gapDomain[domain] ??= []).push(avg);
              if (domain === "الحوكمة والامتثال") acc.govSamples.push(avg);
              consumedRows += 1;
            }
            consumed = true;
          }

          // (B) Orgs-as-columns criterion matrix — bayanat "تقرير مفصل"/
          //     "النتائج المباشرة" or taqreer "نتائج تقييم السياسات".
          if (!consumed) {
            for (let r = 0; r < Math.min(aoa.length, 12); r++) {
              const row = aoa[r];
              if (!Array.isArray(row)) continue;
              const orgCols: Array<{ idx: number; code: string; name: string }> = [];
              const seen = new Set<string>();
              for (let c = 0; c < row.length; c++) {
                const hit = detectKnownOrg(row[c]);
                if (hit && !seen.has(hit.code)) { seen.add(hit.code); orgCols.push({ idx: c, ...hit }); }
              }
              if (orgCols.length < 3) continue;
              // Accumulate per-org averages over subsequent criterion rows.
              const perOrg: Record<string, number[]> = {};
              for (const o of orgCols) perOrg[o.code] = [];
              for (let d = r + 1; d < aoa.length; d++) {
                const dr = aoa[d];
                if (!Array.isArray(dr)) continue;
                if (dr.every((v) => v === null || v === undefined || String(v).trim() === "")) continue;
                for (const o of orgCols) {
                  const raw = dr[o.idx];
                  let v = toNum(raw);
                  if (v === null) v = textToScore(raw, GOV_TEXT_SCORE) ?? textToScore(raw, AGREE_TEXT_SCORE);
                  if (v === null) continue;
                  if (v > 5) v = Math.max(0, Math.min(5, v / 20));
                  perOrg[o.code].push(v);
                }
              }
              let anyCaptured = false;
              for (const o of orgCols) {
                const vs = perOrg[o.code];
                if (!vs.length) continue;
                const avg = vs.reduce((a, b) => a + b, 0) / vs.length;
                const acc = ensureOrg(o.code, o.name);
                acc.sources.add(sheetName);
                if (fileIsGov) acc.govSamples.push(avg);
                else acc.gapOverall.push(avg);
                anyCaptured = true;
                consumedRows += 1;
              }
              if (anyCaptured) { consumed = true; break; }
            }
          }

          // (C) Orgs-as-rows survey form (Form1) — each row is one respondent.
          if (!consumed) {
            // Find the org-name column in the first 4 rows.
            for (let r = 0; r < Math.min(aoa.length, 4); r++) {
              const row = aoa[r];
              if (!Array.isArray(row)) continue;
              const orgColIdx = row.findIndex((v) => /اسم\s*المؤسسة|entity\s*name|organization\s*name/i.test(String(v ?? "")));
              if (orgColIdx < 0) continue;
              const scaleTable = fileIsGov ? GOV_TEXT_SCORE : AGREE_TEXT_SCORE;
              for (let d = r + 1; d < aoa.length; d++) {
                const dr = aoa[d];
                if (!Array.isArray(dr)) continue;
                const org = detectKnownOrg(dr[orgColIdx]);
                if (!org) continue;
                const vals: number[] = [];
                for (let c = orgColIdx + 1; c < dr.length; c++) {
                  const v = textToScore(dr[c], scaleTable);
                  if (v !== null) vals.push(v);
                }
                if (!vals.length) continue;
                const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
                const acc = ensureOrg(org.code, org.name);
                acc.sources.add(sheetName);
                if (fileIsGov) acc.govSamples.push(avg);
                else acc.gapOverall.push(avg);
                consumedRows += 1;
              }
              if (consumedRows > 0) { consumed = true; break; }
            }
          }

          if (consumed) {
            sheetsSummary.push({ name: sheetName, rows: aoa.length, kpis: 0, matrix: consumedRows });
            const sheetPct = 20 + Math.round(((si + 1) / totalSheets) * 30);
            await setProgress("reading_sheets", sheetPct, `ورقة ${si + 1}/${totalSheets}: ${sheetName} (${fileIsGov ? "حوكمة" : "فجوات"})`);
            continue;
          }
        }


        // ── Profile layout branch (نموذج 1 — orgs as columns, fields as rows) ──
        if (fileIsInstitutional || looksLikeNetworksSheet(sheetName)) {
          const profile = detectProfileLayout(aoa);
          if (profile) {
            const perOrg: Record<string, Record<string, string>> = {};
            const orgNames: Record<string, string> = {};
            for (const o of profile.orgCols) { perOrg[o.code] = {}; orgNames[o.code] = o.name; }
            let currentSection: string | null = null;
            for (let r = profile.headerIdx + 1; r < aoa.length; r++) {
              const row = aoa[r];
              if (!Array.isArray(row)) continue;
              const label = toStr(row[1]) ?? toStr(row[0]);
              if (!label) continue;
              const numCol = toStr(row[0]) ?? "";
              const isSection = numCol === "#" || profile.orgCols.every((o) => {
                const v = row[o.idx];
                return v === null || v === undefined || String(v).trim() === "";
              });
              if (isSection && numCol === "#") { currentSection = label; continue; }
              for (const o of profile.orgCols) {
                const v = row[o.idx];
                if (v === null || v === undefined) continue;
                const str = v instanceof Date
                  ? v.toISOString().slice(0, 10)
                  : String(v).replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
                if (!str) continue;
                const key = currentSection ? `${currentSection} › ${label}` : label;
                perOrg[o.code][key] = str;
              }
            }
            let saved = 0;
            for (const o of profile.orgCols) {
              const fields = perOrg[o.code];
              const count = Object.keys(fields).length;
              if (count === 0) continue;
              matrixRows.push({
                upload_id: data.uploadId,
                kind: "institutional_profile",
                entity_code: o.code,
                file_path: data.filePath,
                file_name: originalFileName,
                payload: { fields, source_sheet: sheetName, field_count: count } as unknown as never,
                summary: `ملف مؤسسي — ${o.name} (${count} حقل)`,
                org_mentions: [o.code] as unknown as never,
                entities: [{ code: o.code, name: o.name }] as unknown as never,
                numbers_found: [] as unknown as never,
              });
              saved += 1;
              matrixCount += 1;
            }
            if (saved > 0) {
              sheetsSummary.push({ name: sheetName, rows: aoa.length, kpis: 0, matrix: saved });
              const sheetPct = 20 + Math.round(((si + 1) / totalSheets) * 30);
              await setProgress("reading_sheets", sheetPct, `ورقة ${si + 1}/${totalSheets}: ${sheetName} (ملفات مؤسسية: ${saved})`);
              continue;
            }
          }
        }

        // ── Institutional matrix branch (Networks/الشبكات consolidated sheet) ──
        // Detects: org name in any early column + axis headers in remaining columns.
        if (fileIsInstitutional || looksLikeNetworksSheet(sheetName)) {
          // Find the header row: the first row that contains at least one axis we can classify.

          let headerIdx = -1;
          let headerCols: { idx: number; bucket: MatrixBucket; key: string }[] = [];
          let orgColIdx = -1;
          for (let r = 0; r < Math.min(aoa.length, 15); r++) {
            const row = aoa[r];
            if (!Array.isArray(row)) continue;
            const classified = row.map((cell, idx) => ({ idx, ...classifyAxis(toStr(cell) ?? "") }));
            const axes = classified.filter((c) => c.bucket !== null);
            if (axes.length >= 3) {
              headerIdx = r;
              headerCols = axes;
              // Org column is the first non-empty, non-axis text column.
              for (let c = 0; c < row.length; c++) {
                if (axes.some((a) => a.idx === c)) continue;
                const t = toStr(row[c]) ?? "";
                if (/مؤسسة|الكيان|المنظمة|entity|organization|اسم/i.test(t)) { orgColIdx = c; break; }
              }
              if (orgColIdx < 0) orgColIdx = 0;
              break;
            }
          }

          if (headerIdx >= 0) {
            for (let r = headerIdx + 1; r < aoa.length; r++) {
              const row = aoa[r];
              if (!Array.isArray(row)) continue;
              // Try the candidate org cell first, then scan any cell for a known org.
              let org = detectKnownOrg(row[orgColIdx]);
              if (!org) {
                for (const cell of row) {
                  const hit = detectKnownOrg(cell);
                  if (hit) { org = hit; break; }
                }
              }
              if (!org) continue;

              const payload: { gaps: Record<string, number>; gov?: number; fin?: number; maturity?: number } = { gaps: {} };
              for (const h of headerCols) {
                const raw = toNum(row[h.idx]);
                if (raw === null) continue;
                // Normalise to 0..5 scale (accept percentages too).
                const score = raw > 5 ? Math.max(0, Math.min(5, raw / 20)) : raw;
                if (h.bucket === "gap") payload.gaps[h.key] = score;
                else if (h.bucket === "gov") payload.gov = score;
                else if (h.bucket === "fin") payload.fin = score;
                else if (h.bucket === "maturity") payload.maturity = Math.round(raw);
              }
              if (Object.keys(payload.gaps).length === 0 && payload.gov == null && payload.fin == null && payload.maturity == null) continue;

              matrixRows.push({
                upload_id: data.uploadId,
                kind: "institutional_matrix",
                entity_code: org.code,
                file_path: data.filePath,
                file_name: originalFileName,
                payload: payload as unknown as never,
                summary: `مصفوفة مؤسسية — ${org.name}`,
                org_mentions: [org.code] as unknown as never,
                entities: [{ code: org.code, name: org.name }] as unknown as never,
                numbers_found: [] as unknown as never,
              });
              matrixCount += 1;
            }
          }
          if (matrixCount === 0) {
            const preview = spreadsheetTextPreview(aoa);
            if (preview) {
              spreadsheetExtracts.push({
                upload_id: data.uploadId,
                kind: "institutional_spreadsheet",
                entity_code: uploadRow?.org_id && uploadRow.org_id !== "الكل" ? uploadRow.org_id : null,
                file_path: data.filePath,
                file_name: originalFileName,
                text_preview: preview,
                payload: { sheet_name: sheetName, rows: aoa.length, selected_data_type: selectedDataType } as unknown as never,
                summary: `بيانات مؤسسية جدولية — ${sheetName}`,
                org_mentions: [] as unknown as never,
                entities: [] as unknown as never,
                numbers_found: [] as unknown as never,
              });
            }
          }
          sheetsSummary.push({ name: sheetName, rows: aoa.length, kpis: 0, matrix: matrixCount, skipped: matrixCount === 0, reason: matrixCount === 0 ? "بيانات مؤسسية غير مطابقة لقالب المصفوفة" : undefined });
          const sheetPct = 20 + Math.round(((si + 1) / totalSheets) * 30);
          await setProgress("reading_sheets", sheetPct, `ورقة ${si + 1}/${totalSheets}: ${sheetName} (مصفوفة مؤسسية)`);
          continue;
        }

        // ── قالب التقرير الربعي ──────────────────────────────────────────────
        {
          const qr = parseQuarterlySheet(aoa);
          if (qr) {
            const orgHit = detectKnownOrg(qr.orgName ?? "") ?? detectKnownOrg(originalFileName);
            const yearMatch = (originalFileName + " " + data.filePath).match(/20\d{2}/);
            const quarterMatch = qr.quarter ?? ((originalFileName + " " + data.filePath).match(/Q[1-4]/i)?.[0]?.toUpperCase() ?? null);
            quarterlyRows.push({
              upload_id: data.uploadId,
              kind: "quarterly_report",
              entity_code: orgHit?.code ?? null,
              file_path: data.filePath,
              file_name: originalFileName,
              text_preview: spreadsheetTextPreview(aoa),
              payload: {
                ...qr,
                quarter: quarterMatch,
                year: yearMatch ? Number(yearMatch[0]) : null,
                org_code: orgHit?.code ?? null,
                sheet_name: sheetName,
              } as unknown as never,
              summary: `تقرير ربعي — ${orgHit?.name ?? qr.orgName ?? originalFileName} (${quarterMatch ?? "?"})`,
              org_mentions: (orgHit ? [orgHit.code] : []) as unknown as never,
              entities: (orgHit ? [{ code: orgHit.code, name: orgHit.name }] : []) as unknown as never,
              numbers_found: [] as unknown as never,
            });
            sheetsSummary.push({
              name: sheetName,
              rows: aoa.length,
              kpis: 0,
              reason: `تقرير ربعي: ${qr.achievements.length} إنجاز، ${qr.events.length} فعالية، ${qr.challenges.length} تحدٍ، ${qr.recommendations.length} توصية`,
            });
            const sheetPct = 20 + Math.round(((si + 1) / totalSheets) * 30);
            await setProgress("reading_sheets", sheetPct, `ورقة ${si + 1}/${totalSheets}: ${sheetName} (تقرير ربعي)`);
            continue;
          }
        }


        if (!sheetLooksKpi) {
          const preview = spreadsheetTextPreview(aoa);
          if (preview) {
            spreadsheetExtracts.push({
              upload_id: data.uploadId,
              kind: "spreadsheet_data",
              entity_code: uploadRow?.org_id && uploadRow.org_id !== "الكل" ? uploadRow.org_id : null,
              file_path: data.filePath,
              file_name: originalFileName,
              text_preview: preview,
              payload: { sheet_name: sheetName, rows: aoa.length, selected_data_type: selectedDataType } as unknown as never,
              summary: `بيانات جدولية غير مصنفة كمؤشرات — ${sheetName}`,
              org_mentions: [] as unknown as never,
              entities: [] as unknown as never,
              numbers_found: [] as unknown as never,
            });
          }
          sheetsSummary.push({ name: sheetName, rows: aoa.length, kpis: 0, skipped: true, reason: "ليست قالب مؤشرات أداء" });
          const sheetPct = 20 + Math.round(((si + 1) / totalSheets) * 30);
          await setProgress("reading_sheets", sheetPct, `ورقة ${si + 1}/${totalSheets}: ${sheetName} (ليست مؤشرات)`);
          continue;
        }

        const cols = kpiColumnMap(aoa, kpiHeaderIdx);
        const rowsToParse = kpiHeaderIdx >= 0 ? aoa.slice(kpiHeaderIdx + 1) : aoa;
        // كشف النسبة من تنسيق خلية Excel (cell.z يحتوي %) — بديل القاعدة التلقائية ≤1×100
        const pctCell = (sheetRow: number, colIdx: number): number | null => {
          if (colIdx < 0) return null;
          const cell = (ws as Record<string, { z?: string } | undefined>)[XLSX.utils.encode_cell({ r: sheetRow, c: colIdx })];
          return typeof cell?.z === "string" && cell.z.includes("%") ? 100 : 1;
        };
        const pctVal = (row: unknown[], sheetRow: number, colIdx: number): number | null => {
          const n = toNum(row[colIdx]);
          return n === null ? null : n * (pctCell(sheetRow, colIdx) ?? 1);
        };
        for (const [ri, row] of rowsToParse.entries()) {
          if (!Array.isArray(row)) continue;
          if (!isValidKpiRow(row, cols)) continue;
          const sheetRow = (kpiHeaderIdx >= 0 ? kpiHeaderIdx + 1 : 0) + ri;
          const code = toStr(row[cols.code]);
          const name = toStr(row[cols.name]);

          const sector = toStr(row[cols.sector]);
          if (sector) lastSector = sector;

          const rowOrg = entityFromKpiCode(code);
          const rowEntity = rowOrg ?? entityCode;
          kpiRows.push({
            upload_id: data.uploadId,
            entity_code: rowEntity,
            entity_name: rowOrg && rowOrg !== entityCode ? normalizeEntity(rowOrg).name : entityName,
            sector: lastSector,
            objective: toStr(row[cols.objective]),
            kpi_code: kpiCodeWithYear(code, planYear),
            plan_year: planYear,
            is_baseline: planYear === 2026,
            fiscal_type: ACADEMIC_ORGS.has(rowEntity) ? "academic" : "calendar",
            kpi_name: name,
            kpi_type: toStr(row[cols.type]),
            unit: cols.unit >= 0 ? toStr(row[cols.unit]) : null,
            polarity: cols.polarity >= 0 ? toStr(row[cols.polarity]) : null,
            frequency: cols.frequency >= 0 ? toStr(row[cols.frequency]) : null,
            weight: toNum(row[cols.weight]),
            baseline: toNum(row[cols.baseline]),
            annual_target: toNum(row[cols.target]),
            q1_planned: toNum(row[cols.q1p]),
            q2_planned: toNum(row[cols.q2p]),
            q3_planned: toNum(row[cols.q3p]),
            q4_planned: toNum(row[cols.q4p]),
            total_planned: toNum(row[cols.totalPlanned]),
            q1_actual: toNum(row[cols.q1a]),
            q2_actual: toNum(row[cols.q2a]),
            q3_actual: toNum(row[cols.q3a]),
            q4_actual: toNum(row[cols.q4a]),
            total_actual: toNum(row[cols.totalActual]),
            achievement_pct: pctVal(row, sheetRow, cols.achievement),
            overall_pct: pctVal(row, sheetRow, cols.overall),
            final_output: toStr(row[cols.output]),
            period,
            raw: { row } as unknown as never,
          });
          kpiCount += 1;
        }
        sheetsSummary.push({ name: sheetName, rows: aoa.length, kpis: kpiCount });
        const sheetPct = 20 + Math.round(((si + 1) / totalSheets) * 30); // 20→50
        await setProgress("reading_sheets", sheetPct, `ورقة ${si + 1}/${totalSheets}: ${sheetName}`);
      }

      // Flush Gap/Governance accumulator into institutional_matrix rows.
      const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
      for (const [code, acc] of Object.entries(orgAccum)) {
        const gaps: Record<string, number> = {};
        for (const [domain, samples] of Object.entries(acc.gapDomain)) {
          if (samples.length) gaps[domain] = Math.round(avg(samples) * 100) / 100;
        }
        if (acc.gapOverall.length) {
          gaps["متوسط عام"] = Math.round(avg(acc.gapOverall) * 100) / 100;
        }
        const payload: { gaps: Record<string, number>; gov?: number; fin?: number } = { gaps };
        if (acc.govSamples.length) payload.gov = Math.round(avg(acc.govSamples) * 100) / 100;
        if (gaps["الاستدامة المالية"] != null) payload.fin = gaps["الاستدامة المالية"];
        if (Object.keys(gaps).length === 0 && payload.gov == null) continue;
        matrixRows.push({
          upload_id: data.uploadId,
          kind: "institutional_matrix",
          entity_code: code,
          file_path: data.filePath,
          file_name: originalFileName,
          payload: payload as unknown as never,
          summary: `${fileIsGov ? "حوكمة" : "فجوات"} — ${acc.name}`,
          org_mentions: [code] as unknown as never,
          entities: [{ code, name: acc.name }] as unknown as never,
          numbers_found: [] as unknown as never,
        });
      }


      // Reprocessing must remove stale derived rows from the same upload first.
      await supabaseAdmin.from("kpis").delete().eq("upload_id", data.uploadId);
      await supabaseAdmin.from("document_extractions").delete().eq("upload_id", data.uploadId);

      // Persist institutional matrix rows (replace previous for same upload).
      if (matrixRows.length) {
        const { error: mErr } = await supabaseAdmin
          .from("document_extractions")
          .insert(matrixRows as never);
        if (mErr) throw mErr;
      }

      if (quarterlyRows.length) {
        const { error: qErr } = await supabaseAdmin
          .from("document_extractions")
          .insert(quarterlyRows as never);
        if (qErr) throw qErr;

        // مزامنة تلقائية مع جدول quarterly_reports (fire-and-forget)
        void Promise.allSettled(
          quarterlyRows.map((row) => {
            const payload = (row.payload ?? {}) as Record<string, unknown>;
            const orgCode = (row.entity_code as string | null) ?? ((payload.org_code as string | null) ?? null);
            if (!orgCode) return Promise.resolve();
            const year = typeof payload.year === "number" ? payload.year : 2026;
            const quarter = String(payload.quarter ?? "Q1");
            const title = `تقرير ${quarter} ${year} — ${String(payload.orgName ?? row.file_name ?? "نشاط")}`;
            return supabaseAdmin
              .from("quarterly_reports")
              .upsert(
                {
                  org_id: orgCode,
                  year,
                  quarter,
                  title,
                  raw: payload as never,
                  upload_id: (row.upload_id as string | null) ?? null,
                },
                { onConflict: "org_id,year,quarter,title" },
              );
          }),
        ).then((results) => {
          for (const r of results) if (r.status === "rejected") console.warn("[quarterly sync]", r.reason);
        });
      }

      if (spreadsheetExtracts.length) {
        const { error: sErr } = await supabaseAdmin
          .from("document_extractions")
          .insert(spreadsheetExtracts as never);
        if (sErr) throw sErr;
      }


      await setProgress("matching", 55, kpiRows.length ? `${kpiRows.length} صف للمطابقة` : "لا توجد صفوف مؤشرات مطابقة");

      // سنة الأساس = أقدم سنة متاحة للمؤسسة (قاعدة البيانات + الملف الحالي) — لا سنة ثابتة
      {
        const entities = [...new Set(kpiRows.map((r) => r.entity_code).filter(Boolean))] as string[];
        const minYear = new Map<string, number>();
        for (const ent of entities) {
          const { data: yr } = await supabaseAdmin.from("kpis").select("plan_year").eq("entity_code", ent);
          const years = (yr ?? []).map((r: any) => Number(r.plan_year)).filter(Number.isFinite);
          if (years.length) minYear.set(ent, Math.min(...years));
        }
        for (const row of kpiRows) {
          const cur = Number(row.plan_year);
          if (!Number.isFinite(cur)) continue;
          const base = Math.min(cur, minYear.get(String(row.entity_code ?? "")) ?? cur);
          (row as { is_baseline?: boolean }).is_baseline = cur === base;
        }
      }

      const uniqueRows = Array.from(
        new Map(
          kpiRows.map((row) => [JSON.stringify([row.entity_code, row.kpi_code, row.period]), row]),
        ).values(),
      );
      const duplicateCount = kpiRows.length - uniqueRows.length;

      await setProgress("upserting", 60, `${uniqueRows.length} مؤشر فريد`);

      let upserted = 0;
      const chunk = 200;
      const totalChunks = Math.max(1, Math.ceil(uniqueRows.length / chunk));
      for (let i = 0; i < uniqueRows.length; i += chunk) {
        const slice = uniqueRows.slice(i, i + chunk);
        const { error } = await supabaseAdmin
          .from("kpis")
          .upsert(slice as never, { onConflict: "entity_code,kpi_code,period" });
        if (error) throw error;
        upserted += slice.length;
        const chunkIdx = Math.floor(i / chunk) + 1;
        const pct = 60 + Math.round((chunkIdx / totalChunks) * 38); // 60→98
        await setProgress("upserting", pct, `دفعة ${chunkIdx}/${totalChunks} (${upserted}/${uniqueRows.length})`);
      }

      await supabaseAdmin
        .from("uploads")
        .update({
          status: "processed",
          rows_extracted: upserted || matrixRows.length || quarterlyRows.length || spreadsheetExtracts.length,
          extracted_summary: {
            sheets: sheetsSummary,
            quarterly_reports: quarterlyRows.length,
            classification: quarterlyRows.length ? "quarterly_report" : matrixRows.length ? "institutional_matrix" : kpiRows.length ? "kpi" : fileIsInstitutional ? "institutional_spreadsheet" : "spreadsheet_data",
            selected_data_type: selectedDataType,
            matrix_rows: matrixRows.length,
            spreadsheet_extractions: spreadsheetExtracts.length,
            kpis_read: kpiRows.length,
            kpis_upserted: upserted,
            duplicates_merged: duplicateCount,
          } as unknown as never,
          error_message: null,
          progress: {
            phase: "done",
            label: PHASE_LABELS.done,
            percent: 100,
            elapsed_ms: Date.now() - startedAt,
            eta_ms: 0,
            started_at: new Date(startedAt).toISOString(),
            updated_at: new Date().toISOString(),
          } as unknown as never,
        })
        .eq("id", data.uploadId);

      return { ok: true, upserted, sheets: sheetsSummary };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await supabaseAdmin
        .from("uploads")
        .update({ status: "error", error_message: msg, progress: null })
        .eq("id", data.uploadId);
      throw e;
    }
}
