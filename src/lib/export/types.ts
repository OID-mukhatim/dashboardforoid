/** Unified report model: every section builds one ReportDocument; renderers turn it into PDF / Word / Excel. */
export type Cell = string | number | null;
export type Align = "start" | "center" | "end";
export type Column = { ar: string; en: string; computed?: boolean; align?: Align };
export type Block =
  | { type: "table"; columns: Column[]; rows: Cell[][]; totalsRow?: Cell[] }
  | { type: "kv"; items: { ar: string; en: string; value: Cell; computed?: boolean }[] }
  | { type: "text"; value: string }
  | { type: "subheading"; ar: string; en: string };
export type Section = { titleAr: string; titleEn: string; orientation: "portrait" | "landscape"; blocks: Block[] };
export type ReportStatus = "approved" | "draft" | "live";
export type ReportDocument = {
  titleAr: string;
  titleEn: string;
  /** Short English slug used in the file name. */
  slug: string;
  meta: {
    org: string; orgCode: string; year: string | number | null; period: string | null;
    preparedBy: string | null; approvedBy: string | null; approvedAt: string | null;
    extractedAt: string; status: ReportStatus;
  };
  sections: Section[];
};
export type ExportFormat = "pdf" | "docx" | "xlsx";
