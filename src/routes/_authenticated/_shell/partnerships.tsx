import { createFileRoute } from "@tanstack/react-router";
import { PartnershipsSection } from "../sections/PartnershipsSection";

export const Route = createFileRoute("/_authenticated/_shell/partnerships")({
  head: () => ({ meta: [
    { title: "الشراكات الاستراتيجية | Partnerships — OID" },
    { name: "description", content: "الشراكات الاستراتيجية في لوحة مكتب الإشراف والتطوير المؤسسي." },
    { property: "og:title", content: "الشراكات الاستراتيجية | Partnerships — OID" },
    { property: "og:description", content: "الشراكات الاستراتيجية في لوحة مكتب الإشراف والتطوير المؤسسي." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <PartnershipsSection />,
});
