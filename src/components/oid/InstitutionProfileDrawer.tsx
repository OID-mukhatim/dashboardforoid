/**
 * المحور الثامن: ملف المؤسسة التفصيلي (Drawer/Sheet).
 * يتم استدعاؤه عبر openOrgProfile() من المحور 6.
 *
 * يجمع: الشعار، البيانات التعريفية، الدرجة المركّبة (المحور 1)،
 * تحليل الفجوات (7 محاور)، الحوكمة، KPIs، التزامات مالية،
 * الشراكات، المبادرات، الشذوذات الخاصة، الاتجاه الزمني.
 */
import { useMemo } from "react";
import { X, Building2, Users, Coins, Calendar, ShieldCheck, Phone, Mail, AlertTriangle } from "lucide-react";
import {
  ORGS, type OrgId, GAP_AXES, gapScores, institutions,
  kpiData, partnerships, initiatives, financialAssessment, financialProgram,
  generalPolicies, humanitarianPolicies, universityPolicies, educationPolicies,
  POLICY_STATUS_META,
} from "@/lib/oid-data";
import { ORG_LOGOS } from "@/lib/oid-logos";
import { computeProfile } from "@/lib/oid-composite";
import { detectAnomalies, getSeverityMeta, getCategoryLabel } from "@/lib/oid-anomalies";
import { computeTrend } from "@/lib/oid-timeline";
import { useOrgDrill, closeOrgProfile } from "@/lib/oid-drill";
import { DATA_STATES } from "@/lib/oid-data-states";
import { formatScore, formatBudget, formatPct, formatCount } from "@/lib/oid-formatting";
import { TrendBadge } from "./TrendBadge";

export function InstitutionProfileDrawer() {
  const { openOrg } = useOrgDrill();
  if (!openOrg) return null;
  return <DrawerContent orgId={openOrg} />;
}

