import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Fragment, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  Building2, Users, Heart, Coins, TrendingUp, BarChart3, Target, Handshake,
  Home, LineChart as LineChartIcon, FileText, Radar as RadarIcon, Landmark,
  Wallet, Building, Rocket, Upload, Settings, Bell, Download, Search,
  ChevronRight, AlertTriangle, CheckCircle2, XCircle, Clock, Star, LogOut, Shield,
} from "lucide-react";
import {
  ResponsiveContainer, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, PieChart, Pie, Cell,
} from "recharts";
import {
  ORGS, type OrgId, orgOverallScores, MATURITY_LABELS, GAP_AXES, gapScores,
  kpiData, PERSPECTIVES, q1Data, criticalGaps, POLICY_STATUS_META, type PolicyStatus,
  generalPolicies, universityPolicies, humanitarianPolicies, educationPolicies,
  financialAssessment, PROGRAM_STATUS_META, financialProgram, financialTimeline,
  partnerships, institutions, initiatives, alerts,
} from "@/lib/oid-data";
import { CompositeScoreCard } from "@/components/oid/CompositeScoreCard";
import { DataStateLegend } from "@/components/oid/DataStateCell";
import { AnomaliesPanel } from "@/components/oid/AnomaliesPanel";
import { InstitutionProfileDrawer } from "@/components/oid/InstitutionProfileDrawer";
import { ScrollableTable } from "@/components/oid/ScrollableTable";
import { OrgLogo } from "@/components/oid/OrgLogo";
import { openOrgProfile } from "@/lib/oid-drill";
import { formatScore, formatBudget as fmtBudgetWestern, formatCount } from "@/lib/oid-formatting";
import { MATURITY_SCALE } from "@/lib/oid-maturity";
import { BSC_PERSPECTIVES, BSC_LABELS, matchPerspective, perspectiveLabelOf } from "@/lib/oid-bsc";

export const Route = createFileRoute("/_authenticated/")({ component: Page });

type SectionId =
  | "dashboard" | "kpis" | "quarterly" | "gaps" | "governance"
  | "financial" | "partnerships" | "profiles" | "initiatives" | "upload";

const NAV: { group: string; items: { id: SectionId; label: string; icon: any }[] }[] = [
  { group: "القيادة", items: [
    { id: "dashboard", label: "لوحة القيادة الرئيسية", icon: Home },
    { id: "kpis", label: "مؤشرات الأداء KPIs", icon: Target },
    { id: "quarterly", label: "التقارير الربعية", icon: FileText },
  ]},
  { group: "التقييم", items: [
    { id: "gaps", label: "تحليل الفجوات المؤسسية", icon: RadarIcon },
    { id: "governance", label: "الحوكمة والامتثال", icon: Landmark },
    { id: "financial", label: "المستشار المالي", icon: Wallet },
    { id: "partnerships", label: "الشراكات الاستراتيجية", icon: Handshake },
  ]},
  { group: "المؤسسات", items: [
    { id: "profiles", label: "البيانات المؤسسية", icon: Building },
    { id: "initiatives", label: "المبادرات التطويرية", icon: Rocket },
  ]},
  { group: "الأدوات", items: [
    { id: "upload", label: "رفع البيانات وتحديثها", icon: Upload },
  ]},
];

function Page() {
  const [section, setSection] = useState<SectionId>("dashboard");
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <div className="flex flex-1">
        <Sidebar current={section} onChange={setSection} />
        <main className="flex-1 p-6 overflow-x-hidden">
          {section === "dashboard" && <DashboardSection />}
          {section === "kpis" && <KPIsSection />}
          {section === "quarterly" && <QuarterlySection />}
          {section === "gaps" && <GapsSection />}
          {section === "governance" && <GovernanceSection />}
          {section === "financial" && <FinancialSection />}
          {section === "partnerships" && <PartnershipsSection />}
          {section === "profiles" && <ProfilesSection />}
          {section === "initiatives" && <InitiativesSection />}
          {section === "upload" && <UploadSection />}
        </main>
      </div>
      <InstitutionProfileDrawer />
    </div>
  );
}

/* ============================== Header ============================== */
function Header() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="header-grad text-white shadow-lg">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">مكتب الإشراف والتطوير المؤسسي</h1>
          <p className="text-lg text-white/80 font-serif mt-0.5">Oversight & Institutional Development — OID</p>
        </div>
        <div className="flex items-center gap-3">

          {isAdmin && (
            <Link to="/users" className="p-2 rounded-lg hover:bg-white/15 transition" title="إدارة المستخدمين">
              <Shield size={18} />
            </Link>
          )}
          <span className="text-xs px-2 py-1 rounded-md bg-white/15 border border-white/20">v1.0 — 2026</span>
          <IconBtn icon={Download} label="تصدير PDF" onClick={() => window.print()} />
          <IconBtn icon={Bell} label="تنبيهات" badge={alerts.filter(a=>a.level==="danger").length} />
          <button onClick={signOut} className="p-2 rounded-lg hover:bg-white/15 transition" title="خروج">
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </header>
  );
}
function IconBtn({ icon: Icon, label, badge, onClick }: any) {
  return (
    <button onClick={onClick} className="relative p-2 rounded-lg hover:bg-white/15 transition" title={label}>
      <Icon size={18} />
      {badge ? <span className="absolute -top-0.5 -left-0.5 text-[10px] bg-danger text-white rounded-full w-4 h-4 flex items-center justify-center font-bold">{badge}</span> : null}
    </button>
  );
}

