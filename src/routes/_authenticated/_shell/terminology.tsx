import { createFileRoute } from "@tanstack/react-router";
import { TerminologySection } from "../sections/TerminologySection";
import { AdminOnly } from "@/components/oid/AdminOnly";

export const Route = createFileRoute("/_authenticated/_shell/terminology")({
  head: () => ({ meta: [
    { title: "إدارة المصطلحات | Terminology — OID" },
    { name: "description", content: "إدارة المصطلحات في لوحة مكتب الإشراف والتطوير المؤسسي." },
    { property: "og:title", content: "إدارة المصطلحات | Terminology — OID" },
    { property: "og:description", content: "إدارة المصطلحات في لوحة مكتب الإشراف والتطوير المؤسسي." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <AdminOnly><TerminologySection /></AdminOnly>,
});
