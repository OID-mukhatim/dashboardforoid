import { createFileRoute } from "@tanstack/react-router";
import { GapsSection } from "../sections/GapsSection";

export const Route = createFileRoute("/_authenticated/_shell/gaps")({
  head: () => ({ meta: [
    { title: "تحليل الفجوات | Gap analysis — OID" },
    { name: "description", content: "تحليل الفجوات في لوحة مكتب الإشراف والتطوير المؤسسي." },
    { property: "og:title", content: "تحليل الفجوات | Gap analysis — OID" },
    { property: "og:description", content: "تحليل الفجوات في لوحة مكتب الإشراف والتطوير المؤسسي." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <GapsSection />,
});
