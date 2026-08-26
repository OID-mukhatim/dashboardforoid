import { ResponsiveContainer, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Tooltip, Legend } from "recharts";
import { ORGS, GAP_AXES, gapScores, criticalGaps } from "@/lib/oid-data";
import { ScrollableTable } from "@/components/oid/ScrollableTable";
import { Card, CardHeader, useDashboardSnapshotQuery, getLiveGapValue, SectionTitle } from "./_shared";

/* ============================ GAPS ============================ */
export function GapsSection() {
  const { data: snap } = useDashboardSnapshotQuery();
  const heatColor = (v: number | null) => {
    if (v === null) return "bg-gray-100 text-gray-400";
    if (v < 2) return "bg-red-100 text-red-700";
    if (v < 3) return "bg-orange-100 text-orange-700";
    if (v < 3.5) return "bg-yellow-100 text-yellow-700";
    if (v < 4.5) return "bg-blue-100 text-blue-700";
    return "bg-green-100 text-green-700";
  };
  const radarData = GAP_AXES.map((axis, i) => {
    const row: any = { axis };
    ORGS.forEach((o) => {
      const liveGap = getLiveGapValue(snap, o.id, axis);
      row[o.id] = typeof liveGap === "number" ? liveGap : (gapScores[o.id][i] ?? 0);
    });
    return row;
  });
  return (
    <div className="space-y-6">
      <SectionTitle title="تحليل الفجوات المؤسسية" subtitle="تشخيص مستوى النضج عبر 7 محاور" />

      <Card>
        <CardHeader title="خريطة الحرارة (Heatmap)" subtitle="6 مؤسسات × 7 محاور" />
        <div className="p-4"><ScrollableTable>
          <table className="w-full text-sm">
            <thead><tr><th className="px-3 py-2 text-right text-xs text-muted-foreground">المؤسسة</th>
              {GAP_AXES.map(a => <th key={a} className="px-3 py-2 text-xs text-muted-foreground">{a}</th>)}
            </tr></thead>
            <tbody>
              {ORGS.map(o => (
                <tr key={o.id} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{o.nameAr}</td>
                  {GAP_AXES.map((axis, i) => {
                    const liveGap = getLiveGapValue(snap, o.id, axis);
                    const v = typeof liveGap === "number" ? liveGap : (gapScores[o.id][i] ?? null);
                    return (
                      <td key={axis} className="px-2 py-2 text-center">
                        <span className={`inline-block w-14 py-1 rounded text-xs font-semibold tabular-nums ${heatColor(v)}`}>{v !== null ? v.toFixed(2) : "—"}</span>
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
          <CardHeader title="Radar — 7 محاور" />
          <div className="p-4 h-[380px]">
            <ResponsiveContainer>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#e0e8f0" />
                <PolarAngleAxis dataKey="axis" tick={{ fontSize: 11 }} />
                <PolarRadiusAxis domain={[0, 5]} tick={{ fontSize: 10 }} />
                {ORGS.map(o => (
                  <Radar key={o.id} name={o.nameAr} dataKey={o.id} stroke={o.color} fill={o.color} fillOpacity={0.07}
                    strokeDasharray={o.id==="HAMDI" ? "4 4" : undefined} />
                ))}
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="الفجوات الحرجة (مرتبة بالأولوية)" />
          <div className="p-5 space-y-2">
            {criticalGaps.map(g => (
              <div key={g.rank} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/20">
                <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">{g.rank}</div>
                <div className="flex-1">
                  <div className="text-sm font-medium">{g.name}</div>
                  <div className="text-xs text-muted-foreground">المتأثر: {g.affected} • المتوسط: {g.avg.toFixed(2)}</div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${g.priority.includes("جداً") ? "bg-red-100 text-red-700" : g.priority==="حرج" ? "bg-orange-100 text-orange-700" : "bg-yellow-100 text-yellow-700"}`}>{g.priority}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
