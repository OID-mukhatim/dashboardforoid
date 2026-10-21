import { col, makeDoc, section, table } from "./common";

export type PartnershipRow = { name: string; name_en: string | null; type: string; status: string; geography: string; orgs: string; description: string | null; contact: string | null };
/** Strategic partnerships — current section content as is (to be redesigned later; only this function changes then). */
export function buildPartnershipsDoc(input: { rows: PartnershipRow[]; orgName: string; orgCode: string; now?: string }) {
  const count = (key: "type" | "status" | "geography") => {
    const m = new Map<string, number>();
    input.rows.forEach((r) => m.set(r[key] || "—", (m.get(r[key] || "—") ?? 0) + 1));
    return [...m].map(([k, n]) => [k, n]);
  };
  return makeDoc({
    titleAr: "تقرير الشراكات الاستراتيجية", titleEn: "Strategic Partnerships Report", slug: "Partnerships",
    org: input.orgName, orgCode: input.orgCode, now: input.now,
    sections: [
      section("الشراكات", "Partnerships", input.rows.length ? [table(
        [col("الشريك", "Partner"), col("الاسم بالإنجليزية", "English name"), col("النوع", "Type"), col("الحالة", "Status"), col("النطاق الجغرافي", "Geography"), col("المؤسسات المرتبطة", "Linked institutions"), col("الوصف", "Description"), col("التواصل", "Contact")],
        input.rows.map((r) => [r.name, r.name_en, r.type, r.status, r.geography, r.orgs, r.description, r.contact]))] : [], "landscape"),
      section("التوزيع", "Distribution", input.rows.length ? [
        { type: "subheading", ar: "حسب النوع", en: "By type" }, table([col("النوع", "Type"), col("العدد", "Count", true)], count("type"), ["الإجمالي", input.rows.length]),
        { type: "subheading", ar: "حسب الحالة", en: "By status" }, table([col("الحالة", "Status"), col("العدد", "Count", true)], count("status")),
        { type: "subheading", ar: "حسب النطاق", en: "By geography" }, table([col("النطاق", "Geography"), col("العدد", "Count", true)], count("geography")),
      ] : []),
    ],
  });
}
