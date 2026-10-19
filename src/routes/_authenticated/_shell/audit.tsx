import { createFileRoute } from "@tanstack/react-router";
import { AuditSection } from "../sections/AuditSection";
import { AdminOnly } from "@/components/oid/AdminOnly";

export const Route = createFileRoute("/_authenticated/_shell/audit")({
  head: () => ({ meta: [
    { title: "سجل التغييرات | Change log — OID" },
    { name: "description", content: "سجل التغييرات في لوحة مكتب الإشراف والتطوير المؤسسي." },
    { property: "og:title", content: "سجل التغييرات | Change log — OID" },
    { property: "og:description", content: "سجل التغييرات في لوحة مكتب الإشراف والتطوير المؤسسي." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <AdminOnly><AuditSection /></AdminOnly>,
});
