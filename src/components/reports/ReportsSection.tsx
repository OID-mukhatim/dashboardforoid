import { useState } from "react";
import { useSuspenseQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { perfQueryOptions } from "@/components/perf/PerformanceSection";
import { ORGS } from "@/lib/org-registry";
import { useLang } from "@/lib/lang-context";
import { useAuth } from "@/hooks/use-auth";
import { FilterSelect, SectionTitle } from "@/routes/_authenticated/sections/_shared";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { buildReportSections, approvalWarnings, DEFAULT_ANNUAL_STATS, REPORT_PERIODS, type ReportPeriod, type ReportSnapshot, type InitiativeLite } from "@/lib/reports/build";
import { loadReportExtras, saveReportContent, approveReport, reopenReport } from "@/lib/reports/reports.functions";
import { REPORT_SECTIONS } from "./registry";
import { RowsEditor } from "./RowsEditor";
import { COLUMNS } from "./sections";
import { CorrectionDialog } from "./CorrectionDialog";
import { usePlanSelection } from "./usePlanSelection";

export function ReportsSection() {
  const { data } = useSuspenseQuery(perfQueryOptions);
  const { lang, dir, t } = useLang();
  const ar = lang === "ar";
  const { isEditor, isAdmin } = useAuth();
  const qc = useQueryClient();
  const extrasFn = useServerFn(loadReportExtras);
  const extras = useQuery({ queryKey: ["report-extras"], queryFn: () => extrasFn() });
  const save = useServerFn(saveReportContent), approve = useServerFn(approveReport), reopen = useServerFn(reopenReport);
  const sel = usePlanSelection(data.plans, data.activeYears);
  const [period, setPeriod] = useState<ReportPeriod>("Q1");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [reopening, setReopening] = useState(false);
  const [exec, setExec] = useState<string | null>(null);
  const plan = sel.plan;
  const report = data.reports.find((r) => r.plan_id === plan?.id && r.period === period);
  const approved = report?.status === "approved";
  const kpis = data.kpis.filter((k) => k.plan_id === plan?.id);
  const live: ReportSnapshot | null = plan
    ? buildReportSections({
        plan, kpis, report, period,
        activities: data.activities.filter((a) => a.plan_id === plan.id),
        initiatives: (extras.data?.initiatives ?? []) as InitiativeLite[],
      })
    : null;
  const snap = (approved ? (report?.snapshot as ReportSnapshot) : live) ?? null;
  const canEdit = isEditor && !approved && !!plan;
  const org = ORGS.find((o) => o.id === sel.orgId);
  async function act(work: () => Promise<unknown>) {
    setBusy(true); setMsg("");
    try {
      await work();
      await Promise.all([qc.invalidateQueries({ queryKey: ["perf-data"] }), qc.invalidateQueries({ queryKey: ["report-extras"] })]);
      setMsg(ar ? "تم الحفظ" : "Saved");
    } catch (e) { setMsg(e instanceof Error ? e.message : "error"); }
    finally { setBusy(false); }
  }
  const saveField = (values: Record<string, unknown>) => plan && act(() => save({ data: { planId: plan.id, period, values } as never }));
  const warnings = live ? approvalWarnings(live) : [];
  const warnText: Record<string, string> = ar
    ? { missing: "توجد مؤشرات ببيانات ناقصة", noPlan: "توجد مؤشرات بلا مخطط", emptyNarrative: "بعض الأقسام السردية فارغة" }
    : { missing: "Some KPIs have missing data", noPlan: "Some KPIs have no plan", emptyNarrative: "Some narrative sections are empty" };
  const kpiOptions = kpis.filter((k) => k.id).map((k) => ({ value: k.id as string, label: `${k.code} · ${k.name}` }));
  return (
    <div dir={dir} className="space-y-6">
      <SectionTitle title={t("nav.reports")} />
      <div className="flex flex-wrap gap-3">
        <FilterSelect label={ar ? "المؤسسة" : "Institution"} value={sel.orgId} onChange={sel.setOrg}
          options={ORGS.map((o) => ({ value: o.id, label: ar ? o.nameAr : o.nameEn }))} />
        <FilterSelect label={ar ? "السنة" : "Year"} value={sel.year} onChange={sel.setYear} options={sel.yearOptions} />
        <FilterSelect label={ar ? "نوع التقرير" : "Report"} value={period} onChange={(v) => { setPeriod(v as ReportPeriod); setExec(null); }}
          options={REPORT_PERIODS.map((p) => ({ value: p, label: p === "annual" ? (ar ? "سنوي" : "Annual") : p }))} />
      </div>
      {!plan || !snap ? (
        <p className="py-12 text-center text-muted-foreground">{ar ? "لا توجد بيانات للفترة" : "No data for this period"}</p>
      ) : (
        <>
          <header className="border-y border-border py-4 grid grid-cols-2 md:grid-cols-3 gap-3 text-sm" data-testid="report-header">
            <div><span className="text-muted-foreground">{ar ? "المؤسسة: " : "Institution: "}</span><strong>{ar ? org?.nameAr : org?.nameEn}</strong></div>
            <div><span className="text-muted-foreground">{ar ? "الفترة: " : "Period: "}</span>{period === "annual" ? (ar ? "التقرير السنوي" : "Annual report") : period}</div>
            <div><span className="text-muted-foreground">{ar ? "السنة: " : "Year: "}</span>{sel.yearLabel(plan.plan_year)}</div>
            <div><span className="text-muted-foreground">{ar ? "معدّ التقرير: " : "Prepared by: "}</span>{plan.prepared_by ?? "—"}</div>
            <div><span className="text-muted-foreground">{ar ? "الحالة: " : "Status: "}</span>
              <strong data-testid="report-status">{approved ? (ar ? "معتمد" : "Approved") : (ar ? "مسودة" : "Draft")}</strong></div>
            {approved && <div><span className="text-muted-foreground">{ar ? "اعتُمد: " : "Approved: "}</span>
              {plan.approved_by ?? ""} {report?.approved_at ? new Date(report.approved_at).toLocaleString(ar ? "ar" : "en") : ""}</div>}
          </header>
          {isAdmin && (
            <div className="flex flex-wrap items-center gap-3">
              {!approved ? (
                <Button disabled={busy || plan.status !== "matrix_approved"}
                  onClick={() => act(() => approve({ data: { planId: plan.id, period, snapshot: live as never } }))}>
                  {ar ? "اعتماد التقرير" : "Approve report"}
                </Button>
              ) : (
                <Button variant="outline" disabled={busy} onClick={() => setReopening(true)}>{ar ? "إعادة فتح" : "Reopen"}</Button>
              )}
              {!approved && plan.status !== "matrix_approved" && <span className="text-sm text-muted-foreground">{ar ? "يتطلب اعتماد مصفوفة الخطة أولاً" : "Plan matrix must be approved first"}</span>}
            </div>
          )}
          {!approved && warnings.length > 0 && (
            <ul className="text-sm border border-border rounded-md p-3 bg-muted list-disc ps-6" role="note">
              {warnings.map((w) => <li key={w}>{warnText[w]}</li>)}
            </ul>
          )}
          {msg && <p role="status" className="text-sm">{msg}</p>}
          {REPORT_SECTIONS.filter((s) => !s.only || s.only(period)).map((s, i) => {
            const d = s.collect(snap);
            return (
              <section key={s.id} className="space-y-2" data-section={s.id}>
                <h2 className="font-semibold text-lg">{i + 1}. {ar ? s.title[0] : s.title[1]}</h2>
                {s.narrative === "executive_summary" ? (
                  canEdit ? (
                    <div className="space-y-2">
                      <Textarea aria-label={s.title[0]} rows={5} value={exec ?? (d as string | null) ?? ""} onChange={(e) => setExec(e.target.value)} />
                      <Button size="sm" disabled={busy || exec === null} onClick={async () => { await saveField({ executive_summary: exec }); setExec(null); }}>{ar ? "حفظ" : "Save"}</Button>
                    </div>
                  ) : d ? <p className="whitespace-pre-wrap text-sm">{d as string}</p>
                    : <p className="text-sm text-muted-foreground">{ar ? "لا توجد بيانات للفترة" : "No data for this period"}</p>
                ) : s.narrative ? (
                  <RowsEditor
                    key={`${report?.id}-${s.id}-${approved}`}
                    busy={busy}
                    columns={s.narrative === "achievements"
                      ? COLUMNS.achievements.map((c) => c.key === "kpi_id" ? { ...c, options: kpiOptions } : c)
                      : COLUMNS[s.narrative]}
                    rows={(d as any[]) ?? []}
                    seed={s.narrative === "annual_stats" ? DEFAULT_ANNUAL_STATS.map((category) => ({ category })) : undefined}
                    onSave={canEdit ? (rows) => saveField({ [s.narrative as string]: rows }) : undefined}
                  />
                ) : s.render?.(d, lang)}
              </section>
            );
          })}
        </>
      )}
      <CorrectionDialog open={reopening} title={ar ? "إعادة فتح التقرير" : "Reopen report"} description={ar ? "اكتب سبب إعادة الفتح (10 أحرف على الأقل). تُحفظ النسخة المعتمدة السابقة في السجل." : "Write the reason (at least 10 characters). The previous approved copy is kept in the log."} onCancel={() => setReopening(false)}
        onConfirm={(reason) => { setReopening(false); if (report?.id) act(() => reopen({ data: { reportId: report.id as string, reason } })); }} />
    </div>
  );
}
