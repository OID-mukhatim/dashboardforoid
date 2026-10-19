import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ScrollText } from "lucide-react";
import { loadAuditLog } from "@/lib/audit.functions";
import { ALL_ORGS } from "@/lib/org-registry";
import { useLang } from "@/lib/lang-context";
import { ScrollableTable } from "@/components/oid/ScrollableTable";
import { Card } from "./_shared";

const TABLES: Record<string, [string, string]> = {
  kpis: ["مؤشرات الأداء", "KPIs"], kpi_perspectives: ["منظورات المؤشرات", "KPI perspectives"], kpi_goals: ["أهداف المؤشرات", "KPI goals"],
  gap_scores: ["درجات الفجوات", "Gap scores"], governance_policies: ["سياسات الحوكمة", "Governance policies"],
  quarterly_reports: ["التقارير الربعية", "Quarterly reports"], financial_reports: ["التقارير المالية", "Financial reports"],
  advisor_snapshots: ["أعمال المستشار المالي", "Financial advisor"], timeline_entries: ["البعد الزمني", "Timeline"],
  org_active_years: ["السنة النشطة", "Active years"], institutions: ["البيانات المؤسسية", "Institution profiles"],
  organizations: ["المؤسسات", "Institutions"], partnerships: ["الشراكات", "Partnerships"], initiatives: ["المبادرات", "Initiatives"],
  office_tasks: ["المهام", "Tasks"], meetings: ["الاجتماعات", "Meetings"], meeting_decisions: ["قرارات الاجتماعات", "Meeting decisions"],
  visits: ["الزيارات", "Visits"], visit_gaps: ["فجوات الزيارات", "Visit gaps"], office_plans: ["خطط المكتب", "Office plans"],
  plan_activities: ["أنشطة الخطط", "Plan activities"], uploads: ["الملفات المرفوعة", "Uploads"], terminology: ["المصطلحات", "Terminology"],
};
const FIELDS: Record<string, [string, string]> = {
  status: ["الحالة", "Status"], score: ["الدرجة", "Score"], note: ["ملاحظة", "Note"], notes: ["ملاحظات", "Notes"], title: ["العنوان", "Title"],
  name: ["الاسم", "Name"], name_ar: ["الاسم بالعربية", "Arabic name"], name_en: ["الاسم بالإنجليزية", "English name"], abbr: ["الاختصار", "Abbreviation"],
  color: ["اللون", "Color"], fiscal_type: ["نوع السنة المالية", "Fiscal type"], aliases: ["الأسماء البديلة", "Aliases"], sort_order: ["الترتيب", "Order"],
  period: ["الفترة", "Period"], domain_name: ["المجال", "Dimension"], domain_index: ["رقم المجال", "Dimension no."], policy_id: ["رمز السياسة", "Policy code"],
  weight: ["الوزن", "Weight"], annual_target: ["المستهدف السنوي", "Annual target"], achievement_pct: ["نسبة الإنجاز", "Achievement %"],
  q1_actual: ["منجز الربع 1", "Q1 actual"], q2_actual: ["منجز الربع 2", "Q2 actual"], q3_actual: ["منجز الربع 3", "Q3 actual"], q4_actual: ["منجز الربع 4", "Q4 actual"],
  priority: ["الأولوية", "Priority"], due_date: ["تاريخ الاستحقاق", "Due date"], description: ["الوصف", "Description"], value: ["القيمة", "Value"],
  active_year: ["السنة النشطة", "Active year"], approved_budget: ["الموازنة المعتمدة", "Approved budget"], actual_spending: ["الإنفاق الفعلي", "Actual spending"],
  license_expiry: ["انتهاء الترخيص", "License expiry"], website: ["الموقع", "Website"], progress: ["التقدم", "Progress"], rows_extracted: ["الصفوف المستخرجة", "Rows extracted"],
  ar: ["العربية", "Arabic"], en: ["الإنجليزية", "English"], quarter: ["الربع", "Quarter"], year: ["السنة", "Year"], plan_year: ["سنة الخطة", "Plan year"],
};
const ACTIONS: Record<string, [string, string]> = { insert: ["إضافة", "Insert"], update: ["تعديل", "Update"], delete: ["حذف", "Delete"] };

const show = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v));
const SEL = "h-9 px-2 rounded-md border border-border bg-background text-sm";

