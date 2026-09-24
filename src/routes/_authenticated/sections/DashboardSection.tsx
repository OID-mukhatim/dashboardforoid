import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Users, Heart, Coins, TrendingUp, BarChart3, Target, Handshake, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { ResponsiveContainer, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Tooltip, Legend } from "recharts";
import { ORGS, type OrgId, orgOverallScores, GAP_AXES, gapScores, institutions, alerts, partnerships as fallbackPartnerships } from "@/lib/oid-data";
import { CompositeScoreCard } from "@/components/oid/CompositeScoreCard";
import { DataStateLegend } from "@/components/oid/DataStateCell";
import { AnomaliesPanel } from "@/components/oid/AnomaliesPanel";
import { openOrgProfile } from "@/lib/oid-drill";
import { formatScore } from "@/lib/oid-formatting";
import { MATURITY_SCALE } from "@/lib/oid-maturity";
import { BSC_PERSPECTIVES, matchPerspective } from "@/lib/oid-bsc";
import { computeProfileFromLive } from "@/lib/oid-composite";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { loadActiveKPIs } from "@/lib/dashboard.functions";
import { computeOrgKPIPerformance } from "@/lib/oid-kpi-engine";
import { perspectiveLabelOf } from "@/lib/oid-bsc";
import { Card, CardHeader, StatCard, EmptyData, Progress, MATURITY_OF_LEVEL, extractBeneficiaries, fmtBudget, fmtNum, useDashboardSnapshotQuery, getLiveGapValue, SectionTitle } from "./_shared";
import { useLang } from "@/lib/lang-context";

