import { latestGapRows, type GapRow } from "./live-gap-rules";
import type { Lang } from "./i18n";

export type LiveAlert = { id: string; severity: "critical" | "warning"; org_id: string; title: string; message: string; section: "profiles" | "governance" | "gaps" | "reports" };
type Institution = { id: string; name_ar: string; name_en: string | null; license_expiry: string | null };
const AXES_EN = ["Strategy", "Leadership and competencies", "Performance and results", "Processes and systems", "Financial resources", "Infrastructure", "Governance and compliance"];

export function buildLiveAlerts(institutions: Institution[], gaps: GapRow[], matrix: Record<string, { govPct: number | null }>, lang: Lang, today: string): LiveAlert[] {
  const alerts: LiveAlert[] = [];
  const names = new Map(institutions.map((r) => [r.id, lang === "ar" ? r.name_ar : r.name_en ?? r.id]));
  const ar = lang === "ar";
  for (const inst of institutions) {
    const name = names.get(inst.id) ?? inst.id;
    if (inst.license_expiry) {
      const days = Math.round((Date.parse(inst.license_expiry) - Date.parse(today)) / 86400000);
      if (days < 0) alerts.push({ id: `license-expired-${inst.id}-${inst.license_expiry}`, severity: "critical", org_id: inst.id, section: "profiles", title: ar ? `ترخيص ${name} منتهٍ` : `${name}: expired license`, message: ar ? `انتهى الترخيص في ${inst.license_expiry} منذ ${-days} يوم؛ يحتاج تجديداً فورياً.` : `License expired on ${inst.license_expiry}, ${-days} days ago; immediate renewal is required.` });
      else if (days <= 60) alerts.push({ id: `license-expiring-${inst.id}-${inst.license_expiry}`, severity: "warning", org_id: inst.id, section: "profiles", title: ar ? `ترخيص ${name} ينتهي قريباً` : `${name}: license expiring soon`, message: ar ? `يتبقى ${days} يوم على انتهاء الترخيص في ${inst.license_expiry}.` : `License expires in ${days} days, on ${inst.license_expiry}.` });
    }
  }
  for (const [id, entry] of Object.entries(matrix)) {
    const pct = entry.govPct;
    if (pct !== null && pct < 40) alerts.push({ id: `governance-low-${id}-governance`, severity: "critical", org_id: id, section: "governance", title: ar ? `حوكمة ${names.get(id) ?? id} أقل من 40%` : `${names.get(id) ?? id}: governance below 40%`, message: ar ? `نسبة الحوكمة الحالية ${pct}%؛ تتطلب معالجة عاجلة.` : `Current governance is ${pct}%; urgent action is required.` });
  }
  for (const r of latestGapRows(gaps)) {
    if (Number(r.score) >= 2) continue;
    const axis = ar ? r.domain_name : AXES_EN[r.domain_index] ?? `Dimension ${r.domain_index}`;
    alerts.push({ id: `gap-low-${r.org_id}-${r.domain_index}-${r.period}`, severity: "warning", org_id: r.org_id, section: "gaps", title: ar ? `فجوة ${axis} — ${names.get(r.org_id) ?? r.org_id}` : `${names.get(r.org_id) ?? r.org_id}: ${axis} gap`, message: ar ? `درجة المجال ${Number(r.score)}/5 في ${r.period}، وهي أقل من 2/5.` : `Dimension score is ${Number(r.score)}/5 in ${r.period}, below 2/5.` });
  }
  return alerts.sort((a, b) => Number(a.severity !== "critical") - Number(b.severity !== "critical") || a.id.localeCompare(b.id));
}
import type { ReportAlert } from "./reports/integration";
/** Bilingual alert items for late reports and weak perspectives. */
export function reportAlertItems(items: ReportAlert[], names: Map<string, string>, lang: Lang): LiveAlert[] {
  const ar = lang === "ar";
  const P: Record<string, [string, string]> = { S: ["المستفيدون", "Stakeholders"], P: ["العمليات", "Processes"], L: ["التعلم والنمو", "Learning & growth"], F: ["المالي", "Financial"] };
  return items.map((a) => {
    const n = names.get(a.orgId) ?? a.orgId;
    if (a.kind === "lateReport")
      return { id: `report-late-${a.orgId}-${a.year}-${a.quarter}`, severity: "warning" as const, org_id: a.orgId, section: "reports" as const,
        title: ar ? `تقرير ${a.quarter} متأخر — ${n}` : `${n}: ${a.quarter} report overdue`,
        message: ar ? `انتهى الربع منذ ${a.daysLate} يوماً ولم يُعتمد تقريره.` : `The quarter ended ${a.daysLate} days ago and its report is not approved.` };
    const pn = P[a.perspective]?.[ar ? 0 : 1] ?? a.perspective;
    return { id: `report-weak-${a.orgId}-${a.period}-${a.perspective}`, severity: "warning" as const, org_id: a.orgId, section: "reports" as const,
      title: ar ? `منظور ${pn} ضعيف — ${n}` : `${n}: weak ${pn} perspective`,
      message: ar ? `الدرجة المحققة ${Math.round(a.pct * 100) / 100}% في آخر تقرير معتمد (${a.period})، أقل من 60%.` : `Achieved ${Math.round(a.pct * 100) / 100}% in the latest approved report (${a.period}), below 60%.` };
  });
}
