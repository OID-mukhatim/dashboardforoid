import { createFileRoute } from "@tanstack/react-router";
import { UploadSection } from "../sections/UploadSection";

export const Route = createFileRoute("/_authenticated/_shell/upload")({
  head: () => ({ meta: [
    { title: "رفع البيانات | Data upload — OID" },
    { name: "description", content: "رفع البيانات في لوحة مكتب الإشراف والتطوير المؤسسي." },
    { property: "og:title", content: "رفع البيانات | Data upload — OID" },
    { property: "og:description", content: "رفع البيانات في لوحة مكتب الإشراف والتطوير المؤسسي." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <UploadSection />,
});
