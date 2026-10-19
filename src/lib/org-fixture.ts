// بيانات اختبار فقط — نسخة من صفوف جدول organizations لتشغيل الاختبارات دون قاعدة بيانات.
import { setOrganizations, type OrganizationRow } from "./org-registry";
const row = (id: string, name_ar: string, name_en: string, abbr: string, color: string, fiscal_type: string, aliases: string[], sort_order: number): OrganizationRow => ({ id, name_ar, name_en, abbr, color, fiscal_type, aliases, status: "active", sort_order });
export function seedTestOrganizations() {
  setOrganizations([
    row("ZF", "مؤسسة زمزم", "Zamzam Foundation", "ZF", "#d97706", "calendar", ["(?:مؤسسة|شركة)\\s*زمزم", "زمزم\\s*للتنمية", "\\bZamzam\\s+Foundation\\b", "\\bZF\\b", "^زمزم$"], 1),
    row("ZUST", "جامعة زمزم للعلوم والتكنولوجيا", "ZUST", "ZU", "#1d4ed8", "academic", ["جامعة\\s*زمزم", "\\bZamzam\\s+University\\b", "\\bZUST\\b"], 2),
    row("ZAD", "زاد للتنمية", "Zad for Development", "ZD", "#ea580c", "calendar", ["(?:مؤسسة|شركة)\\s*زاد", "زاد\\s*للتنمية", "\\bZad\\s+for\\s+Development\\b", "\\bZAD\\b"], 3),
    row("TAYO", "تيو للتعليم", "Tayo for Education", "TY", "#2563eb", "academic", ["(?:مؤسسة|شركة|مدارس)\\s*تيو", "تيو\\s*للتعليم", "تيو\\s*للتنمية", "\\bTayo\\s+for\\s+Education\\b", "\\bTAYO\\b"], 4),
    row("KAFI", "كافي للتنمية", "Kafi for Development", "KF", "#15803d", "calendar", ["(?:مؤسسة|شركة)\\s*كافي", "كافي\\s*للتنمية", "\\bKafi\\s+for\\s+Development\\b", "\\bKAFI\\b"], 5),
    row("HAMDI", "منظمة حمدي للتنمية", "Hamdi Organization", "HM", "#94a3b8", "academic", ["(?:منظمة|مؤسسة|شركة)\\s*حمد[يى]", "حمد[يى]\\s*لل(?:رعاية|تنمية)", "\\bHamdi\\s+Organization\\b", "\\bHAMDI\\b"], 6),
  ]);
}
