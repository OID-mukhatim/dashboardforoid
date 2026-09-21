import { useMemo, useState } from "react";
import { Search, AlertTriangle, CheckCircle2, X } from "lucide-react";
import {
  ORGS,
  ORG_FISCAL_YEAR,
  FISCAL_QUARTERS,
  formatKPIValue,
  validateKPIValue,
  type OrgId,
} from "@/lib/oid-data";
import {
  computeKPIAchievement,
  computeRowAchievement,
  natureOf,
  polarityOf,
  type MeasurementNature,
} from "@/lib/oid-kpi-engine";
import { ScrollableTable } from "@/components/oid/ScrollableTable";
import { YearSelector } from "@/components/oid/YearSelector";
import { BSC_PERSPECTIVES, BSC_LABELS, perspectiveLabelOf } from "@/lib/oid-bsc";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { loadActiveYears, loadActiveKPIs, loadAvailableYears, setActiveYear } from "@/lib/dashboard.functions";
import { loadIncompleteCards, updateKPICard, saveQuarterAchievements } from "@/lib/kpis.functions";
import { Card, CardHeader, Progress, SectionTitle, Select, CircularProgress, QuarterBadge } from "./_shared";

const UNCLASSIFIED = "غير مصنّف";
type Quarter = "q1" | "q2" | "q3" | "q4";

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const sumQ = (...vals: (number | null)[]) => {
  const present = vals.filter((v): v is number => v !== null);
  return present.length ? present.reduce((a, b) => a + b, 0) : null;
};
const derive = (k: any) => {
  const baseline = num(k.baseline);
  const target = num(k.annual_target);
  const weight = num(k.weight);
  const qp = [num(k.q1_planned), num(k.q2_planned), num(k.q3_planned), num(k.q4_planned)];
  const qa = [num(k.q1_actual), num(k.q2_actual), num(k.q3_actual), num(k.q4_actual)];
  const totalPlanned = num(k.total_planned) ?? sumQ(...qp);
  const totalActual = num(k.total_actual) ?? sumQ(...qa);
  const cumulative = baseline !== null || totalActual !== null ? (baseline ?? 0) + (totalActual ?? 0) : null;
  const achievement =
    num(k.achievement_pct) ?? (target && target !== 0 && totalActual !== null ? totalActual / target : null);
  const overall = num(k.overall_pct) ?? (achievement !== null && weight !== null ? achievement * weight : null);
  return { baseline, target, weight, qp, qa, totalPlanned, totalActual, cumulative, achievement, overall };
};
const fmtPct = (v: number | null | undefined, decimals = 0) => {
  if (v === null || v === undefined) return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  const pct = n <= 1 && n >= -1 ? n * 100 : n;
  return `${Number(pct.toFixed(decimals))}%`;
};
const fmtNum = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : String(Math.round(Number(v) * 100) / 100);

