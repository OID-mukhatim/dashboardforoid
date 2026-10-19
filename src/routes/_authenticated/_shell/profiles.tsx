import { createFileRoute } from "@tanstack/react-router";
import { ProfilesSection } from "../sections/ProfilesSection";

export const Route = createFileRoute("/_authenticated/_shell/profiles")({
  head: () => ({ meta: [
    { title: "البيانات المؤسسية | Institutional profiles — OID" },
    { name: "description", content: "البيانات المؤسسية في لوحة مكتب الإشراف والتطوير المؤسسي." },
    { property: "og:title", content: "البيانات المؤسسية | Institutional profiles — OID" },
    { property: "og:description", content: "البيانات المؤسسية في لوحة مكتب الإشراف والتطوير المؤسسي." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <ProfilesSection />,
});
