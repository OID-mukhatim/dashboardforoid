/**
 * مكوّن موحّد لعرض شعار المؤسسة.
 * - يعرض الشعار من ORG_LOGOS إن وُجد، ويعود تلقائياً إلى دائرة ملوّنة بالأحرف الأولى.
 * - يُستخدم في البطاقات، رأس ملف المؤسسة، الجداول، والقوائم.
 */
import { ORGS, type OrgId } from "@/lib/oid-data";
import { ORG_LOGOS } from "@/lib/oid-logos";

type Props = {
  orgId: OrgId;
  size?: number;
  shape?: "rounded" | "circle";
  className?: string;
  title?: string;
  /** مصدر شعار بديل (مثلاً شعار مرفوع من قاعدة البيانات) */
  src?: string | null;
};

export function OrgLogo({ orgId, size = 48, shape = "rounded", className = "", title, src }: Props) {
  const org = ORGS.find((o) => o.id === orgId);
  const logo = src || ORG_LOGOS[orgId];
  const radius = shape === "circle" ? "9999px" : "10px";

  if (!org) {
    return <div style={{ width: size, height: size, borderRadius: radius, background: "#e5e7eb" }} />;
  }

  if (logo) {
    return (
      <div
        className={`shrink-0 bg-white flex items-center justify-center overflow-hidden ${className}`}
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          border: `1px solid ${org.color}30`,
          padding: Math.max(2, size * 0.08),
        }}
        title={title ?? org.nameAr}
      >
        <img src={logo} alt={org.nameAr} className="max-w-full max-h-full object-contain" />
      </div>
    );
  }

  return (
    <div
      className={`shrink-0 flex items-center justify-center text-white font-bold ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: org.color,
        fontSize: size * 0.35,
      }}
      title={title ?? org.nameAr}
    >
      {org.abbr}
    </div>
  );
}
