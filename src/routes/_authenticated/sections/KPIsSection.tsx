import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search } from "lucide-react";
import { ORGS } from "@/lib/oid-data";
import { ScrollableTable } from "@/components/oid/ScrollableTable";
import { BSC_PERSPECTIVES, BSC_LABELS, perspectiveLabelOf } from "@/lib/oid-bsc";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, Progress, fmtNum, SectionTitle, Select, CircularProgress } from "./_shared";

export function KPIsSection() {
  const [orgF, setOrgF] = useState<string>("الكل");
  const [persF, setPersF] = useState<string>("الكل");
  const [q, setQ] = useState("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["kpis"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kpis")
        .select("*")
        .order("entity_code", { ascending: true })
        .order("kpi_code", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 5000,
  });

  const normSector = (s: string | null | undefined) =>
    (s ?? "").replace(/\s+/g, " ").trim();

  // قيود مهمّة: لا تُعرض إلا المؤسسات الستّ المعتمدة.
  // أي entity_code آخر (الربعي/data/البيانات/التحليل/الجامعة/النتائج المباشرة/نتائج تقييم السياسات…)
  // ناتج عن قراءة خاطئة من ملفات Excel ويجب تجاهله في العرض حتى يتم تنظيف المصدر.
  const VALID_ORG_IDS = new Set(ORGS.map(o => o.id) as string[]);
  const cleanRows = rows.filter(r => r.entity_code && VALID_ORG_IDS.has(r.entity_code));

  // مناظير BSC الأربعة المعيارية فقط: نُسقط نص "sector" الخام إلى أحد المناظير،
  // وأي نص لا يطابق (مثل: "توسيع قاعدة المانحين"، "الهدف"، "تعزيز الشفافية")
  // يُصنّف "غير مصنّف" ولا يُعرض كمنظور مستقل.
  const UNCLASSIFIED = "غير مصنّف";
  const normalized = cleanRows.map(r => {
    const raw = normSector(r.sector) || null;
    const mapped = perspectiveLabelOf(raw);
    return { ...r, sector: raw, perspective: mapped ?? UNCLASSIFIED };
  });

  const entities = ORGS.map(o => o.id) as string[];
  const orgScoped = orgF === "الكل" ? normalized : normalized.filter(r => r.entity_code === orgF);
  // خيارات الفلتر = المناظير الأربعة + "غير مصنّف" إن وُجد
  const hasUnclassified = orgScoped.some(r => r.perspective === UNCLASSIFIED);
  const perspectiveOptions = [...BSC_LABELS, ...(hasUnclassified ? [UNCLASSIFIED] : [])];

  const filtered = normalized.filter(k =>
    (orgF === "الكل" || k.entity_code === orgF) &&
    (persF === "الكل" || k.perspective === persF) &&
    (!q || (k.kpi_name ?? "").includes(q) || (k.kpi_code ?? "").includes(q))
  );

  // إحصاءات لكل منظور من المناظير الأربعة فقط
  const sectorStats = BSC_PERSPECTIVES.map(p => {
    const items = orgScoped.filter(r => r.perspective === p.label);
    const vals = items.map(r => {
      const n = Number(r.achievement_pct ?? 0);
      return Number.isFinite(n) ? (n <= 1 ? n * 100 : n) : 0;
    });
    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    return { name: p.label, color: p.color, count: items.length, avg: Math.round(avg) };
  });



  const num = (v: unknown): number | null => {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  /** جمع الأرباع: يعيد null فقط إذا كانت كل القيم فارغة. */
  const sumQ = (...vals: (number | null)[]) => {
    const present = vals.filter((v): v is number => v !== null);
    return present.length ? present.reduce((a, b) => a + b, 0) : null;
  };
  /** المعادلات كما في نموذج الأكسل، مع تفضيل القيمة المخزّنة إن وُجدت. */
  const derive = (k: any) => {
    const baseline = num(k.baseline);
    const target = num(k.annual_target);
    const weight = num(k.weight);
    const qp = [num(k.q1_planned), num(k.q2_planned), num(k.q3_planned), num(k.q4_planned)];
    const qa = [num(k.q1_actual), num(k.q2_actual), num(k.q3_actual), num(k.q4_actual)];
    const totalPlanned = num(k.total_planned) ?? sumQ(...qp);
    const totalActual = num(k.total_actual) ?? sumQ(...qa);
    // الإجمالي التراكمي = خط الأساس + المنجز
    const cumulative = baseline !== null || totalActual !== null ? (baseline ?? 0) + (totalActual ?? 0) : null;
    // نسبة الإنجاز = المنجز ÷ المستهدف السنوي
    const achievement =
      num(k.achievement_pct) ?? (target && target !== 0 && totalActual !== null ? totalActual / target : null);
    // النسبة العامة = نسبة الإنجاز × الوزن النسبي
    const overall = num(k.overall_pct) ?? (achievement !== null && weight !== null ? achievement * weight : null);
    return { baseline, target, weight, qp, qa, totalPlanned, totalActual, cumulative, achievement, overall };
  };

  const fmtPct = (v: number | null | undefined, decimals = 0) => {
    if (v === null || v === undefined) return "—";
    const n = Number(v);
    if (!Number.isFinite(n)) return "—";
    const pct = n <= 1 && n >= -1 ? n * 100 : n;
    return `${pct.toFixed(decimals)}%`;
  };
  const fmtNum = (v: number | null | undefined) =>
    v === null || v === undefined ? "—" : String(Math.round(Number(v) * 100) / 100);


  return (
    <div className="space-y-6">
      <SectionTitle title="مؤشرات الأداء (KPIs)" subtitle={`بيانات حية من قاعدة البيانات — تتحدّث تلقائيًا عند إعادة الرفع (${cleanRows.length} مؤشر${rows.length !== cleanRows.length ? ` · تم تجاهل ${rows.length - cleanRows.length} صف بكود مؤسسة غير معروف` : ""})`} />
      <Card className="p-4 flex flex-wrap items-center gap-3">
        <Select value={orgF} onChange={setOrgF} options={["الكل", ...entities]} label="المؤسسة" />
        <Select value={persF} onChange={setPersF} options={["الكل", ...perspectiveOptions]} label="المنظور" />
        <div className="relative ml-auto">
          <Search size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="بحث (اسم/كود)" className="pr-8 pl-3 py-1.5 text-sm bg-muted rounded-md border border-border focus:outline-none focus:ring-2 focus:ring-primary/30 w-56" />
        </div>
      </Card>

      {sectorStats.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {sectorStats.map((p) => (
            <Card key={p.name} className="p-5 flex items-center gap-4">
              <CircularProgress value={p.avg} color={p.color} />
              <div>
                <div className="text-sm font-medium">{p.name}</div>
                <div className="text-xs text-muted-foreground">{p.count} مؤشر</div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader title={`جدول المؤشرات (${filtered.length})`} />
        <ScrollableTable>
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th colSpan={9} className="px-3 py-1.5 text-right font-medium border-b border-border">العوامل الأساسية</th>
                <th colSpan={5} className="px-3 py-1.5 text-center font-medium border-b border-r border-border bg-sky-500/5">المخطط Planned</th>
                <th colSpan={5} className="px-3 py-1.5 text-center font-medium border-b border-r border-border bg-emerald-500/5">المنجز Achieved</th>
                <th colSpan={4} className="px-3 py-1.5 text-center font-medium border-b border-r border-border">النتائج</th>
              </tr>
              <tr>
                {["الكود","المؤسسة","المنظور","الهدف","المؤشر","النوع","الوزن","خط الأساس","المستهدف السنوي",
                  "Q1 مخطط","Q2 مخطط","Q3 مخطط","Q4 مخطط","إجمالي المخطط",
                  "Q1 منجز","Q2 منجز","Q3 منجز","Q4 منجز","مجموع المنجز",
                  "الإجمالي التراكمي","% الإنجاز","النسبة العامة","المخرجات"].map(h => (
                  <th key={h} className="px-3 py-2 text-right font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={23} className="px-3 py-6 text-center text-muted-foreground">جاري التحميل…</td></tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={23} className="px-3 py-6 text-center text-muted-foreground">لا توجد بيانات — ارفع ملف Excel من قسم "رفع البيانات".</td></tr>
              )}
              {filtered.map(k => {
                const d = derive(k);
                return (
                <tr key={k.id} className="border-t border-border hover:bg-muted/20">
                  <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{k.kpi_code}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{k.entity_code}</td>
                  <td className="px-3 py-2 whitespace-nowrap" title={k.sector ?? ""}>{k.perspective}</td>
                  <td className="px-3 py-2 max-w-[220px]">{k.objective ?? "—"}</td>
                  <td className="px-3 py-2 max-w-[280px]">{k.kpi_name}</td>
                  <td className="px-3 py-2 text-xs whitespace-nowrap">{k.kpi_type ?? "—"}</td>
                  <td className="px-3 py-2 tabular-nums text-xs">{fmtPct(d.weight, 2)}</td>
                  <td className="px-3 py-2 tabular-nums text-xs">{fmtNum(d.baseline)}</td>
                  <td className="px-3 py-2 tabular-nums text-xs font-medium">{fmtNum(d.target)}</td>
                  {d.qp.map((v, i) => (
                    <td key={`p${i}`} className="px-3 py-2 tabular-nums text-xs bg-sky-500/5">{fmtNum(v)}</td>
                  ))}
                  <td className="px-3 py-2 tabular-nums text-xs font-medium bg-sky-500/5">{fmtNum(d.totalPlanned)}</td>
                  {d.qa.map((v, i) => (
                    <td key={`a${i}`} className="px-3 py-2 tabular-nums text-xs bg-emerald-500/5">{fmtNum(v)}</td>
                  ))}
                  <td className="px-3 py-2 tabular-nums text-xs font-medium bg-emerald-500/5">{fmtNum(d.totalActual)}</td>
                  <td className="px-3 py-2 tabular-nums text-xs">{fmtNum(d.cumulative)}</td>
                  <td className="px-3 py-2 min-w-[120px]">
                    <div className="flex items-center gap-2">
                      <Progress value={Math.max(0, Math.min(100, Number(fmtPct(d.achievement, 2).replace("%","")) || 0))} />
                      <span className="text-xs tabular-nums w-12">{fmtPct(d.achievement)}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 tabular-nums text-xs">{fmtPct(d.overall, 2)}</td>
                  <td className="px-3 py-2 text-xs max-w-[240px]">{k.final_output ?? "—"}</td>
                </tr>
                );
              })}
            </tbody>
          </table>

        </ScrollableTable>
      </Card>
    </div>
  );
}
