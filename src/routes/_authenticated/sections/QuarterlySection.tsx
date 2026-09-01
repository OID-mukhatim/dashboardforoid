import { useMemo, useState } from "react";
import { ORGS, q1Data, type OrgId } from "@/lib/oid-data";
import { ScrollableTable } from "@/components/oid/ScrollableTable";
import { loadQuarterlyActivities } from "@/lib/dashboard.functions";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Card, EmptyData, Progress, SectionTitle, OrgChip, FilterSelect } from "./_shared";

/* ============================ QUARTERLY ============================ */
type QAch = { n: number|null; title: string; code: string|null; target: number|null; achieved: number|null; pct: number|null; beneficiaries: number|null; location: string|null; budget: number|null; cost: number|null; variance: number|null; outcomes: string|null };
type QEv = { n: number|null; title: string; code: string|null; target: number|null; achieved: number|null; pct: number|null; participants: number|null; location: string|null; evaluation: string|null };
type QCh = { n: number|null; title: string; impact: string|null; reasons: string|null; actions: string|null; status: string|null; requiredSupport: string|null };

type FilterType = "all" | "ach" | "ev" | "ch" | "rec";

/** نسبة الإنجاز المعتمدة: تُحتسب من (المنفذ ÷ المستهدف) لأن بعض الملفات تخزّن نسبة الانحراف بدل نسبة الإنجاز */
function effPct(a: { target: number|null; achieved: number|null; pct: number|null }): number | null {
  const t = a.target, ac = a.achieved;
  if (typeof t === "number" && t !== 0 && typeof ac === "number") {
    return Math.round((ac / t) * 1000) / 10;
  }
  return a.pct;
}

