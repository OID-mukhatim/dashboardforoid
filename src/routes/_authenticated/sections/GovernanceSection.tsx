import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts";
import { ORGS, type OrgId, orgOverallScores, POLICY_STATUS_META, type PolicyStatus, generalPolicies, universityPolicies, humanitarianPolicies, educationPolicies } from "@/lib/oid-data";
import { ScrollableTable } from "@/components/oid/ScrollableTable";
import { loadGovernancePolicies, updatePolicyStatus } from "@/lib/dashboard.functions";
import { useLang } from "@/lib/lang-context";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, useDashboardSnapshotQuery, SectionTitle } from "./_shared";

const STATUS_OPTIONS: PolicyStatus[] = ["active", "inactive", "review", "inDev", "missing", "pending"];

const STATUS_SELECT_CLASS: Record<PolicyStatus, string> = {
  active: "status-green border-success/30",
  inactive: "bg-info/10 text-info border-info/30",
  review: "status-yellow border-warning/30",
  inDev: "bg-warning/10 text-warning border-warning/30",
  missing: "status-red border-danger/30",
  pending: "status-gray border-border",
};

const ALL_POLICIES = [...generalPolicies, ...universityPolicies, ...humanitarianPolicies, ...educationPolicies];

/* ============================ GOVERNANCE ============================ */
export function GovernanceSection() {
  const { lang, t } = useLang();
  const { data: snap } = useDashboardSnapshotQuery();
  const [cat, setCat] = useState<"all"|"general"|"university"|"humanitarian"|"education">("general");
  const queryClient = useQueryClient();
  const loadPolicies = useServerFn(loadGovernancePolicies);
  const savePolicy = useServerFn(updatePolicyStatus);

  const { data: dbPolicies } = useQuery({
    queryKey: ["governance-policies"],
    queryFn: () => loadPolicies(),
    staleTime: 60 * 1000,
  });

  const livePoliciesMap = useMemo(() => {
    const map = new Map<string, PolicyStatus>();
    for (const p of dbPolicies ?? []) map.set(`${p.policy_id}__${p.org_id}`, p.status as PolicyStatus);
    return map;
  }, [dbPolicies]);

  const data = useMemo(() => {
    if (cat === "general") return generalPolicies;
    if (cat === "university") return universityPolicies;
    if (cat === "humanitarian") return humanitarianPolicies;
    if (cat === "education") return educationPolicies;
    return ALL_POLICIES;
  }, [cat]);

  const statusFromGovScore = (score: number | null | undefined): PolicyStatus | null => {
    if (typeof score !== "number" || !Number.isFinite(score)) return null;
    if (score >= 4) return "active";
    if (score >= 3) return "inactive";
    if (score >= 2) return "review";
    if (score >= 1) return "inDev";
    return "missing";
  };

  const effectivePolicyStatus = (policyId: string, orgId: OrgId, raw: PolicyStatus | undefined): PolicyStatus | undefined => {
    const live = livePoliciesMap.get(`${policyId}__${orgId}`);
    if (live) return live;
    if (raw !== "pending") return raw;
    return statusFromGovScore(snap?.matrix?.[orgId]?.govScore) ?? raw;
  };

  async function handleStatusChange(policyId: string, orgId: string, newStatus: PolicyStatus) {
    queryClient.setQueryData(["governance-policies"], (old: any[] | undefined) => {
      const rows = old ? [...old] : [];
      const idx = rows.findIndex((p) => p.policy_id === policyId && p.org_id === orgId);
      if (idx >= 0) rows[idx] = { ...rows[idx], status: newStatus };
      else rows.push({ policy_id: policyId, org_id: orgId, status: newStatus });
      return rows;
    });
    try {
      await savePolicy({ data: { policyId, orgId, status: newStatus } });
      queryClient.invalidateQueries({ queryKey: ["dashboard-snapshot"] });
    } finally {
      queryClient.invalidateQueries({ queryKey: ["governance-policies"] });
    }
  }

  const stackedData = ORGS.map(o => {
    const counts: any = { org: o.abbr, active: 0, inactive: 0, review: 0, inDev: 0, missing: 0, pending: 0 };
    ALL_POLICIES.forEach(p => {
      const s = effectivePolicyStatus(p.id, o.id, p.values[o.id]);
      if (s) counts[s]++;
    });
    return counts;
  });

  const governanceScores = ORGS.map((org) => {
    const liveGovScore = snap?.matrix?.[org.id]?.govScore;
    const fallback = orgOverallScores.find((s) => s.id === org.id) ?? null;
    const govScore = typeof liveGovScore === "number" ? liveGovScore : fallback?.govScore ?? null;
    const govPct = typeof govScore === "number" ? Math.round((govScore / 5) * 100) : fallback?.govPct ?? null;
    return { ...org, govScore, govPct };
  });

  return (
    <div className="space-y-6">
      <SectionTitle title={t("governance.title")} subtitle={t("governance.subtitle")} />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {governanceScores.map(o => (
          <Card key={o.id} className="p-4 text-center">
            <div className="text-xs text-muted-foreground mb-2 whitespace-normal break-words">{lang === "ar" ? o.nameAr : o.nameEn}</div>
            <div className="text-3xl font-bold tabular-nums mb-1" style={{ color: o.color }}>{o.govPct !== null ? `${o.govPct}%` : "—"}</div>
            <div className="text-[11px] text-muted-foreground">
              {o.govPct === null ? t("governance.missingData") :
               o.govPct >= 80 ? t("governance.excellent") :
               o.govPct >= 60 ? t("governance.good") :
               o.govPct >= 40 ? t("governance.average") : t("governance.weak")}
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader title={t("governance.distribution")} />
        <div className="p-4 h-[280px]">
          <ResponsiveContainer>
            <BarChart data={stackedData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e8f0" />
              <XAxis dataKey="org" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="active" stackId="a" fill="#16a34a" name={t("governance.chartStatuses.active")} />
              <Bar dataKey="inactive" stackId="a" fill="#2563eb" name={t("governance.chartStatuses.inactive")} />
              <Bar dataKey="review" stackId="a" fill="#d97706" name={t("governance.chartStatuses.review")} />
              <Bar dataKey="inDev" stackId="a" fill="#ea580c" name={t("governance.chartStatuses.inDev")} />
              <Bar dataKey="missing" stackId="a" fill="#dc2626" name={t("governance.chartStatuses.missing")} />
              <Bar dataKey="pending" stackId="a" fill="#94a3b8" name={t("governance.chartStatuses.pending")} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <CardHeader title={t("governance.policiesTitle")} subtitle={t("governance.editHint")} action={
          <div className="flex flex-wrap gap-2">
            {(["general", "university", "humanitarian", "education", "all"] as const).map((k)=>(
              <Button key={k} size="sm" variant={cat === k ? "default" : "outline"} onClick={()=>setCat(k)} className="text-xs">{t(`governance.categories.${k}`)}</Button>
            ))}
          </div>
        } />
        <ScrollableTable>
          <table className="oid-table">
            <thead>
              <tr>
                <th className="px-3 py-2 text-start font-medium">{t("governance.code")}</th>
                <th className="px-3 py-2 text-start font-medium">{t("governance.policy")}</th>
                {ORGS.map(o => (
                  <th key={o.id} className="text-center min-w-[90px]" style={{ background: `linear-gradient(135deg, ${o.color}dd, ${o.color}99)` }}>
                    {o.abbr}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map(p => (
                <tr key={p.id} className="border-t border-border">
                  <td className="px-3 py-2 font-mono text-xs">{p.id}</td>
                  <td className="px-3 py-2">{t(`governance.policies.${p.id}`)}</td>
                  {ORGS.map(o => {
                    const s = effectivePolicyStatus(p.id, o.id, p.values[o.id]) ?? "pending";
                    const meta = POLICY_STATUS_META[s];
                    return (
                      <td key={o.id} className="text-center py-1 px-2">
                        <select
                          value={s}
                          onChange={(e) => void handleStatusChange(p.id, o.id, e.target.value as PolicyStatus)}
                           title={t(`governance.statuses.${s}`)}
                          className={`w-full cursor-pointer rounded-md border px-1.5 py-1 text-[11px] font-semibold font-sans ${STATUS_SELECT_CLASS[s]}`}
                        >
                           {STATUS_OPTIONS.map(op => (
                             <option key={op} value={op}>{POLICY_STATUS_META[op].icon} {t(`governance.statuses.${op}`)}</option>
                          ))}
                        </select>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollableTable>
        <div className="flex flex-wrap gap-3 p-4 border-t border-border text-xs">
          {(Object.entries(POLICY_STATUS_META) as [PolicyStatus, any][]).map(([k, m]) => (
            <span key={k} className={`px-2 py-1 rounded ${m.bg} ${m.fg}`}>{m.icon} {t(`governance.statuses.${k}`)}</span>
          ))}
        </div>
      </Card>
    </div>
  );
}