export function AuditSection() {
  const { lang } = useLang();
  const L = (p: [string, string] | undefined, raw: string) => (p ? p[lang === "ar" ? 0 : 1] : raw);
  const [f, setF] = useState({ orgId: "", table: "", userId: "", from: "", to: "" });
  const [page, setPage] = useState(0);
  const fn = useServerFn(loadAuditLog);
  const clean = Object.fromEntries(Object.entries(f).filter(([, v]) => v)) as Partial<typeof f>;
  const { data, isFetching, error } = useQuery({
    queryKey: ["audit-log", clean, page],
    queryFn: () => fn({ data: { ...clean, page } }),
    placeholderData: keepPreviousData,
  });
  const set = (k: keyof typeof f, v: string) => { setF((s) => ({ ...s, [k]: v })); setPage(0); };
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const orgName = (id: string | null) => { const o = ALL_ORGS.find((x) => x.id === id); return o ? (lang === "ar" ? o.nameAr : o.nameEn || o.nameAr) : id ?? "—"; };

  const changes = (r: NonNullable<typeof data>["rows"][number]) => {
    if (r.action === "update") return (r.changed_fields ?? []).map((k) => ({ k, a: r.old_data?.[k], b: r.new_data?.[k] }));
    return [];
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2"><ScrollText size={20} /><h2 className="text-xl font-bold">{lang === "ar" ? "سجل التغييرات" : "Change Log"}</h2></div>
      <Card>
        <div className="flex flex-wrap gap-2 items-end">
          <select className={SEL} value={f.orgId} onChange={(e) => set("orgId", e.target.value)}>
            <option value="">{lang === "ar" ? "كل المؤسسات" : "All institutions"}</option>
            {ALL_ORGS.map((o) => <option key={o.id} value={o.id}>{orgName(o.id)}</option>)}
          </select>
          <select className={SEL} value={f.table} onChange={(e) => set("table", e.target.value)}>
            <option value="">{lang === "ar" ? "كل الجداول" : "All tables"}</option>
            {Object.keys(TABLES).map((k) => <option key={k} value={k}>{L(TABLES[k], k)}</option>)}
          </select>
          <select className={SEL} value={f.userId} onChange={(e) => set("userId", e.target.value)}>
            <option value="">{lang === "ar" ? "كل المستخدمين" : "All users"}</option>
            {Object.entries(data?.users ?? {}).map(([id, email]) => <option key={id} value={id}>{email}</option>)}
          </select>
          <label className="text-xs">{lang === "ar" ? "من" : "From"} <input type="date" className={SEL} value={f.from} onChange={(e) => set("from", e.target.value)} /></label>
          <label className="text-xs">{lang === "ar" ? "إلى" : "To"} <input type="date" className={SEL} value={f.to} onChange={(e) => set("to", e.target.value)} /></label>
          {isFetching && <span className="text-xs text-muted-foreground">…</span>}
        </div>
      </Card>
      {error && <div className="text-sm text-danger">{lang === "ar" ? "تعذّر تحميل السجل." : "Could not load the log."}</div>}
      <Card>
        <ScrollableTable>
          <table className="oid-table w-full text-sm">
            <thead><tr>
              <th>{lang === "ar" ? "التاريخ" : "Date"}</th><th>{lang === "ar" ? "المستخدم" : "User"}</th><th>{lang === "ar" ? "الجدول" : "Table"}</th>
              <th>{lang === "ar" ? "المؤسسة" : "Institution"}</th><th>{lang === "ar" ? "العملية" : "Action"}</th><th>{lang === "ar" ? "الحقول المتغيرة" : "Changed fields"}</th>
            </tr></thead>
            <tbody>
              {(data?.rows ?? []).map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap tabular-nums" dir="ltr">{new Date(r.changed_at).toLocaleString(lang === "ar" ? "ar" : "en-GB")}</td>
                  <td dir="ltr">{r.changed_by ? data?.users[r.changed_by] ?? r.changed_by : lang === "ar" ? "النظام" : "System"}</td>
                  <td>{L(TABLES[r.table_name], r.table_name)}</td>
                  <td>{r.org_id ? orgName(r.org_id) : "—"}</td>
                  <td>{L(ACTIONS[r.action], r.action)}</td>
                  <td className="max-w-[520px]">
                    {r.action === "update" ? (
                      <ul className="space-y-0.5">
                        {changes(r).map((c) => (
                          <li key={c.k} className="break-words"><b>{L(FIELDS[c.k], c.k)}:</b> <span className="text-muted-foreground">{show(c.a).slice(0, 200)}</span> ← <span>{show(c.b).slice(0, 200)}</span></li>
                        ))}
                      </ul>
                    ) : <span className="text-muted-foreground text-xs">{r.record_id ?? ""}</span>}
                  </td>
                </tr>
              ))}
              {data && data.rows.length === 0 && <tr><td colSpan={6} className="text-center text-muted-foreground">{lang === "ar" ? "لا توجد تغييرات" : "No changes"}</td></tr>}
            </tbody>
          </table>
        </ScrollableTable>
        <div className="flex items-center justify-between mt-3 text-sm">
          <span>{data ? `${data.total} — ${lang === "ar" ? "صفحة" : "Page"} ${page + 1}/${pages}` : ""}</span>
          <div className="flex gap-2">
            <button className="px-3 py-1 rounded border border-border disabled:opacity-40" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>{lang === "ar" ? "السابق" : "Previous"}</button>
            <button className="px-3 py-1 rounded border border-border disabled:opacity-40" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>{lang === "ar" ? "التالي" : "Next"}</button>
          </div>
        </div>
      </Card>
    </div>
  );
}