export function QuarterlySection() {
  const [filters, setFilters] = useState({ org: "all", quarter: "all", year: "2026", type: "all" as FilterType });
  const update = (k: keyof typeof filters, v: string) => setFilters((p) => ({ ...p, [k]: v }));
  const reset = () => setFilters({ org: "all", quarter: "all", year: "2026", type: "all" });

  const activitiesFn = useServerFn(loadQuarterlyActivities);
  const { data: result, isLoading } = useQuery({
    queryKey: ["quarterly-activities"],
    queryFn: () => activitiesFn(),
    refetchInterval: 15000,
    staleTime: 2 * 60 * 1000,
  });

  const rows = useMemo(() => result?.rows ?? [], [result]);
  // عرض البيانات الثابتة التجريبية فقط عند فراغ قاعدة البيانات والاستخراجات
  const showStaticFallback = !isLoading && rows.length === 0;

  const live = useMemo(() => rows.filter((r) => {
    const okOrg = filters.org === "all" || r.orgCode === filters.org;
    const okQ = filters.quarter === "all" || (r.quarter ?? "") === filters.quarter;
    const okY = filters.year === "all" || String(r.year ?? "") === filters.year;
    return okOrg && okQ && okY;
  }), [rows, filters.org, filters.quarter, filters.year]);

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

  const totals = useMemo(() => rows.reduce((acc, r) => {
    acc.ach += (((r.payload as any)?.achievements ?? []) as unknown[]).length;
    acc.ev += (((r.payload as any)?.events ?? []) as unknown[]).length;
    acc.ch += (((r.payload as any)?.challenges ?? []) as unknown[]).length;
    acc.rec += (((r.payload as any)?.recommendations ?? []) as unknown[]).length;
    return acc;
  }, { ach: 0, ev: 0, ch: 0, rec: 0 }), [rows]);
  const hasActive = filters.org !== "all" || filters.quarter !== "all" || filters.year !== "2026" || filters.type !== "all";

  const orgOpts = [{ value: "all", label: "جميع المؤسسات" }, ...ORGS.map((o) => ({ value: o.id, label: o.nameAr }))];
  const qOpts = [
    { value: "all", label: "جميع الأرباع" },
    { value: "Q1", label: "الربع الأول" }, { value: "Q2", label: "الربع الثاني" },
    { value: "Q3", label: "الربع الثالث" }, { value: "Q4", label: "الربع الرابع" },
  ];
  const years = Array.from(new Set(rows.map((r) => r.year).filter(Boolean) as number[])).sort();
  const yOpts = [{ value: "all", label: "جميع السنوات" }, ...years.map((y) => ({ value: String(y), label: String(y) }))];
  const typeOpts: { value: FilterType; label: string }[] = [
    { value: "all", label: "جميع أنواع النشاط" },
    { value: "ach", label: "الإنجازات والمشاريع" },
    { value: "ev", label: "الفعاليات والبرامج التدريبية" },
    { value: "ch", label: "التحديات والعوائق" },
    { value: "rec", label: "التوصيات" },
  ];

  // عدّ النتائج حسب النوع المختار
  const currentCount = filters.type === "all" ? achievements.length + events.length + challenges.length + recommendations.length
    : filters.type === "ach" ? achievements.length
    : filters.type === "ev" ? events.length
    : filters.type === "ch" ? challenges.length
    : recommendations.length;
  const totalCount = filters.type === "all" ? totals.ach + totals.ev + totals.ch + totals.rec
    : totals[filters.type];

  const subtitle = rows.length
    ? `${rows.length} تقرير مرفوع — ${Array.from(new Set(rows.map((r) => `${r.quarter ?? "?"} ${r.year ?? ""}`.trim()))).join("، ")}`
    : "لا توجد تقارير مرفوعة بعد";

  return (
    <div className="space-y-6">
      <SectionTitle title="التقارير الربعية" subtitle={subtitle} />

      {/* ===== شريط الفلاتر ===== */}
      <Card className="p-3 flex flex-wrap items-center gap-3">
        <FilterSelect label="المؤسسة" value={filters.org} onChange={(v) => update("org", v)} options={orgOpts} />
        <FilterSelect label="الربع" value={filters.quarter} onChange={(v) => update("quarter", v)} options={qOpts} />
        <FilterSelect label="السنة" value={filters.year} onChange={(v) => update("year", v)} options={yOpts} />
        <FilterSelect label="نوع النشاط" value={filters.type} onChange={(v) => update("type", v)} options={typeOpts} />
        {hasActive && (
          <button onClick={reset} className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted">↺ إعادة ضبط</button>
        )}
      </Card>

      {/* ===== مؤشر النتائج ===== */}
      <div className="text-xs text-muted-foreground">
        عرض <span className="font-bold tabular-nums" dir="ltr">{currentCount}</span> من <span className="tabular-nums" dir="ltr">{totalCount}</span> سجل
      </div>

      {isLoading && <Card className="p-8 text-center text-sm text-muted-foreground">جارٍ تحميل التقارير…</Card>}

      {/* ===== بيانات تجريبية ثابتة عند فراغ قاعدة البيانات ===== */}
      {showStaticFallback && (
        <Card>
          <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2 flex-wrap">
            <div className="text-sm font-medium">أنشطة الربع الأول (نموذج)</div>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">بيانات تجريبية — تُستبدل فور رفع التقارير</span>
          </div>
          <ScrollableTable>
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>{["م","النشاط","كود المؤشر","المؤسسة","المستهدف","المنفذ","% الإنجاز","المستفيدون","الموازنة","التكلفة","الانحراف"].map(h=><th key={h} className="px-3 py-2 text-right font-medium whitespace-nowrap">{h}</th>)}</tr>
              </thead>
              <tbody>
                {q1Data.map((r, i) => (
                  <tr key={r.id} className="border-t border-border hover:bg-muted/20 align-top">
                    <td className="px-3 py-2 tabular-nums">{i + 1}</td>
                    <td className="px-3 py-2 min-w-[240px]">{r.title}</td>
                    <td className="px-3 py-2 font-mono text-xs text-primary">{r.kpiCode}</td>
                    <td className="px-3 py-2"><OrgChip id={r.org as OrgId} /></td>
                    <td className="px-3 py-2 text-xs tabular-nums">{r.target}</td>
                    <td className="px-3 py-2 text-xs tabular-nums">{r.done}</td>
                    <td className="px-3 py-2 min-w-[120px]">
                      <div className="flex items-center gap-2"><Progress value={Math.min(100, Math.max(0, r.pct))} /><span className="text-xs tabular-nums">{r.pct}%</span></div>
                    </td>
                    <td className="px-3 py-2 text-xs tabular-nums">{r.beneficiaries}</td>
                    <td className="px-3 py-2 tabular-nums text-xs">{r.budget ? `$${r.budget}` : "—"}</td>
                    <td className="px-3 py-2 tabular-nums text-xs">{r.cost ? `$${r.cost}` : "—"}</td>
                    <td className="px-3 py-2">
                      {!r.deviation ? <span className="text-xs text-gray-500">—</span>
                        : <span className={`text-xs px-2 py-0.5 rounded-full ${r.deviation > 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{r.deviation > 0 ? `+$${r.deviation}` : `-$${Math.abs(r.deviation)}`}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollableTable>
        </Card>
      )}

      {/* ===== الإنجازات والمشاريع ===== */}
      {!isLoading && (filters.type === "all" || filters.type === "ach") && (
        achievements.length === 0 ? (
          <Card className="p-8 text-center space-y-3">
            <EmptyData msg="لا توجد إنجازات مطابقة — ارفع تقرير الأداء الربعي أو عدّل الفلاتر" />
            {hasActive && <button onClick={reset} className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted">↺ إعادة ضبط الفلاتر</button>}
          </Card>
        ) : (
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
        )
      )}

      {/* ===== الفعاليات والبرامج التدريبية ===== */}
      {!isLoading && (filters.type === "all" || filters.type === "ev") && (
        events.length === 0 ? (
          <Card className="p-8 text-center space-y-3">
            <EmptyData msg="لا توجد فعاليات مطابقة — عدّل الفلاتر أو ارفع تقريراً يحتوي على قسم المشاركات" />
            {hasActive && <button onClick={reset} className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted">↺ إعادة ضبط الفلاتر</button>}
          </Card>
        ) : (
          <Card>
            <div className="px-4 py-3 text-sm font-medium border-b border-border">المشاركات والفعاليات والبرامج التدريبية</div>
            <ScrollableTable>
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>{["م","الفعالية","الكود","المؤسسة","الربع","المستهدف","المنفذ","% الإنجاز","المشاركون","الموقع","التقييم"].map(h=><th key={h} className="px-3 py-2 text-right font-medium whitespace-nowrap">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {events.map((r, i) => (
                    <tr key={r._k} className="border-t border-border hover:bg-muted/20 align-top">
                      <td className="px-3 py-2 tabular-nums">{i + 1}</td>
                      <td className="px-3 py-2 min-w-[200px]">{r.title}</td>
                      <td className="px-3 py-2 font-mono text-xs text-primary">{r.code ?? "—"}</td>
                      <td className="px-3 py-2">{r.org ? <OrgChip id={r.org as OrgId} /> : "—"}</td>
                      <td className="px-3 py-2 text-xs whitespace-nowrap">{r.quarter ?? "—"}</td>
                      <td className="px-3 py-2 text-xs tabular-nums">{r.target ?? "—"}</td>
                      <td className="px-3 py-2 text-xs tabular-nums">{r.achieved ?? "—"}</td>
                      <td className="px-3 py-2 min-w-[120px]">
                        {r.pct === null ? <span className="text-xs text-muted-foreground">—</span> : (
                          <div className="flex items-center gap-2"><Progress value={Math.min(100, Math.max(0, r.pct))} /><span className="text-xs tabular-nums">{Math.round(r.pct)}%</span></div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs tabular-nums">{r.participants ?? "—"}</td>
                      <td className="px-3 py-2 text-xs">{r.location ?? "—"}</td>
                      <td className="px-3 py-2 text-xs">{r.evaluation ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollableTable>
          </Card>
        )
      )}

      {/* ===== التحديات والعوائق ===== */}
      {!isLoading && (filters.type === "all" || filters.type === "ch") && (
        challenges.length === 0 ? (
          <Card className="p-8 text-center space-y-3">
            <EmptyData msg="لا توجد تحديات مستخرجة من التقارير المرفوعة" />
            {hasActive && <button onClick={reset} className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted">↺ إعادة ضبط الفلاتر</button>}
          </Card>
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

      {/* ===== التوصيات ===== */}
      {!isLoading && (filters.type === "all" || filters.type === "rec") && (
        recommendations.length === 0 ? (
          <Card className="p-8 text-center space-y-3">
            <EmptyData msg="لا توجد توصيات مستخرجة من التقارير المرفوعة" />
            {hasActive && <button onClick={reset} className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted">↺ إعادة ضبط الفلاتر</button>}
          </Card>
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