/* ============================== Sidebar ============================== */
function Sidebar({ current, onChange }: { current: SectionId; onChange: (s: SectionId)=>void }) {
  return (
    <aside className="w-[248px] shrink-0 text-white" style={{ background: "var(--sidebar-bg)" }}>
      <div className="p-4 space-y-5">
        {NAV.map((g) => (
          <div key={g.group}>
            <div className="text-[11px] uppercase tracking-wider text-white/50 mb-2 px-2">{g.group}</div>
            <nav className="space-y-1">
              {g.items.map((it) => {
                const active = current === it.id;
                return (
                  <button
                    key={it.id}
                    onClick={() => onChange(it.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition text-right ${
                      active ? "text-white font-medium" : "text-white/75 hover:bg-white/5"
                    }`}
                    style={ active ? { background: "var(--sidebar-active)", borderRight: "3px solid #a8d5b5" } : undefined }
                  >
                    <it.icon size={16} />
                    <span className="flex-1">{it.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        ))}
      </div>
    </aside>
  );
}

/* ============================ Reusable ============================ */
function Card({ children, className = "" }: any) {
  return <div className={`bg-card rounded-xl border border-border shadow-sm ${className}`}>{children}</div>;
}
function CardHeader({ title, subtitle, action }: any) {
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
function StatCard({ label, value, sub, icon: Icon, accent }: any) {
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
function EmptyData({ msg = "البيانات قيد الاستكمال" }: { msg?: string }) {
  return (
    <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg p-6 text-center">
      <Clock className="mx-auto mb-2 text-gray-400" size={22} />
      <p className="text-sm text-gray-500">{msg}</p>
    </div>
  );
}
function Progress({ value, color = "var(--primary)" }: { value: number; color?: string }) {
  return (
    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: color }} />
    </div>
  );
}

/* ============================ DASHBOARD ============================ */
const MATURITY_OF_LEVEL: Record<number, string> = { 1: "أولي", 2: "ناشئ", 3: "متطور", 4: "متقدم", 5: "ريادي" };
function extractBeneficiaries(s: string | null | undefined): number {
  if (!s) return 0;
  const nums = String(s).replace(/,/g, "").match(/\d{2,}/g);
  if (!nums) return 0;
  return nums.reduce((a, b) => a + Number(b), 0);
}
// الأرقام دائماً غربية (المحور 5) — نستخدم helpers من oid-formatting
const fmtBudget = (n: number) => fmtBudgetWestern(n);
const fmtNum = (n: number) => formatCount(n);

function DashboardSection() {
  const [orgFilter, setOrgFilter] = useState<"all" | OrgId>("all");
  const radarData = GAP_AXES.map((axis, i) => {
    const row: any = { axis };
    ORGS.forEach((o) => { row[o.id] = gapScores[o.id][i] ?? 0; });
    return row;
  });

  const stats = useMemo(() => {
    const list = orgFilter === "all" ? institutions : institutions.filter((i) => i.id === orgFilter);
    const scoreList = orgFilter === "all" ? orgOverallScores : orgOverallScores.filter((s) => s.id === orgFilter);
    const staff = list.reduce((sum, i) => sum + (i.staff?.total ?? 0), 0);
    const budget = list.reduce((sum, i) => sum + (i.budget ?? 0), 0);
    const beneficiaries = list.reduce((sum, i) => sum + extractBeneficiaries(i.branches), 0);
    const scored = scoreList.filter((s) => s.score != null);
    const avgScore = scored.length ? scored.reduce((a, s) => a + (s.score as number), 0) / scored.length : null;
    const matured = scoreList.filter((s) => s.maturity != null);
    const avgMaturity = matured.length ? Math.round(matured.reduce((a, s) => a + (s.maturity as number), 0) / matured.length) : null;
    return {
      orgsCount: orgFilter === "all" ? ORGS.length : 1,
      orgsSub: orgFilter === "all" ? "مؤسسات رئيسية" : (ORGS.find((o) => o.id === orgFilter)?.nameAr ?? ""),
      staff, budget, beneficiaries, avgScore, avgMaturity,
    };
  }, [orgFilter]);

  return (
    <div className="space-y-6">
      <SectionTitle title="لوحة القيادة الرئيسية" subtitle="نظرة استراتيجية فورية على حال الشبكة" />

      <div className="flex items-center justify-end gap-2">
        <span className="text-sm text-muted-foreground">فلترة حسب المؤسسة:</span>
        <select
          value={orgFilter}
          onChange={(e) => setOrgFilter(e.target.value as "all" | OrgId)}
          className="border rounded-md px-3 py-1.5 text-sm bg-card"
        >
          <option value="all">كل المؤسسات</option>
          {ORGS.map((o) => (
            <option key={o.id} value={o.id}>{o.nameAr}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="مؤسسات الشبكة" value={String(stats.orgsCount)} sub={stats.orgsSub} icon={Building2} accent="#1d4ed8" />
        <StatCard label="إجمالي الموظفين" value={stats.staff ? `${fmtNum(stats.staff)}+` : "—"} sub={orgFilter === "all" ? "عبر الشبكة" : "في المؤسسة"} icon={Users} accent="#15803d" />
        <StatCard label="إجمالي المستفيدين" value={stats.beneficiaries ? `${fmtNum(stats.beneficiaries)}+` : "—"} sub="مستفيد مباشر" icon={Heart} accent="#10b986" />
        <StatCard label="الميزانية الإجمالية" value={fmtBudget(stats.budget)} sub="إجمالي 2026" icon={Coins} accent="#7c3aed" />
        <StatCard label="متوسط الأداء" value={stats.avgScore != null ? `${formatScore(stats.avgScore)} / 5` : "—"} sub={stats.avgMaturity ? `↑ ${MATURITY_OF_LEVEL[stats.avgMaturity]}` : "—"} icon={TrendingUp} accent="#d97706" />
        <StatCard label="مستوى النضج" value={stats.avgMaturity ? MATURITY_OF_LEVEL[stats.avgMaturity] : "—"} sub={stats.avgMaturity ? `المستوى ${stats.avgMaturity}` : "—"} icon={BarChart3} accent="#2e9bd4" />
        <StatCard label="مؤشرات الأداء الفاعلة" value="80+" sub="KPIs نشطة" icon={Target} accent="#15803d" />
        <StatCard label="الشراكات الفاعلة" value="13+" sub="شراكات استراتيجية" icon={Handshake} accent="#0e4d2e" />
      </div>

      <BSCPerformanceMap />

      {/* المحور 1: الدرجة المركّبة لكل مؤسسة (4 مصادر بأوزان) */}
      <Card>
        <CardHeader
          title="الدرجة المركّبة للمؤسسات"
          subtitle="تجمع 4 مصادر: الفجوات 35% • الحوكمة 25% • مؤشرات الأداء 25% • المالي 15%"
        />
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {ORGS
              .filter((o) => orgFilter === "all" || o.id === orgFilter)
              .map((o) => (
                <CompositeScoreCard key={o.id} orgId={o.id} />
              ))}
          </div>
          <div className="flex items-center justify-between pt-3 border-t border-border flex-wrap gap-3">
            <DataStateLegend />
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
              <span className="font-medium">مقياس النضج:</span>
              {MATURITY_SCALE.map((m) => (
                <span
                  key={m.level}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded"
                  style={{ background: m.bg, color: m.color }}
                  title={m.description}
                >
                  {m.level} — {m.labelAr}
                </span>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* المحور 4: الشذوذات والتناقضات */}
      <Card>
        <CardHeader
          title="الشذوذات والتنبيهات الذكية"
          subtitle="كشف تلقائي للتناقضات والاختلالات بين المكوّنات الأربعة"
        />
        <div className="p-5">
          <AnomaliesPanel orgFilter={orgFilter} />
        </div>
      </Card>



      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader title="خريطة الأداء عبر المحاور السبعة" subtitle="مقارنة المؤسسات على Radar Chart" />
          <div className="p-4 h-[380px]">
            <ResponsiveContainer>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#e0e8f0" />
                <PolarAngleAxis dataKey="axis" tick={{ fontSize: 11, fill: "#4a6070" }} />
                <PolarRadiusAxis angle={90} domain={[0, 5]} tick={{ fontSize: 10 }} />
                {ORGS.map((o) => (
                  <Radar key={o.id} name={o.nameAr} dataKey={o.id} stroke={o.color} fill={o.color} fillOpacity={0.08}
                    strokeDasharray={o.id === "HAMDI" ? "4 4" : undefined} />
                ))}
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="ترتيب المؤسسات حسب الأداء العام" />
          <div className="p-5 space-y-4">
            {orgOverallScores.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => openOrgProfile(o.id as OrgId)}
                className="w-full text-right hover:bg-muted/30 rounded-md px-2 py-1 -mx-2 transition"
                title="افتح الملف التفصيلي"
              >
                <div className="flex items-center justify-between mb-1.5 text-sm">
                  <span className="font-medium">{o.name}</span>
                  <span className="tabular-nums font-bold" style={{ color: o.color }}>
                    {o.score !== null ? o.score.toFixed(2) : "—"}
                    {o.maturity && <span className="text-xs text-muted-foreground font-normal mr-2">({MATURITY_LABELS[o.maturity]})</span>}
                  </span>
                </div>
                <Progress value={o.score ? (o.score / 5) * 100 : 0} color={o.color} />
              </button>
            ))}
          </div>
        </Card>
      </div>




      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader title="لوحة التنبيهات" subtitle="أبرز الأحداث الحرجة عبر الشبكة" />
          <div className="p-5 space-y-2">
            {alerts.map((a, i) => {
              const styles: any = {
                danger: { bg: "bg-red-50", border: "border-red-200", text: "text-red-700", icon: XCircle },
                warning: { bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-700", icon: AlertTriangle },
                success: { bg: "bg-green-50", border: "border-green-200", text: "text-green-700", icon: CheckCircle2 },
              }[a.level];
              const Ic = styles.icon;
              return (
                <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${styles.bg} ${styles.border}`}>
                  <Ic size={18} className={styles.text} />
                  <div className="flex-1">
                    <div className={`text-sm font-medium ${styles.text}`}>{a.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{a.action}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <CardHeader title="ملخص الحوكمة السريع" />
          <div className="p-5 grid grid-cols-2 gap-3">
            {orgOverallScores.map((o) => (
              <div key={o.id} className="border border-border rounded-lg p-3 text-center">
                <div className="text-xs text-muted-foreground mb-1 truncate">{o.name}</div>
                <div className="text-xl font-bold tabular-nums" style={{ color: o.color }}>
                  {o.govPct !== null ? `${o.govPct}%` : "—"}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
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

/* ============================== KPIs (live from DB) ============================== */
function KPIsSection() {
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



  const fmtPct = (v: number | null | undefined) => {
    if (v === null || v === undefined) return "—";
    const n = Number(v);
    if (!Number.isFinite(n)) return "—";
    return `${Math.round(n <= 1 ? n * 100 : n)}%`;
  };
  const fmtNum = (v: number | null | undefined) => (v === null || v === undefined ? "—" : String(v));

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
                {["الكود","المؤسسة","المنظور","الهدف","المؤشر","النوع","الوزن","خط الأساس","المستهدف","Q1","Q2","Q3","Q4","المنجز","% الإنجاز"].map(h => (
                  <th key={h} className="px-3 py-2 text-right font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={15} className="px-3 py-6 text-center text-muted-foreground">جاري التحميل…</td></tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={15} className="px-3 py-6 text-center text-muted-foreground">لا توجد بيانات — ارفع ملف Excel من قسم "رفع البيانات".</td></tr>
              )}
              {filtered.map(k => (
                <tr key={k.id} className="border-t border-border hover:bg-muted/20">
                  <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{k.kpi_code}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{k.entity_code}</td>
                  <td className="px-3 py-2 whitespace-nowrap" title={k.sector ?? ""}>{k.perspective}</td>
                  <td className="px-3 py-2 max-w-[220px]">{k.objective ?? "—"}</td>
                  <td className="px-3 py-2 max-w-[280px]">{k.kpi_name}</td>
                  <td className="px-3 py-2 text-xs whitespace-nowrap">{k.kpi_type ?? "—"}</td>
                  <td className="px-3 py-2 tabular-nums text-xs">{fmtPct(k.weight)}</td>
                  <td className="px-3 py-2 tabular-nums text-xs">{fmtNum(k.baseline)}</td>
                  <td className="px-3 py-2 tabular-nums text-xs font-medium">{fmtNum(k.annual_target)}</td>
                  <td className="px-3 py-2 tabular-nums text-xs">{fmtNum(k.q1_actual)}</td>
                  <td className="px-3 py-2 tabular-nums text-xs">{fmtNum(k.q2_actual)}</td>
                  <td className="px-3 py-2 tabular-nums text-xs">{fmtNum(k.q3_actual)}</td>
                  <td className="px-3 py-2 tabular-nums text-xs">{fmtNum(k.q4_actual)}</td>
                  <td className="px-3 py-2 tabular-nums text-xs">{fmtNum(k.total_actual)}</td>
                  <td className="px-3 py-2 min-w-[120px]">
                    <div className="flex items-center gap-2">
                      <Progress value={Math.min(100, Math.round((Number(k.achievement_pct ?? 0) <= 1 ? Number(k.achievement_pct ?? 0) * 100 : Number(k.achievement_pct ?? 0))))} />
                      <span className="text-xs tabular-nums w-10">{fmtPct(k.achievement_pct)}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollableTable>
      </Card>
    </div>
  );
}

function Select({ value, onChange, options, label }: any) {
  return (
    <label className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <select value={value} onChange={(e)=>onChange(e.target.value)} className="px-2 py-1.5 rounded-md bg-muted border border-border text-sm focus:outline-none">
        {options.map((o: string) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}
function OrgChip({ id }: { id: OrgId }) {
  const o = ORGS.find(x => x.id === id);
  if (!o) return <span>{id}</span>;
  return <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full" style={{ background: `${o.color}15`, color: o.color }}>
    <OrgLogo orgId={id} size={16} shape="circle" />{o.abbr}
  </span>;
}
function CircularProgress({ value, color }: { value: number; color: string }) {
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

/* ============================ QUARTERLY ============================ */
function QuarterlySection() {
  const [tab, setTab] = useState<"ach"|"ch"|"rec">("ach");
  const [filters, setFilters] = useState({ org: "all", quarter: "all", year: "2026" });
  const update = (k: keyof typeof filters, v: string) => setFilters((p) => ({ ...p, [k]: v }));
  const reset = () => setFilters({ org: "all", quarter: "all", year: "2026" });

  // q1Data يعكس حالياً Q1/2026 فقط — نطبّق الفلاتر بمنطق AND حقيقي
  const filtered = useMemo(() => {
    return q1Data.filter((r) => {
      const matchOrg = filters.org === "all" || r.org === filters.org;
      const matchQ = filters.quarter === "all" || filters.quarter === "Q1";
      const matchY = filters.year === "all" || filters.year === "2026";
      return matchOrg && matchQ && matchY;
    });
  }, [filters]);

  const hasActive = filters.org !== "all" || filters.quarter !== "all" || filters.year !== "2026";
  const orgOpts = [{ value: "all", label: "جميع المؤسسات" }, ...ORGS.map((o) => ({ value: o.id, label: o.nameAr }))];
  const qOpts = [
    { value: "all", label: "جميع الأرباع" },
    { value: "Q1", label: "الربع الأول" }, { value: "Q2", label: "الربع الثاني" },
    { value: "Q3", label: "الربع الثالث" }, { value: "Q4", label: "الربع الرابع" },
  ];
  const yOpts = [{ value: "all", label: "جميع السنوات" }, { value: "2026", label: "2026" }, { value: "2025", label: "2025" }];

  return (
    <div className="space-y-6">
      <SectionTitle title="التقارير الربعية" subtitle="Q1 — 2026" />
      <Card className="p-3 flex flex-wrap items-center gap-3">
        <FilterSelect label="المؤسسة" value={filters.org} onChange={(v)=>update("org", v)} options={orgOpts} />
        <FilterSelect label="الربع" value={filters.quarter} onChange={(v)=>update("quarter", v)} options={qOpts} />
        <FilterSelect label="السنة" value={filters.year} onChange={(v)=>update("year", v)} options={yOpts} />
        {hasActive && (
          <button onClick={reset} className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted">↺ إعادة ضبط</button>
        )}
        <div className="ml-auto flex gap-2">
          <button className="text-xs flex items-center gap-1 px-3 py-1.5 rounded-md bg-primary text-primary-foreground"><Download size={14}/> PDF</button>
          <button className="text-xs flex items-center gap-1 px-3 py-1.5 rounded-md bg-secondary text-secondary-foreground"><Download size={14}/> Excel</button>
        </div>
      </Card>

      <div className="text-xs text-muted-foreground">
        عرض <span className="font-bold tabular-nums" dir="ltr">{filtered.length}</span> من{" "}
        <span className="tabular-nums" dir="ltr">{q1Data.length}</span> سجل
      </div>

      <div className="flex gap-2 border-b border-border">
        {[["ach","الإنجازات والمشاريع"],["ch","التحديات والعوائق"],["rec","التوصيات"]].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k as any)} className={`px-4 py-2 text-sm border-b-2 transition ${tab===k?"border-primary text-primary font-medium":"border-transparent text-muted-foreground hover:text-foreground"}`}>{l}</button>
        ))}
      </div>

      {tab === "ach" && (
        filtered.length === 0 ? (
          <Card className="p-8 text-center space-y-3">
            <EmptyData msg="لا توجد سجلات مطابقة لهذا الفلتر" />
            <button onClick={reset} className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted">↺ إعادة ضبط الفلاتر</button>
          </Card>
        ) : (
        <Card>
          <ScrollableTable>
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>{["م","الإنجاز/المشروع","كود المؤشر","المؤسسة","المستهدف","المنفذ","% الإنجاز","المستفيدون","الموازنة","التكلفة","الانحراف"].map(h=><th key={h} className="px-3 py-2 text-right font-medium whitespace-nowrap">{h}</th>)}</tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} className="border-t border-border hover:bg-muted/20">
                    <td className="px-3 py-2 tabular-nums">{r.id}</td>
                    <td className="px-3 py-2">{r.title}</td>
                    <td className="px-3 py-2"><span className="font-mono text-xs text-primary hover:underline cursor-pointer">{r.kpiCode}</span></td>
                    <td className="px-3 py-2"><OrgChip id={r.org as OrgId} /></td>
                    <td className="px-3 py-2 text-xs">{r.target}</td>
                    <td className="px-3 py-2 text-xs">{r.done}</td>
                    <td className="px-3 py-2 min-w-[120px]"><div className="flex items-center gap-2"><Progress value={r.pct} /><span className="text-xs tabular-nums">{r.pct}%</span></div></td>
                    <td className="px-3 py-2 text-xs">{r.beneficiaries}</td>
                    <td className="px-3 py-2 tabular-nums text-xs">{r.budget ? `$${r.budget}` : "—"}</td>
                    <td className="px-3 py-2 tabular-nums text-xs">{r.cost ? `$${r.cost}` : "—"}</td>
                    <td className="px-3 py-2">
                      {r.deviation === 0 ? <span className="text-xs text-gray-500">—</span>
                        : <span className={`text-xs px-2 py-0.5 rounded-full ${r.deviation > 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{r.deviation > 0 ? `+$${r.deviation}` : `-$${Math.abs(r.deviation)}`}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollableTable>
        </Card>
        )
      )}
      {tab === "ch" && <Card className="p-8"><EmptyData msg="سيتم إدراج التحديات الربعية عند استكمال التقارير" /></Card>}
      {tab === "rec" && <Card className="p-8"><EmptyData msg="سيتم إدراج التوصيات المعتمدة قريباً" /></Card>}
    </div>
  );
}

/** قائمة منسدلة موحّدة لشريط الفلاتر — value/label منفصلان لدعم "الكل". */
function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string)=>void; options: { value: string; label: string }[] }) {
  return (
    <label className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <select value={value} onChange={(e)=>onChange(e.target.value)} className="px-2 py-1.5 rounded-md bg-muted border border-border text-sm focus:outline-none">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

/* ============================ GAPS ============================ */
function GapsSection() {
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
    ORGS.forEach((o) => { row[o.id] = gapScores[o.id][i] ?? 0; });
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
                  {gapScores[o.id].map((v, i) => (
                    <td key={i} className="px-2 py-2 text-center">
                      <span className={`inline-block w-14 py-1 rounded text-xs font-semibold tabular-nums ${heatColor(v)}`}>{v !== null ? v.toFixed(2) : "—"}</span>
                    </td>
                  ))}
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

/* ============================ GOVERNANCE ============================ */
function GovernanceSection() {
  const [cat, setCat] = useState<"all"|"general"|"university"|"humanitarian"|"education">("general");
  const data = useMemo(() => {
    if (cat === "general") return generalPolicies;
    if (cat === "university") return universityPolicies;
    if (cat === "humanitarian") return humanitarianPolicies;
    if (cat === "education") return educationPolicies;
    return [...generalPolicies, ...universityPolicies, ...humanitarianPolicies, ...educationPolicies];
  }, [cat]);

  const stackedData = ORGS.map(o => {
    const counts: any = { org: o.abbr, active: 0, inactive: 0, review: 0, inDev: 0, missing: 0, pending: 0 };
    [...generalPolicies, ...universityPolicies, ...humanitarianPolicies, ...educationPolicies].forEach(p => {
      const s = p.values[o.id];
      if (s) counts[s]++;
    });
    return counts;
  });

  return (
    <div className="space-y-6">
      <SectionTitle title="الحوكمة والامتثال" subtitle="حالة السياسات والوثائق المؤسسية" />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {orgOverallScores.map(o => (
          <Card key={o.id} className="p-4 text-center">
            <div className="text-xs text-muted-foreground mb-2 truncate">{o.name}</div>
            <div className="text-3xl font-bold tabular-nums mb-1" style={{ color: o.color }}>{o.govPct !== null ? `${o.govPct}%` : "—"}</div>
            <div className="text-[11px] text-muted-foreground">
              {o.govPct === null ? "بيانات ناقصة" :
               o.govPct >= 80 ? "ممتاز ⭐⭐⭐" :
               o.govPct >= 60 ? "جيد ⭐⭐" :
               o.govPct >= 40 ? "متوسط ⭐" : "ضعيف"}
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader title="توزيع السياسات حسب الحالة (Stacked)" />
        <div className="p-4 h-[280px]">
          <ResponsiveContainer>
            <BarChart data={stackedData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e8f0" />
              <XAxis dataKey="org" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="active" stackId="a" fill="#16a34a" name="مفعّل" />
              <Bar dataKey="inactive" stackId="a" fill="#2563eb" name="غير مفعّل" />
              <Bar dataKey="review" stackId="a" fill="#d97706" name="بحاجة تحديث" />
              <Bar dataKey="inDev" stackId="a" fill="#ea580c" name="قيد الإعداد" />
              <Bar dataKey="missing" stackId="a" fill="#dc2626" name="غير موجود" />
              <Bar dataKey="pending" stackId="a" fill="#94a3b8" name="بيانات ناقصة" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <CardHeader title="جدول السياسات التفصيلي" action={
          <div className="flex gap-2">
            {[["general","عامة"],["university","جامعية"],["humanitarian","إنسانية"],["education","تعليمية"],["all","الكل"]].map(([k,l])=>(
              <button key={k} onClick={()=>setCat(k as any)} className={`text-xs px-3 py-1 rounded-md border ${cat===k?"bg-primary text-primary-foreground border-primary":"border-border text-muted-foreground hover:bg-muted"}`}>{l}</button>
            ))}
          </div>
        } />
        <ScrollableTable>
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-right font-medium">الكود</th>
                <th className="px-3 py-2 text-right font-medium">السياسة</th>
                {ORGS.map(o => <th key={o.id} className="px-3 py-2 font-medium">{o.abbr}</th>)}
              </tr>
            </thead>
            <tbody>
              {data.map(p => (
                <tr key={p.id} className="border-t border-border">
                  <td className="px-3 py-2 font-mono text-xs">{p.id}</td>
                  <td className="px-3 py-2">{p.name}</td>
                  {ORGS.map(o => {
                    const s = p.values[o.id];
                    if (!s) return <td key={o.id} className="px-2 py-2 text-center text-gray-300">·</td>;
                    const meta = POLICY_STATUS_META[s];
                    return <td key={o.id} className={`px-2 py-2 text-center text-xs ${meta.bg} ${meta.fg}`} title={meta.label}>{meta.icon}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollableTable>
        <div className="flex flex-wrap gap-3 p-4 border-t border-border text-xs">
          {(Object.entries(POLICY_STATUS_META) as [PolicyStatus, any][]).map(([k, m]) => (
            <span key={k} className={`px-2 py-1 rounded ${m.bg} ${m.fg}`}>{m.icon} {m.label}</span>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ============================ FINANCIAL ============================ */
function FinancialSection() {
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(Object.entries(financialAssessment) as ["ZUST"|"ZAD"|"TAYO", any][]).map(([id, a]) => {
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
                  </div>
                </Card>
              );
            })}
          </div>

          <Card>
            <CardHeader title="التقييم التفصيلي والتوصيات" />
            <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-5">
              {(Object.entries(financialAssessment) as ["ZUST"|"ZAD"|"TAYO", any][]).map(([id, a]) => {
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
                        {a.weaknesses.map((s: string, i: number) => <li key={i}>• {s}</li>)}
                      </ul>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-blue-700 mb-1">💡 التوصيات</div>
                      <ul className="text-xs space-y-1 text-muted-foreground">
                        {a.recommendations.map((s: string, i: number) => <li key={i}>• {s}</li>)}
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {(Object.entries(financialProgram) as ["ZUST"|"ZAD"|"TAYO", any[]][]).map(([id, rows]) => {
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
                    return (
                      <div key={i} className="border border-border rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">{r.domain}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${m.color}`}>{m.label}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">{r.note}</div>
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
            {financialTimeline.map((m, i) => (
              <div key={i} className="flex-1 text-center min-w-[120px]">
                <div className={`mx-auto mb-2 w-12 h-12 rounded-full flex items-center justify-center text-2xl ${m.done?"bg-green-100":"bg-blue-100"}`}>
                  {m.done ? "✅" : "🔄"}
                </div>
                <div className="text-xs font-bold">{m.period}</div>
                <div className="text-xs text-muted-foreground mt-1">{m.title}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

/* ============================ PARTNERSHIPS ============================ */
function PartnershipsSection() {
  const [filters, setFilters] = useState({ type: "all", status: "all", geography: "all", org: "all" });
  const [sortBy, setSortBy] = useState<"name"|"type"|"status">("name");
  const [view, setView] = useState<"table"|"cards">("table");
  const update = (k: keyof typeof filters, v: string) => setFilters((p) => ({ ...p, [k]: v }));
  const reset = () => setFilters({ type: "all", status: "all", geography: "all", org: "all" });

  const uniq = <T,>(arr: T[]) => Array.from(new Set(arr));
  const typeOpts = useMemo(() => [{ value: "all", label: "جميع الأنواع" }, ...uniq(partnerships.map(p=>p.type)).map(t=>({value:t,label:t}))], []);
  const statusOpts = useMemo(() => [{ value: "all", label: "جميع الحالات" }, ...uniq(partnerships.map(p=>p.status)).map(t=>({value:t,label:t}))], []);
  const geoOpts = useMemo(() => [{ value: "all", label: "جميع المناطق" }, ...uniq(partnerships.map(p=>p.geography)).map(t=>({value:t,label:t}))], []);
  const orgOpts = [{ value: "all", label: "جميع المؤسسات" }, ...ORGS.map(o => ({ value: o.id, label: o.nameAr }))];

  const filtered = useMemo(() => {
    const out = partnerships.filter(p =>
      (filters.type === "all" || p.type === filters.type) &&
      (filters.status === "all" || p.status === filters.status) &&
      (filters.geography === "all" || p.geography === filters.geography) &&
      (filters.org === "all" || p.linkedOrgs.includes(filters.org))
    );
    out.sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name, "ar");
      if (sortBy === "type") return a.type.localeCompare(b.type, "ar");
      return a.status.localeCompare(b.status, "ar");
    });
    return out;
  }, [filters, sortBy]);

  const byGeo = useMemo(() => {
    const m: Record<string, number> = {};
    filtered.forEach(p => { m[p.geography] = (m[p.geography] || 0) + 1; });
    return Object.entries(m).map(([name, value]) => ({ name, value }));
  }, [filtered]);
  const byType = useMemo(() => {
    const m: Record<string, number> = {};
    filtered.forEach(p => { m[p.type] = (m[p.type] || 0) + 1; });
    return Object.entries(m).map(([name, value]) => ({ name, value }));
  }, [filtered]);
  const colors = ["#0e4d2e","#1558a0","#2e9bd4","#d97706","#10b986","#7c3aed"];
  const hasActive = filters.type !== "all" || filters.status !== "all" || filters.geography !== "all" || filters.org !== "all";

  return (
    <div className="space-y-6">
      <SectionTitle title="الشراكات الاستراتيجية" subtitle={`إجمالي ${partnerships.length} شراكة`} />

      {/* شريط الفلاتر والترتيب والعرض */}
      <Card className="p-3 flex flex-wrap items-center gap-3">
        <FilterSelect label="النوع" value={filters.type} onChange={(v)=>update("type", v)} options={typeOpts} />
        <FilterSelect label="الحالة" value={filters.status} onChange={(v)=>update("status", v)} options={statusOpts} />
        <FilterSelect label="الجغرافيا" value={filters.geography} onChange={(v)=>update("geography", v)} options={geoOpts} />
        <FilterSelect label="المؤسسة" value={filters.org} onChange={(v)=>update("org", v)} options={orgOpts} />
        <div className="h-6 w-px bg-border mx-1" />
        <FilterSelect label="ترتيب" value={sortBy} onChange={(v)=>setSortBy(v as any)} options={[
          { value: "name", label: "الاسم (أبجدي)" },
          { value: "type", label: "النوع" },
          { value: "status", label: "الحالة" },
        ]} />
        <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
          <button onClick={()=>setView("table")} className={`text-xs px-2 py-1 rounded ${view==="table"?"bg-primary text-primary-foreground":"hover:bg-muted"}`} title="عرض جدولي">☰</button>
          <button onClick={()=>setView("cards")} className={`text-xs px-2 py-1 rounded ${view==="cards"?"bg-primary text-primary-foreground":"hover:bg-muted"}`} title="عرض بطاقات">▦</button>
        </div>
        {hasActive && (
          <button onClick={reset} className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted">↺ إعادة ضبط</button>
        )}
        <div className="ml-auto text-xs text-muted-foreground">
          عرض <span className="font-bold tabular-nums" dir="ltr">{filtered.length}</span> من{" "}
          <span className="tabular-nums" dir="ltr">{partnerships.length}</span> شراكة
        </div>
      </Card>

      {/* إحصاءات تتفاعل مع الفلتر */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-5">
          <div className="text-xs text-muted-foreground mb-1">الشراكات المعروضة</div>
          <div className="text-4xl font-bold text-primary tabular-nums">{filtered.length}</div>
          <div className="text-xs text-muted-foreground mt-2">{hasActive ? "حسب الفلتر النشط" : "إجمالي القاعدة"}</div>
        </Card>
        <Card>
          <CardHeader title="التوزيع الجغرافي" />
          <div className="p-4 h-[220px]">
            {byGeo.length === 0 ? <EmptyData msg="لا بيانات" /> : (
            <ResponsiveContainer>
              <PieChart>
                <Pie data={byGeo} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={{ fontSize: 10 }}>
                  {byGeo.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
            )}
          </div>
        </Card>
        <Card>
          <CardHeader title="التوزيع حسب النوع" />
          <div className="p-4 h-[220px]">
            {byType.length === 0 ? <EmptyData msg="لا بيانات" /> : (
            <ResponsiveContainer>
              <BarChart data={byType} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={90} />
                <Tooltip />
                <Bar dataKey="value" fill="#1558a0" radius={4} />
              </BarChart>
            </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-8 text-center space-y-3">
          <EmptyData msg="لا توجد شراكات مطابقة لهذا الفلتر" />
          <button onClick={reset} className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted">↺ إعادة ضبط الفلاتر</button>
        </Card>
      ) : view === "table" ? (
        <Card>
          <CardHeader title="جدول الشراكات" />
          <ScrollableTable>
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>{["الكود","الشريك","النوع","الحالة","الجغرافيا","المؤسسات المرتبطة"].map(h=><th key={h} className="px-3 py-2 text-right font-medium whitespace-nowrap">{h}</th>)}</tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id} className="border-t border-border hover:bg-muted/20">
                    <td className="px-3 py-2 font-mono text-xs">{p.id}</td>
                    <td className="px-3 py-2 font-medium">{p.name}</td>
                    <td className="px-3 py-2 text-xs">{p.type}</td>
                    <td className="px-3 py-2"><span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">{p.status}</span></td>
                    <td className="px-3 py-2 text-xs">{p.geography}</td>
                    <td className="px-3 py-2"><div className="flex gap-1">{p.linkedOrgs.map(o => <OrgChip key={o} id={o as OrgId} />)}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollableTable>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(p => (
            <Card key={p.id} className="p-4 hover:shadow-md transition">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[10px] text-muted-foreground">{p.id}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700">{p.status}</span>
              </div>
              <div className="font-bold text-sm mb-2 leading-tight">{p.name}</div>
              <div className="text-xs text-muted-foreground mb-3">{p.type} • {p.geography}</div>
              <div className="flex flex-wrap gap-1">{p.linkedOrgs.map(o => <OrgChip key={o} id={o as OrgId} />)}</div>
            </Card>
          ))}
        </div>
      )}

      <Card className="p-5 bg-yellow-50 border-yellow-200">
        <div className="flex gap-3">
          <AlertTriangle className="text-warning shrink-0" size={20} />
          <div>
            <div className="font-bold text-sm mb-1">المكتب في مرحلة بناء منهجية الشراكات</div>
            <div className="text-xs text-muted-foreground">الخطوات المقترحة: إعداد قوالب رسمية (يونيو 2026) ← تحديث البيانات ← وضع معايير التقييم ← إطلاق خطة الشراكات 2026-2027</div>
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ============================ PROFILES ============================ */
function ProfilesSection() {
  return (
    <div className="space-y-6">
      <SectionTitle title="البيانات المؤسسية" subtitle="بطاقات تعريف الكيانات الست" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {institutions.map(o => (
          <Card key={o.id} className="p-5 hover:shadow-md hover:border-primary/40 transition cursor-pointer" >
            <div onClick={() => openOrgProfile(o.id as OrgId)} role="button" tabIndex={0}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && openOrgProfile(o.id as OrgId)}>
            <div className="flex items-start gap-3 mb-4">
              <OrgLogo orgId={o.id as OrgId} size={56} shape="rounded" />
              <div className="flex-1 min-w-0">
                <div className="font-bold leading-tight">{o.nameAr}</div>
                <div className="text-xs text-muted-foreground font-serif">{o.nameEn}</div>
              </div>
            </div>
            <div className="text-xs text-muted-foreground mb-3">{o.sector}</div>
            <dl className="space-y-1.5 text-xs">
              <Row k="التأسيس" v={o.founded} />
              <Row k="الترخيص" v={o.license} />
              <Row k="الصلاحية" v={o.licenseExpiry} />
              <Row k="المدير التنفيذي" v={o.execAr} />
              <Row k="الموظفون" v={o.staff.total ? `${o.staff.total}` : null} />
              <Row k="الميزانية" v={o.budget ? `$${o.budget.toLocaleString()}` : null} />
              <Row k="الفروع" v={o.branches} />
            </dl>
            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border">
              <span className="text-xs">الأداء:</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: `${o.color}15`, color: o.color }}>
                {o.score !== null ? o.score.toFixed(2) : "—"}
              </span>
              <span className="text-xs ml-1">الحوكمة:</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-muted">{o.govScore !== null ? `${o.govScore.toFixed(2)}` : "—"}</span>
            </div>
            {o.alerts && o.alerts.length > 0 && (
              <div className="mt-3 space-y-1">
                {o.alerts.map((a, i) => <div key={i} className="text-xs p-2 rounded bg-red-50 text-red-700 border border-red-200">{a}</div>)}
              </div>
            )}
            {(o as any).dataStatus === "pending" && <div className="mt-3"><EmptyData msg="بعض البيانات قيد الاستكمال" /></div>}
            </div>
            <button onClick={() => openOrgProfile(o.id as OrgId)} className="mt-4 w-full text-xs flex items-center justify-center gap-1 py-2 rounded-md border border-border text-primary hover:bg-primary/5">التقرير التفصيلي <ChevronRight size={14} className="rotate-180" /></button>
          </Card>
        ))}
      </div>
    </div>
  );
}
function Row({ k, v }: { k: string; v: any }) {
  return (
    <div className="flex justify-between gap-2 border-b border-border/50 py-1">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="font-medium text-left">{v ?? <span className="text-gray-400">—</span>}</dd>
    </div>
  );
}

/* ============================ INITIATIVES ============================ */
type InitiativeStatus = "مقترح" | "قيد التنفيذ" | "مكتمل";
const INITIATIVE_STATUSES: InitiativeStatus[] = ["مقترح", "قيد التنفيذ", "مكتمل"];
const INITIATIVE_PRIORITIES = ["حرج", "عالٍ", "متوسط", "منخفض", "جارٍ"] as const;

function InitiativesSection() {
  const { isEditor } = useAuth();
  const qc = useQueryClient();
  const listFn = useServerFn(listInitiatives);
  const upsertFn = useServerFn(upsertInitiative);
  const deleteFn = useServerFn(deleteInitiative);
  const statusFn = useServerFn(updateInitiativeStatus);
  const autoFn = useServerFn(autoGenerateInitiatives);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["initiatives"],
    queryFn: () => listFn(),
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Initiative | null>(null);

  function openCreate() { setEditing(null); setDialogOpen(true); }
  function openEdit(i: Initiative) { setEditing(i); setDialogOpen(true); }

  async function handleSave(payload: any) {
    try {
      await upsertFn({ data: payload });
      toast.success(editing ? "تم تحديث المبادرة" : "تمت إضافة المبادرة");
      setDialogOpen(false);
      qc.invalidateQueries({ queryKey: ["initiatives"] });
    } catch (e: any) {
      toast.error(e?.message ?? "تعذر الحفظ");
    }
  }
  async function handleDelete(id: string) {
    if (!confirm("حذف هذه المبادرة؟")) return;
    try {
      await deleteFn({ data: { id } });
      toast.success("تم الحذف");
      qc.invalidateQueries({ queryKey: ["initiatives"] });
    } catch (e: any) { toast.error(e?.message ?? "تعذر الحذف"); }
  }
  async function handleStatusChange(id: string, status: InitiativeStatus) {
    const previous = qc.getQueryData<Initiative[]>(["initiatives"]) ?? [];
    const next = previous.map((r) => (r.id === id ? { ...r, status } : r));
    qc.setQueryData(["initiatives"], next);
    try {
      await statusFn({ data: { id, status } });
      toast.success("تم تحديث حالة المبادرة في قاعدة البيانات");
      qc.invalidateQueries({ queryKey: ["initiatives"] });
    } catch (e: any) {
      qc.setQueryData(["initiatives"], previous);
      toast.error(e?.message ?? "تعذر التحديث");
    }
  }
  async function handleAuto() {
    try {
      const res = await autoFn();
      toast.success(`تمت أتمتة ${res.inserted} مبادرة من الفجوات الحرجة`);
      qc.invalidateQueries({ queryKey: ["initiatives"] });
    } catch (e: any) { toast.error(e?.message ?? "تعذرت الأتمتة"); }
  }

  const cols: [InitiativeStatus, string][] = [["مقترح","#fef3c7"],["قيد التنفيذ","#dbeafe"],["مكتمل","#dcfce7"]];

  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<InitiativeStatus | null>(null);

  function onDragStart(e: React.DragEvent, id: string) {
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  }
  function onDragEnd() { setDragId(null); setDragOverCol(null); }
  function onDragOverCol(e: React.DragEvent, col: InitiativeStatus) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverCol !== col) setDragOverCol(col);
  }
  async function onDropCol(e: React.DragEvent, col: InitiativeStatus) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain") || dragId;
    setDragOverCol(null); setDragId(null);
    if (!id) return;
    const item = rows.find(r => r.id === id);
    if (!item || item.status === col) return;
    if (!isEditor) { toast.error("صلاحيات غير كافية لتغيير الحالة"); return; }
    await handleStatusChange(id, col);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <SectionTitle title="المبادرات التطويرية" subtitle="Kanban — اسحب البطاقة بين الأعمدة لتغيير الحالة" />
        {isEditor && (
          <div className="flex gap-2">
            <Button onClick={openCreate} className="gap-1.5">
              <Plus className="w-4 h-4" /> إضافة مبادرة
            </Button>
            <Button variant="outline" onClick={handleAuto} className="gap-1.5">
              <Sparkles className="w-4 h-4" /> أتمتة من الفجوات
            </Button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground text-center py-12">جارٍ التحميل…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {cols.map(([col, bg]) => {
            const items = rows.filter(i => i.status === col);
            const isOver = dragOverCol === col;
            return (
              <Card
                key={col}
                className={`overflow-hidden transition ${isOver ? "ring-2 ring-primary ring-offset-2" : ""}`}
                onDragOver={(e: React.DragEvent<HTMLDivElement>) => { if (isEditor) onDragOverCol(e, col); }}
                onDragLeave={() => setDragOverCol(prev => prev === col ? null : prev)}
                onDrop={(e: React.DragEvent<HTMLDivElement>) => onDropCol(e, col)}
              >
                <div className="px-4 py-3 border-b border-border flex items-center justify-between" style={{ background: bg }}>
                  <span className="font-bold text-sm">{col}</span>
                  <span className="text-xs bg-white/70 px-2 py-0.5 rounded-full font-bold">{items.length}</span>
                </div>
                <div className={`p-3 space-y-3 min-h-[300px] ${isOver ? "bg-primary/5" : ""}`}>
                  {items.map(i => (
                    <div
                      key={i.id}
                      draggable={isEditor}
                      onDragStart={(e) => onDragStart(e, i.id)}
                      onDragEnd={onDragEnd}
                      className={`border border-border rounded-lg p-3 bg-card hover:shadow-sm transition ${isEditor ? "cursor-grab active:cursor-grabbing" : ""} ${dragId === i.id ? "opacity-40" : ""}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-[10px] text-muted-foreground">{i.code ?? i.id.slice(0,8)}</span>
                        <div className="flex items-center gap-1">
                          {i.source === "auto" && <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">آلي</span>}
                          {i.source === "manual" && <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">يدوي</span>}
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${i.priority==="حرج"?"bg-red-100 text-red-700":i.priority==="عالٍ"?"bg-orange-100 text-orange-700":"bg-blue-100 text-blue-700"}`}>{i.priority}</span>
                        </div>
                      </div>
                      <div className="text-sm font-medium leading-tight mb-2">{i.title}</div>
                      {i.objective && <div className="text-xs text-muted-foreground mb-2">{i.objective}</div>}
                      <div className="flex flex-wrap gap-1 text-[10px] mb-2">
                        {i.domain && <span className="px-1.5 py-0.5 rounded bg-muted">{i.domain}</span>}
                        {i.timeline && <span className="px-1.5 py-0.5 rounded bg-muted">{i.timeline}</span>}
                        {i.orgs?.slice(0,3).map((o, idx) => <span key={idx} className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">{o}</span>)}
                      </div>
                      {i.cost && <div className="text-xs font-bold text-primary mb-2">{i.cost}</div>}
                      {isEditor && (
                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/50">
                          <select
                            value={i.status}
                            onChange={(e) => handleStatusChange(i.id, e.target.value as InitiativeStatus)}
                            className="text-[10px] border border-border rounded px-1.5 py-1 bg-background flex-1"
                          >
                            {INITIATIVE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                          <button onClick={() => openEdit(i)} className="p-1 hover:bg-muted rounded" title="تعديل">
                            <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                          <button onClick={() => handleDelete(i.id)} className="p-1 hover:bg-red-50 rounded" title="حذف">
                            <Trash2 className="w-3.5 h-3.5 text-red-600" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  {items.length === 0 && <div className="text-xs text-center text-muted-foreground py-8">{isOver ? "أفلت هنا" : "لا توجد عناصر"}</div>}
                </div>
              </Card>
            );
          })}
        </div>
      )}


      <InitiativeFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        onSave={handleSave}
      />
    </div>
  );
}

function InitiativeFormDialog({
  open, onOpenChange, editing, onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Initiative | null;
  onSave: (payload: any) => void;
}) {
  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");
  const [priority, setPriority] = useState<string>("متوسط");
  const [status, setStatus] = useState<InitiativeStatus>("مقترح");
  const [domain, setDomain] = useState("");
  const [objective, setObjective] = useState("");
  const [gap, setGap] = useState("");
  const [orgsStr, setOrgsStr] = useState("");
  const [timeline, setTimeline] = useState("");
  const [cost, setCost] = useState("");
  const [notes, setNotes] = useState("");

  // Reset on open
  const lastIdRef = useRef<string | null>(null);
  if (open && lastIdRef.current !== (editing?.id ?? "__new__")) {
    lastIdRef.current = editing?.id ?? "__new__";
    setTitle(editing?.title ?? "");
    setCode(editing?.code ?? "");
    setPriority(editing?.priority ?? "متوسط");
    setStatus((editing?.status as InitiativeStatus) ?? "مقترح");
    setDomain(editing?.domain ?? "");
    setObjective(editing?.objective ?? "");
    setGap(editing?.gap ?? "");
    setOrgsStr((editing?.orgs ?? []).join("، "));
    setTimeline(editing?.timeline ?? "");
    setCost(editing?.cost ?? "");
    setNotes(editing?.notes ?? "");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { toast.error("العنوان مطلوب"); return; }
    const orgs = orgsStr.split(/[،,]/).map(s => s.trim()).filter(Boolean);
    onSave({
      ...(editing?.id ? { id: editing.id } : {}),
      title: title.trim(),
      code: code.trim() || null,
      priority,
      status,
      domain: domain.trim() || null,
      objective: objective.trim() || null,
      gap: gap.trim() || null,
      orgs,
      timeline: timeline.trim() || null,
      cost: cost.trim() || null,
      notes: notes.trim() || null,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>{editing ? "تعديل مبادرة" : "إضافة مبادرة تطويرية"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label>العنوان *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>الكود (اختياري)</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} maxLength={50} placeholder="INI-009" />
            </div>
            <div>
              <Label>المجال</Label>
              <Input value={domain} onChange={(e) => setDomain(e.target.value)} maxLength={60} placeholder="حوكمة / مالي / تقني…" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>الأولوية</Label>
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full border border-input rounded-md px-3 py-2 bg-background text-sm">
                {INITIATIVE_PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <Label>الحالة</Label>
              <select value={status} onChange={(e) => setStatus(e.target.value as InitiativeStatus)} className="w-full border border-input rounded-md px-3 py-2 bg-background text-sm">
                {INITIATIVE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <Label>الهدف</Label>
            <Textarea value={objective} onChange={(e) => setObjective(e.target.value)} maxLength={500} rows={2} />
          </div>
          <div>
            <Label>الفجوة المستهدفة</Label>
            <Textarea value={gap} onChange={(e) => setGap(e.target.value)} maxLength={300} rows={2} />
          </div>
          <div>
            <Label>المؤسسات المستهدفة (مفصولة بفاصلة)</Label>
            <Input value={orgsStr} onChange={(e) => setOrgsStr(e.target.value)} placeholder="زاد، تيو، كافي…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>الجدول الزمني</Label>
              <Input value={timeline} onChange={(e) => setTimeline(e.target.value)} maxLength={80} placeholder="6 أشهر" />
            </div>
            <div>
              <Label>التكلفة التقديرية</Label>
              <Input value={cost} onChange={(e) => setCost(e.target.value)} maxLength={80} placeholder="$5,000-$10,000" />
            </div>
          </div>
          <div>
            <Label>ملاحظات</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} rows={2} />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
            <Button type="submit">{editing ? "حفظ التعديلات" : "إضافة"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}



/* ============================ UPLOAD ============================ */
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { parseUpload, reprocessUpload, processUpload, previewKpiUpload, deleteUploads } from "@/lib/uploads.functions";
import { getDocumentExtractions } from "@/lib/documents.functions";
import { listInitiatives, upsertInitiative, deleteInitiative, updateInitiativeStatus, autoGenerateInitiatives, type Initiative } from "@/lib/initiatives.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Plus, Sparkles, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useRef } from "react";

/* ============================ BSC Performance Map ============================ */
// مناظير BSC ومطابقة القطاعات تُستورد من src/lib/oid-bsc.ts (4 مناظير معيارية فقط).


function BSCPerformanceMap() {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["kpis"],
    queryFn: async () => {
      const { data, error } = await supabase.from("kpis").select("entity_code, entity_name, sector, achievement_pct, weight");
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 5000,
  });

  // قيد: لا تُعرض إلا المؤسسات الستّ المعتمدة (تجاهل أي كود غريب من رفع Excel سابق).
  const VALID_ORG_IDS = new Set(ORGS.map(o => o.id) as string[]);
  const cleanRows = rows.filter(r => r.entity_code && VALID_ORG_IDS.has(r.entity_code));

  const allOrgs = ORGS.map(o => ({ code: o.id as string, name: o.nameAr, color: o.color }));

  const [selected, setSelected] = useState<string[]>([]);
  const activeOrgs = selected.length ? selected : allOrgs.map(o => o.code);

  const colorFor = (code: string) => allOrgs.find(o => o.code === code)?.color ?? "#64748b";

  const toggle = (code: string) => setSelected(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]);

  // perspective → org → { avg, count }
  const matrix = BSC_PERSPECTIVES.map(p => {
    const orgStats = activeOrgs.map(code => {
      const items = cleanRows.filter(r => r.entity_code === code && matchPerspective(r.sector) === p.key);
      const vals = items.map(r => {
        const n = Number(r.achievement_pct ?? 0);
        return Number.isFinite(n) ? (n <= 1 ? n * 100 : n) : 0;
      });
      const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      return { code, name: allOrgs.find(o => o.code === code)?.name ?? code, count: items.length, avg: Math.round(avg) };
    });
    return { ...p, orgStats };
  });

  return (
    <Card>
      <CardHeader
        title="خريطة الأداء — بطاقة الأداء المتوازن (BSC)"
        subtitle="مقارنة المؤسسات عبر المناظير الأربعة لبطاقة الأداء المتوازن"
        action={
          <div className="flex items-center gap-1.5 flex-wrap justify-end max-w-md">
            <button
              onClick={() => setSelected([])}
              className={`text-xs px-2.5 py-1 rounded-full border transition ${selected.length === 0 ? "bg-primary text-primary-foreground border-primary" : "bg-muted border-border hover:bg-muted/70"}`}
            >الكل</button>
            {allOrgs.map(o => {
              const active = selected.includes(o.code);
              const c = colorFor(o.code);
              return (
                <button
                  key={o.code}
                  onClick={() => toggle(o.code)}
                  className="text-xs px-2.5 py-1 rounded-full border transition flex items-center gap-1.5"
                  style={ active
                    ? { background: c, color: "#fff", borderColor: c }
                    : { background: "transparent", color: c, borderColor: `${c}55` }
                  }
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: active ? "#fff" : c }} />
                  {o.name}
                </button>
              );
            })}
          </div>
        }
      />
      <div className="p-5">
        {isLoading ? (
          <div className="text-center text-sm text-muted-foreground py-8">جاري التحميل…</div>
        ) : allOrgs.length === 0 ? (
          <EmptyData msg="لا توجد بيانات KPIs بعد — ارفع ملفًا من قسم رفع البيانات." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {matrix.map((p) => (
              <div
                key={p.key}
                className="relative rounded-xl border border-border p-4 overflow-hidden"
                style={{ background: `linear-gradient(135deg, ${p.color}08, transparent 70%)` }}
              >
                <div className="absolute top-0 right-0 w-1 h-full" style={{ background: p.color }} />
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{p.icon}</span>
                    <div>
                      <div className="font-bold text-sm" style={{ color: p.color }}>{p.label}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {p.orgStats.reduce((a, b) => a + b.count, 0)} مؤشر · {p.orgStats.filter(s => s.count > 0).length} مؤسسة
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  {p.orgStats.map(s => {
                    const c = colorFor(s.code);
                    return (
                      <div key={s.code}>
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full" style={{ background: c }} />
                            <span className="font-medium">{s.name}</span>
                            <span className="text-muted-foreground">({s.count})</span>
                          </span>
                          <span className="tabular-nums font-bold" style={{ color: s.count ? c : "#9ca3af" }}>
                            {s.count ? `${s.avg}%` : "—"}
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all"
                            style={{ width: `${Math.min(100, s.avg)}%`, background: c, opacity: s.count ? 1 : 0.2 }} />
                        </div>
                      </div>
                    );
                  })}
                  {p.orgStats.length === 0 && (
                    <div className="text-xs text-muted-foreground text-center py-2">اختر مؤسسة على الأقل</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && allOrgs.length > 0 && (
          <div className="mt-5 pt-4 border-t border-border">
            <div className="text-xs text-muted-foreground mb-2">مقارنة إجمالية (متوسط جميع المناظير)</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {activeOrgs.map(code => {
                const scores = matrix.map(p => p.orgStats.find(s => s.code === code)).filter((s): s is NonNullable<typeof s> => !!s && s.count > 0);
                const overall = scores.length ? Math.round(scores.reduce((a, b) => a + b.avg, 0) / scores.length) : 0;
                const c = colorFor(code);
                return (
                  <div key={code} className="border border-border rounded-lg p-3 text-center" style={{ borderTopColor: c, borderTopWidth: 3 }}>
                    <div className="text-xs text-muted-foreground mb-1 truncate">{allOrgs.find(o => o.code === code)?.name ?? code}</div>
                    <div className="text-2xl font-bold tabular-nums" style={{ color: c }}>{overall}%</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}



const DATA_TYPES = ["الكل", "مؤشرات الأداء", "تقرير ربعي", "بيانات الفجوات", "بيانات الحوكمة", "البيانات المؤسسية", "التقرير المالي"];
const PERIODS = ["الكل", "Q1 2026", "Q2 2026", "Q3 2026", "Q4 2026", "سنوي 2026"];

function UploadSection() {
  const [dragging, setDragging] = useState(false);
  const [dataType, setDataType] = useState("الكل");
  const [orgId, setOrgId] = useState<string>("الكل");
  const [period, setPeriod] = useState("الكل");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const processFn = useServerFn(processUpload);
  const reprocessFn = useServerFn(reprocessUpload);
  const previewFn = useServerFn(previewKpiUpload);
  const deleteFn = useServerFn(deleteUploads);
  const qc = useQueryClient();
  const [reprocessing, setReprocessing] = useState<string | null>(null);
  const [viewExtract, setViewExtract] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleAll(ids: string[]) {
    setSelected((prev) => {
      const allSelected = ids.every((id) => prev.has(id));
      if (allSelected) return new Set();
      return new Set(ids);
    });
  }
  async function handleDelete(ids: string[]) {
    if (ids.length === 0) return;
    if (!confirm(`هل تريد حذف ${ids.length} ملف؟ سيُحذف الملف وكل البيانات المرتبطة به (مؤشرات / استخراجات) نهائياً.`)) return;
    setDeleting(true); setMsg(null);
    try {
      await deleteFn({ data: { uploadIds: ids } });
      setSelected(new Set());
      setMsg({ kind: "ok", text: `تم حذف ${ids.length} ملف وبياناتها المرتبطة.` });
      qc.invalidateQueries({ queryKey: ["uploads"] });
      qc.invalidateQueries({ queryKey: ["kpis"] });
      qc.invalidateQueries({ queryKey: ["document_extractions"] });
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : "فشل الحذف" });
    } finally {
      setDeleting(false);
    }
  }
  type PreviewState = {
    uploadId: string;
    filePath: string;
    fileName: string;
    loading: boolean;
    error?: string;
    result?: Awaited<ReturnType<typeof previewKpiUpload>>;
  };
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function handleReprocess(id: string) {
    setReprocessing(id); setMsg(null);
    try {
      const r = await reprocessFn({ data: { uploadId: id } }) as { ok?: boolean; upserted?: number; fileType?: string; orgsFound?: string[]; numbersCount?: number };
      const isDoc = r.fileType && ["docx", "pptx", "pdf"].includes(r.fileType);
      setMsg({
        kind: "ok",
        text: isDoc
          ? `أُعيدت المعالجة — ${r.orgsFound?.length ?? 0} مؤسسة · ${r.numbersCount ?? 0} رقم مُستخرج.`
          : `أُعيدت المعالجة بنجاح — ${r.upserted ?? 0} مؤشر.`
      });
      qc.invalidateQueries({ queryKey: ["uploads"] });
      qc.invalidateQueries({ queryKey: ["kpis"] });
      qc.invalidateQueries({ queryKey: ["document_extractions"] });
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : "فشلت إعادة المعالجة" });
    } finally { setReprocessing(null); }
  }

  const { data: rows = [] } = useQuery({
    queryKey: ["uploads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("uploads")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
    // Poll fast while any upload is in-flight, otherwise slow down.
    refetchInterval: (q) => {
      const data = q.state.data as any[] | undefined;
      const active = data?.some((r) => r.status === "processing" || r.status === "uploaded");
      return active ? 1000 : 5000;
    },
  });

  const { data: extractions = [] } = useQuery({
    queryKey: ["document_extractions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_extractions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 5000,
  });

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true); setMsg(null);
    try {
      const slug = (s: string) => {
        const ascii = s.replace(/[^\w.\-]+/g, "_").replace(/^_+|_+$/g, "");
        return ascii || `x${Math.random().toString(36).slice(2, 8)}`;
      };
      for (const file of Array.from(files)) {
        const safeName = slug(file.name);
        const path = `${slug(orgId)}/${slug(dataType)}/${slug(period)}/${Date.now()}_${safeName}`;
        const { error: upErr } = await supabase.storage.from("uploads").upload(path, file, {
          upsert: false, contentType: file.type || undefined,
        });
        if (upErr) throw upErr;

        const { data: row, error: insErr } = await supabase.from("uploads").insert({
          file_name: file.name, file_path: path, file_size: file.size,
          mime_type: file.type || null, data_type: dataType, org_id: orgId, period, status: "uploaded",
        }).select("id").single();
        if (insErr) throw insErr;

        const ext = file.name.split(".").pop()?.toLowerCase() || "";
        const isExcel = ext === "xlsx" || ext === "xls" || ext === "csv";

        if (isExcel) {
          // Excel: show preview modal first, defer commit until user confirms
          setPreview({ uploadId: row.id, filePath: path, fileName: file.name, loading: true });
          try {
            const result = await previewFn({ data: { filePath: path, period } });
            setPreview({ uploadId: row.id, filePath: path, fileName: file.name, loading: false, result });
          } catch (e) {
            setPreview({ uploadId: row.id, filePath: path, fileName: file.name, loading: false, error: e instanceof Error ? e.message : "فشلت المعاينة" });
          }
          qc.invalidateQueries({ queryKey: ["uploads"] });
          break; // Only preview one file at a time
        } else {
          // Word/PPT/PDF: process directly
          await processFn({ data: { uploadId: row.id, filePath: path } }).catch(() => {});
        }
      }
      if (!preview) {
        setMsg({ kind: "ok", text: `تم رفع ${files.length} ملف بنجاح ومعالجتها.` });
      }
      qc.invalidateQueries({ queryKey: ["uploads"] });
      qc.invalidateQueries({ queryKey: ["document_extractions"] });
      qc.invalidateQueries({ queryKey: ["kpis"] });
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : "فشل الرفع" });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function confirmPreview() {
    if (!preview?.result) return;
    setConfirming(true);
    try {
      await processFn({ data: { uploadId: preview.uploadId, filePath: preview.filePath } });
      const s = preview.result.summary;
      setMsg({ kind: "ok", text: `تم الاستيراد: +${s.inserted} جديد · ↻${s.updated} مُحدَّث · ${s.unchanged} بلا تغيير` });
      setPreview(null);
      qc.invalidateQueries({ queryKey: ["uploads"] });
      qc.invalidateQueries({ queryKey: ["kpis"] });
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : "فشل الاستيراد" });
    } finally {
      setConfirming(false);
    }
  }

  async function cancelPreview() {
    if (!preview) return;
    // Mark upload as cancelled by deleting the storage object & row
    try {
      await supabase.storage.from("uploads").remove([preview.filePath]);
      await supabase.from("uploads").delete().eq("id", preview.uploadId);
    } catch { /* ignore cleanup errors */ }
    setPreview(null);
    qc.invalidateQueries({ queryKey: ["uploads"] });
  }

  const orgOptions = ["الكل", ...ORGS.map(o => o.id)];

  const fileIcon = (name: string) => {
    const ext = name.split(".").pop()?.toLowerCase();
    if (ext === "xlsx" || ext === "xls" || ext === "csv") return "📊";
    if (ext === "docx" || ext === "doc") return "📝";
    if (ext === "pptx" || ext === "ppt") return "📽️";
    if (ext === "pdf") return "📄";
    return "📎";
  };

  const docRows = rows.filter((r: any) => {
    const ext = r.file_name?.split(".").pop()?.toLowerCase();
    return ["docx", "pptx", "pdf", "doc", "ppt"].includes(ext);
  });

  return (
    <div className="space-y-6">
      <SectionTitle title="رفع البيانات وتحديثها" subtitle="ملفات Excel / Word / PowerPoint / PDF — يُستخرج النص والأرقام تلقائياً" />

      <Card>
        <CardHeader title="منطقة الرفع" />
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <Select value={dataType} onChange={setDataType} options={DATA_TYPES} label="نوع البيانات" />
            <Select value={orgId} onChange={setOrgId} options={orgOptions} label="المؤسسة" />
            <Select value={period} onChange={setPeriod} options={PERIODS} label="الفترة" />
          </div>

          <input
            ref={inputRef} type="file" multiple
            accept=".xlsx,.xls,.csv,.pdf,.docx,.pptx,.doc,.ppt"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />

          <div
            onDragOver={(e)=>{e.preventDefault();setDragging(true);}}
            onDragLeave={()=>setDragging(false)}
            onDrop={(e)=>{e.preventDefault();setDragging(false);handleFiles(e.dataTransfer.files);}}
            onClick={() => !busy && inputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition ${dragging?"border-primary bg-primary/5":"border-border bg-muted/20 hover:bg-muted/40"} ${busy?"opacity-60 pointer-events-none":""}`}
          >
            <Upload className="mx-auto mb-3 text-primary" size={32} />
            <div className="font-bold mb-1">{busy ? "جاري الرفع والمعالجة..." : "اسحب وأفلت الملفات هنا"}</div>
            <div className="text-xs text-muted-foreground mb-4">أو اضغط للاختيار — Excel / Word / PowerPoint / PDF</div>
            <button type="button" className="text-sm px-4 py-2 rounded-md bg-primary text-primary-foreground" disabled={busy}>
              {busy ? "..." : "اختيار ملفات"}
            </button>
          </div>

          {msg && (
            <div className={`mt-4 text-sm p-3 rounded-md ${msg.kind==="ok"?"bg-emerald-500/10 text-emerald-700":"bg-rose-500/10 text-rose-700"}`}>
              {msg.text}
            </div>
          )}

          <div className="text-xs text-muted-foreground mt-4">
            💡 اختر «الكل» لأي حقل لرفع بيانات عامة غير مرتبطة بفلتر محدد.
            <br />
            📊 Excel/CSV → يُستخرج KPIs تلقائياً. 📝 Word / 📽️ PowerPoint / 📄 PDF → يُستخرج النص والأرقام والمؤسسات.
          </div>
        </div>
      </Card>

      {/* Document Extractions Panel */}
      {docRows.length > 0 && (
        <Card>
          <CardHeader
            title="البيانات المستخرجة من المستندات"
            subtitle={`${docRows.length} ملف Word / PowerPoint / PDF مُعالج`}
          />
          <div className="p-5">
            <div className="space-y-3">
              {docRows.map((r: any) => {
                const ext = r.file_name?.split(".").pop()?.toLowerCase();
                const isProcessed = r.status === "processed";
                const summary = r.extracted_summary as any;
                const extract = extractions.find((e: any) => e.upload_id === r.id);
                const isOpen = viewExtract === r.id;
                return (
                  <div key={r.id} className="border border-border rounded-lg overflow-hidden">
                    <button
                      onClick={() => setViewExtract(isOpen ? null : r.id)}
                      className="w-full flex items-center gap-3 p-3 text-right hover:bg-muted/30 transition"
                    >
                      <span className="text-xl">{fileIcon(r.file_name)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{r.file_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {isProcessed
                            ? summary?.orgs_found?.length > 0
                              ? `${summary.orgs_found.length} مؤسسة · ${summary.numbers_count ?? 0} رقم`
                              : "مُعالج"
                            : r.status === "error" ? "خطأ في المعالجة" : "قيد المعالجة..."}
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        isProcessed ? "bg-emerald-500/10 text-emerald-700" :
                        r.status === "error" ? "bg-rose-500/10 text-rose-700" :
                        "bg-amber-500/10 text-amber-700"
                      }`}>
                        {isProcessed ? "مُعالج" : r.status === "error" ? "خطأ" : "جاري..."}
                      </span>
                      <ChevronRight size={16} className={`text-muted-foreground transition ${isOpen ? "rotate-90" : ""}`} />
                    </button>

                    {isOpen && extract && (
                      <div className="px-4 pb-4 border-t border-border bg-muted/10">
                        {/* Summary */}
                        {(extract as any).summary && (
                          <div className="mt-3 p-2 rounded bg-blue-50 text-blue-800 text-xs border border-blue-100">
                            <strong>ملخص:</strong> {(extract as any).summary}
                          </div>
                        )}

                        {/* Orgs found */}
                        {(extract as any).org_mentions && (extract as any).org_mentions.length > 0 && (
                          <div className="mt-3">
                            <div className="text-xs font-medium text-muted-foreground mb-1">المؤسسات المذكورة:</div>
                            <div className="flex flex-wrap gap-1">
                              {(extract as any).org_mentions.map((o: any, i: number) => (
                                <span key={i} className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary font-medium">
                                  {o.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Numbers */}
                        {(extract as any).numbers_found && (extract as any).numbers_found.length > 0 && (
                          <div className="mt-3">
                            <div className="text-xs font-medium text-muted-foreground mb-1">الأرقام المستخرجة:</div>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                              {(extract as any).numbers_found.slice(0, 12).map((n: any, i: number) => (
                                <div key={i} className="text-xs p-2 rounded border border-border bg-card">
                                  <div className="font-bold tabular-nums" dir="ltr">
                                    {n.value.toLocaleString()} {n.unit || ""}
                                  </div>
                                  <div className="text-muted-foreground truncate mt-0.5" title={n.context}>
                                    {n.context?.substring(0, 40)}...
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Text preview */}
                        {(extract as any).text_preview && (
                          <details className="mt-3">
                            <summary className="text-xs cursor-pointer text-muted-foreground hover:text-foreground">عرض النص المستخرج</summary>
                            <pre className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap bg-muted/30 p-3 rounded max-h-[300px] overflow-y-auto">
                              {(extract as any).text_preview}
                            </pre>
                          </details>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader
          title="سجل التحديثات الأخيرة"
          action={
            selected.size > 0 ? (
              <button
                type="button"
                onClick={() => handleDelete(Array.from(selected))}
                disabled={deleting}
                className="text-xs px-3 py-1.5 rounded-md bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {deleting ? "جارٍ الحذف..." : `🗑 حذف المحدّد (${selected.size})`}
              </button>
            ) : null
          }
        />
        <div className="p-5">
          {rows.length === 0 ? <EmptyData msg="لا توجد ملفات مرفوعة بعد" /> : (
            <ScrollableTable>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-right border-b">
                    <th className="p-2 w-8">
                      <input
                        type="checkbox"
                        checked={rows.length > 0 && rows.every((r: any) => selected.has(r.id))}
                        onChange={() => toggleAll(rows.map((r: any) => r.id))}
                      />
                    </th>
                    <th className="p-2">الملف</th><th className="p-2">النوع</th>
                    <th className="p-2">المؤسسة</th><th className="p-2">الفترة</th>
                    <th className="p-2">الحالة</th><th className="p-2">صفوف</th>
                    <th className="p-2">التاريخ</th><th className="p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r: any) => {
                    const prog = r.progress as null | { phase: string; label: string; percent: number; message?: string | null; elapsed_ms: number; eta_ms: number | null };
                    const isActive = r.status === "processing" || r.status === "uploaded";
                    const showProgress = isActive || (prog && prog.percent < 100 && r.status !== "error");
                    const fmtMs = (ms: number | null | undefined) => {
                      if (ms == null || !Number.isFinite(ms)) return "—";
                      const s = Math.round(ms / 1000);
                      if (s < 60) return `${s} ث`;
                      const m = Math.floor(s / 60), rem = s % 60;
                      return `${m} د ${rem} ث`;
                    };
                    return (
                      <Fragment key={r.id}>
                    <tr className={`border-b hover:bg-muted/30 ${selected.has(r.id) ? "bg-primary/5" : ""}`}>
                      <td className="p-2">
                        <input
                          type="checkbox"
                          checked={selected.has(r.id)}
                          onChange={() => toggleOne(r.id)}
                        />
                      </td>
                      <td className="p-2 font-medium truncate max-w-[200px]">
                        <span className="mr-1">{fileIcon(r.file_name)}</span>
                        {r.file_name}
                      </td>
                      <td className="p-2">{r.data_type}</td>
                      <td className="p-2">{r.org_id}</td>
                      <td className="p-2">{r.period}</td>
                      <td className="p-2">
                        <span className={`text-xs px-2 py-1 rounded ${
                          r.status==="processed"?"bg-emerald-500/10 text-emerald-700":
                          r.status==="error"?"bg-rose-500/10 text-rose-700":
                          "bg-amber-500/10 text-amber-700"
                        }`}>
                          {r.status==="processed"?"مُعالج":r.status==="error"?"خطأ":"قيد المعالجة"}
                        </span>
                      </td>
                      <td className="p-2">{r.rows_extracted ?? 0}</td>
                      <td className="p-2 text-xs text-muted-foreground whitespace-nowrap">{new Date(r.created_at).toLocaleString("ar")}</td>
                      <td className="p-2 whitespace-nowrap">
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            type="button"
                            onClick={() => handleReprocess(r.id)}
                            disabled={reprocessing === r.id}
                            className="text-xs px-2 py-1 rounded-md border border-border hover:bg-primary hover:text-primary-foreground transition disabled:opacity-50"
                          >
                            {reprocessing === r.id ? "..." : "إعادة المعالجة"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete([r.id])}
                            disabled={deleting}
                            title="حذف الملف وبياناته"
                            className="text-xs px-2 py-1 rounded-md border border-rose-200 text-rose-700 hover:bg-rose-600 hover:text-white hover:border-rose-600 transition disabled:opacity-50"
                          >
                            🗑
                          </button>
                        </div>
                      </td>
                    </tr>
                    {showProgress && (
                      <tr key={`${r.id}-progress`} className="border-b bg-amber-50/40">
                        <td className="p-2" />
                        <td colSpan={8} className="p-2">
                          <UploadProgressBar
                            phase={prog?.phase ?? "downloading"}
                            label={prog?.label ?? "بدء المعالجة..."}
                            percent={prog?.percent ?? 0}
                            message={prog?.message ?? null}
                            elapsedMs={prog?.elapsed_ms ?? 0}
                            etaMs={prog?.eta_ms ?? null}
                            fmtMs={fmtMs}
                          />
                        </td>
                      </tr>
                    )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </ScrollableTable>
          )}
        </div>
      </Card>

      {preview && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={cancelPreview}>
          <div className="bg-background rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e)=>e.stopPropagation()}>
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div>
                <div className="font-bold text-lg">معاينة الاستيراد قبل التأكيد</div>
                <div className="text-xs text-muted-foreground mt-1">{preview.fileName}</div>
              </div>
              <button onClick={cancelPreview} className="text-muted-foreground hover:text-foreground p-1">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {preview.loading && (
                <div className="text-center py-12 text-muted-foreground">جارٍ تحليل الملف ومطابقته بالبيانات الحالية...</div>
              )}
              {preview.error && (
                <div className="p-3 rounded-md bg-rose-500/10 text-rose-700 text-sm">⚠️ {preview.error}</div>
              )}
              {preview.result && (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50">
                      <div className="text-2xl font-bold text-emerald-700">{preview.result.summary.inserted}</div>
                      <div className="text-xs text-emerald-700 mt-1">مؤشرات جديدة</div>
                    </div>
                    <div className="p-3 rounded-lg border border-blue-200 bg-blue-50">
                      <div className="text-2xl font-bold text-blue-700">{preview.result.summary.updated}</div>
                      <div className="text-xs text-blue-700 mt-1">سيتم تحديثها</div>
                    </div>
                    <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                      <div className="text-2xl font-bold text-slate-600">{preview.result.summary.unchanged}</div>
                      <div className="text-xs text-slate-600 mt-1">بلا تغيير</div>
                    </div>
                    {preview.result.summary.rejected > 0 ? (
                      <div className="p-3 rounded-lg border border-rose-200 bg-rose-50">
                        <div className="text-2xl font-bold text-rose-700">{preview.result.summary.rejected}</div>
                        <div className="text-xs text-rose-700 mt-1">صفوف مرفوضة</div>
                      </div>
                    ) : (
                      <div className="p-3 rounded-lg border border-border bg-muted/30">
                        <div className="text-2xl font-bold">{preview.result.summary.totalInFile}</div>
                        <div className="text-xs text-muted-foreground mt-1">إجمالي الملف</div>
                      </div>
                    )}
                  </div>

                  <div className="p-3 rounded-md bg-blue-50 text-blue-800 text-xs border border-blue-100">
                    ℹ️ سيتم <strong>تحديث</strong> المؤشرات المطابقة بالكود والمؤسسة والفترة، واعتماد القيم الجديدة فقط — <strong>لن يتكرر أي مؤشر</strong>.
                  </div>

                  {preview.result.updated.length > 0 && (
                    <div>
                      <div className="font-semibold text-sm mb-2">تفاصيل المؤشرات المُحدَّثة ({preview.result.updated.length}):</div>
                      <div className="max-h-[300px] overflow-y-auto border border-border rounded-lg">
                        <table className="w-full text-xs">
                          <thead className="bg-muted/50 sticky top-0">
                            <tr className="text-right">
                              <th className="p-2">الكود</th><th className="p-2">الحقل</th>
                              <th className="p-2">القديم</th><th className="p-2">الجديد</th>
                            </tr>
                          </thead>
                          <tbody>
                            {preview.result.updated.flatMap(u =>
                              u.changes.map((c, i) => (
                                <tr key={`${u.entity_code}-${u.kpi_code}-${c.field}-${i}`} className="border-t border-border">
                                  <td className="p-2 font-mono text-[10px]">{u.entity_code}/{u.kpi_code}</td>
                                  <td className="p-2">{c.label}</td>
                                  <td className="p-2 text-rose-700 line-through">{c.from ?? "—"}</td>
                                  <td className="p-2 text-emerald-700 font-semibold">{c.to ?? "—"}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {preview.result.summary.stale > 0 && (
                    <div className="p-3 rounded-md bg-amber-50 text-amber-800 text-xs border border-amber-200">
                      ⚠️ {preview.result.summary.stale} مؤشر من استيراد سابق لم يُذكر في هذا الملف — سيبقى كما هو دون حذف.
                    </div>
                  )}
                  {preview.result.summary.duplicatesInFile > 0 && (
                    <div className="p-3 rounded-md bg-amber-50 text-amber-800 text-xs border border-amber-200">
                      ⚠️ {preview.result.summary.duplicatesInFile} صف مكرر داخل الملف نفسه — سيُعتمد آخر ظهور فقط.
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="p-4 border-t border-border flex items-center justify-end gap-2">
              <button
                onClick={cancelPreview}
                disabled={confirming}
                className="px-4 py-2 rounded-md border border-border hover:bg-muted/50 text-sm disabled:opacity-50"
              >إلغاء</button>
              <button
                onClick={confirmPreview}
                disabled={!preview.result || confirming || !!preview.error}
                className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
              >
                {confirming ? "جارٍ التأكيد..." :
                  preview.result ? `✅ تأكيد الاستيراد (${preview.result.summary.inserted + preview.result.summary.updated} تغيير)` : "..."}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

}


