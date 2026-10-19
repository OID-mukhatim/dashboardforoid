import { createFileRoute } from "@tanstack/react-router";
import { DashboardSection } from "../sections/DashboardSection";

export const Route = createFileRoute("/_authenticated/_shell/dashboard")({
  head: () => ({ meta: [
    { title: "لوحة القيادة | Dashboard — OID" },
    { name: "description", content: "لوحة القيادة في لوحة مكتب الإشراف والتطوير المؤسسي." },
    { property: "og:title", content: "لوحة القيادة | Dashboard — OID" },
    { property: "og:description", content: "لوحة القيادة في لوحة مكتب الإشراف والتطوير المؤسسي." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <DashboardSection />,
});
