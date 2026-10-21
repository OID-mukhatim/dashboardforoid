import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { renderPrintHtml } from "@/lib/export/render-html";
import { exportFileName } from "@/lib/export/filename";
import { PRINT_KEY } from "@/lib/export/deliver";
import type { ReportDocument } from "@/lib/export/types";

export const Route = createFileRoute("/print/report")({
  head: () => ({
    meta: [
      { title: "طباعة التقرير — مكتب الإشراف والتطوير المؤسسي" },
      { name: "description", content: "صفحة طباعة تقارير مكتب الإشراف والتطوير المؤسسي وحفظها PDF." },
      { property: "og:title", content: "طباعة التقرير — OID" },
      { property: "og:description", content: "صفحة طباعة تقارير المكتب." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PrintReport,
});

/** Reads the prepared report from this browser tab session only (no data fetch), then opens the print dialog. */
function PrintReport() {
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    const raw = sessionStorage.getItem(PRINT_KEY) ?? window.opener?.sessionStorage?.getItem(PRINT_KEY);
    if (!raw) { setMissing(true); return; }
    const doc = JSON.parse(raw) as ReportDocument;
    const html = renderPrintHtml(doc).replace(/<title>.*?<\/title>/, `<title>${exportFileName(doc, "pdf").replace(/\.pdf$/, "")}</title>`);
    document.open(); document.write(html); document.close();
    const go = () => setTimeout(() => window.print(), 300);
    if (document.fonts?.ready) document.fonts.ready.then(go); else go();
  }, []);
  return <p dir="rtl" style={{ padding: 32 }}>{missing ? "لا يوجد تقرير للطباعة — أعد التصدير من المنصة." : "جارٍ تجهيز التقرير…"}</p>;
}
