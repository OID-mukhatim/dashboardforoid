/**
 * المصدر المشترك الوحيد لقائمة المؤسسات (جدول organizations).
 * القوائم أدناه تُملأ في مكانها من قاعدة البيانات (setOrganizations) في المتصفح
 * عبر OrgsProvider، وعلى الخادم عبر loadOrgRegistry قبل أي حساب.
 * لا توجد قيم مكتوبة هنا — قبل التحميل تكون القوائم فارغة.
 */
export type OrgId = string;
export type FiscalType = "calendar" | "academic";

export type OrganizationRow = {
  id: string;
  name_ar: string;
  name_en: string;
  abbr: string;
  color: string;
  fiscal_type: string;
  aliases: string[];
  status: string;
  sort_order: number;
};

export type OrgInfo = { id: OrgId; abbr: string; nameAr: string; nameEn: string; color: string };

/** المؤسسات النشطة فقط (اللوحات، القوائم، الفلاتر، التنبيهات). */
export const ORGS: OrgInfo[] = [];
/** كل المؤسسات بما فيها المؤرشفة (سجل التغييرات، الإدارة). */
export const ALL_ORGS: Array<OrgInfo & { status: string; fiscalType: FiscalType; aliases: string[]; sortOrder: number }> = [];
export const ORG_FISCAL_YEAR: Record<OrgId, FiscalType> = {};
export const ENTITY_ALIASES: { id: OrgId; name: string; patterns: RegExp[] }[] = [];

let version = 0;
export const orgRegistryVersion = () => version;

function compile(src: string): RegExp | null {
  try { return new RegExp(src, "i"); } catch { return null; }
}

export function setOrganizations(rows: OrganizationRow[]) {
  const sorted = [...rows].sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id));
  ALL_ORGS.length = 0;
  ORGS.length = 0;
  ENTITY_ALIASES.length = 0;
  for (const k of Object.keys(ORG_FISCAL_YEAR)) delete ORG_FISCAL_YEAR[k];
  for (const r of sorted) {
    const fiscalType: FiscalType = r.fiscal_type === "academic" ? "academic" : "calendar";
    const info: OrgInfo = { id: r.id, abbr: r.abbr, nameAr: r.name_ar, nameEn: r.name_en, color: r.color };
    ALL_ORGS.push({ ...info, status: r.status, fiscalType, aliases: r.aliases ?? [], sortOrder: r.sort_order });
    if (r.status !== "active") continue;
    ORGS.push(info);
    ORG_FISCAL_YEAR[r.id] = fiscalType;
    ENTITY_ALIASES.push({ id: r.id, name: r.name_ar, patterns: (r.aliases ?? []).map(compile).filter((x): x is RegExp => !!x) });
  }
  version += 1;
}

export const activeOrgIds = () => ORGS.map((o) => o.id);
export const isAcademicOrg = (id: string) => ORG_FISCAL_YEAR[id] === "academic";
