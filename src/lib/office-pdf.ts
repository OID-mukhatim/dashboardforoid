/**
 * تصدير نماذج المكتب الرسمية (محضر اجتماع — نموذج 3، استمارة زيارة — نموذج 2)
 * بصيغة صفحة طباعة جاهزة PDF.
 */
import { ORGS, type OrgId } from "@/lib/oid-data";
import { t as translate, type Lang } from "@/lib/i18n";
const orgNameFor = (id: OrgId, lang: Lang) => { const org = ORGS.find(o => o.id === id); return org ? (lang === "en" ? org.nameEn : org.nameAr) : id; };
const tx = (lang: Lang, text: string) => translate(lang, "office." + text);

const BASE_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap');
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:'Tajawal',Arial,sans-serif; direction:rtl; font-size:13px; color:#1a2332; }
  .header { background:linear-gradient(135deg,#0e4d2e,#0d3a6e); color:#fff; padding:16px 24px; text-align:center; }
  .header h1 { font-size:16px; font-weight:700; }
  .header p { font-size:11px; opacity:.75; margin-top:2px; }
  .title-bar { background:#a8d5b5; padding:10px 24px; font-size:15px; font-weight:700; text-align:center; }
  .section { padding:12px 24px; }
  .section h3 { font-size:13px; font-weight:700; color:#0e4d2e; background:#f0fdf4;
                padding:6px 10px; border-right:3px solid #0e4d2e; margin-bottom:8px; }
  .field { display:flex; gap:8px; margin-bottom:6px; font-size:12px; }
  .field-label { font-weight:700; min-width:130px; color:#4a6070; }
  .field-value { flex:1; white-space:pre-wrap; }
  table { width:100%; border-collapse:collapse; font-size:12px; }
  th { background:#f0fdf4; padding:8px; text-align:right; border:1px solid #e0e8f0; font-weight:700; }
  td { padding:8px; border:1px solid #e0e8f0; vertical-align:top; }
  .footer { padding:12px 24px; font-size:10px; color:#94a3b8; text-align:center;
            border-top:1px solid #e0e8f0; margin-top:16px; }
  @media print { body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } .no-print { display:none; } }
`;

const esc = (v: any) =>
  v === null || v === undefined || v === ""
    ? "—"
    : String(v).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);

function openPrint(title: string, body: string, lang: Lang) {
  const html = `<!doctype html><html lang="${lang}" dir="${lang === "ar" ? "rtl" : "ltr"}"><head><meta charset="utf-8">
  <title>${esc(title)}</title><style>${BASE_CSS}${lang === "en" ? "body{direction:ltr;font-family:Arial,sans-serif}th{text-align:left}.section h3{border-right:0;border-left:3px solid #0e4d2e}" : ""}</style></head><body>${body}</body></html>`;
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 700);
}

const FOOTER = (lang: Lang) => `<div class="footer">${tx(lang, "مكتب الإشراف والتطوير المؤسسي — شبكة مؤسسات زمزم")}</div>`;
const HEADER = (form: string, lang: Lang) => `
  <div class="header">
    <h1>${tx(lang, "مكتب الإشراف والتطوير المؤسسي (OID)")}</h1>
    <p>${tx(lang, "نماذج العمل —")} ${form}</p>
  </div>`;

const MEETING_TYPES: Record<string, string> = {
  internal: "اجتماع داخلي",
  with_institution: "اجتماع مع مؤسسة",
  board: "اجتماع مجلس أمناء",
};

/** تصدير محضر اجتماع (نموذج 3). */
export function exportMeetingPDF(meeting: any, lang: Lang = "ar") {
  const decisions = meeting.meeting_decisions ?? [];
  const attendees = (meeting.attendees ?? []) as { name: string; role: string }[];
  const body = `
  ${HEADER(tx(lang, "نموذج 3"), lang)}
  <div class="title-bar">${tx(lang, 'محضر اجتماع —')} ${esc(meeting.title)}</div>

  <div class="section">
    <h3>${tx(lang, 'البيانات الأساسية')}</h3>
    <div class="field"><div class="field-label">${tx(lang, 'التاريخ:')}</div><div class="field-value">${esc(meeting.date)}</div></div>
    <div class="field"><div class="field-label">${tx(lang, 'نوع الاجتماع:')}</div><div class="field-value">${esc(tx(lang, MEETING_TYPES[meeting.meeting_type] ?? meeting.meeting_type))}</div></div>
    ${meeting.org_id ? `<div class="field"><div class="field-label">${tx(lang, 'المؤسسة المعنية:')}</div><div class="field-value">${esc(orgNameFor(meeting.org_id as OrgId, lang))}</div></div>` : ""}
    <div class="field"><div class="field-label">${tx(lang, 'مدة ومكان الاجتماع:')}</div><div class="field-value">${esc(meeting.duration)} | ${esc(meeting.location)}</div></div>
    <div class="field"><div class="field-label">${tx(lang, 'الحضور:')}</div><div class="field-value">${
      attendees.map((a) => `${esc(a.name)} (${esc(a.role)})`).join(" | ") || "—"
    }</div></div>
  </div>

  <div class="section">
    <h3>${tx(lang, 'محتوى الاجتماع')}</h3>
    <div class="field"><div class="field-label">${tx(lang, 'هدف الاجتماع:')}</div><div class="field-value">${esc(meeting.objective)}</div></div>
    <div class="field"><div class="field-label">${tx(lang, 'وقائع الاجتماع:')}</div><div class="field-value">${esc(meeting.minutes)}</div></div>
    <div class="field"><div class="field-label">${tx(lang, 'مخرجات الاجتماع:')}</div><div class="field-value">${esc(meeting.outputs)}</div></div>
  </div>

  <div class="section">
    <h3>${tx(lang, 'المخرجات والقرارات')}</h3>
    <table>
      <thead><tr><th style="width:32px">#</th><th>${tx(lang, 'القرار')}</th><th style="width:140px">${tx(lang, 'المكلف')}</th><th style="width:110px">${tx(lang, 'وقت الإنجاز')}</th></tr></thead>
      <tbody>
        ${
          decisions.length
            ? decisions
                .map(
                  (d: any, i: number) =>
                    `<tr><td>${i + 1}</td><td>${esc(d.decision)}</td><td>${esc(d.assigned_to)}</td><td>${esc(d.due_date)}</td></tr>`,
                )
                .join("")
            : `<tr><td colspan="4" style="text-align:center;color:#94a3b8">${tx(lang, 'لا توجد قرارات مسجّلة')}</td></tr>`
        }
      </tbody>
    </table>
  </div>
  ${FOOTER(lang)}`;
  openPrint(`${tx(lang, "محضر اجتماع —")} ${meeting.title}`, body, lang);
}

const PERFORMANCE_LABELS: Record<string, string> = {
  excellent: "ممتاز ⭐⭐⭐",
  good: "جيد ⭐⭐",
  medium: "متوسط ⭐",
  weak: "ضعيف",
};
const VISIT_TYPE_LABELS: Record<string, string> = {
  scheduled: "دورية مجدولة",
  surprise: "مفاجئة رقابية",
  field: "ميدانية",
  other: "أخرى",
};

/** تصدير استمارة زيارة (نموذج 2). */
export function exportVisitPDF(visit: any, lang: Lang = "ar") {
  const gaps = visit.visit_gaps ?? [];
  const evals: [string, any][] = [
    ["الهوية البصرية", visit.visual_identity],
    ["الانضباط", visit.discipline],
    ["الجاهزية والتوثيق", visit.readiness],
    ["المتابعات السابقة", visit.prev_followups],
    ["الممارسات المتميزة", visit.best_practices],
    ["سير العمل العام", visit.general_work],
  ];
  const body = `
  ${HEADER(tx(lang, "نموذج 2"), lang)}
  <div class="title-bar">${tx(lang, 'استمارة الزيارات —')} ${esc(orgNameFor(visit.org_id as OrgId, lang))}</div>

  <div class="section">
    <h3>${tx(lang, 'البيانات الأساسية')}</h3>
    <div class="field"><div class="field-label">${tx(lang, 'اسم المؤسسة:')}</div><div class="field-value">${esc(orgNameFor(visit.org_id as OrgId, lang))}</div></div>
    <div class="field"><div class="field-label">${tx(lang, 'التاريخ:')}</div><div class="field-value">${esc(visit.date)}</div></div>
    <div class="field"><div class="field-label">${tx(lang, 'الهدف:')}</div><div class="field-value">${esc(visit.objective)}</div></div>
    <div class="field"><div class="field-label">${tx(lang, 'نوع الزيارة:')}</div><div class="field-value">${esc(tx(lang, VISIT_TYPE_LABELS[visit.visit_type] ?? visit.visit_type))}</div></div>
    <div class="field"><div class="field-label">${tx(lang, 'وفد الزيارة:')}</div><div class="field-value">${tx(lang, 'رئيس المؤسسة:')} ${esc(visit.org_delegate)} / ${tx(lang, "مندوب OID:")} ${esc(visit.oid_delegate)}</div></div>
  </div>

  <div class="section">
    <h3>${tx(lang, 'التقييمات والملاحظات')}</h3>
    ${evals
      .map(
        ([label, val]) =>
          `<div class="field"><div class="field-label">${tx(lang, label)}:</div><div class="field-value">${esc(val)}</div></div>`,
      )
      .join("")}
  </div>

  <div class="section">
    <h3>${tx(lang, 'الفجوات')}</h3>
    <table>
      <thead><tr><th style="width:32px">#</th><th>${tx(lang, 'الفجوة المرصودة')}</th><th>${tx(lang, 'الإجراء التصحيحي')}</th><th style="width:90px">${tx(lang, 'الأولوية')}</th><th style="width:110px">${tx(lang, 'موعد الإنجاز')}</th></tr></thead>
      <tbody>
        ${
          gaps.length
            ? gaps
                .map(
                  (g: any, i: number) =>
                    `<tr><td>${i + 1}</td><td>${esc(g.gap)}</td><td>${esc(g.action)}</td><td>${
                      g.priority === "urgent" ? "🔴 " + tx(lang, "عاجل") : "⚪ " + tx(lang, "غير عاجل")
                    }</td><td>${esc(g.due_date)}</td></tr>`,
                )
                .join("")
            : `<tr><td colspan="5" style="text-align:center;color:#94a3b8">${tx(lang, 'لا توجد فجوات مرصودة')}</td></tr>`
        }
      </tbody>
    </table>
  </div>

  <div class="section">
    <h3>${tx(lang, 'نتائج الزيارة')}</h3>
    <div class="field"><div class="field-label">${tx(lang, 'المخرجات والقرارات:')}</div><div class="field-value">${esc(visit.outputs)}</div></div>
    <div class="field"><div class="field-label">${tx(lang, 'التحديات والتوصيات:')}</div><div class="field-value">${esc(visit.challenges)}</div></div>
    <div class="field"><div class="field-label">${tx(lang, 'مستوى الأداء العام:')}</div><div class="field-value">${esc(tx(lang, PERFORMANCE_LABELS[visit.performance] ?? visit.performance))}</div></div>
    <div class="field"><div class="field-label">${tx(lang, 'توجيه رئيس المؤسسة:')}</div><div class="field-value">${esc(visit.guidance)}</div></div>
    <div class="field"><div class="field-label">${tx(lang, 'أخرى:')}</div><div class="field-value">${esc(visit.notes)}</div></div>
  </div>
  ${FOOTER(lang)}`;
  openPrint(`${tx(lang, "استمارة زيارة —")} ${orgNameFor(visit.org_id as OrgId, lang)}`, body, lang);
}
