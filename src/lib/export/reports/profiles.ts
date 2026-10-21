import type { Cell } from "../types";
import { makeDoc, section } from "./common";

const LABELS: Record<string, [string, string]> = {
  name_ar: ["الاسم بالعربية", "Arabic name"], name_en: ["الاسم بالإنجليزية", "English name"], founded: ["سنة التأسيس", "Founded"],
  license_number: ["رقم الترخيص", "License no."], license_expiry: ["انتهاء الترخيص", "License expiry"], address: ["العنوان", "Address"],
  website: ["الموقع", "Website"], exec_name_ar: ["المدير التنفيذي", "Executive director"], exec_phone: ["الهاتف", "Phone"],
  exec_email: ["البريد", "Email"], staff_total: ["إجمالي الموظفين", "Total staff"],
};
const SKIP = new Set(["id", "logo_url", "created_at", "updated_at"]);
const cellOf = (v: unknown): Cell => (v === null || v === undefined || v === "" ? null : typeof v === "number" ? v : typeof v === "object" ? JSON.stringify(v) : String(v));

/** Institutional profile: one section per institution with the stored record and fields extracted from uploaded forms. */
export function buildProfilesDoc(input: { orgs: { id: string; nameAr: string; nameEn: string; db: Record<string, unknown> | null; fields: Record<string, unknown> }[]; orgCode: string; now?: string }) {
  return makeDoc({
    titleAr: "تقرير البيانات المؤسسية", titleEn: "Institutional Profile Report", slug: "Institutional-Profile",
    org: input.orgCode === "ALL" ? "كل المؤسسات" : input.orgs[0]?.nameAr ?? input.orgCode, orgCode: input.orgCode, now: input.now,
    sections: input.orgs.map((o) => {
      const items = Object.entries(o.db ?? {}).filter(([k, v]) => !SKIP.has(k) && v !== null && v !== "")
        .map(([k, v]) => ({ ar: LABELS[k]?.[0] ?? k, en: LABELS[k]?.[1] ?? k.replace(/_/g, " "), value: cellOf(v) }));
      const extra = Object.entries(o.fields).filter(([, v]) => v !== null && v !== "").map(([k, v]) => ({ ar: k, en: "", value: cellOf(v) }));
      return section(o.nameAr, o.nameEn, [
        ...(items.length ? [{ type: "kv" as const, items }] : []),
        ...(extra.length ? [{ type: "subheading" as const, ar: "بيانات الاستمارة", en: "Form data" }, { type: "kv" as const, items: extra }] : []),
      ]);
    }),
  });
}
