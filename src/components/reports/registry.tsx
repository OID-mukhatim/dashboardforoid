import type { ReactNode } from "react";
import type { ReportPeriod, ReportSnapshot } from "@/lib/reports/build";
import type { Lang } from "@/lib/i18n";
import { KpiResultView, OperationalView, InitiativesView } from "./sections";

/** Report section registry: add financial / partnerships sections here later without rebuilding the report. */
export type ReportSectionDef = {
  id: string;
  title: [string, string];
  /** Section data collected from the full report snapshot. */
  collect: (s: ReportSnapshot) => unknown;
  /** Read view (narrative sections are rendered by the editor instead). */
  render?: (data: any, lang: Lang) => ReactNode;
  narrative?: "executive_summary" | "annual_stats" | "achievements" | "challenges" | "proposals";
  only?: (p: ReportPeriod) => boolean;
};

export const REPORT_SECTIONS: ReportSectionDef[] = [
  { id: "executive", title: ["الملخص التنفيذي", "Executive summary"], collect: (s) => s.executive, narrative: "executive_summary" },
  { id: "kpi", title: ["نتيجة مؤشرات الأداء", "KPI results"], collect: (s) => s.kpi, render: (d, l) => <KpiResultView data={d} lang={l} /> },
  { id: "operational", title: ["ملخص الخطة التشغيلية", "Operational plan summary"], collect: (s) => s.operational, render: (d, l) => <OperationalView data={d} lang={l} /> },
  { id: "initiatives", title: ["المبادرات التطويرية", "Development initiatives"], collect: (s) => s.initiatives, render: (d, l) => <InitiativesView data={d} lang={l} /> },
  { id: "annual_stats", title: ["الإحصاءات السنوية", "Annual statistics"], collect: (s) => s.annual_stats, narrative: "annual_stats", only: (p) => p === "annual" },
  { id: "achievements", title: ["أبرز الإنجازات", "Key achievements"], collect: (s) => s.achievements, narrative: "achievements" },
  { id: "challenges", title: ["التحديات", "Challenges"], collect: (s) => s.challenges, narrative: "challenges" },
  { id: "proposals", title: ["المقترحات لمجلس الأمناء", "Proposals to the Board"], collect: (s) => s.proposals, narrative: "proposals" },
];
