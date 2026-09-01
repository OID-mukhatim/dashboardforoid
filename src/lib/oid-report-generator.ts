/**
 * مولّد التقرير التنفيذي — تقرير احترافي شامل يفتح في نافذة طباعة منفصلة.
 * يشمل: ملخص الأداء المركّب، أبرز التنبيهات، ومصفوفة النضج على المحاور السبعة.
 */

import { computeProfile, type InstitutionProfile } from "./oid-composite";
import { detectAnomalies, type Anomaly } from "./oid-anomalies";
import { ORGS, institutions, gapScores, GAP_AXES, type OrgId } from "./oid-data";

const ORG_NAME: Record<OrgId, string> = Object.fromEntries(
  institutions.map((i) => [i.id, i.nameAr]),
) as Record<OrgId, string>;

const MATURITY_COLORS: Record<number, string> = {
  1: "#dc2626",
  2: "#d97706",
  3: "#ca8a04",
  4: "#2563eb",
  5: "#16a34a",
};

function scoreBar(score: number | null, color: string): string {
  if (score === null) {
    return `<div class="score-missing">— بيانات ناقصة</div>`;
  }
  const pct = Math.round((score / 5) * 100);
  return `
    <div class="score-bar-wrap">
      <div class="score-bar-track">
        <div class="score-bar-fill" style="width:${pct}%;background:${color}"></div>
      </div>
      <div class="score-bar-value" style="color:${color}">${score.toFixed(2)}</div>
    </div>`;
}

function axisColor(val: number | null): string {
  if (val === null || val === undefined) return "#94a3b8";
  if (val >= 4.5) return "#16a34a";
  if (val >= 3.5) return "#2563eb";
  if (val >= 3.0) return "#ca8a04";
  if (val >= 2.0) return "#d97706";
  return "#dc2626";
}

