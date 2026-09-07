import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts";
import { ORGS, type OrgId, orgOverallScores, POLICY_STATUS_META, type PolicyStatus, generalPolicies, universityPolicies, humanitarianPolicies, educationPolicies } from "@/lib/oid-data";
import { ScrollableTable } from "@/components/oid/ScrollableTable";
import { loadGovernancePolicies, updatePolicyStatus } from "@/lib/dashboard.functions";
import { Card, CardHeader, useDashboardSnapshotQuery, SectionTitle } from "./_shared";

const STATUS_OPTIONS: { value: PolicyStatus; label: string }[] = [
  { value: "active", label: "✅ موجود ومفعّل" },
  { value: "inactive", label: "🔵 موجود وغير مفعّل" },
  { value: "review", label: "🟡 بحاجة تحديث" },
  { value: "inDev", label: "🟠 قيد الإعداد" },
  { value: "missing", label: "❌ غير موجود" },
  { value: "pending", label: "⏳ بيانات ناقصة" },
];

const ALL_POLICIES = [...generalPolicies, ...universityPolicies, ...humanitarianPolicies, ...educationPolicies];

/* ============================ GOVERNANCE ============================ */
export function GovernanceSection() {
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
      <SectionTitle title="الحوكمة والامتثال" subtitle="حالة السياسات والوثائق المؤسسية" />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {governanceScores.map(o => (
          <Card key={o.id} className="p-4 text-center">
            <div className="text-xs text-muted-foreground mb-2 whitespace-normal break-words">{o.nameAr}</div>
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
        <CardHeader title="جدول السياسات التفصيلي" subtitle="اختر الحالة من القائمة — تُحفظ تلقائياً" action={
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
                    const s = effectivePolicyStatus(p.id, o.id, p.values[o.id]) ?? "pending";
                    const meta = POLICY_STATUS_META[s];
                    return (
                      <td key={o.id} className="px-2 py-2 text-center">
                        <select
                          value={s}
                          onChange={(e) => void handleStatusChange(p.id, o.id, e.target.value as PolicyStatus)}
                          title={meta?.label}
                          className={`text-[11px] font-semibold rounded-md border border-border/60 px-1.5 py-1 cursor-pointer ${meta?.bg ?? ""} ${meta?.fg ?? ""}`}
                        >
                          {STATUS_OPTIONS.map(op => (
                            <option key={op.value} value={op.value}>{op.label}</option>
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
            <span key={k} className={`px-2 py-1 rounded ${m.bg} ${m.fg}`}>{m.icon} {m.label}</span>
          ))}
        </div>
      </Card>
    </div>
  );
}
