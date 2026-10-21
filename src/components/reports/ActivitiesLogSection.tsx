import { useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { perfQueryOptions } from "@/components/perf/PerformanceSection";
import { ActivitiesEditor } from "@/components/perf/ActivitiesEditor";
import { ORGS } from "@/lib/org-registry";
import { useLang } from "@/lib/lang-context";
import { useAuth } from "@/hooks/use-auth";
import type { Quarter } from "@/lib/perf/types";
import { FilterSelect, SectionTitle } from "@/routes/_authenticated/sections/_shared";
import { usePlanSelection } from "./usePlanSelection";

export function ActivitiesLogSection() {
  const { data } = useSuspenseQuery(perfQueryOptions);
  const { lang, dir, t } = useLang();
  const { isEditor } = useAuth();
  const sel = usePlanSelection(data.plans, data.activeYears);
  const [period, setPeriod] = useState<Quarter>("Q1");
  const plan = sel.plan;
  const approved = (q: string) =>
    data.reports.some((r) => r.plan_id === plan?.id && r.status === "approved" && (r.period === q || r.period === "annual"));
  return (
    <div dir={dir} className="space-y-6">
      <SectionTitle title={t("nav.activities")} />
      <div className="flex flex-wrap gap-3">
        <FilterSelect label={lang === "ar" ? "المؤسسة" : "Institution"} value={sel.orgId} onChange={sel.setOrg}
          options={ORGS.map((o) => ({ value: o.id, label: lang === "ar" ? o.nameAr : o.nameEn }))} />
        <FilterSelect label={lang === "ar" ? "السنة" : "Year"} value={sel.year} onChange={sel.setYear} options={sel.yearOptions} />
        <FilterSelect label={lang === "ar" ? "الفترة" : "Period"} value={period} onChange={(v) => setPeriod(v as Quarter)}
          options={["Q1", "Q2", "Q3", "Q4"].map((q) => ({ value: q, label: q }))} />
      </div>
      {!plan ? (
        <p className="py-12 text-center text-muted-foreground">{lang === "ar" ? "لا توجد بيانات للفترة" : "No data for this period"}</p>
      ) : (
        <ActivitiesEditor
          key={plan.id}
          plan={plan}
          kpis={data.kpis.filter((k) => k.plan_id === plan.id)}
          activities={data.activities.filter((a) => a.plan_id === plan.id)}
          period={period}
          report={data.reports.find((r) => r.plan_id === plan.id && r.period === period)}
          editor={isEditor}
          locked={approved}
        />
      )}
    </div>
  );
}
