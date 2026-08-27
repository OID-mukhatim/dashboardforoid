/**
 * المحور الثامن: ملف المؤسسة التفصيلي (Drawer/Sheet).
 * يتم استدعاؤه عبر openOrgProfile() من المحور 6.
 *
 * يجمع بيانات حقيقية من قاعدة البيانات (snapshot + institutions + partnerships +
 * initiatives) مع fallback ثابت، ويعرضها عبر تبويبات: نظرة عامة، الفجوات،
 * الحوكمة، الشراكات، المبادرات، السجل الزمني. زر تصدير PDF يطبع الـ Drawer فقط.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
  Line, LineChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { X, Building2, Users, Coins, Calendar, ShieldCheck, Phone, Mail, AlertTriangle, Printer } from "lucide-react";
import {
  ORGS, type OrgId, GAP_AXES, gapScores, institutions,
  kpiData, partnerships, initiatives, financialAssessment, financialProgram,
  generalPolicies, humanitarianPolicies, universityPolicies, educationPolicies,
  POLICY_STATUS_META,
} from "@/lib/oid-data";
import { ORG_LOGOS } from "@/lib/oid-logos";
import { computeProfile, computeProfileFromLive, type LiveInputs } from "@/lib/oid-composite";
import { detectAnomalies, getSeverityMeta, getCategoryLabel } from "@/lib/oid-anomalies";
import { computeTrend, getSeries, type TimelineDomain } from "@/lib/oid-timeline";
import { useOrgDrill, closeOrgProfile } from "@/lib/oid-drill";
import { DATA_STATES } from "@/lib/oid-data-states";
import { formatScore, formatBudget, formatPct, formatCount } from "@/lib/oid-formatting";
import { TrendBadge } from "./TrendBadge";
import { useDashboardSnapshotQuery } from "@/routes/_authenticated/sections/_shared";

const TABS = ["نظرة عامة", "الفجوات", "الحوكمة", "الشراكات", "المبادرات", "السجل الزمني"] as const;
type TabKey = (typeof TABS)[number];

const TL_DOMAINS: { key: TimelineDomain; label: string; color: string }[] = [
  { key: "composite", label: "مركّبة", color: "#0d3a6e" },
  { key: "gap", label: "الفجوات", color: "#dc2626" },
  { key: "governance", label: "الحوكمة", color: "#2563eb" },
  { key: "kpi", label: "المؤشرات", color: "#d97706" },
  { key: "financial", label: "المالية", color: "#7c3aed" },
];

export function InstitutionProfileDrawer() {
  const { openOrg } = useOrgDrill();
  if (!openOrg) return null;
  return <DrawerContent orgId={openOrg} />;
}

function DrawerContent({ orgId }: { orgId: OrgId }) {
  const [tab, setTab] = useState<TabKey>("نظرة عامة");
  const org = ORGS.find((o) => o.id === orgId)!;
  const inst = institutions.find((i) => i.id === orgId);
  const trend = computeTrend(orgId, "composite");

  // ---- Live data from DB ----
  const { data: snap } = useDashboardSnapshotQuery();
  const { data: dbInst } = useQuery({
    queryKey: ["institutions", orgId],
    queryFn: async () => {
      const { data } = await supabase.from("institutions").select("*").eq("id", orgId).single();
      return data;
    },
    enabled: !!orgId,
  });
  const { data: dbPartnerships } = useQuery({
    queryKey: ["partnerships", orgId],
    queryFn: async () => {
      const { data } = await supabase.from("partnerships").select("*").contains("linked_orgs", [orgId]);
      return data ?? [];
    },
    enabled: !!orgId,
  });
  const { data: dbInitiatives } = useQuery({
    queryKey: ["initiatives", orgId],
    queryFn: async () => {
      const { data } = await supabase.from("initiatives").select("*").contains("orgs", [orgId]);
      return data ?? [];
    },
    enabled: !!orgId,
  });

  // ---- Composite score from live snapshot ----
  const live: LiveInputs = {
    gapAvg: snap?.matrix?.[orgId]?.gapAvg ?? undefined,
    govScore: snap?.matrix?.[orgId]?.govScore ?? undefined,
    kpiScorePct: snap?.kpi?.[orgId]?.weightedAvgPct ?? undefined,
    finScore: snap?.matrix?.[orgId]?.finScore ?? undefined,
  };
  const profile = computeProfileFromLive(orgId, live);

  const allProfiles = useMemo(() => {
    const m = {} as Record<OrgId, ReturnType<typeof computeProfile>>;
    for (const o of ORGS) m[o.id] = computeProfile(o.id);
    return m;
  }, []);
  const anomalies = useMemo(() => detectAnomalies(orgId, allProfiles), [orgId, allProfiles]);

  const orgKPIs = kpiData.filter((k) => k.org === orgId);
  // الشراكات: حية من قاعدة البيانات + fallback ثابت
  const livePartnerships = (dbPartnerships ?? []).map((p: any) => ({
    id: p.id ?? p.name,
    name: p.name,
    type: p.type,
    status: p.status,
    geography: p.geography,
    description: p.description,
  }));
  const orgPartnerships =
    livePartnerships.length > 0
      ? livePartnerships
      : partnerships.filter((p) => p.linkedOrgs.includes(orgId as any));

  // المبادرات: حية + fallback ثابت
  const liveInits = (dbInitiatives ?? []).map((i: any) => ({
    id: i.code ?? i.id,
    priority: i.priority,
    status: i.status,
    domain: i.domain,
    title: i.title,
    objective: i.objective,
    cost: i.cost,
    timeline: i.timeline,
  }));
  const orgInitiatives =
    liveInits.length > 0
      ? liveInits
      : initiatives.filter(
          (i) => i.orgs.includes(org.nameAr) || i.orgs.includes(orgId as any) || i.orgs.includes("الجميع"),
        );

  // سياسات تخص المؤسسة (من كل المجموعات)
  const allPolicyGroups = [
    { label: "عامة", rows: generalPolicies },
    { label: "إنسانية", rows: humanitarianPolicies },
    { label: "جامعية", rows: universityPolicies },
    { label: "تعليمية", rows: educationPolicies },
  ];
  const orgPolicies = allPolicyGroups.flatMap((g) =>
    g.rows
      .filter((r) => r.values[orgId])
      .map((r) => ({ group: g.label, name: r.name, status: r.values[orgId]! })),
  );

  const fin = (financialAssessment as any)[orgId] as undefined | typeof financialAssessment.ZUST;
  const finProg = (financialProgram as any)[orgId] as undefined | typeof financialProgram.ZUST;

  // بيانات الهوية مدمجة (DB يغلب على الثابت)
  const identity = {
    founded: dbInst?.founded ?? inst?.founded,
    license: dbInst?.license_number ?? inst?.license,
    licenseExpiry: dbInst?.license_expiry ?? inst?.licenseExpiry,
    execAr: dbInst?.exec_name_ar ?? inst?.execAr,
    deputyName: dbInst?.deputy_name_ar,
    staffTotal: dbInst?.staff_total ?? inst?.staff?.total,
    budget: dbInst?.budget ?? inst?.budget,
    sector: dbInst?.sector ?? inst?.sector,
    branches: dbInst?.branches ?? inst?.branches,
    address: dbInst?.address,
    website: dbInst?.website,
    phone: dbInst?.exec_phone ?? inst?.phone,
    email: dbInst?.exec_email ?? inst?.email,
  };

  // رادار الفجوات لهذه المؤسسة
  const radarData = GAP_AXES.map((ax, i) => ({
    axis: ax,
    score: gapScores[orgId][i] ?? 0,
  }));

  // السجل الزمني — مخطط خطي متعدد المجالات
  const tlPeriods = useMemo(() => {
    const entries = TL_DOMAINS.flatMap((d) => getSeries(orgId, d.key));
    const seen = new Map<string, number>();
    for (const e of entries) seen.set(e.period, e.periodOrder);
    return [...seen.keys()].sort((a, b) => (seen.get(a) ?? 0) - (seen.get(b) ?? 0));
  }, [orgId]);
  const lineData = tlPeriods.map((period) => {
    const row: Record<string, number | string> = { period };
    for (const d of TL_DOMAINS) {
      const e = getSeries(orgId, d.key).find((x) => x.period === period);
      if (e) row[d.key] = e.value;
    }
    return row;
  });
  const hasTimeline = lineData.some((r) => TL_DOMAINS.some((d) => typeof r[d.key] === "number"));

  return (
    <div
      className="fixed inset-0 z-50 flex"
      role="dialog"
      aria-modal="true"
      onKeyDown={(e) => e.key === "Escape" && closeOrgProfile()}
    >
      <div className="flex-1 bg-black/45 backdrop-blur-[2px]" onClick={closeOrgProfile} />
      <aside className="profile-drawer-print w-full max-w-[860px] bg-background shadow-2xl overflow-y-auto border-l border-border">
        {/* Header */}
        <div
          className="sticky top-0 z-10 px-6 py-4 border-b border-border flex items-center justify-between"
          style={{ background: `linear-gradient(135deg, ${org.color}10, transparent)` }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-14 h-14 rounded-xl bg-white border-2 flex items-center justify-center overflow-hidden shrink-0"
              style={{ borderColor: org.color + "60" }}
            >
              <img src={ORG_LOGOS[orgId]} alt={org.nameAr} className="max-w-full max-h-full object-contain" />
            </div>
            <div className="min-w-0">
              <div className="text-lg font-bold whitespace-normal break-words">{org.nameAr}</div>
              <div className="text-xs text-muted-foreground whitespace-normal break-words" dir="ltr">{org.nameEn}</div>
              {identity.sector && <div className="text-[11px] mt-0.5 text-muted-foreground">{identity.sector}</div>}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => window.print()}
              className="p-2 rounded-lg hover:bg-muted transition flex items-center gap-1.5 text-xs"
              title="تصدير PDF (طباعة)"
            >
              <Printer size={16} /> <span className="hidden sm:inline">تصدير</span>
            </button>
            <button
              onClick={closeOrgProfile}
              className="p-2 rounded-lg hover:bg-muted transition"
              title="إغلاق"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="sticky top-[73px] z-10 bg-background border-b border-border px-4 flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition ${
                tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="p-6 space-y-6">
          {tab === "نظرة عامة" && (
            <>
              {/* Composite */}
              <Block title="الدرجة المركّبة" subtitle="ترجيح 4 مصادر: فجوات 35% • حوكمة 25% • KPIs 25% • مالي 15%">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div
                    className="md:col-span-1 rounded-xl p-4 border flex flex-col items-center justify-center"
                    style={{ background: (profile.maturityColor ?? org.color) + "10", borderColor: (profile.maturityColor ?? org.color) + "40" }}
                  >
                    <div className="text-[11px] text-muted-foreground">الأداء الكلي</div>
                    <div
                      className="text-4xl font-extrabold tabular-nums"
                      dir="ltr"
                      style={{ color: profile.maturityColor ?? org.color }}
                    >
                      {profile.compositeScore !== null ? formatScore(profile.compositeScore) : "—"}
                    </div>
                    {profile.maturityLabel && (
                      <span
                        className="mt-1 text-[11px] px-2 py-0.5 rounded-full font-medium"
                        style={{ color: profile.maturityColor!, background: profile.maturityColor! + "20" }}
                      >
                        المستوى {profile.maturityLevel} — {profile.maturityLabel}
                      </span>
                    )}
                    <div className="mt-2 text-[11px] text-muted-foreground">
                      اكتمال البيانات: <span className="font-bold" dir="ltr">{formatPct(profile.dataCompleteness * 100)}</span>
                    </div>
                    <div className="mt-1"><TrendBadge trend={trend} label="لا يوجد تاريخ بعد" /></div>
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    {profile.components.map((c) => {
                      const filled = c.score !== null ? (c.score / 5) * 100 : 0;
                      const meta = c.state !== "achieved" ? DATA_STATES[c.state] : null;
                      return (
                        <div key={c.source} className="flex items-center gap-3 text-sm">
                          <span className="w-36 text-muted-foreground">{c.label}</span>
                          <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${filled}%`, background: org.color }} />
                          </div>
                          <span className="w-20 text-left tabular-nums font-bold text-sm" dir="ltr">
                            {c.score !== null ? formatScore(c.score) : (
                              <span style={{ color: meta?.color }} title={meta?.tooltip}>
                                {meta?.icon} {meta?.display}
                              </span>
                            )}
                          </span>
                          <span className="w-12 text-left text-[10px] text-muted-foreground tabular-nums" dir="ltr">
                            ×{(c.weight * 100).toFixed(0)}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Block>

              {/* Identity */}
              <Block title="البيانات التعريفية">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                  <Field icon={Calendar} k="التأسيس" v={identity.founded} />
                  <Field icon={ShieldCheck} k="الترخيص" v={identity.license} />
                  <Field icon={Calendar} k="صلاحية الترخيص" v={identity.licenseExpiry} />
                  <Field icon={Users} k="المدير التنفيذي" v={identity.execAr} />
                  {identity.deputyName && <Field icon={Users} k="نائب المدير" v={identity.deputyName} />}
                  <Field icon={Users} k="إجمالي الموظفين" v={identity.staffTotal ? formatCount(identity.staffTotal) : null} />
                  <Field icon={Coins} k="الميزانية" v={identity.budget ? formatBudget(identity.budget) : null} />
                  <Field icon={Building2} k="الفروع/المرافق" v={identity.branches} />
                  {identity.address && <Field icon={Building2} k="العنوان" v={identity.address} />}
                  {identity.website && <Field icon={Building2} k="الموقع" v={identity.website} dir="ltr" />}
                  <Field icon={Phone} k="هاتف" v={identity.phone} dir="ltr" />
                  <Field icon={Mail} k="بريد" v={identity.email} dir="ltr" />
                </div>
                {inst?.alerts && inst.alerts.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {inst.alerts.map((a, i) => (
                      <div key={i} className="text-xs p-2 rounded bg-red-50 text-red-700 border border-red-200">{a}</div>
                    ))}
                  </div>
                )}
              </Block>

              {/* KPIs summary */}
              <Block title={`مؤشرات الأداء (${orgKPIs.length})`}>
                {orgKPIs.length === 0 ? (
                  <EmptyMini msg="لا توجد KPIs مرتبطة" />
                ) : (
                  <ul className="space-y-1.5">
                    {orgKPIs.map((k) => (
                      <li key={k.code} className="flex items-center gap-3 text-sm border border-border rounded-lg p-2.5">
                        <span className="font-mono text-[10px] text-muted-foreground w-20 shrink-0">{k.code}</span>
                        <span className="flex-1 whitespace-normal break-words">{k.kpi}</span>
                        <div className="w-32 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${k.progress}%`, background: org.color }} />
                        </div>
                        <span className="text-xs w-10 text-left tabular-nums" dir="ltr">{k.progress}%</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Block>

              {/* Financial */}
              {(fin || finProg) && (
                <Block title="الوضع المالي">
                  {fin && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                      <Mini label="التقييم المالي" value={`${formatScore(fin.rating)} / 5`} sub={fin.label} accent="#7c3aed" />
                      <Mini label="نقاط القوة" value={String(fin.strengths.length)} sub="عنصر" accent="#15803d" />
                      <Mini label="التوصيات" value={String(fin.recommendations.length)} sub="إجراء" accent="#d97706" />
                    </div>
                  )}
                  {fin && (
                    <details className="text-sm border border-border rounded-lg p-3">
                      <summary className="cursor-pointer font-medium">عرض القوة / الضعف / التوصيات</summary>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3 text-xs">
                        <Lst title="نقاط القوة" items={fin.strengths} color="#15803d" />
                        <Lst title="نقاط الضعف" items={fin.weaknesses} color="#dc2626" />
                        <Lst title="التوصيات" items={fin.recommendations} color="#d97706" />
                      </div>
                      {fin.nextMilestone && (
                        <div className="mt-3 p-2 rounded bg-amber-50 text-amber-800 text-xs border border-amber-200">
                          <strong>الإنجاز القادم:</strong> {fin.nextMilestone}
                        </div>
                      )}
                    </details>
                  )}
                  {finProg && (
                    <ul className="mt-3 space-y-1 text-xs">
                      {finProg.map((p, i) => (
                        <li key={i} className="flex items-center gap-2 border border-border rounded p-2">
                          <span className="flex-1">{p.domain}</span>
                          <span className="text-muted-foreground whitespace-normal break-words max-w-[260px]">{p.note}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted">{p.status}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Block>
              )}

              {/* Anomalies for this org */}
              <Block title={`الشذوذات الخاصة (${anomalies.length})`}>
                {anomalies.length === 0 ? (
                  <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded p-2 flex items-center gap-2">
                    <AlertTriangle size={13} /> لا شذوذات مكتشفة لهذه المؤسسة.
                  </div>
                ) : (
                  <ul className="space-y-1.5">
                    {anomalies.map((a) => {
                      const m = getSeverityMeta(a.severity);
                      return (
                        <li
                          key={a.id}
                          className="border rounded p-2 text-xs"
                          style={{ borderInlineStartWidth: 3, borderInlineStartColor: m.color }}
                        >
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-semibold">{a.title}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: m.bg, color: m.color }}>{m.label}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{getCategoryLabel(a.category)}</span>
                          </div>
                          <p className="text-muted-foreground">{a.message}</p>
                          <p className="text-slate-700 mt-1"><span className="font-medium">↳</span> {a.suggestion}</p>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Block>
            </>
          )}

          {tab === "الفجوات" && (
            <>
              <Block title="تحليل الفجوات — مخطط رادار" subtitle="7 محاور مؤسسية لهذه المؤسسة">
                <div style={{ width: "100%", height: 300 }}>
                  <ResponsiveContainer>
                    <RadarChart data={radarData} outerRadius="75%">
                      <PolarGrid />
                      <PolarAngleAxis dataKey="axis" tick={{ fontSize: 11, fill: "#64748b" }} />
                      <PolarRadiusAxis domain={[0, 5]} tick={{ fontSize: 10, fill: "#94a3b8" }} />
                      <Radar name="النتيجة" dataKey="score" stroke={org.color} fill={org.color} fillOpacity={0.35} />
                      <Tooltip formatter={(v: any) => formatScore(Number(v))} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </Block>
              <Block title="القيم التفصيلية">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {GAP_AXES.map((ax, i) => {
                    const v = gapScores[orgId][i];
                    const color = v === null ? "#94a3b8" : v < 2 ? "#dc2626" : v < 3 ? "#ea580c" : v < 4 ? "#d97706" : "#15803d";
                    return (
                      <div key={ax} className="border border-border rounded-lg p-3 text-center">
                        <div className="text-[11px] text-muted-foreground mb-1 whitespace-normal break-words">{ax}</div>
                        <div className="text-xl font-bold tabular-nums" style={{ color }} dir="ltr">
                          {v !== null ? formatScore(v) : "—"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Block>
            </>
          )}

          {tab === "الحوكمة" && (
            <Block title={`الحوكمة والسياسات (${orgPolicies.length})`}>
              {orgPolicies.length === 0 ? (
                <EmptyMini msg="لا توجد سياسات مسجلة" />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 text-xs">
                  {orgPolicies.map((p, i) => {
                    const meta = POLICY_STATUS_META[p.status];
                    return (
                      <div key={i} className={`flex items-center gap-2 p-2 rounded ${meta.bg}`}>
                        <span>{meta.icon}</span>
                        <span className="flex-1 whitespace-normal break-words">{p.name}</span>
                        <span className="text-[10px] text-muted-foreground">{p.group}</span>
                        <span className={`text-[10px] ${meta.fg} font-medium`}>{meta.label}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Block>
          )}

          {tab === "الشراكات" && (
            <Block title={`الشراكات (${orgPartnerships.length})`} subtitle={livePartnerships.length > 0 ? "مصدر: قاعدة البيانات" : "مصدر: البيانات الثابتة"}>
              {orgPartnerships.length === 0 ? (
                <EmptyMini msg="لا شراكات مرتبطة" />
              ) : (
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-1.5 text-xs">
                  {orgPartnerships.map((p: any) => (
                    <li key={p.id} className="border border-border rounded p-2 flex items-center gap-2">
                      <span className="flex-1 whitespace-normal break-words">{p.name}</span>
                      {p.type && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted">{p.type}</span>}
                      {p.status && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted">{p.status}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </Block>
          )}

          {tab === "المبادرات" && (
            <Block title={`المبادرات (${orgInitiatives.length})`} subtitle={liveInits.length > 0 ? "مصدر: قاعدة البيانات" : "مصدر: البيانات الثابتة"}>
              {orgInitiatives.length === 0 ? (
                <EmptyMini msg="لا توجد مبادرات" />
              ) : (
                <ul className="space-y-1.5 text-xs">
                  {orgInitiatives.map((i: any) => (
                    <li key={i.id} className="border border-border rounded p-2">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-[10px] text-muted-foreground">{i.id}</span>
                        <span className="font-medium flex-1 whitespace-normal break-words">{i.title}</span>
                        {i.priority && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted">{i.priority}</span>}
                        {i.status && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted">{i.status}</span>}
                      </div>
                      {i.objective && <div className="text-muted-foreground whitespace-normal break-words">{i.objective}</div>}
                      {(i.cost || i.timeline) && (
                        <div className="text-[10px] text-primary mt-1">{i.cost} · {i.timeline}</div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Block>
          )}

          {tab === "السجل الزمني" && (
            <Block title="السجل الزمني — اتجاه الأداء" subtitle="مخطط خطي متعدد المجالات">
              {hasTimeline ? (
                <div style={{ width: "100%", height: 320 }}>
                  <ResponsiveContainer>
                    <LineChart data={lineData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="period" tick={{ fontSize: 11, fill: "#64748b" }} />
                      <YAxis domain={[0, 5]} tick={{ fontSize: 10, fill: "#94a3b8" }} />
                      <Tooltip formatter={(v: any) => formatScore(Number(v))} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      {TL_DOMAINS.map((d) => (
                        <Line key={d.key} type="monotone" dataKey={d.key} name={d.label} stroke={d.color} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyMini msg="لا توجد بيانات زمنية متوفرة لهذه المؤسسة" />
              )}
            </Block>
          )}
        </div>
      </aside>
    </div>
  );
}

/* ============ helpers ============ */
function Block({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section>
      <header className="mb-3">
        <h3 className="text-sm font-bold">{title}</h3>
        {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
      </header>
      {children}
    </section>
  );
}
function Field({ icon: Icon, k, v, dir }: any) {
  return (
    <div className="border border-border rounded-lg p-2.5">
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-1"><Icon size={11} /> {k}</div>
      <div className="text-sm font-medium" dir={dir}>{v ?? <span className="text-gray-400">—</span>}</div>
    </div>
  );
}
function EmptyMini({ msg }: { msg: string }) {
  return <div className="text-xs text-muted-foreground bg-muted/40 border border-dashed border-border rounded p-3 text-center">{msg}</div>;
}
function Mini({ label, value, sub, accent }: any) {
  return (
    <div className="border border-border rounded-lg p-3">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="text-xl font-bold tabular-nums" style={{ color: accent }} dir="ltr">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}
function Lst({ title, items, color }: { title: string; items: readonly string[]; color: string }) {
  return (
    <div>
      <div className="font-bold mb-1" style={{ color }}>{title}</div>
      <ul className="space-y-1">
        {items.map((s, i) => <li key={i} className="flex gap-1"><span style={{ color }}>•</span><span>{s}</span></li>)}
      </ul>
    </div>
  );
}
