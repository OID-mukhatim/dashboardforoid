import { createFileRoute } from "@tanstack/react-router";
import { GovernanceSection } from "../sections/GovernanceSection";

export const Route = createFileRoute("/_authenticated/_shell/governance")({
  head: () => ({ meta: [
    { title: "الحوكمة والامتثال | Governance — OID" },
    { name: "description", content: "الحوكمة والامتثال في لوحة مكتب الإشراف والتطوير المؤسسي." },
    { property: "og:title", content: "الحوكمة والامتثال | Governance — OID" },
    { property: "og:description", content: "الحوكمة والامتثال في لوحة مكتب الإشراف والتطوير المؤسسي." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <GovernanceSection />,
});