export const generateExecutiveReport = (quarter: string, year: number) => {
  const orgIds = ORGS.map((o) => o.id);
  const profilesMap = {} as Record<OrgId, InstitutionProfile>;
  for (const id of orgIds) profilesMap[id] = computeProfile(id);
  const profiles = orgIds.map((id) => profilesMap[id]);

  const anomalies: Anomaly[] = profiles.flatMap((p) =>
    detectAnomalies(p.orgId, profilesMap),
  );
  const criticals = anomalies.filter((a) => a.severity === "high").slice(0, 5);
  const mediums = anomalies.filter((a) => a.severity !== "high").slice(0, 5);

  const today = new Date().toLocaleDateString("ar-SA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // بطاقات ملخص الأداء
  const orgCards = profiles
    .map((p) => {
      const color = p.maturityLevel ? MATURITY_COLORS[p.maturityLevel] : "#94a3b8";
      const level = p.maturityLabel ?? "بيانات ناقصة";
      const name = ORG_NAME[p.orgId] ?? p.orgId;
      const comps = p.components
        .map(
          (c) => `
          <div class="component-row">
            <span>${c.label}</span>
            <span class="component-score">${c.score !== null ? c.score.toFixed(2) : "—"}</span>
          </div>`,
        )
        .join("");
      return `
      <div class="org-card">
        <div class="org-header">
          <span class="org-dot" style="background:${color}"></span>
          <div>
            <div class="org-name">${name}</div>
            <div class="org-abbr">${p.orgId}</div>
          </div>
          <span class="org-level" style="background:${color}18;color:${color}">${level}</span>
        </div>
        ${scoreBar(p.compositeScore, color)}
        <div class="components">${comps}</div>
      </div>`;
    })
    .join("");

  // التنبيهات
  const anomalyItem = (a: Anomaly, cls: string) => `
    <div class="anomaly-item ${cls}">
      <strong>${a.title}</strong>
      <div>${a.message}</div>
    </div>`;

  const anomaliesHtml =
    criticals.length + mediums.length === 0
      ? `<div class="anomaly-item anomaly-ok">لا توجد تنبيهات حرجة حالياً — الوضع العام مستقر.</div>`
      : [
          ...criticals.map((a) => anomalyItem(a, "anomaly-high")),
          ...mediums.map((a) => anomalyItem(a, "anomaly-medium")),
        ].join("");

  // مصفوفة النضج — المحاور السبعة (بدون حمدي لعدم اكتمال بياناتها)
  const matrixOrgs = profiles.filter((p) => p.orgId !== "HAMDI");
  const matrixHead = matrixOrgs.map((p) => `<th>${p.orgId}</th>`).join("");
  const matrixRows = GAP_AXES.map((axis, i) => {
    const cells = matrixOrgs
      .map((p) => {
        const val = gapScores[p.orgId]?.[i] ?? null;
        return `<td style="color:${axisColor(val)};font-weight:700">${
          val !== null ? Number(val).toFixed(1) : "—"
        }</td>`;
      })
      .join("");
    return `<tr><td class="axis-name">${axis}</td>${cells}</tr>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>تقرير نبض الأداء — ${quarter} ${year}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Tajawal', Arial, sans-serif; direction: rtl; color: #1a2332; background: #fff; font-size: 13px; }
    .header {
      background: linear-gradient(135deg, #0e4d2e 0%, #0d3a6e 100%);
      color: white; padding: 28px 32px;
      display: flex; justify-content: space-between; align-items: flex-start;
    }
    .header h1 { font-size: 22px; font-weight: 800; margin-bottom: 6px; }
    .header p { font-size: 12px; opacity: 0.75; line-height: 1.7; }
    .header-badge {
      background: rgba(255,255,255,0.15); border-radius: 8px;
      padding: 10px 16px; text-align: center; font-weight: 700;
      font-size: 11px; line-height: 1.6; white-space: nowrap;
    }
    .header-badge .date { font-size: 14px; font-weight: 800; display: block; margin-top: 2px; }
    .section { padding: 20px 32px; border-bottom: 1px solid #e2e8f0; }
    .section h2 {
      font-size: 15px; font-weight: 700; color: #0e4d2e;
      margin-bottom: 14px; padding-bottom: 6px;
      border-bottom: 2px solid #a8d5b5;
    }
    .orgs-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .org-card { border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; page-break-inside: avoid; }
    .org-header { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
    .org-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
    .org-name { font-size: 13px; font-weight: 700; }
    .org-abbr { font-size: 10px; color: #94a3b8; }
    .org-level { font-size: 10px; padding: 2px 8px; border-radius: 10px; margin-right: auto; font-weight: 600; white-space: nowrap; }
    .score-bar-wrap { display: flex; align-items: center; gap: 8px; margin: 8px 0 10px; }
    .score-bar-track { flex: 1; height: 8px; background: #f1f5f9; border-radius: 4px; overflow: hidden; }
    .score-bar-fill { height: 100%; border-radius: 4px; }
    .score-bar-value { font-size: 16px; font-weight: 800; min-width: 38px; text-align: left; }
    .score-missing { font-size: 11px; color: #94a3b8; background: #f8fafc; border-radius: 6px; padding: 6px 10px; margin: 8px 0 10px; }
    .components { border-top: 1px dashed #e2e8f0; padding-top: 8px; }
    .component-row { display: flex; justify-content: space-between; font-size: 11px; color: #64748b; margin-bottom: 4px; }
    .component-score { font-weight: 700; color: #334155; }
    .anomaly-item { padding: 8px 12px; border-radius: 6px; margin-bottom: 6px; font-size: 12px; border-right: 3px solid; line-height: 1.6; }
    .anomaly-item strong { display: block; margin-bottom: 2px; }
    .anomaly-high { background: #fff1f2; border-color: #dc2626; color: #7f1d1d; }
    .anomaly-medium { background: #fffbeb; border-color: #d97706; color: #78350f; }
    .anomaly-ok { background: #f0fdf4; border-color: #16a34a; color: #14532d; }
    .gap-table { width: 100%; border-collapse: collapse; font-size: 11px; }
    .gap-table th { text-align: center; padding: 7px 10px; background: #f8fafc; border-bottom: 2px solid #e2e8f0; font-weight: 700; color: #64748b; }
    .gap-table th:first-child { text-align: right; }
    .gap-table td { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; text-align: center; }
    .gap-table td.axis-name { text-align: right; color: #334155; font-weight: 500; }
    .footer { padding: 16px 32px; text-align: center; font-size: 11px; color: #94a3b8; background: #f8fafc; line-height: 1.8; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .org-card { break-inside: avoid; }
      .section { break-inside: avoid-page; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>تقرير نبض الأداء — ${quarter} ${year}</h1>
      <p>مكتب الإشراف والتطوير المؤسسي — Oversight &amp; Institutional Development (OID)<br>شبكة مؤسسات زمزم — الصومال</p>
    </div>
    <div class="header-badge">تاريخ الإصدار<span class="date">${today}</span></div>
  </div>

  <div class="section">
    <h2>ملخص الأداء المؤسسي — الدرجة المركّبة</h2>
    <div class="orgs-grid">${orgCards}</div>
  </div>

  <div class="section">
    <h2>أبرز التنبيهات والشذوذات (${criticals.length + mediums.length})</h2>
    ${anomaliesHtml}
  </div>

  <div class="section">
    <h2>مصفوفة النضج المؤسسي — المحاور السبعة</h2>
    <table class="gap-table">
      <thead><tr><th>المحور</th>${matrixHead}</tr></thead>
      <tbody>${matrixRows}</tbody>
    </table>
  </div>

  <div class="footer">
    صدر عن مكتب الإشراف والتطوير المؤسسي — شبكة مؤسسات زمزم، الصومال<br>
    هذا التقرير سري ومخصص لمجلس الأمناء
  </div>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (!win) {
    alert("يرجى السماح بالنوافذ المنبثقة لتصدير التقرير");
    return;
  }
  win.document.write(html);
  win.document.close();
  // نمنح الخطوط والتنسيقات وقتاً للتحميل قبل فتح حوار الطباعة
  setTimeout(() => win.print(), 800);
};
