import { useMemo, useState } from "react";
import { Search, AlertTriangle, CheckCircle2, X } from "lucide-react";
import {
  ORGS,
  ORG_FISCAL_YEAR,
  FISCAL_QUARTERS,
  computeKPIStatus,
  formatKPIValue,
  validateKPIValue,
  type OrgId,
} from "@/lib/oid-data";
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

const statusClass: Record<string, string> = {
  green: "bg-emerald-500/10 text-emerald-600",
  yellow: "bg-amber-500/10 text-amber-600",
  red: "bg-red-500/10 text-red-600",
  gray: "bg-muted text-muted-foreground",
};

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
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
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
                {["نسبة الإنجاز %", "الحالة", "المخرجات والنتائج"].map((h) => (
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
                      className={`px-3 py-1.5 text-center font-normal text-[11px] border-b border-border ${
                        lbl === "منجز" ? "bg-emerald-500/5" : "bg-sky-500/5"
                      }`}
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
                  <td colSpan={24} className="px-3 py-6 text-center text-muted-foreground">
                    جاري التحميل…
                  </td>
                </tr>
              )}
              {!isLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={24} className="px-3 py-6 text-center text-muted-foreground">
                    لا توجد بيانات — ارفع مصفوفة المؤشرات من قسم "رفع البيانات".
                  </td>
                </tr>
              )}
              {rows.map((k) => {
                const d = derive(k);
                const st = computeKPIStatus(k, d.totalActual);
                 const unit = k.unit ?? k.kpi_type ?? null;
                const gw = k.goal_id ? num(k.goal_weight) : null;
                return (
                  <tr key={k.id} className="border-t border-border hover:bg-muted/20">
                    <td className="px-3 py-2 whitespace-nowrap">{k.entity_code}</td>
                    <td className="px-3 py-2 whitespace-nowrap" title={k.sector ?? ""}>
                      {k.perspective}
                    </td>
                    <td className="px-3 py-2 max-w-[220px]">{k.objective ?? "—"}</td>
                    <td className="px-3 py-2 tabular-nums text-xs">{fmtPct(gw, 2)}</td>
                    <td className="px-3 py-2 max-w-[280px]">
                      {!k.card_completed && (
                        <span title="البطاقة غير مكتملة" className="ml-1">
                          ⚠️
                        </span>
                      )}
                      {k.kpi_name}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{k.kpi_code}</td>
                    <td className="px-3 py-2 tabular-nums text-xs">{fmtPct(d.weight, 2)}</td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap">{k.kpi_type ?? "—"}</td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap">{unit ?? "—"}</td>
                    <td className="px-3 py-2 tabular-nums text-xs">{formatKPIValue(d.baseline, unit)}</td>
                    <td className="px-3 py-2 tabular-nums text-xs font-medium">{formatKPIValue(d.target, unit)}</td>
                    {[0, 1, 2, 3].flatMap((i) => [
                      <td key={`p${i}`} className="px-3 py-2 tabular-nums text-xs bg-sky-500/5">
                        {formatKPIValue(d.qp[i], unit)}
                      </td>,
                      <td key={`a${i}`} className="px-3 py-2 tabular-nums text-xs bg-emerald-500/5">
                        {formatKPIValue(d.qa[i], unit)}
                      </td>,
                    ])}
                    <td className="px-3 py-2 tabular-nums text-xs font-medium bg-sky-500/5">
                      {formatKPIValue(d.totalPlanned ?? d.target, unit)}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-xs font-medium bg-emerald-500/5">
                      {formatKPIValue(d.totalActual, unit)}
                    </td>
                    <td className="px-3 py-2 min-w-[120px]">
                      <div className="flex items-center gap-2">
                        <Progress
                          value={Math.max(0, Math.min(100, Number(fmtPct(d.achievement, 2).replace("%", "")) || 0))}
                        />
                        <span className="text-xs tabular-nums w-12">{fmtPct(d.achievement)}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${statusClass[st.color]}`}>{st.label}</span>
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

const FIELD_SECTIONS: { title: string; fields: { key: string; label: string; type?: "textarea" | "select"; options?: string[] }[] }[] = [
  {
    title: "تعريف المؤشر",
    fields: [
      { key: "description", label: "وصف المؤشر", type: "textarea" },
      { key: "related_goal", label: "الهدف المرتبط" },
      { key: "department", label: "الإدارة المسؤولة" },
      { key: "indicator_type", label: "نوع المؤشر", type: "select", options: ["كمي", "نوعي", "قيادي", "تابع"] },
      { key: "unit", label: "وحدة القياس" },
      { key: "polarity", label: "القطبية", type: "select", options: ["تصاعدي", "تنازلي"] },
    ],
  },
  {
    title: "آلية القياس",
    fields: [
      { key: "calculation", label: "العملية الحسابية", type: "textarea" },
      { key: "data_sources", label: "مصادر البيانات", type: "textarea" },
      { key: "frequency", label: "التردد والتكرار", type: "select", options: ["شهري", "ربع سنوي", "نصف سنوي", "سنوي"] },
      { key: "related_kpis", label: "المؤشرات المرتبطة" },
      { key: "enablers", label: "الممكنات" },
    ],
  },
  {
    title: "العتبات",
    fields: [
      { key: "threshold_red", label: "🔴 العتبة الحمراء (مثال: أقل من 80%)" },
      { key: "threshold_yellow", label: "🟡 العتبة الصفراء (مثال: من 81% إلى 90%)" },
      { key: "threshold_green", label: "🟢 العتبة الخضراء (مثال: أكثر من 90%)" },
    ],
  },
];

function CardModal({ kpi, onClose }: { kpi: any; onClose: () => void }) {
  const qc = useQueryClient();
  const saveFn = useServerFn(updateKPICard);
  const [form, setForm] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    FIELD_SECTIONS.forEach((s) => s.fields.forEach((f) => (init[f.key] = kpi[f.key] ?? "")));
    return init;
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

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

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-background border border-border rounded-xl w-full max-w-2xl my-8 shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <div className="text-sm font-semibold">بطاقة المؤشر</div>
            <div className="text-xs text-muted-foreground font-mono">
              {kpi.kpi_code} · {kpi.kpi_name}
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-5">
          {FIELD_SECTIONS.map((section) => (
            <div key={section.title} className="space-y-3">
              <div className="text-xs font-semibold text-muted-foreground">{section.title}</div>
              <div className="grid md:grid-cols-2 gap-3">
                {section.fields.map((f) => (
                  <div key={f.key} className={f.type === "textarea" ? "md:col-span-2" : ""}>
                    <label className="block text-xs text-muted-foreground mb-1">{f.label}</label>
                    {f.type === "textarea" ? (
                      <textarea
                        rows={2}
                        value={form[f.key]}
                        onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                        className="w-full text-sm bg-muted rounded-md border border-border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    ) : f.type === "select" ? (
                      <select
                        value={form[f.key]}
                        onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                        className="w-full text-sm bg-muted rounded-md border border-border px-3 py-2"
                      >
                        <option value="">—</option>
                        {f.options?.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={form[f.key]}
                        onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                        className="w-full text-sm bg-muted rounded-md border border-border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
          {msg && <div className="text-xs text-amber-600">{msg}</div>}
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-border">
          <button onClick={onClose} className="px-3 py-1.5 text-sm rounded-md border border-border">
            إغلاق
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-1.5 text-sm rounded-md bg-primary text-primary-foreground disabled:opacity-60"
          >
            {saving ? "جارٍ الحفظ…" : "حفظ ✅"}
          </button>
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
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
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
              const achievedNum = current === "" ? null : Number(current);
              const pct = target && achievedNum !== null ? (achievedNum / target) * 100 : null;
              const st = computeKPIStatus({ ...k, annual_target: target }, achievedNum);
              const unit = k.unit ?? k.kpi_type ?? null;
              const check = validateKPIValue(current as string, unit, k.kpi_name ?? "");
              return (
                <tr key={k.id} className="border-t border-border hover:bg-muted/20">
                  <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{k.kpi_code}</td>
                  <td className="px-3 py-2 max-w-[320px]">{k.kpi_name}</td>
                  <td className="px-3 py-2 tabular-nums text-xs">{formatKPIValue(target, unit)}</td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      step="any"
                      value={current as string}
                      onChange={(e) => setEdits({ ...edits, [k.id]: e.target.value })}
                      placeholder={unit && unit.includes("%") ? "مثال: 65" : "مثال: 11"}
                      className={`w-28 text-sm bg-muted rounded-md border px-2 py-1 tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                        check.warning ? "border-red-400" : "border-border"
                      }`}
                    />
                    {check.warning && <div className="mt-1 text-[10px] text-red-600">⚠️ {check.warning}</div>}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-xs">{pct === null ? "—" : `${pct.toFixed(0)}%`}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${statusClass[st.color]}`}>{st.label}</span>
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
