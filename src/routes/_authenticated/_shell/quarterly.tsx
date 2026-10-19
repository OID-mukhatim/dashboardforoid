import { createFileRoute } from "@tanstack/react-router";
import { QuarterlySection } from "../sections/QuarterlySection";

export const Route = createFileRoute("/_authenticated/_shell/quarterly")({
  head: () => ({ meta: [
    { title: "التقارير الربعية | Quarterly reports — OID" },
    { name: "description", content: "التقارير الربعية في لوحة مكتب الإشراف والتطوير المؤسسي." },
    { property: "og:title", content: "التقارير الربعية | Quarterly reports — OID" },
    { property: "og:description", content: "التقارير الربعية في لوحة مكتب الإشراف والتطوير المؤسسي." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <QuarterlySection />,
});
