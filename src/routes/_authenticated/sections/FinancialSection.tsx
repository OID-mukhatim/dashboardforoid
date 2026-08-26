import { useState } from "react";
import { Star } from "lucide-react";
import { ORGS, financialAssessment, PROGRAM_STATUS_META, financialProgram, financialTimeline } from "@/lib/oid-data";
import { OverdueBadge } from "@/components/oid/OverdueBadge";
import { detectDeadline } from "@/lib/oid-overdue";
import { Card, CardHeader, Progress, SectionTitle } from "./_shared";

/* ============================ FINANCIAL ============================ */
export function FinancialSection() {
  const [tab, setTab] = useState<"assess"|"program"|"timeline">("assess");
  return (
    <div className="space-y-6">
      <SectionTitle title="المستشار المالي" subtitle="تقييم ومتابعة برنامج الإدارة المالية" />

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
