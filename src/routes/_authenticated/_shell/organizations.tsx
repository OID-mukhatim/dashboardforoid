import { createFileRoute } from "@tanstack/react-router";
import { OrganizationsSection } from "../sections/OrganizationsSection";
import { AdminOnly } from "@/components/oid/AdminOnly";

export const Route = createFileRoute("/_authenticated/_shell/organizations")({
  head: () => ({ meta: [
    { title: "إدارة المؤسسات | Institutions — OID" },
    { name: "description", content: "إدارة المؤسسات في لوحة مكتب الإشراف والتطوير المؤسسي." },
    { property: "og:title", content: "إدارة المؤسسات | Institutions — OID" },
    { property: "og:description", content: "إدارة المؤسسات في لوحة مكتب الإشراف والتطوير المؤسسي." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <AdminOnly><OrganizationsSection /></AdminOnly>,
});
