import { useMemo, useState } from "react";
import { ORGS, type OrgId } from "@/lib/oid-data";
import { ScrollableTable } from "@/components/oid/ScrollableTable";
import { loadQuarterlyReports, type QuarterlyReportRecord } from "@/lib/dashboard.functions";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Card, EmptyData, Progress, SectionTitle, OrgChip, FilterSelect } from "./_shared";

/* ============================ QUARTERLY ============================ */
type QAch = { n: number|null; title: string; code: string|null; target: number|null; achieved: number|null; pct: number|null; beneficiaries: number|null; location: string|null; budget: number|null; cost: number|null; variance: number|null; outcomes: string|null };
type QEv = { n: number|null; title: string; code: string|null; target: number|null; achieved: number|null; pct: number|null; participants: number|null; location: string|null; evaluation: string|null };

/** نسبة الإنجاز المعتمدة: تُحتسب من (المنفذ ÷ المستهدف) لأن بعض الملفات تخزّن نسبة الانحراف بدل نسبة الإنجاز */
function effPct(a: { target: number|null; achieved: number|null; pct: number|null }): number | null {
  const t = a.target, ac = a.achieved;
  if (typeof t === "number" && t !== 0 && typeof ac === "number") {
    return Math.round((ac / t) * 1000) / 10;
  }
  return a.pct;
}
type QCh = { n: number|null; title: string; impact: string|null; reasons: string|null; actions: string|null; status: string|null; requiredSupport: string|null };

