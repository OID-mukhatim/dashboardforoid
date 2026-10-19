import { createFileRoute } from "@tanstack/react-router";
import { FinancialSection } from "../sections/FinancialSection";

export const Route = createFileRoute("/_authenticated/_shell/financial")({
  head: () => ({ meta: [
    { title: "الأداء المالي | Financial performance — OID" },
    { name: "description", content: "الأداء المالي في لوحة مكتب الإشراف والتطوير المؤسسي." },
    { property: "og:title", content: "الأداء المالي | Financial performance — OID" },
    { property: "og:description", content: "الأداء المالي في لوحة مكتب الإشراف والتطوير المؤسسي." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <FinancialSection />,
});
