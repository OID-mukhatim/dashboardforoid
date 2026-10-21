import { createFileRoute } from "@tanstack/react-router";
import { perfQueryOptions } from "@/components/perf/PerformanceSection";
import { ActivitiesLogSection } from "@/components/reports/ActivitiesLogSection";

export const Route = createFileRoute("/_authenticated/_shell/activities")({
  loader: ({ context }) => context.queryClient.ensureQueryData(perfQueryOptions),
  head: () => ({ meta: [
    { title: "سجل البرامج والأنشطة | Activities log — OID" },
    { name: "description", content: "سجل البرامج والفعاليات وبناء القدرات لكل مؤسسة وفترة." },
    { property: "og:title", content: "سجل البرامج والأنشطة | Activities log — OID" },
    { property: "og:description", content: "سجل البرامج والفعاليات وبناء القدرات لكل مؤسسة وفترة." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: ActivitiesLogSection,
});
