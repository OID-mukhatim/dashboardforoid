/**
 * مولّد التقرير التنفيذي — يبني صفحة HTML منسّقة من البيانات المركّبة
 * ويفتحها في نافذة طباعة منفصلة (PDF عبر طباعة المتصفح).
 */

import { computeAllProfiles } from "./oid-composite";
import { detectAllAnomalies } from "./oid-anomalies";
import { institutions, type OrgId } from "./oid-data";

const ORG_NAME: Record<OrgId, string> = Object.fromEntries(
  institutions.map((i) => [i.id, i.nameAr]),
) as Record<OrgId, string>;

export const generateExecutiveReport = (quarter: string, year: number) => {
  const profiles = computeAllProfiles();
  const anomalies = detectAllAnomalies();
  const issued = new Date().toLocaleDateString("ar-SA");

  const scoreCards = Object.values(profiles)
    .map((p) => {
      const score = p.compositeScore != null ? p.compositeScore.toFixed(2) : "—";
      const label = p.maturityLabel ?? "بيانات ناقصة";
      const color = p.maturityColor ?? "#64748b";
      return `
        <div class="score-card">
          <div class="score-num" style="color:${color}">${score}</div>
          <div class="score-name">${ORG_NAME[p.orgId] ?? p.orgId}</div>
          <div class="score-label">${label}</div>
        </div>`;
    })
    .join("");

  const anomalyItems = anomalies
    .slice(0, 8)
    .map((a) => {
      const cls = a.severity === "high" ? "critical" : "warning";
      return `<div class="anomaly ${cls}">${a.title} — ${a.message}</div>`;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>تقرير نبض الأداء — ${quarter} ${year}</title>
  <style>
    @page { margin: 12mm; }
    body { font-family: 'Tajawal','Arial',sans-serif; direction: rtl; color: #1a2332; margin: 0; }
    .header { background: linear-gradient(135deg,#0e4d2e,#0d3a6e); color: white; padding: 24px; }
    .header h1 { font-size: 22px; margin: 0; }
    .header p  { font-size: 13px; opacity: .75; margin: 4px 0 0; }
    .section { padding: 16px 24px; border-bottom: 1px solid #e0e8f0; }
    .section h2 { font-size: 16px; color: #0e4d2e; margin: 0 0 12px; }
    .score-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; }
    .score-card { border: 1px solid #e0e8f0; border-radius: 8px; padding: 12px; text-align: center; }
    .score-num  { font-size: 28px; font-weight: 700; }
    .score-name { font-size: 12px; color: #64748b; margin-top: 4px; }
    .score-label{ font-size: 11px; color: #94a3b8; margin-top: 2px; }
    .anomaly    { padding: 8px 12px; border-radius: 6px; margin-bottom: 6px; font-size: 12px; }
    .critical   { background: #fee2e2; color: #b91c1c; }
    .warning    { background: #fef3c7; color: #92400e; }
    .footer     { padding: 16px 24px; font-size: 11px; color: #94a3b8; text-align: center; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>تقرير نبض الأداء — ${quarter} ${year}</h1>
    <p>مكتب الإشراف والتطوير المؤسسي | Oversight & Institutional Development (OID)</p>
    <p>تاريخ الإصدار: ${issued}</p>
  </div>

  <div class="section">
    <h2>ملخص الأداء المؤسسي</h2>
    <div class="score-grid">${scoreCards}</div>
  </div>

  <div class="section">
    <h2>أبرز التنبيهات والشذوذات</h2>
    ${anomalyItems || '<div class="anomaly warning">لا توجد شذوذات مكتشفة</div>'}
  </div>

  <div class="footer">
    صدر عن مكتب الإشراف والتطوير المؤسسي — شبكة مؤسسات زمزم
  </div>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  // نمنح المتصفح لحظة لرسم المحتوى قبل فتح حوار الطباعة
  setTimeout(() => win.print(), 300);
};
