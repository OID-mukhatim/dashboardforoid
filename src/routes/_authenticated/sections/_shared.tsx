import { Settings, Clock } from "lucide-react";
import { ORGS, type OrgId } from "@/lib/oid-data";
import { OrgLogo } from "@/components/oid/OrgLogo";
import { formatBudget as fmtBudgetWestern, formatCount } from "@/lib/oid-formatting";
import { loadDashboardSnapshot } from "@/lib/dashboard.functions";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";

/* ============================ Reusable ============================ */
export function Card({ children, className = "" }: any) {
  return <div className={`bg-card rounded-xl border border-border shadow-sm ${className}`}>{children}</div>;
}
export function CardHeader({ title, subtitle, action }: any) {
  return (
    <div className="flex items-start justify-between px-5 py-4 border-b border-border">
      <div>
        <h3 className="font-bold text-foreground">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
export function StatCard({ label, value, sub, icon: Icon, accent }: any) {
  return (
    <Card className="p-5 border-r-4 hover:shadow-md transition" >
      <div className="flex items-start justify-between" style={{ borderRightColor: accent }}>
        <div>
          <div className="text-xs text-muted-foreground mb-1">{label}</div>
          <div className="text-3xl font-bold tabular-nums" style={{ color: accent }}>{value}</div>
          {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
        </div>
        <div className="p-2 rounded-lg" style={{ background: `${accent}15`, color: accent }}>
          <Icon size={20} />
        </div>
      </div>
    </Card>
  );
}
export function EmptyData({ msg = "البيانات قيد الاستكمال" }: { msg?: string }) {
  return (
    <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg p-6 text-center">
      <Clock className="mx-auto mb-2 text-gray-400" size={22} />
      <p className="text-sm text-gray-500">{msg}</p>
    </div>
  );
}
export function Progress({ value, color = "var(--primary)" }: { value: number; color?: string }) {
  return (
    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: color }} />
    </div>
  );
}

export const UPLOAD_PHASES: { key: string; label: string }[] = [
  { key: "downloading", label: "تنزيل" },
  { key: "reading_sheets", label: "قراءة الأوراق" },
  { key: "matching", label: "مطابقة" },
  { key: "upserting", label: "حفظ" },
  { key: "done", label: "اكتمل" },
];
export function UploadProgressBar({
  phase, label, percent, message, elapsedMs, etaMs, fmtMs,
}: {
  phase: string; label: string; percent: number; message: string | null;
  elapsedMs: number; etaMs: number | null;
  fmtMs: (ms: number | null | undefined) => string;
}) {
  const currentIdx = Math.max(0, UPLOAD_PHASES.findIndex((p) => p.key === phase));
  const safePercent = Math.min(100, Math.max(0, percent));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-amber-800">{label}</span>
          {message && <span className="text-muted-foreground whitespace-normal break-words">— {message}</span>}
        </div>
        <div className="flex items-center gap-3 whitespace-nowrap tabular-nums">
          <span className="font-bold text-amber-800">{safePercent}%</span>
          <span className="text-muted-foreground">⏱ {fmtMs(elapsedMs)}</span>
          {etaMs != null && <span className="text-muted-foreground">⏳ ~{fmtMs(etaMs)}</span>}
        </div>
      </div>
      <Progress value={safePercent} color="#d97706" />
      <div className="flex items-center justify-between gap-1 text-[10px]" dir="rtl">
        {UPLOAD_PHASES.map((p, i) => {
          const done = i < currentIdx || (i === currentIdx && safePercent >= 100);
          const active = i === currentIdx && safePercent < 100;
          return (
            <div key={p.key} className="flex items-center gap-1 flex-1">
              <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold ${
                done ? "bg-emerald-600 text-white" :
                active ? "bg-amber-500 text-white animate-pulse" :
                "bg-gray-200 text-gray-500"
              }`}>
                {done ? "✓" : i + 1}
              </span>
              <span className={done || active ? "text-foreground" : "text-muted-foreground"}>{p.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================ DASHBOARD ============================ */
export const MATURITY_OF_LEVEL: Record<number, string> = { 1: "أولي", 2: "ناشئ", 3: "متطور", 4: "متقدم", 5: "ريادي" };
export function extractBeneficiaries(s: string | null | undefined): number {
  if (!s) return 0;
  const nums = String(s).replace(/,/g, "").match(/\d{2,}/g);
  if (!nums) return 0;
  return nums.reduce((a, b) => a + Number(b), 0);
}
// الأرقام دائماً غربية (المحور 5) — نستخدم helpers من oid-formatting
export const fmtBudget = (n: number) => fmtBudgetWestern(n);
export const fmtNum = (n: number) => formatCount(n);

export const GAP_AXIS_SOURCE_KEYS: Record<string, string[]> = {
  الاستراتيجية: ["الاستراتيجية"],
  القيادة: ["القيادة", "القيادة والكفاءات"],
  الأداء: ["الأداء", "الأداء والنتائج"],
  العمليات: ["العمليات", "العمليات والأنظمة"],
  المالية: ["المالية", "الاستدامة المالية"],
  "البنية التحتية": ["البنية التحتية"],
  الحوكمة: ["الحوكمة", "الحوكمة والامتثال"],
};

export function useDashboardSnapshotQuery() {
  const snapshotFn = useServerFn(loadDashboardSnapshot);
  return useQuery({
    queryKey: ["dashboard-snapshot"],
    queryFn: () => snapshotFn(),
    refetchInterval: 10000,
  });
}

export function getLiveGapValue(snap: any, orgId: OrgId, axis: string): number | null {
  const gaps = snap?.matrix?.[orgId]?.gaps;
  if (!gaps) return null;
  for (const key of GAP_AXIS_SOURCE_KEYS[axis] ?? [axis]) {
    const value = gaps[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

export function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border pb-4">
      <div>
        <h2 className="text-2xl font-bold text-foreground">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      <button className="text-xs flex items-center gap-1 text-primary hover:underline">
        <Settings size={14} /> تعديل
      </button>
    </div>
  );
}

export function Select({ value, onChange, options, label }: any) {
  return (
    <label className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <select value={value} onChange={(e)=>onChange(e.target.value)} className="px-2 py-1.5 rounded-md bg-muted border border-border text-sm focus:outline-none">
        {options.map((o: string) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}
export function OrgChip({ id }: { id: OrgId }) {
  const o = ORGS.find(x => x.id === id);
  if (!o) return <span>{id}</span>;
  return <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full" style={{ background: `${o.color}15`, color: o.color }}>
    <OrgLogo orgId={id} size={16} shape="circle" />{o.abbr}
  </span>;
}
export function CircularProgress({ value, color }: { value: number; color: string }) {
  const r = 22, c = 2 * Math.PI * r;
  const off = c - (value / 100) * c;
  return (
    <svg width="60" height="60" viewBox="0 0 60 60">
      <circle cx="30" cy="30" r={r} fill="none" stroke="#e0e8f0" strokeWidth="5" />
      <circle cx="30" cy="30" r={r} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={off} transform="rotate(-90 30 30)" />
      <text x="30" y="34" textAnchor="middle" fontSize="12" fontWeight="700" fill={color}>{value}%</text>
    </svg>
  );
}

export function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string)=>void; options: { value: string; label: string }[] }) {
  return (
    <label className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <select value={value} onChange={(e)=>onChange(e.target.value)} className="px-2 py-1.5 rounded-md bg-muted border border-border text-sm focus:outline-none">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

export function Row({ k, v }: { k: string; v: any }) {
  return (
    <div className="flex justify-between gap-2 border-b border-border/50 py-1">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="font-medium text-left">{v ?? <span className="text-gray-400">—</span>}</dd>
    </div>
  );
}
