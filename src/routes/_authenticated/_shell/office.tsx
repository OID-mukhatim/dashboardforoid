import { createFileRoute } from "@tanstack/react-router";
import { OfficeSection } from "../sections/OfficeSection";

export const Route = createFileRoute("/_authenticated/_shell/office")({
  head: () => ({ meta: [
    { title: "أعمال المكتب | Office work — OID" },
    { name: "description", content: "أعمال المكتب في لوحة مكتب الإشراف والتطوير المؤسسي." },
    { property: "og:title", content: "أعمال المكتب | Office work — OID" },
    { property: "og:description", content: "أعمال المكتب في لوحة مكتب الإشراف والتطوير المؤسسي." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <OfficeSection />,
});
