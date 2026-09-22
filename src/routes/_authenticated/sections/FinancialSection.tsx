import { useState } from "react";
import { Star } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ORGS, financialAssessment, PROGRAM_STATUS_META, financialProgram, financialTimeline,
  ORG_FISCAL_YEAR, FISCAL_QUARTERS, getQuarterLabel, type OrgId,
} from "@/lib/oid-data";
import { OverdueBadge } from "@/components/oid/OverdueBadge";
import { detectDeadline } from "@/lib/oid-overdue";
import { formatBudget } from "@/lib/oid-formatting";
import { ScrollableTable } from "@/components/oid/ScrollableTable";
import {
  loadFinancialReports, saveFinancialReport,
  type FinancialReport, type RevenueRow, type ExpenseRow,
} from "@/lib/financial.functions";
import { Card, CardHeader, Progress, SectionTitle } from "./_shared";

const money = (n: number | null | undefined) => (n ? formatBudget(n) : "$0");
const orgName = (id: string) => ORGS.find((o) => o.id === id)?.nameAr ?? id;

/* ============================ FINANCIAL ============================ */
export function FinancialSection() {
  const [tab, setTab] = useState<"advisor" | "reports">("advisor");
  return (
    <div className="space-y-6">
      <SectionTitle title="الأداء المالي" subtitle="متابعة أعمال المستشار المالي والتقارير الدورية" />

      <div className="flex gap-2 border-b border-border">
        {[["advisor", "💼 أعمال المستشار المالي"], ["reports", "📊 التقارير المالية"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k as any)}
            className={`px-4 py-2.5 text-sm border-b-2 transition ${tab === k ? "border-primary text-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{l}</button>
        ))}
      </div>

      {tab === "advisor" && <AdvisorTab />}
      {tab === "reports" && <FinancialReportsTab />}
    </div>
  );
}

/* ============================ أعمال المستشار (كما هي) ============================ */
function AdvisorTab() {
  const [tab, setTab] = useState<"assess" | "program" | "timeline">("assess");
  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b border-border">
        {[["assess","📊 تقييم الأداء المالي"],["program","📋 متابعة البرنامج"],["timeline","📅 الخط الزمني"]].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k as any)} className={`px-4 py-2 text-sm border-b-2 transition ${tab===k?"border-primary text-primary font-medium":"border-transparent text-muted-foreground hover:text-foreground"}`}>{l}</button>
        ))}
      </div>

      {tab === "assess" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {(Object.entries(financialAssessment) as ["ZUST"|"ZAD"|"TAYO"|"KAFI", any][]).map(([id, a]) => {
              const o = ORGS.find(x => x.id === id)!;
              return (
                <Card key={id} className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="font-bold">{o.nameAr}</div>
                    <div className="flex items-center gap-1 text-warning"><Star size={14} fill="currentColor"/><span className="text-sm font-bold tabular-nums">{a.rating}</span></div>
                  </div>
                  <div className="text-xs text-muted-foreground mb-3">{a.label}</div>
                  <div className="text-xs text-muted-foreground border-t border-border pt-2">
                    <div className="font-medium text-primary mb-1">المعلم القادم:</div>
                    {a.nextMilestone}
                    <OverdueBadge text={a.nextMilestone} />
                  </div>
                </Card>
              );
            })}
          </div>

          <Card>
            <CardHeader title="التقييم التفصيلي والتوصيات" />
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
              {(Object.entries(financialAssessment) as ["ZUST"|"ZAD"|"TAYO"|"KAFI", any][]).map(([id, a]) => {
                const o = ORGS.find(x => x.id === id)!;
                return (
                  <div key={id} className="space-y-3">
                    <h4 className="font-bold text-sm" style={{ color: o.color }}>{o.nameAr}</h4>
                    <div>
                      <div className="text-xs font-medium text-green-700 mb-1">✅ نقاط القوة</div>
                      <ul className="text-xs space-y-1 text-muted-foreground">
                        {a.strengths.map((s: string, i: number) => <li key={i}>• {s}</li>)}
                      </ul>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-red-700 mb-1">⚠️ نقاط الضعف</div>
                      <ul className="text-xs space-y-1 text-muted-foreground">
                        {a.weaknesses.map((s: string, i: number) => <li key={i}>• {s}<OverdueBadge text={s} /></li>)}
                      </ul>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-blue-700 mb-1">💡 التوصيات</div>
                      <ul className="text-xs space-y-1 text-muted-foreground">
                        {a.recommendations.map((s: string, i: number) => <li key={i}>• {s}<OverdueBadge text={s} /></li>)}
                      </ul>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {tab === "program" && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {(Object.entries(financialProgram) as ["ZUST"|"ZAD"|"TAYO"|"KAFI", any[]][]).map(([id, rows]) => {
            const o = ORGS.find(x => x.id === id)!;
            const doneCount = rows.filter(r => r.status === "done").length;
            const pct = Math.round((doneCount / rows.length) * 100);
            return (
              <Card key={id}>
                <CardHeader title={o.nameAr} subtitle={`اكتمل ${doneCount} من ${rows.length}`} />
                <div className="px-5 pt-2"><Progress value={pct} color={o.color} /></div>
                <div className="p-5 space-y-2">
                  {rows.map((r, i) => {
                    const m = PROGRAM_STATUS_META[r.status as keyof typeof PROGRAM_STATUS_META];
                    const noteOverdue = detectDeadline(r.note).overdue && r.status !== "done";
                    return (
                      <div key={i} className={`border rounded-lg p-3 ${noteOverdue ? "border-red-300 bg-red-50/40" : "border-border"}`}>
                        <div className="flex items-center justify-between mb-1 gap-2">
                          <span className="text-sm font-medium">{r.domain}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${m.color}`}>{noteOverdue ? "متأخر" : m.label}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">{r.note}<OverdueBadge text={r.note} /></div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {tab === "timeline" && (
        <Card className="p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {financialTimeline.map((m, i) => {
              const info = detectDeadline(m.period);
              const late = !m.done && info.overdue;
              return (
                <div key={i} className="flex-1 text-center min-w-[120px]">
                  <div className={`mx-auto mb-2 w-12 h-12 rounded-full flex items-center justify-center text-2xl ${m.done?"bg-green-100":late?"bg-red-100":"bg-blue-100"}`}>
                    {m.done ? "✅" : late ? "⚠️" : "🔄"}
                  </div>
                  <div className="text-xs font-bold">{m.period}</div>
                  <div className="text-xs text-muted-foreground mt-1">{m.title}</div>
                  {late && <div className="text-[10px] text-red-700 font-medium mt-1">متأخر {info.monthsLate} شهر</div>}
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

/* ============================ التقارير المالية ============================ */
function FinancialReportsTab() {
  const queryClient = useQueryClient();
  const [selectedOrg, setSelectedOrg] = useState("all");
  const [selectedYear, setSelectedYear] = useState(2026);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<FinancialReport | null>(null);

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["financial-reports", selectedOrg, selectedYear],
    queryFn: () => loadFinancialReports({
      data: { orgId: selectedOrg !== "all" ? selectedOrg : undefined, year: selectedYear },
    }),
  });

  const selectCls = "h-9 rounded-lg border border-border bg-card px-3 text-sm";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select className={selectCls} value={selectedOrg} onChange={(e) => setSelectedOrg(e.target.value)}>
          <option value="all">جميع المؤسسات</option>
          {ORGS.map((o) => <option key={o.id} value={o.id}>{o.nameAr}</option>)}
        </select>
        <select className={selectCls} value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}>
          <option value={2026}>2026</option>
          <option value={2027}>2027</option>
        </select>
        <button
          onClick={() => { setEditingReport(null); setModalOpen(true); }}
          className="ms-auto h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">
          + تقرير مالي جديد
        </button>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">جارٍ التحميل…</div>
      ) : reports.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          <p className="text-2xl mb-2">📊</p>
          <p>لا توجد تقارير مالية بعد</p>
          <p className="text-xs mt-1">ابدأ بإضافة أول تقرير مالي ربعي</p>
        </div>
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px,1fr))" }}>
          {reports.map((r) => (
            <FinancialReportCard key={r.id} report={r} onEdit={() => { setEditingReport(r); setModalOpen(true); }} />
          ))}
        </div>
      )}

      {modalOpen && (
        <FinancialReportModal
          report={editingReport}
          onSave={async (data) => {
            await saveFinancialReport({ data });
            queryClient.invalidateQueries({ queryKey: ["financial-reports"] });
            setModalOpen(false);
          }}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}

function FinancialReportCard({ report, onEdit }: { report: FinancialReport; onEdit: () => void }) {
  const executionPct = report.approved_budget > 0
    ? Math.round((report.actual_spending / report.approved_budget) * 100) : 0;
  const isDeficit = Number(report.surplus_deficit) < 0;
  const barColor = executionPct >= 90 ? "#16a34a" : executionPct >= 70 ? "#d97706" : "#dc2626";

  return (
    <Card className="p-4" >
      <div style={{ borderInlineEnd: `4px solid ${barColor}`, marginInlineEnd: -16, paddingInlineEnd: 12 }}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="text-sm font-bold">{orgName(report.org_id)}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {getQuarterLabel(report.org_id, report.quarter)} — {report.plan_year}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${report.status === "final" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
              {report.status === "final" ? "✅ معتمد" : "📝 مسودة"}
            </span>
            <button onClick={onEdit} className="rounded-md border border-border bg-muted px-2 py-1 text-[11px]">✎</button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-2.5">
          {[
            { label: "الميزانية المعتمدة", value: money(report.approved_budget) },
            { label: "الإنفاق الفعلي", value: money(report.actual_spending) },
          ].map((it) => (
            <div key={it.label} className="rounded-md bg-muted p-2 text-center">
              <div className="text-[10px] text-muted-foreground">{it.label}</div>
              <div className="mt-0.5 text-[13px] font-bold tabular-nums" dir="ltr">{it.value}</div>
            </div>
          ))}
        </div>

        <div className="mb-2">
          <div className="mb-1 flex justify-between text-[11px]">
            <span className="text-muted-foreground">نسبة التنفيذ</span>
            <span className="font-bold tabular-nums" dir="ltr">{executionPct}%</span>
          </div>
          <Progress value={Math.min(executionPct, 100)} color={barColor} />
        </div>

        <div className={`rounded-md py-1.5 text-center text-xs font-bold ${isDeficit ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
          {isDeficit ? "عجز" : "فائض"}: <span dir="ltr">{money(Math.abs(Number(report.surplus_deficit)))}</span>
        </div>
      </div>
    </Card>
  );
}

type FormState = {
  id?: string;
  org_id: string;
  plan_year: number;
  quarter: string;
  approved_budget: number;
  actual_spending: number;
  revenues: RevenueRow[];
  expenses: ExpenseRow[];
  challenges: string;
  actions: string;
  notes: string;
  status: string;
};

function FinancialReportModal({ report, onSave, onClose }: {
  report: FinancialReport | null;
  onSave: (d: FormState) => void | Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<FormState>({
    id: report?.id,
    org_id: report?.org_id ?? "",
    plan_year: report?.plan_year ?? 2026,
    quarter: report?.quarter ?? "Q1",
    approved_budget: Number(report?.approved_budget ?? 0),
    actual_spending: Number(report?.actual_spending ?? 0),
    revenues: (report?.revenues ?? []) as RevenueRow[],
    expenses: (report?.expenses ?? []) as ExpenseRow[],
    challenges: report?.challenges ?? "",
    actions: report?.actions ?? "",
    notes: report?.notes ?? "",
    status: report?.status ?? "draft",
  });
  const [saving, setSaving] = useState(false);

  const executionPct = form.approved_budget > 0
    ? Math.round((form.actual_spending / form.approved_budget) * 100) : 0;
  const surplus = form.approved_budget - form.actual_spending;

  const field = "h-9 w-full rounded-lg border border-border bg-card px-2 text-sm";
  const labelCls = "mb-1 block text-[11px] font-medium text-muted-foreground";

  const updateRevenue = (i: number, key: keyof RevenueRow, val: any) => {
    setForm((p) => {
      const rows = [...p.revenues];
      rows[i] = { ...rows[i], [key]: val } as RevenueRow;
      rows[i].diff = Number(rows[i].actual ?? 0) - Number(rows[i].planned ?? 0);
      return { ...p, revenues: rows };
    });
  };
  const updateExpense = (i: number, key: keyof ExpenseRow, val: any) => {
    setForm((p) => {
      const rows = [...p.expenses];
      rows[i] = { ...rows[i], [key]: val } as ExpenseRow;
      rows[i].diff = Number(rows[i].actual ?? 0) - Number(rows[i].planned ?? 0);
      return { ...p, expenses: rows };
    });
  };

  const submit = async (status: string) => {
    if (!form.org_id) return;
    setSaving(true);
    try { await onSave({ ...form, status }); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4" onClick={onClose}>
      <div dir="rtl" className="my-6 w-full max-w-[680px] overflow-hidden rounded-xl bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between px-5 py-4 text-white" style={{ background: "linear-gradient(135deg,#0e4d2e,#0d3a6e)" }}>
          <div>
            <div className="text-[11px] opacity-70">التقرير المالي الربعي</div>
            <div className="text-[15px] font-bold">
              {form.org_id ? orgName(form.org_id) : "تقرير مالي جديد"}
              {form.org_id && ` — ${getQuarterLabel(form.org_id, form.quarter)}`}
            </div>
          </div>
          <button onClick={onClose} className="rounded-md bg-white/15 px-2.5 py-1 text-sm">✕</button>
        </div>

        <div className="space-y-4 p-5">
          {/* البيانات الأساسية */}
          <div className="rounded-xl border border-border bg-muted/40 p-3.5">
            <div className="mb-3 text-xs font-bold text-primary">البيانات الأساسية</div>
            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className={labelCls}>المؤسسة *</label>
                <select className={field} value={form.org_id} onChange={(e) => setForm((p) => ({ ...p, org_id: e.target.value }))}>
                  <option value="">اختر…</option>
                  {ORGS.filter((o) => o.id !== "HAMDI").map((o) => <option key={o.id} value={o.id}>{o.nameAr}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>الربع *</label>
                <select className={field} value={form.quarter} onChange={(e) => setForm((p) => ({ ...p, quarter: e.target.value }))}>
                  {["Q1", "Q2", "Q3", "Q4"].map((q) => <option key={q} value={q}>{q}</option>)}
                </select>
                {form.org_id && (
                  <div className="mt-0.5 text-[10px] text-muted-foreground">
                    {FISCAL_QUARTERS[ORG_FISCAL_YEAR[form.org_id as OrgId] ?? "calendar"].find((q) => q.q === form.quarter)?.months}
                  </div>
                )}
              </div>
              <div>
                <label className={labelCls}>السنة *</label>
                <input type="number" className={field} dir="ltr" value={form.plan_year}
                  onChange={(e) => setForm((p) => ({ ...p, plan_year: Number(e.target.value) }))} />
              </div>
            </div>
          </div>

          {/* الملخص المالي */}
          <div className="overflow-hidden rounded-xl border border-border">
            <div className="border-b border-border bg-green-50 px-3.5 py-2.5 text-xs font-bold text-primary">الملخص المالي</div>
            <div className="p-3.5">
              <div className="mb-3 grid grid-cols-2 gap-2.5">
                <div>
                  <label className={labelCls}>الميزانية المعتمدة للربع ($)</label>
                  <input type="number" dir="ltr" className={field} value={form.approved_budget}
                    onChange={(e) => setForm((p) => ({ ...p, approved_budget: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className={labelCls}>الإنفاق الفعلي ($)</label>
                  <input type="number" dir="ltr" className={field} value={form.actual_spending}
                    onChange={(e) => setForm((p) => ({ ...p, actual_spending: Number(e.target.value) }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-blue-50 p-2.5 text-center">
                  <div className="text-[10px] text-muted-foreground">نسبة التنفيذ</div>
                  <div className="text-xl font-bold tabular-nums" dir="ltr"
                    style={{ color: executionPct >= 90 ? "#15803d" : executionPct >= 70 ? "#d97706" : "#dc2626" }}>
                    {executionPct}%
                  </div>
                </div>
                <div className={`rounded-lg p-2.5 text-center ${surplus >= 0 ? "bg-green-50" : "bg-red-50"}`}>
                  <div className="text-[10px] text-muted-foreground">{surplus >= 0 ? "الفائض" : "العجز"}</div>
                  <div className="text-xl font-bold tabular-nums" dir="ltr" style={{ color: surplus >= 0 ? "#15803d" : "#dc2626" }}>
                    {money(Math.abs(surplus))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* الإيرادات */}
          <div className="overflow-hidden rounded-xl border border-border">
            <div className="flex items-center justify-between border-b border-border bg-green-50 px-3.5 py-2.5 text-xs font-bold text-primary">
              <span>الإيرادات</span>
              <button className="text-[11px] text-primary"
                onClick={() => setForm((p) => ({ ...p, revenues: [...p.revenues, { source: "", planned: 0, actual: 0, diff: 0 }] }))}>
                + إضافة مصدر
              </button>
            </div>
            <div className="p-3.5">
              {form.revenues.length === 0 ? (
                <div className="py-3 text-center text-xs text-muted-foreground">لا توجد إيرادات — اضغط «+ إضافة مصدر»</div>
              ) : (
                <ScrollableTable minWidth={520}>
                  <table className="oid-table oid-table-fixed">
                    <colgroup>
                      <col /><col style={{ width: 90 }} /><col style={{ width: 90 }} /><col style={{ width: 80 }} /><col style={{ width: 36 }} />
                    </colgroup>
                    <thead><tr><th>المصدر</th><th>المخطط ($)</th><th>الفعلي ($)</th><th>الفرق ($)</th><th /></tr></thead>
                    <tbody>
                      {form.revenues.map((rev, i) => (
                        <tr key={i}>
                          <td><input className={field} value={rev.source} placeholder="اسم المصدر" onChange={(e) => updateRevenue(i, "source", e.target.value)} /></td>
                          <td><input type="number" dir="ltr" className={`${field} text-center`} value={rev.planned} onChange={(e) => updateRevenue(i, "planned", Number(e.target.value))} /></td>
                          <td><input type="number" dir="ltr" className={`${field} text-center`} value={rev.actual} onChange={(e) => updateRevenue(i, "actual", Number(e.target.value))} /></td>
                          <td className="numeric" style={{ color: rev.diff >= 0 ? "#15803d" : "#dc2626", fontWeight: 700 }}>
                            {rev.diff >= 0 ? "+" : ""}{Math.round(rev.diff).toLocaleString("en-US")}
                          </td>
                          <td>
                            <button className="text-red-600" onClick={() => setForm((p) => ({ ...p, revenues: p.revenues.filter((_, j) => j !== i) }))}>✕</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollableTable>
              )}
            </div>
          </div>

          {/* المصروفات */}
          <div className="overflow-hidden rounded-xl border border-border">
            <div className="flex items-center justify-between border-b border-border bg-green-50 px-3.5 py-2.5 text-xs font-bold text-primary">
              <span>المصروفات حسب البند</span>
              <button className="text-[11px] text-primary"
                onClick={() => setForm((p) => ({ ...p, expenses: [...p.expenses, { item: "", planned: 0, actual: 0, diff: 0, note: "" }] }))}>
                + إضافة بند
              </button>
            </div>
            <div className="p-3.5">
              {form.expenses.length === 0 ? (
                <div className="py-3 text-center text-xs text-muted-foreground">لا توجد مصروفات — اضغط «+ إضافة بند»</div>
              ) : (
                <ScrollableTable minWidth={620}>
                  <table className="oid-table oid-table-fixed">
                    <colgroup>
                      <col /><col style={{ width: 80 }} /><col style={{ width: 80 }} /><col style={{ width: 75 }} /><col /><col style={{ width: 36 }} />
                    </colgroup>
                    <thead><tr><th>البند</th><th>المخطط ($)</th><th>الفعلي ($)</th><th>الفرق ($)</th><th>ملاحظة</th><th /></tr></thead>
                    <tbody>
                      {form.expenses.map((exp, i) => (
                        <tr key={i}>
                          <td><input className={field} value={exp.item} placeholder="اسم البند" onChange={(e) => updateExpense(i, "item", e.target.value)} /></td>
                          <td><input type="number" dir="ltr" className={`${field} text-center`} value={exp.planned} onChange={(e) => updateExpense(i, "planned", Number(e.target.value))} /></td>
                          <td><input type="number" dir="ltr" className={`${field} text-center`} value={exp.actual} onChange={(e) => updateExpense(i, "actual", Number(e.target.value))} /></td>
                          <td className="numeric" style={{ color: exp.diff <= 0 ? "#15803d" : "#dc2626", fontWeight: 700 }}>
                            {exp.diff > 0 ? "+" : ""}{Math.round(exp.diff).toLocaleString("en-US")}
                          </td>
                          <td><input className={field} value={exp.note ?? ""} placeholder="ملاحظة اختيارية" onChange={(e) => updateExpense(i, "note", e.target.value)} /></td>
                          <td>
                            <button className="text-red-600" onClick={() => setForm((p) => ({ ...p, expenses: p.expenses.filter((_, j) => j !== i) }))}>✕</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollableTable>
              )}
            </div>
          </div>

          {/* الملاحظات الختامية */}
          <div className="overflow-hidden rounded-xl border border-border">
            <div className="border-b border-border bg-green-50 px-3.5 py-2.5 text-xs font-bold text-primary">الملاحظات الختامية</div>
            <div className="grid grid-cols-2 gap-3 p-3.5">
              <div>
                <label className={labelCls}>أبرز التحديات المالية</label>
                <textarea rows={3} className="w-full resize-y rounded-lg border border-border bg-card p-2 text-sm"
                  value={form.challenges} onChange={(e) => setForm((p) => ({ ...p, challenges: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>الإجراءات المتخذة</label>
                <textarea rows={3} className="w-full resize-y rounded-lg border border-border bg-card p-2 text-sm"
                  value={form.actions} onChange={(e) => setForm((p) => ({ ...p, actions: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>ملاحظات إضافية</label>
                <textarea rows={2} className="w-full resize-y rounded-lg border border-border bg-card p-2 text-sm"
                  value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <button onClick={onClose} className="rounded-lg border border-border px-5 py-2 text-sm">إغلاق</button>
            <button disabled={saving || !form.org_id} onClick={() => submit("draft")}
              className="rounded-lg border border-border bg-muted px-5 py-2 text-sm disabled:opacity-50">💾 حفظ كمسودة</button>
            <button disabled={saving || !form.org_id} onClick={() => submit("final")}
              className="rounded-lg bg-primary px-6 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50">✅ اعتماد التقرير</button>
          </div>
        </div>
      </div>
    </div>
  );
}
