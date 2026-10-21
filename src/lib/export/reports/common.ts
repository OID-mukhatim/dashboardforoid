import type { Block, Cell, Column, ReportDocument, ReportStatus, Section } from "../types";
import { optionLabel } from "../../perf/dictionary";

// Keep document values precise; each renderer controls display precision only.
export const r2 = (v: number | null | undefined): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
export const col = (ar: string, en: string, computed = false): Column => ({ ar, en, computed });
export const rate = (k: string | null | undefined): string | null => (k ? optionLabel("rating", k, "ar") : null);
export const persp = (k: string) => optionLabel("perspective", k, "ar");
export const persEn = (k: string) => optionLabel("perspective", k, "en");
export const table = (columns: Column[], rows: Cell[][], totalsRow?: Cell[]): Block => ({ type: "table", columns, rows, totalsRow });
export const section = (titleAr: string, titleEn: string, blocks: Block[], orientation: Section["orientation"] = "portrait"): Section => ({ titleAr, titleEn, orientation, blocks });

export function makeDoc(input: {
  titleAr: string; titleEn: string; slug: string; org: string; orgCode: string;
  year?: string | number | null; period?: string | null; preparedBy?: string | null;
  approvedBy?: string | null; approvedAt?: string | null; status?: ReportStatus; now?: string; sections: Section[];
}): ReportDocument {
  return {
    titleAr: input.titleAr, titleEn: input.titleEn, slug: input.slug,
    meta: {
      org: input.org, orgCode: input.orgCode, year: input.year ?? null, period: input.period ?? null,
      preparedBy: input.preparedBy ?? null, approvedBy: input.approvedBy ?? null, approvedAt: input.approvedAt ?? null,
      extractedAt: input.now ?? new Date().toISOString(), status: input.status ?? "live",
    },
    sections: input.sections,
  };
}
export const periodLabel = (p: string) => (p === "annual" ? "السنوي" : p);