export function QuarterlySection() {
  const [tab, setTab] = useState<"ach"|"ch"|"rec">("ach");
  const [filters, setFilters] = useState({ org: "all", quarter: "all", year: "all" });
  const update = (k: keyof typeof filters, v: string) => setFilters((p) => ({ ...p, [k]: v }));
  const reset = () => setFilters({ org: "all", quarter: "all", year: "all" });

  const reportsFn = useServerFn(loadQuarterlyReports);
  const { data: reports, isLoading } = useQuery({
    queryKey: ["quarterly-reports"],
    queryFn: () => reportsFn(),
    refetchInterval: 15000,
  });

  const rows = (reports ?? []) as QuarterlyReportRecord[];

  const live = useMemo(() => rows.filter((r) => {
    const okOrg = filters.org === "all" || r.orgCode === filters.org;
    const okQ = filters.quarter === "all" || (r.quarter ?? "") === filters.quarter;
    const okY = filters.year === "all" || String(r.year ?? "") === filters.year;
    return okOrg && okQ && okY;
  }), [rows, filters]);

  const achievements = useMemo(() => live.flatMap((r) =>
    (((r.payload as any)?.achievements ?? []) as QAch[]).map((a, i) => ({ ...a, pct: effPct(a), _k: `${r.id}-${i}`, org: r.orgCode, quarter: r.quarter, year: r.year }))
  ), [live]);
  const events = useMemo(() => live.flatMap((r) =>
    (((r.payload as any)?.events ?? []) as QEv[]).map((a, i) => ({ ...a, pct: effPct(a), _k: `${r.id}-e${i}`, org: r.orgCode, quarter: r.quarter }))
  ), [live]);
  const challenges = useMemo(() => live.flatMap((r) =>
    (((r.payload as any)?.challenges ?? []) as QCh[]).map((a, i) => ({ ...a, _k: `${r.id}-c${i}`, org: r.orgCode, quarter: r.quarter }))
  ), [live]);
  const recommendations = useMemo(() => live.flatMap((r) =>
    (((r.payload as any)?.recommendations ?? []) as string[]).map((t, i) => ({ text: t, _k: `${r.id}-r${i}`, org: r.orgCode, quarter: r.quarter }))
  ), [live]);

  const totalAch = rows.reduce((s, r) => s + (((r.payload as any)?.achievements ?? []) as unknown[]).length, 0);
  const hasActive = filters.org !== "all" || filters.quarter !== "all" || filters.year !== "all";
  const orgOpts = [{ value: "all", label: "جميع المؤسسات" }, ...ORGS.map((o) => ({ value: o.id, label: o.nameAr }))];
  const qOpts = [
    { value: "all", label: "جميع الأرباع" },
    { value: "Q1", label: "الربع الأول" }, { value: "Q2", label: "الربع الثاني" },
    { value: "Q3", label: "الربع الثالث" }, { value: "Q4", label: "الربع الرابع" },
  ];
  const years = Array.from(new Set(rows.map((r) => r.year).filter(Boolean))).sort() as number[];
  const yOpts = [{ value: "all", label: "جميع السنوات" }, ...years.map((y) => ({ value: String(y), label: String(y) }))];
  const subtitle = rows.length
    ? `${rows.length} تقرير مرفوع — ${Array.from(new Set(rows.map((r) => `${r.quarter ?? "?"} ${r.year ?? ""}`.trim()))).join("، ")}`
    : "لا توجد تقارير مرفوعة بعد";

  return (
    <div className="space-y-6">
      <SectionTitle title="التقارير الربعية" subtitle={subtitle} />
      <Card className="p-3 flex flex-wrap items-center gap-3">
        <FilterSelect label="المؤسسة" value={filters.org} onChange={(v)=>update("org", v)} options={orgOpts} />
        <FilterSelect label="الربع" value={filters.quarter} onChange={(v)=>update("quarter", v)} options={qOpts} />
        <FilterSelect label="السنة" value={filters.year} onChange={(v)=>update("year", v)} options={yOpts} />
        {hasActive && (
          <button onClick={reset} className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted">↺ إعادة ضبط</button>
        )}
      </Card>

      <div className="text-xs text-muted-foreground">
        عرض <span className="font-bold tabular-nums" dir="ltr">{achievements.length}</span> من{" "}
        <span className="tabular-nums" dir="ltr">{totalAch}</span> إنجاز مستخرج من الملفات المرفوعة
      </div>

      <div className="flex gap-2 border-b border-border">
        {[["ach","الإنجازات والمشاريع"],["ch","التحديات والعوائق"],["rec","التوصيات"]].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k as any)} className={`px-4 py-2 text-sm border-b-2 transition ${tab===k?"border-primary text-primary font-medium":"border-transparent text-muted-foreground hover:text-foreground"}`}>{l}</button>
        ))}
      </div>

      {isLoading && <Card className="p-8 text-center text-sm text-muted-foreground">جارٍ تحميل التقارير…</Card>}

      {!isLoading && tab === "ach" && (
        achievements.length === 0 ? (
          <Card className="p-8 text-center space-y-3">
            <EmptyData msg="لا توجد إنجازات مطابقة — ارفع تقرير الأداء الربعي أو عدّل الفلاتر" />
            {hasActive && <button onClick={reset} className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted">↺ إعادة ضبط الفلاتر</button>}
          </Card>
        ) : (
        <div className="space-y-6">
        <Card>
          <ScrollableTable>
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>{["م","الإنجاز/المشروع","كود المؤشر","المؤسسة","الربع","المستهدف","المنفذ","% الإنجاز","المستفيدون","الموقع","الموازنة","التكلفة","الانحراف"].map(h=><th key={h} className="px-3 py-2 text-right font-medium whitespace-nowrap">{h}</th>)}</tr>
              </thead>
              <tbody>
                {achievements.map((r, i) => (
                  <tr key={r._k} className="border-t border-border hover:bg-muted/20 align-top">
                    <td className="px-3 py-2 tabular-nums">{i + 1}</td>
                    <td className="px-3 py-2 min-w-[240px]">
                      <div>{r.title}</div>
                      {r.outcomes && (
                        <details className="mt-1 group">
                          <summary className="text-[11px] text-primary cursor-pointer select-none inline-flex items-center gap-1 hover:underline list-none">
                            <span className="inline-block transition-transform group-open:rotate-90">▸</span> النتائج/المخرجات
                          </summary>
                          <div className="text-[11px] text-muted-foreground mt-1 leading-relaxed pr-4">{r.outcomes}</div>
                        </details>
                      )}
                    </td>
                    <td className="px-3 py-2"><span className="font-mono text-xs text-primary">{r.code ?? "—"}</span></td>
                    <td className="px-3 py-2">{r.org ? <OrgChip id={r.org as OrgId} /> : <span className="text-xs text-muted-foreground">—</span>}</td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap">{[r.quarter, r.year].filter(Boolean).join(" ") || "—"}</td>
                    <td className="px-3 py-2 text-xs tabular-nums">{r.target ?? "—"}</td>
                    <td className="px-3 py-2 text-xs tabular-nums">{r.achieved ?? "—"}</td>
                    <td className="px-3 py-2 min-w-[120px]">
                      {r.pct === null ? <span className="text-xs text-muted-foreground">—</span> : (
                        <div className="flex items-center gap-2"><Progress value={Math.min(100, Math.max(0, r.pct))} /><span className="text-xs tabular-nums">{Math.round(r.pct)}%</span></div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs tabular-nums">{r.beneficiaries ?? "—"}</td>
                    <td className="px-3 py-2 text-xs">{r.location ?? "—"}</td>
                    <td className="px-3 py-2 tabular-nums text-xs">{r.budget ? `$${r.budget}` : "—"}</td>
                    <td className="px-3 py-2 tabular-nums text-xs">{r.cost ? `$${r.cost}` : "—"}</td>
                    <td className="px-3 py-2">
                      {!r.variance ? <span className="text-xs text-gray-500">—</span>
                        : <span className={`text-xs px-2 py-0.5 rounded-full ${r.variance > 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{r.variance > 0 ? `+$${r.variance}` : `-$${Math.abs(r.variance)}`}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollableTable>
        </Card>

        {events.length > 0 && (
          <Card>
            <div className="px-4 py-3 text-sm font-medium border-b border-border">المشاركات والفعاليات والبرامج التدريبية</div>
            <ScrollableTable>
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>{["م","الفعالية","الكود","المؤسسة","المستهدف","المنفذ","% الإنجاز","المشاركون","التقييم"].map(h=><th key={h} className="px-3 py-2 text-right font-medium whitespace-nowrap">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {events.map((r, i) => (
                    <tr key={r._k} className="border-t border-border hover:bg-muted/20">
                      <td className="px-3 py-2 tabular-nums">{i + 1}</td>
                      <td className="px-3 py-2">{r.title}</td>
                      <td className="px-3 py-2 font-mono text-xs text-primary">{r.code ?? "—"}</td>
                      <td className="px-3 py-2">{r.org ? <OrgChip id={r.org as OrgId} /> : "—"}</td>
                      <td className="px-3 py-2 text-xs tabular-nums">{r.target ?? "—"}</td>
                      <td className="px-3 py-2 text-xs tabular-nums">{r.achieved ?? "—"}</td>
                      <td className="px-3 py-2 min-w-[120px]">
                        {r.pct === null ? <span className="text-xs text-muted-foreground">—</span> : (
                          <div className="flex items-center gap-2"><Progress value={Math.min(100, Math.max(0, r.pct))} /><span className="text-xs tabular-nums">{Math.round(r.pct)}%</span></div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs tabular-nums">{r.participants ?? "—"}</td>
                      <td className="px-3 py-2 text-xs">{r.evaluation ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollableTable>
          </Card>
        )}
        </div>
        )
      )}

      {!isLoading && tab === "ch" && (
        challenges.length === 0 ? (
          <Card className="p-8"><EmptyData msg="لا توجد تحديات مستخرجة من التقارير المرفوعة" /></Card>
        ) : (
          <Card>
            <ScrollableTable>
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>{["م","التحدي/العائق","المؤسسة","الربع","الأسباب","الإجراءات المتخذة","الوضع الحالي","المساهمة المطلوبة"].map(h=><th key={h} className="px-3 py-2 text-right font-medium whitespace-nowrap">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {challenges.map((r, i) => (
                    <tr key={r._k} className="border-t border-border hover:bg-muted/20 align-top">
                      <td className="px-3 py-2 tabular-nums">{i + 1}</td>
                      <td className="px-3 py-2 min-w-[200px]">{r.title}</td>
                      <td className="px-3 py-2">{r.org ? <OrgChip id={r.org as OrgId} /> : "—"}</td>
                      <td className="px-3 py-2 text-xs whitespace-nowrap">{r.quarter ?? "—"}</td>
                      <td className="px-3 py-2 text-xs">{r.reasons ?? "—"}</td>
                      <td className="px-3 py-2 text-xs">{r.actions ?? "—"}</td>
                      <td className="px-3 py-2 text-xs">{r.status ?? "—"}</td>
                      <td className="px-3 py-2 text-xs">{r.requiredSupport ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollableTable>
          </Card>
        )
      )}

      {!isLoading && tab === "rec" && (
        recommendations.length === 0 ? (
          <Card className="p-8"><EmptyData msg="لا توجد توصيات مستخرجة من التقارير المرفوعة" /></Card>
        ) : (
          <Card className="p-4 space-y-3">
            {recommendations.map((r) => (
              <div key={r._k} className="flex gap-3 items-start border-b border-border last:border-0 pb-3 last:pb-0">
                <div className="mt-0.5">{r.org ? <OrgChip id={r.org as OrgId} /> : null}</div>
                <div className="text-sm leading-relaxed flex-1">{r.text}</div>
                <span className="text-[11px] text-muted-foreground whitespace-nowrap">{r.quarter ?? ""}</span>
              </div>
            ))}
          </Card>
        )
      )}
    </div>
  );
}
