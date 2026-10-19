import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ResponsiveContainer, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Tooltip, Legend } from "recharts";
import { ORGS, GAP_AXES, type OrgId } from "@/lib/oid-data";
import { ScrollableTable } from "@/components/oid/ScrollableTable";
import { loadGapScores, updateGapScore } from "@/lib/dashboard.functions";
import { useLang } from "@/lib/lang-context";
import { Card, CardHeader, useDashboardSnapshotQuery, getLiveGapValue, SectionTitle } from "./_shared";

const PERIOD = "Q2-2026";
const DOMAIN_NAMES = [
  "الاستراتيجية",
  "القيادة والكفاءات",
  "الأداء والنتائج",
  "العمليات والأنظمة",
  "الموارد المالية",
  "البنية التحتية",
  "الحوكمة والامتثال",
];

/* ============================ GAPS ============================ */
export function GapsSection() {
  const { lang, t } = useLang();
  const { data: snap } = useDashboardSnapshotQuery();
  const queryClient = useQueryClient();
  const loadGaps = useServerFn(loadGapScores);
  const saveGap = useServerFn(updateGapScore);

  const { data: dbGaps } = useQuery({
    queryKey: ["gap-scores"],
    queryFn: () => loadGaps(),
    staleTime: 60 * 1000,
  });

  // أحدث فترة لكل مؤسسة بحسب updated_at — لا فترة ثابتة
  const latestPeriodOf = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of (dbGaps ?? []) as any[]) {
      const cur = map.get(g.org_id);
      if (!cur || (g.updated_at ?? "") > (cur as any)) map.set(g.org_id, g.updated_at ?? "");
    }
    const period = new Map<string, string>();
    for (const g of (dbGaps ?? []) as any[]) {
      if ((g.updated_at ?? "") === map.get(g.org_id)) period.set(g.org_id, g.period);
    }
    return period;
  }, [dbGaps]);

  const liveGapScores = useMemo(() => {
    const result: Record<string, (number | null)[]> = {};
    for (const o of ORGS) {
      const period = latestPeriodOf.get(o.id);
      result[o.id] = Array.from({ length: 7 }, (_, i) => {
        const row = (dbGaps ?? []).find((g: any) => g.org_id === o.id && g.domain_index === i && g.period === period);
        if (row) return Number(row.score);
        const live = getLiveGapValue(snap, o.id as OrgId, GAP_AXES[i]);
        return typeof live === "number" ? live : null;
      });
    }
    return result;
  }, [dbGaps, snap, latestPeriodOf]);

  // الفجوات الحرجة: تُحسب حياً من أدنى المحاور متوسطاً عبر المؤسسات
  const liveCriticalGaps = useMemo(() => {
    const rows = GAP_AXES.map((axis, i) => {
      const vals = ORGS.map((o) => liveGapScores[o.id]?.[i]).filter((v): v is number => typeof v === "number");
      if (vals.length === 0) return null;
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      const affected = vals.filter((v) => v < 3).length;
      return { axisIndex: i, avg, affected, total: vals.length };
    }).filter((x): x is NonNullable<typeof x> => x !== null);
    return rows.sort((a, b) => a.avg - b.avg).slice(0, 6);
  }, [liveGapScores]);

  async function handleGapScoreChange(orgId: string, domainIndex: number, newScore: number) {
    queryClient.setQueryData(["gap-scores"], (old: any[] | undefined) => {
      const rows = old ? [...old] : [];
      const idx = rows.findIndex((g) => g.org_id === orgId && g.domain_index === domainIndex && g.period === PERIOD);
      if (idx >= 0) rows[idx] = { ...rows[idx], score: newScore };
      else rows.push({ org_id: orgId, domain_index: domainIndex, domain_name: DOMAIN_NAMES[domainIndex], score: newScore, period: PERIOD });
      return rows;
    });
    try {
      await saveGap({
        data: { orgId, domainIndex, domainName: DOMAIN_NAMES[domainIndex], score: newScore, period: PERIOD },
      });
      queryClient.invalidateQueries({ queryKey: ["dashboard-snapshot"] });
    } finally {
      queryClient.invalidateQueries({ queryKey: ["gap-scores"] });
    }
  }

  const heatColor = (v: number | null) => {
    if (v === null) return "bg-gray-100 text-gray-400";
    if (v < 2) return "bg-red-100 text-red-700";
    if (v < 3) return "bg-orange-100 text-orange-700";
    if (v < 3.5) return "bg-yellow-100 text-yellow-700";
    if (v < 4.5) return "bg-blue-100 text-blue-700";
    return "bg-green-100 text-green-700";
  };
  const radarData = GAP_AXES.map((axis, i) => {
    const row: any = { axis: t(`gaps.axes.${i}`) };
    ORGS.forEach((o) => {
      row[o.id] = liveGapScores[o.id]?.[i] ?? 0;
    });
    return row;
  });
  return (
    <div className="space-y-6">
      <SectionTitle title={t("gaps.title")} subtitle={t("gaps.subtitle")} />

      <Card>
        <CardHeader title={t("gaps.heatmapTitle")} subtitle={t("gaps.editHint")} />
        <div className="p-4"><ScrollableTable direction={lang === "ar" ? "rtl" : "ltr"}>
          <table className="oid-table">
            <thead><tr><th className="px-3 py-2 text-start text-xs text-muted-foreground">{t("gaps.institution")}</th>
              {GAP_AXES.map((a, i) => <th key={a} className="px-3 py-2 text-xs text-muted-foreground">{t(`gaps.axes.${i}`)}</th>)}
            </tr></thead>
            <tbody>
              {ORGS.map(o => (
                <tr key={o.id} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{lang === "ar" ? o.nameAr : o.nameEn}</td>
                  {GAP_AXES.map((axis, i) => {
                    const v = liveGapScores[o.id]?.[i] ?? null;
                    return (
                      <td key={axis} className="numeric">
                        <input
                          type="number"
                          min={0}
                          max={5}
                          step={0.1}
                          defaultValue={v ?? ""}
                          dir="ltr"
                          aria-label={`${lang === "ar" ? o.nameAr : o.nameEn} — ${t(`gaps.axes.${i}`)}`}
                          onBlur={(e) => {
                            const n = parseFloat(e.target.value);
                            if (!Number.isNaN(n) && n >= 0 && n <= 5 && n !== v) {
                              void handleGapScoreChange(o.id, i, Math.round(n * 100) / 100);
                            } else if (Number.isNaN(n)) {
                              e.target.value = v === null ? "" : String(v);
                            }
                          }}
                          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                          className={`w-16 py-1 rounded text-xs font-semibold tabular-nums text-center border border-border/60 ${heatColor(v)}`}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollableTable></div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader title={t("gaps.radarTitle")} />
          <div className="p-4 h-[380px]">
            <ResponsiveContainer>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#e0e8f0" />
                <PolarAngleAxis dataKey="axis" tick={{ fontSize: 11 }} />
                <PolarRadiusAxis domain={[0, 5]} tick={{ fontSize: 10 }} />
                {ORGS.map(o => (
                  <Radar key={o.id} name={lang === "ar" ? o.nameAr : o.nameEn} dataKey={o.id} stroke={o.color} fill={o.color} fillOpacity={0.07}
                    strokeDasharray={o.id==="HAMDI" ? "4 4" : undefined} />
                ))}
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title={t("gaps.criticalTitle")} />
          <div className="p-5 space-y-2">
            {liveCriticalGaps.length === 0 ? (
              <EmptyData msg={t("gaps.noData")} />
            ) : liveCriticalGaps.map((g, i) => {
              const priorityKey = g.avg < 2 ? "veryCritical" : g.avg < 3 ? "critical" : "high";
              const tone = priorityKey === "veryCritical" ? "bg-red-100 text-red-700" : priorityKey === "critical" ? "bg-orange-100 text-orange-700" : "bg-yellow-100 text-yellow-700";
              return (
                <div key={g.axisIndex} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/20">
                  <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">{i + 1}</div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{t(`gaps.axes.${g.axisIndex}`)}</div>
                    <div className="text-xs text-muted-foreground">{t("gaps.affectedLabel")} {g.affected}/{g.total} • {t("gaps.averageLabel")} {g.avg.toFixed(2)}</div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${tone}`}>{t(`gaps.priorities.${priorityKey}`)}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