export function KPIsSection() {
  const [view, setView] = useState<"matrix" | "card" | "update">("matrix");
  const [orgF, setOrgF] = useState<string>("الكل");
  const [persF, setPersF] = useState<string>("الكل");
  const [cardF, setCardF] = useState<string>("الكل");
  const [q, setQ] = useState("");
  const qc = useQueryClient();

  const activeYearsFn = useServerFn(loadActiveYears);
  const activeKpisFn = useServerFn(loadActiveKPIs);
  const availableYearsFn = useServerFn(loadAvailableYears);
  const setActiveYearFn = useServerFn(setActiveYear);
  const incompleteFn = useServerFn(loadIncompleteCards);

  const { data: activeYears = {} } = useQuery({
    queryKey: ["active-years"],
    queryFn: () => activeYearsFn(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["kpis-active"],
    queryFn: () => activeKpisFn(),
    refetchInterval: 15000,
  });

  const { data: availableYears = [] } = useQuery({
    queryKey: ["available-years", orgF],
    queryFn: () => availableYearsFn({ data: { orgId: orgF } }),
    enabled: orgF !== "الكل",
  });

  const { data: incomplete = [] } = useQuery({
    queryKey: ["incomplete-cards", orgF],
    queryFn: () => incompleteFn({ data: { orgId: orgF } }),
  });

  const VALID_ORG_IDS = new Set(ORGS.map((o) => o.id) as string[]);
  const cleanRows = rows.filter((r: any) => r.entity_code && VALID_ORG_IDS.has(r.entity_code));

  const normalized = cleanRows.map((r: any) => {
    const raw = (r.sector ?? "").replace(/\s+/g, " ").trim() || null;
    return { ...r, sector: raw, perspective: perspectiveLabelOf(raw) ?? UNCLASSIFIED };
  });

  const entities = ORGS.map((o) => o.id) as string[];
  const orgScoped = orgF === "الكل" ? normalized : normalized.filter((r: any) => r.entity_code === orgF);
  const hasUnclassified = orgScoped.some((r: any) => r.perspective === UNCLASSIFIED);
  const perspectiveOptions = [...BSC_LABELS, ...(hasUnclassified ? [UNCLASSIFIED] : [])];

  const filtered = normalized.filter(
    (k: any) =>
      (orgF === "الكل" || k.entity_code === orgF) &&
      (persF === "الكل" || k.perspective === persF) &&
      (cardF === "الكل" ||
        (cardF === "مكتملة" && k.card_completed) ||
        (cardF === "غير مكتملة" && !k.card_completed)) &&
      (!q || (k.kpi_name ?? "").includes(q) || (k.kpi_code ?? "").includes(q)),
  );

  const sectorStats = BSC_PERSPECTIVES.map((p) => {
    const items = orgScoped.filter((r: any) => r.perspective === p.label);
    const vals = items.map((r: any) => {
      const n = Number(r.achievement_pct ?? 0);
      return Number.isFinite(n) ? (n <= 1 ? n * 100 : n) : 0;
    });
    const avg = vals.length ? vals.reduce((a: number, b: number) => a + b, 0) / vals.length : 0;
    return { name: p.label, color: p.color, count: items.length, avg: Math.round(avg) };
  });

  const filterBar = (
    <Card className="p-4 flex flex-wrap items-center gap-3">
      <Select value={orgF} onChange={setOrgF} options={["الكل", ...entities]} label="المؤسسة" />
      <Select value={persF} onChange={setPersF} options={["الكل", ...perspectiveOptions]} label="المنظور" />
      <Select value={cardF} onChange={setCardF} options={["الكل", "مكتملة", "غير مكتملة"]} label="البطاقة" />
      {orgF !== "الكل" && availableYears.length > 0 && (
        <YearSelector
          orgId={orgF}
          activeYear={activeYears[orgF]}
          availableYears={availableYears}
          onYearChange={async (year) => {
            await setActiveYearFn({ data: { orgId: orgF, year } });
            qc.invalidateQueries({ queryKey: ["active-years"] });
            qc.invalidateQueries({ queryKey: ["kpis-active"] });
            qc.invalidateQueries({ queryKey: ["dashboard-snapshot"] });
          }}
        />
      )}
      <div className="relative ml-auto">
        <Search size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="بحث (اسم/كود)"
          className="pr-8 pl-3 py-1.5 text-sm bg-muted rounded-md border border-border focus:outline-none focus:ring-2 focus:ring-primary/30 w-56"
        />
      </div>
    </Card>
  );

  return (
    <div className="space-y-6">
      <SectionTitle
        title="مؤشرات الأداء (KPIs)"
        subtitle={`مصفوفة المؤشرات وبطاقاتها ومتابعة المنجز الربعي — ${cleanRows.length} مؤشر`}
      />

      {incomplete.length > 0 && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center justify-between">
          <span className="text-sm text-amber-700 flex items-center gap-2">
            <AlertTriangle size={15} /> {incomplete.length} مؤشر يحتاج استكمال البطاقة
          </span>
          <button onClick={() => setView("card")} className="text-xs text-amber-700 underline font-medium">
            استكمال الآن ←
          </button>
        </div>
      )}

      <div className="flex gap-2">
        {[
          { id: "matrix", label: "مصفوفة المؤشرات" },
          { id: "card", label: "بطاقات المؤشرات" },
          { id: "update", label: "تحديث المنجز" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setView(t.id as typeof view)}
            className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
              view === t.id
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {filterBar}

      {view === "matrix" && (
        <MatrixView
          rows={filtered}
          isLoading={isLoading}
          orgF={orgF}
          sectorStats={sectorStats}
        />
      )}
      {view === "card" && <CardsView rows={filtered} />}
      {view === "update" && <UpdateView rows={filtered} orgF={orgF} />}
    </div>
  );
}

/* ════════════ تبويب 1: مصفوفة المؤشرات ════════════ */
function MatrixView({
  rows,
  isLoading,
  orgF,
  sectorStats,
}: {
  rows: any[];
  isLoading: boolean;
  orgF: string;
  sectorStats: { name: string; color: string; count: number; avg: number }[];
}) {
  // وزن الهدف يأتي من تعريف الهدف نفسه (kpi_goals) — لا يُشتق من مجموع أوزان المؤشرات.
  // المؤشرات القديمة غير المرتبطة بهدف معرّف تبقى بدون وزن هدف.



  const HEAD = "px-3 py-2 text-right font-medium whitespace-nowrap";
  const GROUPS = ["Q1", "Q2", "Q3", "Q4", "الإجمالي"];
  const baseCols = [
    "المؤسسة",
    "المنظور",
    "الهدف الاستراتيجي",
    "وزن الهدف %",
    "مؤشر الأداء",
    "الكود",
    "وزن المؤشر %",
    "النوع",
    "الوحدة",
    "خط الأساس",
    "المستهدف السنوي",
  ];

  return (
    <>
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

      <Card className="mt-6">
        <CardHeader title={`جدول المؤشرات (${rows.length})`} />
        <ScrollableTable>
          <table className="oid-table">
            <thead>
              <tr>
                {baseCols.map((h) => (
                  <th key={h} rowSpan={2} className={`${HEAD} align-bottom border-b border-border`}>
                    {h}
                  </th>
                ))}
                {GROUPS.map((g) => (
                  <th
                    key={g}
                    colSpan={2}
                    className={`px-3 py-1.5 text-center font-semibold border-b border-r border-border ${
                      g === "الإجمالي" ? "bg-emerald-500/10" : "bg-sky-500/5"
                    }`}
                  >
                    <span>{g}</span>
                    {g !== "الإجمالي" && orgF !== "الكل" && (
                      <QuarterBadge orgId={orgF} quarter={g} className="block text-[10px] font-normal" />
                    )}
                  </th>
                ))}
                {["نسبة الإنجاز %", "التجاوز", "الحالة", "المخرجات والنتائج"].map((h) => (
                  <th key={h} rowSpan={2} className={`${HEAD} align-bottom border-b border-border`}>
                    {h}
                  </th>
                ))}
              </tr>
              <tr>
                {GROUPS.flatMap((g) =>
                  ["مخطط", "منجز"].map((lbl) => (
                    <th
                      key={`${g}-${lbl}`}
                      className={lbl === "مخطط" ? "quarter-start" : ""}
                    >
                      {lbl}
                    </th>
                  )),
                )}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={25} className="px-3 py-6 text-center text-muted-foreground">
                    جاري التحميل…
                  </td>
                </tr>
              )}
              {!isLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={25} className="px-3 py-6 text-center text-muted-foreground">
                    لا توجد بيانات — ارفع مصفوفة المؤشرات من قسم "رفع البيانات".
                  </td>
                </tr>
              )}
              {rows.map((k) => {
                const d = derive(k);
                const res = computeRowAchievement(k);
                 const unit = k.unit ?? k.kpi_type ?? null;
                const gw = k.goal_id ? num(k.goal_weight) : null;
                return (
                  <tr key={k.id} className="border-t border-border hover:bg-muted/20">
                    <td className="px-3 py-2 whitespace-nowrap">{k.entity_code}</td>
                    <td className="px-3 py-2 whitespace-nowrap" title={k.sector ?? ""}>
                      {k.perspective}
                    </td>
                    <td className="px-3 py-2 max-w-[220px]">{k.objective ?? "—"}</td>
                    <td className="numeric">{fmtPct(gw, 2)}</td>
                    <td className="px-3 py-2 max-w-[280px]">
                      {!k.card_completed && (
                        <span title="البطاقة غير مكتملة" className="ml-1">
                          ⚠️
                        </span>
                      )}
                      {k.kpi_name}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{k.kpi_code}</td>
                    <td className="numeric">{fmtPct(d.weight, 2)}</td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap">{k.kpi_type ?? "—"}</td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap">{unit ?? "—"}</td>
                    <td className="numeric">{formatKPIValue(d.baseline, unit)}</td>
                    <td className="numeric">{formatKPIValue(d.target, unit)}</td>
                    {[0, 1, 2, 3].flatMap((i) => [
                      <td key={`p${i}`} className="quarter-start numeric">
                        {formatKPIValue(d.qp[i], unit)}
                      </td>,
                      <td key={`a${i}`} className="numeric">
                        {formatKPIValue(d.qa[i], unit)}
                      </td>,
                    ])}
                    <td className="quarter-start numeric">
                      {formatKPIValue(d.totalPlanned ?? d.target, unit)}
                    </td>
                    <td className="numeric">
                      {formatKPIValue(d.totalActual, unit)}
                    </td>
                    <td className="numeric min-w-[120px]">
                      <div className="flex items-center gap-2">
                        <Progress value={res.cappedPct ?? 0} />
                        <span className="text-xs tabular-nums w-12">
                          {res.rawPct !== null ? `${res.rawPct}%` : "—"}
                        </span>
                      </div>
                    </td>
                    <td className="exceeded-cell">
                      {res.exceeded !== null ? `+${res.exceeded}%` : "—"}
                    </td>
                    <td className={`status-${res.status} text-center whitespace-nowrap`}>
                      {res.statusLabel}
                    </td>
                    <td className="px-3 py-2 text-xs max-w-[240px]">{k.final_output ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ScrollableTable>
      </Card>
    </>
  );
}

/* ════════════ تبويب 2: بطاقات المؤشرات ════════════ */
function CardsView({ rows }: { rows: any[] }) {
  const [selected, setSelected] = useState<any | null>(null);
  return (
    <>
      <div className="grid md:grid-cols-2 gap-4">
        {rows.length === 0 && (
          <Card className="p-6 text-sm text-muted-foreground">لا توجد مؤشرات مطابقة للفلاتر الحالية.</Card>
        )}
        {rows.map((k) => (
          <Card key={k.id} className="p-4 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-mono text-xs text-muted-foreground">{k.kpi_code}</div>
                <div className="text-sm font-medium">{k.kpi_name}</div>
              </div>
              {k.card_completed ? (
                <span className="text-xs text-emerald-600 flex items-center gap-1 whitespace-nowrap">
                  <CheckCircle2 size={14} /> مكتملة
                </span>
              ) : (
                <span className="text-xs text-amber-600 flex items-center gap-1 whitespace-nowrap">
                  <AlertTriangle size={14} /> تحتاج استكمال
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              المنظور: {k.perspective} · الهدف: {k.objective ?? "—"} · الوزن: {fmtPct(num(k.weight), 2)}
            </div>
            <button
              onClick={() => setSelected(k)}
              className="text-xs font-medium text-primary underline underline-offset-4"
            >
              {k.card_completed ? "عرض البطاقة ←" : "استكمال البطاقة ←"}
            </button>
          </Card>
        ))}
      </div>
      {selected && <CardModal kpi={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

/* ════════════ بطاقة المؤشر: بيانات Excel (للعرض) + بيانات البطاقة (للإدخال) ════════════ */
const FIELD_LABEL = "block text-[11px] font-semibold text-muted-foreground mb-1";
const INPUT =
  "w-full text-sm bg-muted rounded-md border border-border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30";

function CardModal({ kpi, onClose }: { kpi: any; onClose: () => void }) {
  const qc = useQueryClient();
  const saveFn = useServerFn(updateKPICard);
  const [form, setForm] = useState<Record<string, string>>(() => ({
    measurement_nature: kpi.measurement_nature ?? natureOf(kpi),
    indicator_role: kpi.indicator_role ?? "output",
    description: kpi.description ?? "",
    related_goal: kpi.related_goal ?? "",
    department: kpi.department ?? "",
    unit: kpi.unit ?? "",
    polarity: kpi.polarity ?? "ascending",
    calculation: kpi.calculation ?? "",
    data_sources: kpi.data_sources ?? "",
    frequency: kpi.frequency ?? "",
    related_kpis: kpi.related_kpis ?? "",
    enablers: kpi.enablers ?? "",
    threshold_red: kpi.threshold_red ?? "",
    threshold_yellow: kpi.threshold_yellow ?? "",
    threshold_green: kpi.threshold_green ?? "",
  }));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const qualitative = form.measurement_nature === "qualitative";
  const set = (key: string, value: string) => setForm((p) => ({ ...p, [key]: value }));

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const res = await saveFn({ data: { id: kpi.id, ...form } as any });
      qc.invalidateQueries({ queryKey: ["kpis-active"] });
      qc.invalidateQueries({ queryKey: ["incomplete-cards"] });
      if (res.completed) onClose();
      else setMsg(`حُفظت البطاقة، وما زالت ناقصة: ${res.missing.join("، ")}`);
    } catch (e: any) {
      setMsg(e?.message ?? "تعذّر الحفظ");
    } finally {
      setSaving(false);
    }
  };

  const orgName = ORGS.find((o) => o.id === kpi.entity_code)?.nameAr ?? kpi.entity_code ?? "—";
  const goalWeight = kpi.goal_id ? num(kpi.goal_weight) : null;
  const quarters: { q: string; planned: unknown; actual: unknown }[] = [1, 2, 3, 4].map((i) => ({
    q: `Q${i}`,
    planned: kpi[`q${i}_planned`],
    actual: kpi[`q${i}_actual`],
  }));

  const imported: { label: string; value: string }[] = [
    { label: "المؤسسة", value: orgName },
    { label: "المنظور", value: kpi.perspective ?? kpi.sector ?? "—" },
    { label: "الهدف الاستراتيجي", value: kpi.objective ?? "—" },
    { label: "وزن الهدف", value: goalWeight !== null ? fmtPct(goalWeight, 2) : "—" },
    { label: "وزن المؤشر", value: fmtPct(num(kpi.weight), 2) },
    { label: "خط الأساس", value: formatKPIValue(kpi.baseline ?? null, kpi.unit) },
    { label: "المستهدف السنوي", value: formatKPIValue(kpi.annual_target ?? null, kpi.unit) },
    { label: "نوع المؤشر", value: kpi.kpi_type ?? "—" },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-background border border-border rounded-xl w-full max-w-2xl my-8 shadow-xl max-h-[90vh] overflow-y-auto">
        {/* رأس البطاقة */}
        <div className="header-grad text-primary-foreground px-5 py-4 rounded-t-xl flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] opacity-70 mb-1">بطاقة مؤشر الأداء الرئيسي</div>
            <div className="text-base font-bold">{kpi.kpi_name}</div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <code className="bg-white/15 px-2.5 py-1 rounded-md text-xs" dir="ltr">
              {kpi.kpi_code}
            </code>
            {kpi.card_completed ? (
              <span className="bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap">
                ✅ مكتملة
              </span>
            ) : (
              <span className="bg-amber-100 text-amber-800 px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap">
                ⚠️ تحتاج استكمال
              </span>
            )}
            <button onClick={onClose} className="text-white/70 hover:text-white">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* ══ القسم الأول: البيانات المستوردة من Excel ══ */}
          <div className="bg-muted/50 border border-border rounded-lg p-4">
            <div className="text-xs font-bold text-primary mb-3 flex items-center gap-1.5">
              📊 البيانات المستوردة من مصفوفة المؤشرات
              <span className="text-[10px] font-normal text-muted-foreground">
                (للتعديل: ارفع مصفوفة Excel محدّثة)
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {imported.map((f) => (
                <div key={f.label} className="flex flex-col gap-0.5">
                  <span className="text-[10px] text-muted-foreground font-semibold">{f.label}</span>
                  <span className="text-xs font-medium">{f.value}</span>
                </div>
              ))}
            </div>
            <div className="mt-3">
              <div className="text-[10px] text-muted-foreground font-semibold mb-1.5">المستهدفات الربعية</div>
              <div className="grid grid-cols-4 gap-1.5">
                {quarters.map(({ q, planned, actual }) => {
                  const actualVal = num(actual);
                  return (
                    <div key={q} className="bg-background border border-border rounded-lg p-2 text-center">
                      <div className="text-[11px] font-bold text-primary mb-1">{q}</div>
                      <div style={{ fontSize: "15px", fontWeight: 700, color: "#1a2332", margin: "2px 0" }}>
                        {formatKPIValue(num(planned), kpi.unit)}
                      </div>
                      {actualVal !== null && (
                        <div style={{
                          fontSize: "11px",
                          color: "#0e4d2e",
                          fontWeight: 600,
                          background: "#f0fdf4",
                          borderRadius: "4px",
                          padding: "1px 4px",
                          marginTop: "2px",
                        }}>
                          {formatKPIValue(actualVal, kpi.unit)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ══ القسم الثاني: بيانات البطاقة (للإدخال والتعديل) ══ */}
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="bg-emerald-500/10 px-4 py-2.5 text-xs font-bold text-primary border-b border-border">
              📋 بيانات بطاقة المؤشر
              {!kpi.card_completed && (
                <span className="text-[10px] font-normal text-amber-600 mr-2">— الحقول المطلوبة مُعلَّمة بـ *</span>
              )}
            </div>
            <div className="p-4 space-y-3">
              {/* طبيعة القياس + الدور */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={FIELD_LABEL}>طبيعة القياس *</label>
                  <select
                    value={form.measurement_nature}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        measurement_nature: e.target.value,
                        unit: e.target.value === "qualitative" ? "ليكرت 1-5" : p.unit,
                      }))
                    }
                    className={INPUT}
                  >
                    <option value="quantitative_ratio">كمي نسبي (%)</option>
                    <option value="quantitative_number">كمي عددي</option>
                    <option value="qualitative">نوعي (ليكرت 1-5)</option>
                  </select>
                </div>
                <div>
                  <label className={FIELD_LABEL}>دور المؤشر *</label>
                  <select value={form.indicator_role} onChange={(e) => set("indicator_role", e.target.value)} className={INPUT}>
                    <option value="output">مخرجات</option>
                    <option value="driving">موجهات</option>
                  </select>
                </div>
              </div>

              {/* توضيح ليكرت */}
              {qualitative && (
                <div className="p-3 bg-sky-500/10 border border-sky-500/30 rounded-lg text-[11px] text-sky-700">
                  <strong>مقياس ليكرت الخماسي:</strong>
                  <div className="grid grid-cols-5 gap-1 mt-1.5 text-center">
                    {[
                      { v: 1, l: "ضعيف" },
                      { v: 2, l: "مقبول" },
                      { v: 3, l: "جيد" },
                      { v: 4, l: "جيد جداً" },
                      { v: 5, l: "ممتاز" },
                    ].map((s) => (
                      <div key={s.v} className="bg-background border border-sky-500/30 rounded-md p-1">
                        <div className="font-bold">{s.v}</div>
                        <div className="text-[10px]">{s.l}</div>
                      </div>
                    ))}
                  </div>
                  <p className="mt-1.5 opacity-70">نسبة الإنجاز = (الدرجة ÷ 5) × 100</p>
                </div>
              )}

              {/* وصف المؤشر */}
              <div>
                <label className={FIELD_LABEL}>وصف المؤشر *</label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  placeholder="يقيس نسبة..."
                  className={`${INPUT} resize-y`}
                />
              </div>

              {/* الهدف المرتبط + الإدارة */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={FIELD_LABEL}>الهدف المرتبط</label>
                  <input value={form.related_goal} onChange={(e) => set("related_goal", e.target.value)} className={INPUT} />
                </div>
                <div>
                  <label className={FIELD_LABEL}>الإدارة المسؤولة</label>
                  <input value={form.department} onChange={(e) => set("department", e.target.value)} className={INPUT} />
                </div>
              </div>

              {/* وحدة القياس + القطبية */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={FIELD_LABEL}>وحدة القياس *</label>
                  <input
                    value={form.unit}
                    onChange={(e) => set("unit", e.target.value)}
                    placeholder="% أو عدد أو درجة..."
                    disabled={qualitative}
                    className={`${INPUT} ${qualitative ? "opacity-60" : ""}`}
                  />
                </div>
                <div>
                  <label className={FIELD_LABEL}>القطبية *</label>
                  <select value={form.polarity} onChange={(e) => set("polarity", e.target.value)} className={INPUT}>
                    <option value="ascending">تصاعدي — الأعلى أفضل ↑</option>
                    <option value="descending">تنازلي — الأقل أفضل ↓</option>
                  </select>
                </div>
              </div>

              {/* العملية الحسابية */}
              <div>
                <label className={FIELD_LABEL}>العملية الحسابية *</label>
                <textarea
                  rows={2}
                  value={form.calculation}
                  onChange={(e) => set("calculation", e.target.value)}
                  placeholder="(المنجز ÷ المستهدف) × 100"
                  className={`${INPUT} resize-y`}
                />
              </div>

              {/* مصادر البيانات + التردد/المرتبطة */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={FIELD_LABEL}>مصادر البيانات *</label>
                  <textarea
                    rows={2}
                    value={form.data_sources}
                    onChange={(e) => set("data_sources", e.target.value)}
                    placeholder="سجلات التدريب، نظام الموارد..."
                    className={`${INPUT} resize-y`}
                  />
                </div>
                <div className="space-y-3">
                  <div>
                    <label className={FIELD_LABEL}>التردد والتكرار</label>
                    <select value={form.frequency} onChange={(e) => set("frequency", e.target.value)} className={INPUT}>
                      <option value="">اختر...</option>
                      <option value="ربع سنوي - تراكمي">ربع سنوي - تراكمي</option>
                      <option value="ربع سنوي - مستقل">ربع سنوي - مستقل</option>
                      <option value="نصف سنوي - تراكمي">نصف سنوي - تراكمي</option>
                      <option value="نصف سنوي - مستقل">نصف سنوي - مستقل</option>
                      <option value="سنوي">سنوي</option>
                    </select>
                  </div>
                  <div>
                    <label className={FIELD_LABEL}>المؤشرات المرتبطة</label>
                    <input
                      value={form.related_kpis}
                      onChange={(e) => set("related_kpis", e.target.value)}
                      placeholder="TAYO-L2, TAYO-L3"
                      className={INPUT}
                    />
                  </div>
                </div>
              </div>

              {/* الممكنات */}
              <div>
                <label className={FIELD_LABEL}>الممكنات</label>
                <input
                  value={form.enablers}
                  onChange={(e) => set("enablers", e.target.value)}
                  placeholder="ميزانية التدريب المعتمدة..."
                  className={INPUT}
                />
              </div>

              {/* العتبات الثلاث */}
              <div className="bg-muted/40 border border-border rounded-lg p-3">
                <div className="text-xs font-bold mb-2.5">العتبات الثلاث *</div>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { key: "threshold_red", label: "🔴 الحمراء", ph: qualitative ? "≤ 2" : "أقل من 60%" },
                    { key: "threshold_yellow", label: "🟡 الصفراء", ph: qualitative ? "3" : "60% - 89%" },
                    { key: "threshold_green", label: "🟢 الخضراء", ph: qualitative ? "≥ 4" : "90% فأكثر" },
                  ].map((t) => (
                    <div key={t.key}>
                      <label className={FIELD_LABEL}>{t.label}</label>
                      <input
                        value={form[t.key]}
                        onChange={(e) => set(t.key, e.target.value)}
                        placeholder={t.ph}
                        className={`${INPUT} text-center`}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {msg && <div className="text-xs text-amber-600">{msg}</div>}

              {/* أزرار */}
              <div className="flex justify-end gap-2 pt-1 border-t border-border">
                <button onClick={onClose} className="px-5 py-2 text-[13px] rounded-lg border border-border bg-background">
                  إغلاق
                </button>
                <button
                  onClick={save}
                  disabled={saving}
                  className="px-6 py-2 text-[13px] font-bold rounded-lg bg-primary text-primary-foreground disabled:opacity-60"
                >
                  {saving ? "جارٍ الحفظ…" : "✅ حفظ البطاقة"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════ تبويب 3: تحديث المنجز ════════════ */
function UpdateView({ rows, orgF }: { rows: any[]; orgF: string }) {
  const qc = useQueryClient();
  const saveFn = useServerFn(saveQuarterAchievements);
  const [quarter, setQuarter] = useState<Quarter>("q2");
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const fiscal = ORG_FISCAL_YEAR[orgF as OrgId] ?? "calendar";
  const months = useMemo(
    () => FISCAL_QUARTERS[fiscal].find((x) => x.q === quarter.toUpperCase())?.months ?? "",
    [fiscal, quarter],
  );

  const plannedKey = `${quarter}_planned`;
  const actualKey = `${quarter}_actual`;

  const save = async () => {
    const items = Object.entries(edits).map(([id, v]) => ({
      id,
      achieved: v.trim() === "" ? null : Number(v),
    }));
    if (items.length === 0) return;
    setSaving(true);
    setMsg(null);
    try {
      await saveFn({ data: { quarter, items } });
      setEdits({});
      qc.invalidateQueries({ queryKey: ["kpis-active"] });
      qc.invalidateQueries({ queryKey: ["dashboard-snapshot"] });
      setMsg(`تم حفظ ${items.length} تحديث`);
    } catch (e: any) {
      setMsg(e?.message ?? "تعذّر الحفظ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader title={`تحديث المنجز (${rows.length} مؤشر)`} />
      <div className="p-4 flex flex-wrap items-center gap-3 border-b border-border">
        <div className="flex gap-1">
          {(["q1", "q2", "q3", "q4"] as Quarter[]).map((qq) => (
            <button
              key={qq}
              onClick={() => setQuarter(qq)}
              className={`px-3 py-1 text-xs rounded-full border font-medium ${
                quarter === qq
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted text-muted-foreground border-border hover:bg-accent"
              }`}
            >
              {qq.toUpperCase()}
            </button>
          ))}
        </div>
        {months && <span className="text-xs text-muted-foreground">({months})</span>}
        <button
          onClick={save}
          disabled={saving || Object.keys(edits).length === 0}
          className="ml-auto px-4 py-1.5 text-sm rounded-md bg-primary text-primary-foreground disabled:opacity-50"
        >
          {saving ? "جارٍ الحفظ…" : `حفظ التحديثات (${Object.keys(edits).length})`}
        </button>
        {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
      </div>

      <ScrollableTable>
        <table className="oid-table">
          <thead>
            <tr>
              {["الكود", "المؤشر", "المستهدف", "المنجز", "نسبة الإنجاز", "الحالة"].map((h) => (
                <th key={h} className="px-3 py-2 text-right font-medium whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((k) => {
              const target = num(k[plannedKey]) ?? num(k.annual_target);
              const current = edits[k.id] !== undefined ? edits[k.id] : k[actualKey] ?? "";
              const nature = natureOf(k);
              const unit = nature === "qualitative" ? "ليكرت 1-5" : k.unit ?? k.kpi_type ?? null;
              const res = computeKPIAchievement(
                {
                  measurement_nature: nature,
                  polarity: polarityOf(k),
                  threshold_red: k.threshold_red,
                  threshold_green: k.threshold_green,
                  unit,
                },
                target,
                current === "" ? null : current,
              );
              const check =
                nature === "qualitative" ? { warning: null } : validateKPIValue(current as string, unit, k.kpi_name ?? "");
              return (
                <tr key={k.id} className="border-t border-border hover:bg-muted/20">
                  <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{k.kpi_code}</td>
                  <td className="px-3 py-2 max-w-[320px]">{k.kpi_name}</td>
                  <td className="numeric">{formatKPIValue(target, unit)}</td>
                  <td className="px-3 py-2">
                    <AchievedInput
                      nature={nature}
                      value={String(current ?? "")}
                      warning={!!check.warning}
                      onChange={(v) => setEdits({ ...edits, [k.id]: v })}
                    />
                    {check.warning && <div className="mt-1 text-[10px] text-red-600">⚠️ {check.warning}</div>}
                  </td>
                  <td className="numeric">
                    {res.rawPct === null ? "—" : `${res.rawPct}%`}
                    {res.exceeded !== null && (
                      <span className="mr-1 text-[10px] text-emerald-600 font-bold">+{res.exceeded}%</span>
                    )}
                  </td>
                  <td className={`status-${res.status} text-center whitespace-nowrap`}>
                    {res.statusLabel}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                  لا توجد مؤشرات مطابقة.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </ScrollableTable>
    </Card>
  );
}

/* إدخال المنجز حسب طبيعة القياس */
function AchievedInput({
  nature,
  value,
  warning,
  onChange,
}: {
  nature: MeasurementNature;
  value: string;
  warning?: boolean;
  onChange: (v: string) => void;
}) {
  const border = warning ? "border-red-400" : "border-border";

  if (nature === "qualitative") {
    const labels = ["ضعيف", "مقبول", "جيد", "جيد جداً", "ممتاز"];
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((score) => {
          const active = value === String(score);
          return (
            <button
              key={score}
              type="button"
              title={labels[score - 1]}
              onClick={() => onChange(active ? "" : String(score))}
              className={`w-8 h-8 rounded-full border-2 text-[13px] font-bold transition-colors ${
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:bg-muted"
              }`}
            >
              {score}
            </button>
          );
        })}
      </div>
    );
  }

  if (nature === "quantitative_ratio") {
    return (
      <div className="flex items-center gap-1">
        <input
          type="number"
          min={0}
          max={200}
          step={0.1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="65"
          dir="ltr"
          className={`w-20 text-center text-sm bg-muted rounded-md border px-2 py-1 tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/30 ${border}`}
        />
        <span className="text-sm text-muted-foreground">%</span>
      </div>
    );
  }

  return (
    <input
      type="number"
      min={0}
      step="any"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="11"
      dir="ltr"
      className={`w-24 text-center text-sm bg-muted rounded-md border px-2 py-1 tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/30 ${border}`}
    />
  );
}
