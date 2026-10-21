import { createFileRoute } from "@tanstack/react-router";
import { perfQueryOptions } from "@/components/perf/PerformanceSection";
import { ReportsSection } from "@/components/reports/ReportsSection";

export const Route = createFileRoute("/_authenticated/_shell/reports")({
  loader: ({ context }) => context.queryClient.ensureQueryData(perfQueryOptions),
  head: () => ({ meta: [
    { title: "التقارير الربعية والسنوية | Reports — OID" },
    { name: "description", content: "التقرير الشامل الربعي والسنوي لكل مؤسسة مع الاعتماد والتجميد." },
    { property: "og:title", content: "التقارير الربعية والسنوية | Reports — OID" },
    { property: "og:description", content: "التقرير الشامل الربعي والسنوي لكل مؤسسة مع الاعتماد والتجميد." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: ReportsSection,
});