export function DashboardSection() {
  const { lang, t, tFormat } = useLang();
  const [orgFilter, setOrgFilter] = useState<"all" | OrgId>("all");
  const { data: snap } = useDashboardSnapshotQuery();
  const activeKpisFn = useServerFn(loadActiveKPIs);

  // الأداء الهرمي الحي: مؤشر → هدف → منظور (25%) → الأداء العام.
  const { data: kpiPerf } = useQuery({
    queryKey: ["org-kpi-performance", lang],
    queryFn: async () => {
      const rows = await activeKpisFn();
      const out: Record<string, ReturnType<typeof computeOrgKPIPerformance>> = {};
      for (const o of ORGS) {
        const orgRows = (rows as any[])
          .filter((r) => r.entity_code === o.id)
          .map((r) => ({ ...r, perspective: perspectiveLabelOf(r.sector) ?? t("dashboard.unclassified") }));
        if (orgRows.length) out[o.id] = computeOrgKPIPerformance(orgRows);
      }
      return out;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Live per-org profiles (DB-backed, with static fallback inside the helper).
  const liveProfiles = useMemo(() => {
    const out = {} as Record<OrgId, ReturnType<typeof computeProfileFromLive>>;
    for (const o of ORGS) {
      const m = snap?.matrix?.[o.id];
      const k = snap?.kpi?.[o.id];
      out[o.id] = computeProfileFromLive(o.id, {
        gapAvg: m?.gapAvg ?? null,
        govScore: m?.govScore ?? null,
        kpiScorePct: k?.weightedAvgPct ?? null,
        finScore: m?.finScore ?? null,
      });
    }
    return out;
  }, [snap]);

  // هل هذه المؤسسة تعتمد على البيانات الثابتة (لا يوجد مصدر حي بعد)؟
  const orgUsesFallback = (id: OrgId) => {
    const m = snap?.matrix?.[id];
    const k = snap?.kpi?.[id];
    const hasLive =
      (m && (m.gapAvg != null || m.govScore != null || m.finScore != null)) ||
      (k && k.weightedAvgPct != null);
    return !hasLive;
  };
  const globalFallback = !snap || ORGS.every((o) => orgUsesFallback(o.id));

  const axisKeys = ["strategy", "leadership", "performance", "operations", "finance", "infrastructure", "governance"];
  const radarData = GAP_AXES.map((axis, i) => {
    const row: any = { axis: t(`dashboard.axes.${axisKeys[i]}`) };
    ORGS.forEach((o) => {
      const liveGap = getLiveGapValue(snap, o.id, axis);
      row[o.id] = typeof liveGap === "number" ? liveGap : (gapScores[o.id][i] ?? 0);
    });
    return row;
  });

  // الشراكات: من قاعدة البيانات مع الرجوع للبيانات الثابتة
  const { data: partnershipRows } = useQuery({
    queryKey: ["partnerships"],
    queryFn: async () => {
      const { data, error } = await supabase.from("partnerships").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const partnershipList = useMemo(() => {
    const rows = (partnershipRows ?? []) as any[];
    const src = rows.length ? rows : (fallbackPartnerships as any[]);
    return src.map((r) => ({
      status: r.status as string,
      linkedOrgs: (Array.isArray(r.linked_orgs) ? r.linked_orgs : Array.isArray(r.linkedOrgs) ? r.linkedOrgs : []) as string[],
    }));
  }, [partnershipRows]);

  const stats = useMemo(() => {
    const list = orgFilter === "all" ? institutions : institutions.filter((i) => i.id === orgFilter);
    const staff = list.reduce((sum, i) => sum + (i.staff?.total ?? 0), 0);
    const budget = list.reduce((sum, i) => sum + (i.budget ?? 0), 0);
    const beneficiaries = list.reduce((sum, i) => sum + extractBeneficiaries(i.branches), 0);

    // Composite scores: live profiles for selected orgs.
    const targetOrgs = orgFilter === "all" ? ORGS : ORGS.filter((o) => o.id === orgFilter);
    const composites = targetOrgs
      .map((o) => liveProfiles[o.id]?.compositeScore)
      .filter((v): v is number => typeof v === "number");
    const avgScore = composites.length ? composites.reduce((a, b) => a + b, 0) / composites.length : null;
    const maturities = targetOrgs
      .map((o) => liveProfiles[o.id]?.maturityLevel)
      .filter((v): v is number => typeof v === "number");
    const avgMaturity = maturities.length ? Math.round(maturities.reduce((a, b) => a + b, 0) / maturities.length) : null;

    const kpisLive =
      orgFilter === "all"
        ? (snap?.totals?.kpisCount ?? 0)
        : (snap?.kpi?.[orgFilter]?.count ?? 0);

    const activePartners = partnershipList.filter(
      (p) =>
        (p.status ?? "").includes("فاعلة") &&
        (orgFilter === "all" || p.linkedOrgs.includes(orgFilter)),
    ).length;

    return {
      orgsCount: orgFilter === "all" ? ORGS.length : 1,
      orgsSub: orgFilter === "all" ? t("dashboard.mainOrgs") : (ORGS.find((o) => o.id === orgFilter)?.[lang === "ar" ? "nameAr" : "nameEn"] ?? ""),
      staff, budget, beneficiaries, avgScore, avgMaturity,
      kpisLive, activePartners,
    };
  }, [orgFilter, liveProfiles, snap, partnershipList, lang, t]);

  return (
    <div className="space-y-6">
      <SectionTitle title={t("dashboard.title")} subtitle={t("dashboard.subtitle")} />

      <div className="flex items-center justify-end gap-2">
        <span className="text-sm text-muted-foreground">{t("dashboard.filterByOrg")}</span>
        <select
          value={orgFilter}
          onChange={(e) => setOrgFilter(e.target.value as "all" | OrgId)}
          className="border rounded-md px-3 py-1.5 text-sm bg-card"
        >
          <option value="all">{t("dashboard.allOrgs")}</option>
          {ORGS.map((o) => (
            <option key={o.id} value={o.id}>{lang === "ar" ? o.nameAr : o.nameEn}</option>
          ))}
        </select>
      </div>

      {globalFallback && (
        <div className="flex justify-end">
          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">
            {t("dashboard.demoData")}
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label={t("dashboard.totalOrgs")} value={String(stats.orgsCount)} sub={stats.orgsSub} icon={Building2} accent="#1d4ed8" />
        <StatCard label={t("dashboard.totalStaff")} value={stats.staff ? `${fmtNum(stats.staff)}+` : "—"} sub={orgFilter === "all" ? t("dashboard.acrossNetwork") : t("dashboard.inOrg")} icon={Users} accent="#15803d" />
        <StatCard label={t("dashboard.totalBeneficiaries")} value={stats.beneficiaries ? `${fmtNum(stats.beneficiaries)}+` : "—"} sub={t("dashboard.directBeneficiary")} icon={Heart} accent="#10b986" />
        <StatCard label={t("dashboard.totalBudget")} value={fmtBudget(stats.budget)} sub={tFormat("dashboard.totalYear", { year: 2026 })} icon={Coins} accent="#7c3aed" />
        <StatCard label={t("dashboard.overallScore")} value={stats.avgScore != null ? `${formatScore(stats.avgScore)} / 5` : "—"} sub={stats.avgMaturity ? `↑ ${t(`dashboard.maturity.l${stats.avgMaturity}`)}` : "—"} icon={TrendingUp} accent="#d97706" />
        <StatCard label={t("dashboard.maturityLevel")} value={stats.avgMaturity ? t(`dashboard.maturity.l${stats.avgMaturity}`) : "—"} sub={stats.avgMaturity ? tFormat("dashboard.level", { level: stats.avgMaturity }) : "—"} icon={BarChart3} accent="#2e9bd4" />
        <StatCard label={t("dashboard.activeKPIs")} value={stats.kpisLive ? `${fmtNum(stats.kpisLive)}` : "—"} sub={t("dashboard.fromDatabase")} icon={Target} accent="#15803d" />
        <StatCard label={t("dashboard.partnerships")} value={stats.activePartners ? `${fmtNum(stats.activePartners)}` : "—"} sub={orgFilter === "all" ? t("dashboard.strategicPartnerships") : t("dashboard.orgPartnerships")} icon={Handshake} accent="#0e4d2e" />
      </div>

      <BSCPerformanceMap />

      {/* المحور 1: الدرجة المركّبة لكل مؤسسة (4 مصادر بأوزان) */}
      <Card>
        <CardHeader
          title={t("dashboard.compositeTitle")}
          subtitle={t("dashboard.compositeSubtitle")}
        />
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {ORGS
              .filter((o) => orgFilter === "all" || o.id === orgFilter)
              .map((o) => (
                <div key={o.id} className="space-y-2">
                  <CompositeScoreCard orgId={o.id} profile={liveProfiles[o.id]} usingFallback={orgUsesFallback(o.id)} />
                  <KPIPerformanceBreakdown perf={kpiPerf?.[o.id]} />
                </div>
              ))}
          </div>
          <div className="flex items-center justify-between pt-3 border-t border-border flex-wrap gap-3">
            <DataStateLegend />
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
              <span className="font-medium">{t("dashboard.maturityScale")}</span>
              {MATURITY_SCALE.map((m) => (
                <span
                  key={m.level}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded"
                  style={{ background: m.bg, color: m.color }}
                  title={m.description}
                >
                  {m.level} — {t(`dashboard.maturity.l${m.level}`)}
                </span>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* المحور 4: الشذوذات والتناقضات */}
      <Card>
        <CardHeader
          title={t("dashboard.smartAlertsTitle")}
          subtitle={t("dashboard.smartAlertsSubtitle")}
        />
        <div className="p-5">
          <AnomaliesPanel orgFilter={orgFilter} />
        </div>
      </Card>



      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader title={t("dashboard.radarTitle")} subtitle={t("dashboard.radarSubtitle")} />
          <div className="p-4 h-[380px]">
            <ResponsiveContainer>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#e0e8f0" />
                <PolarAngleAxis dataKey="axis" tick={{ fontSize: 11, fill: "#4a6070" }} />
                <PolarRadiusAxis angle={90} domain={[0, 5]} tick={{ fontSize: 10 }} />
                {ORGS.map((o) => (
                  <Radar key={o.id} name={lang === "ar" ? o.nameAr : o.nameEn} dataKey={o.id} stroke={o.color} fill={o.color} fillOpacity={0.08}
                    strokeDasharray={o.id === "HAMDI" ? "4 4" : undefined} />
                ))}
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title={t("dashboard.rankingTitle")} subtitle={t("dashboard.rankingSubtitle")} />
          <div className="p-5 space-y-4">
            {[...ORGS]
              .map((o) => ({ o, p: liveProfiles[o.id] }))
              .sort((a, b) => (b.p.compositeScore ?? -1) - (a.p.compositeScore ?? -1))
              .map(({ o, p }) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => openOrgProfile(o.id)}
                  className="w-full text-right hover:bg-muted/30 rounded-md px-2 py-1 -mx-2 transition"
                  title={t("dashboard.openDetails")}
                >
                  <div className="flex items-center justify-between mb-1.5 text-sm">
                    <span className="font-medium">{lang === "ar" ? o.nameAr : o.nameEn}</span>
                    <span className="tabular-nums font-bold" style={{ color: o.color }}>
                      {p.compositeScore !== null ? p.compositeScore.toFixed(2) : "—"}
                      {p.maturityLevel && <span className="text-xs text-muted-foreground font-normal mr-2">({t(`dashboard.maturity.l${p.maturityLevel}`)})</span>}
                    </span>
                  </div>
                  <Progress value={p.compositeScore ? (p.compositeScore / 5) * 100 : 0} color={o.color} />
                </button>
              ))}
          </div>
        </Card>
      </div>




      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader title={t("dashboard.alertsTitle")} subtitle={t("dashboard.alertsSubtitle")} />
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
                     <div className={`text-sm font-medium ${styles.text}`}>{t(`dashboard.alertItems.${["hamdiLicense", "zadGovernance", "automation", "income", "zustAudit", "kafiGovernance"][i]}`)}</div>
                     <div className="text-xs text-muted-foreground mt-0.5">{t(`dashboard.alertItems.${["renewNow", "urgent", "digitalProgram", "fundingFramework", "qualitativeStep", "roleModel"][i]}`)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <CardHeader title={t("dashboard.governanceSummary")} subtitle={t("dashboard.governanceSummarySubtitle")} />
          <div className="p-5 grid grid-cols-2 gap-3">
            {ORGS.map((o) => {
              const liveGov = snap?.matrix?.[o.id]?.govPct;
              const fallback = orgOverallScores.find((s) => s.id === o.id)?.govPct ?? null;
              const pct = typeof liveGov === "number" ? liveGov : fallback;
              return (
                <div key={o.id} className="border border-border rounded-lg p-3 text-center">
                  <div className="text-xs text-muted-foreground mb-1 whitespace-normal break-words">{lang === "ar" ? o.nameAr : o.nameEn}</div>
                  <div className="text-xl font-bold tabular-nums" style={{ color: o.color }}>
                    {pct !== null ? `${pct}%` : "—"}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ============================ الأداء الهرمي للمؤشرات ============================ */
function KPIPerformanceBreakdown({ perf }: { perf?: ReturnType<typeof computeOrgKPIPerformance> }) {
  const { t } = useLang();
  if (!perf) return null;
  const overall = perf.overall;
  const entries = Object.entries(perf.perspPerformance);
  if (entries.length === 0) return null;
  return (
    <div className="rounded-lg border border-border p-3 space-y-2 bg-card">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{t("dashboard.kpiOverall")}</span>
        <span
          className="text-sm font-bold tabular-nums"
          style={{ color: (overall ?? 0) >= 90 ? "#15803d" : (overall ?? 0) >= 70 ? "#d97706" : "#dc2626" }}
        >
          {overall !== null ? `${overall.toFixed(1)}%` : "—"}
        </span>
      </div>
      {entries.map(([persp, val]) => (
        <div key={persp} className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground w-24 truncate" title={persp}>
            {(() => {
              const key = matchPerspective(persp);
              return key ? t(`dashboard.perspectives.${key}`) : persp;
            })()}
          </span>
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(((val ?? 0) / 25) * 100, 100)}%`,
                background: (val ?? 0) >= 22.5 ? "#16a34a" : (val ?? 0) >= 17.5 ? "#d97706" : "#dc2626",
              }}
            />
          </div>
          <span className="text-[11px] font-medium w-12 text-left tabular-nums" dir="ltr">
            {val !== null ? `${val.toFixed(1)}%` : "—"}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ============================ BSC Performance Map ============================ */
// مناظير BSC ومطابقة القطاعات تُستورد من src/lib/oid-bsc.ts (4 مناظير معيارية فقط).


function BSCPerformanceMap() {
  const { lang, t, tFormat } = useLang();
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

  const allOrgs = ORGS.map(o => ({ code: o.id as string, name: lang === "ar" ? o.nameAr : o.nameEn, color: o.color }));

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
        title={t("dashboard.bscTitle")}
        subtitle={t("dashboard.bscSubtitle")}
        action={
          <div className="flex items-center gap-1.5 flex-wrap justify-end max-w-md">
            <button
              onClick={() => setSelected([])}
              className={`text-xs px-2.5 py-1 rounded-full border transition ${selected.length === 0 ? "bg-primary text-primary-foreground border-primary" : "bg-muted border-border hover:bg-muted/70"}`}
            >{t("dashboard.all")}</button>
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
          <div className="text-center text-sm text-muted-foreground py-8">{t("dashboard.loading")}</div>
        ) : allOrgs.length === 0 ? (
          <EmptyData msg={t("dashboard.noKpiData")} />
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
                      <div className="font-bold text-sm" style={{ color: p.color }}>{t(`dashboard.perspectives.${p.key}`)}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {tFormat("dashboard.indicatorCount", { count: p.orgStats.reduce((a, b) => a + b.count, 0), orgs: p.orgStats.filter(s => s.count > 0).length })}
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
                    <div className="text-xs text-muted-foreground text-center py-2">{t("dashboard.selectOrg")}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && allOrgs.length > 0 && (
          <div className="mt-5 pt-4 border-t border-border">
            <div className="text-xs text-muted-foreground mb-2">{t("dashboard.overallComparison")}</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {activeOrgs.map(code => {
                const scores = matrix.map(p => p.orgStats.find(s => s.code === code)).filter((s): s is NonNullable<typeof s> => !!s && s.count > 0);
                const overall = scores.length ? Math.round(scores.reduce((a, b) => a + b.avg, 0) / scores.length) : 0;
                const c = colorFor(code);
                return (
                  <div key={code} className="border border-border rounded-lg p-3 text-center" style={{ borderTopColor: c, borderTopWidth: 3 }}>
                    <div className="text-xs text-muted-foreground mb-1 whitespace-normal break-words">{allOrgs.find(o => o.code === code)?.name ?? code}</div>
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
