import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({ meta: [
    { title: "منصة مكتب الإشراف والتطوير المؤسسي — OID" },
    { name: "description", content: "المنصة الخاصة لمتابعة الأداء المؤسسي لمكتب الإشراف والتطوير المؤسسي." },
    { property: "og:title", content: "منصة مكتب الإشراف والتطوير المؤسسي — OID" },
    { property: "og:description", content: "متابعة أداء مؤسسات الشبكة في منصة المكتب الخاصة." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  beforeLoad: () => { throw redirect({ to: "/dashboard", replace: true }); },
});