function DrawerContent({ orgId }: { orgId: OrgId }) {
  const org = ORGS.find((o) => o.id === orgId)!;
  const inst = institutions.find((i) => i.id === orgId);
  const profile = computeProfile(orgId);
  const trend = computeTrend(orgId, "composite");

  const allProfiles = useMemo(() => {
    const m = {} as Record<OrgId, ReturnType<typeof computeProfile>>;
    for (const o of ORGS) m[o.id] = computeProfile(o.id);
    return m;
  }, []);
  const anomalies = useMemo(() => detectAnomalies(orgId, allProfiles), [orgId, allProfiles]);

  const orgKPIs = kpiData.filter((k) => k.org === orgId);
  const orgPartnerships = partnerships.filter((p) => p.linkedOrgs.includes(orgId as any));
  const orgInitiatives = initiatives.filter(
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

  return (
    <div
      className="fixed inset-0 z-50 flex"
      role="dialog"
      aria-modal="true"
      onKeyDown={(e) => e.key === "Escape" && closeOrgProfile()}
    >
      <div className="flex-1 bg-black/45 backdrop-blur-[2px]" onClick={closeOrgProfile} />
      <aside className="w-full max-w-[860px] bg-background shadow-2xl overflow-y-auto border-l border-border">
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
              <div className="text-lg font-bold truncate">{org.nameAr}</div>
              <div className="text-xs text-muted-foreground truncate" dir="ltr">{org.nameEn}</div>
              {inst?.sector && <div className="text-[11px] mt-0.5 text-muted-foreground">{inst.sector}</div>}
            </div>
          </div>
          <button
            onClick={closeOrgProfile}
            className="p-2 rounded-lg hover:bg-muted transition"
            title="إغلاق"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-6">
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
              <Field icon={Calendar} k="التأسيس" v={inst?.founded} />
              <Field icon={ShieldCheck} k="الترخيص" v={inst?.license} />
              <Field icon={Calendar} k="صلاحية الترخيص" v={inst?.licenseExpiry} />
              <Field icon={Users} k="المدير التنفيذي" v={inst?.execAr} />
              <Field icon={Users} k="إجمالي الموظفين" v={inst?.staff?.total ? formatCount(inst.staff.total) : null} />
              <Field icon={Coins} k="الميزانية" v={inst?.budget ? formatBudget(inst.budget) : null} />
              <Field icon={Building2} k="الفروع/المرافق" v={inst?.branches} />
              <Field icon={Phone} k="هاتف" v={inst?.phone} dir="ltr" />
              <Field icon={Mail} k="بريد" v={inst?.email} dir="ltr" />
            </div>
            {inst?.alerts && inst.alerts.length > 0 && (
              <div className="mt-3 space-y-1">
                {inst.alerts.map((a, i) => (
                  <div key={i} className="text-xs p-2 rounded bg-red-50 text-red-700 border border-red-200">{a}</div>
                ))}
              </div>
            )}
          </Block>

          {/* Gap radar values */}
          <Block title="تحليل الفجوات — 7 محاور">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {GAP_AXES.map((ax, i) => {
                const v = gapScores[orgId][i];
                const color = v === null ? "#94a3b8" : v < 2 ? "#dc2626" : v < 3 ? "#ea580c" : v < 4 ? "#d97706" : "#15803d";
                return (
                  <div key={ax} className="border border-border rounded-lg p-3 text-center">
                    <div className="text-[11px] text-muted-foreground mb-1 truncate">{ax}</div>
                    <div className="text-xl font-bold tabular-nums" style={{ color }} dir="ltr">
                      {v !== null ? formatScore(v) : "—"}
                    </div>
                  </div>
                );
              })}
            </div>
          </Block>

          {/* KPIs */}
          <Block title={`مؤشرات الأداء (${orgKPIs.length})`}>
            {orgKPIs.length === 0 ? (
              <EmptyMini msg="لا توجد KPIs مرتبطة" />
            ) : (
              <ul className="space-y-1.5">
                {orgKPIs.map((k) => (
                  <li key={k.code} className="flex items-center gap-3 text-sm border border-border rounded-lg p-2.5">
                    <span className="font-mono text-[10px] text-muted-foreground w-20 shrink-0">{k.code}</span>
                    <span className="flex-1 truncate">{k.kpi}</span>
                    <div className="w-32 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${k.progress}%`, background: org.color }} />
                    </div>
                    <span className="text-xs w-10 text-left tabular-nums" dir="ltr">{k.progress}%</span>
                  </li>
                ))}
              </ul>
            )}
          </Block>

          {/* Governance / policies */}
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
                      <span className="flex-1 truncate">{p.name}</span>
                      <span className={`text-[10px] ${meta.fg} font-medium`}>{meta.label}</span>
                    </div>
                  );
                })}
              </div>
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
                      <span className="text-muted-foreground truncate max-w-[260px]">{p.note}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted">{p.status}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Block>
          )}

          {/* Partnerships */}
          <Block title={`الشراكات (${orgPartnerships.length})`}>
            {orgPartnerships.length === 0 ? (
              <EmptyMini msg="لا شراكات مرتبطة" />
            ) : (
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-1.5 text-xs">
                {orgPartnerships.map((p) => (
                  <li key={p.id} className="border border-border rounded p-2 flex items-center gap-2">
                    <span className="font-mono text-[10px] text-muted-foreground">{p.id}</span>
                    <span className="flex-1 truncate">{p.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted">{p.type}</span>
                  </li>
                ))}
              </ul>
            )}
          </Block>

          {/* Initiatives */}
          <Block title={`المبادرات (${orgInitiatives.length})`}>
            {orgInitiatives.length === 0 ? (
              <EmptyMini msg="لا توجد مبادرات" />
            ) : (
              <ul className="space-y-1.5 text-xs">
                {orgInitiatives.map((i) => (
                  <li key={i.id} className="border border-border rounded p-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-[10px] text-muted-foreground">{i.id}</span>
                      <span className="font-medium flex-1">{i.title}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted">{i.priority}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted">{i.status}</span>
                    </div>
                    <div className="text-muted-foreground">{i.objective}</div>
                    <div className="text-[10px] text-primary mt-1">{i.cost} · {i.timeline}</div>
                  </li>
                ))}
              </ul>
            )}
          </Block>

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
