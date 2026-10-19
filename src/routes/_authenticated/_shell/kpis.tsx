import { createFileRoute } from "@tanstack/react-router";
import { KPIsSection } from "../sections/KPIsSection";

export const Route = createFileRoute("/_authenticated/_shell/kpis")({
  head: () => ({ meta: [
    { title: "مؤشرات الأداء | KPIs — OID" },
    { name: "description", content: "مؤشرات الأداء في لوحة مكتب الإشراف والتطوير المؤسسي." },
    { property: "og:title", content: "مؤشرات الأداء | KPIs — OID" },
    { property: "og:description", content: "مؤشرات الأداء في لوحة مكتب الإشراف والتطوير المؤسسي." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <KPIsSection />,
});
