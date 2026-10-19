import { createFileRoute } from "@tanstack/react-router";
import { InitiativesSection } from "../sections/InitiativesSection";

export const Route = createFileRoute("/_authenticated/_shell/initiatives")({
  head: () => ({ meta: [
    { title: "المبادرات التطويرية | Initiatives — OID" },
    { name: "description", content: "المبادرات التطويرية في لوحة مكتب الإشراف والتطوير المؤسسي." },
    { property: "og:title", content: "المبادرات التطويرية | Initiatives — OID" },
    { property: "og:description", content: "المبادرات التطويرية في لوحة مكتب الإشراف والتطوير المؤسسي." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <InitiativesSection />,
});
