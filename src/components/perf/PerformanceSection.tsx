import { useState } from "react";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { loadPerfData } from "@/lib/perf/imports.functions";
import { ORGS } from "@/lib/org-registry";
import { useLang } from "@/lib/lang-context";
import { perfText } from "@/lib/perf/ui-text";
import { scorePlan } from "@/lib/perf/engine";
import type { Quarter } from "@/lib/perf/types";
import { FilterSelect, SectionTitle } from "@/routes/_authenticated/sections/_shared";
import { ScoreSummary, ReportSections } from "./PerformanceTables";
import { useAuth } from "@/hooks/use-auth";
import { useServerFn } from "@tanstack/react-start";
import { createPerfPlan } from "@/lib/perf/editor.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus } from "lucide-react";
import { PlanApproval } from "./PlanApproval";
import { EditableMatrix } from "./EditableMatrix";
import { ActualsEntry } from "./ActualsEntry";
import { IndicatorCard } from "./IndicatorCard";
import { ExportTemplateButton } from "./ExportTemplateButton";
import { usePerfEditor } from "./usePerfEditor";
export const perfQueryOptions = queryOptions({
  queryKey: ["perf-data"],
  queryFn: () => loadPerfData(),
});
export function PerformanceSection() {
  const { data } = useSuspenseQuery(perfQueryOptions);
  const { lang, dir } = useLang();
  const t = (k: string) => perfText(k, lang);
  const { isEditor, isAdmin } = useAuth();
  const create = useServerFn(createPerfPlan);
  const { busy, run, message } = usePerfEditor();
  const [newYear, setNewYear] = useState(2026);
  const [card, setCard] = useState<string | null>(null);
  const [selectedOrg, setOrg] = useState("");
  const orgId = selectedOrg || ORGS[0]?.id || "";
  const available = data.plans.filter((p) => p.org_id === orgId);
  const [selectedYear, setYear] = useState("");
  const year = available.some((p) => String(p.plan_year) === selectedYear)
    ? selectedYear
    : String(available[0]?.plan_year ?? data.activeYears[orgId] ?? 2026);
  const [period, setPeriod] = useState<Quarter>("Q2");
  const plan = available.find((p) => String(p.plan_year) === year);
  const kpis = data.kpis.filter((k) => k.plan_id === plan?.id);
  const activities = data.activities.filter((a) => a.plan_id === plan?.id);
  const report = data.reports.find((r) => r.plan_id === plan?.id && r.period === period);
  const labelYear = plan?.fiscal_type === "academic" ? `${year}/${Number(year) + 1}` : year;
  return (
    <div dir={dir} className="space-y-6">
      <SectionTitle title={t("title")} />
      <div className="flex flex-wrap gap-3">
        <FilterSelect
          label={t("org")}
          value={orgId}
          onChange={(v) => {
            setOrg(v);
            setYear("");
          }}
          options={ORGS.map((o) => ({ value: o.id, label: lang === "ar" ? o.nameAr : o.nameEn }))}
        />
        <FilterSelect
          label={t("year")}
          value={year}
          onChange={setYear}
          options={(available.length ? available.map((p) => p.plan_year) : [Number(year)]).map(
            (y) => ({
              value: String(y),
              label: plan?.fiscal_type === "academic" ? `${y}/${y + 1}` : String(y),
            }),
          )}
        />
        <FilterSelect
          label={t("period")}
          value={period}
          onChange={(v) => setPeriod(v as Quarter)}
          options={["Q1", "Q2", "Q3", "Q4"].map((q) => ({ value: q, label: q }))}
        />
      </div>
      {isEditor && (
        <div className="flex flex-wrap gap-2 items-center">
          <Input
            type="number"
            min={1900}
            max={2200}
            className="w-32"
            aria-label={t("newPlan")}
            value={newYear}
            onChange={(e) => setNewYear(Number(e.target.value))}
          />
          <Button
            variant="outline"
            disabled={busy || available.some((p) => p.plan_year === newYear)}
            onClick={async () => {
              if (await run(() => create({ data: { orgId, year: newYear } })))
                setYear(String(newYear));
            }}
          >
            <Plus size={16} />
            {t("newPlan")}
          </Button>
          {message && <span role="status">{message}</span>}
        </div>
      )}
      {!plan ? (
        <p className="py-12 text-center text-muted-foreground">{t("empty")}</p>
      ) : (
        <>
          <PlanApproval
            plan={plan}
            kpis={kpis}
            events={data.events.filter((e) => e.plan_id === plan.id)}
            editor={isEditor}
            admin={isAdmin}
            users={data.users}
          />
          <ExportTemplateButton
            input={{
              plan,
              orgName: ORGS.find((o) => o.id === orgId)?.nameAr ?? orgId,
              orgAbbr: ORGS.find((o) => o.id === orgId)?.abbr ?? orgId,
              period,
              kpis,
              activities,
              report,
            }}
          />
          <ScoreSummary score={scorePlan(kpis, period)} />
          <Tabs defaultValue="matrix" key={plan.id} dir={dir}>
            <TabsList className="flex flex-wrap h-auto">
              <TabsTrigger value="matrix">{t("matrix")}</TabsTrigger>
              <TabsTrigger value="actuals">{t("actuals")}</TabsTrigger>
              <TabsTrigger value="report">{t("executive")}</TabsTrigger>
            </TabsList>
            <TabsContent value="matrix">
              <EditableMatrix
                key={plan.id}
                plan={plan}
                kpis={kpis}
                period={period}
                editor={isEditor}
                onCard={setCard}
              />
            </TabsContent>
            <TabsContent value="actuals">
              <ActualsEntry
                key={`${plan.id}-${period}`}
                plan={plan}
                kpis={kpis}
                period={period}
                editor={isEditor}
                locked={data.reports.some((r) => r.plan_id === plan.id && r.status === "approved" && (r.period === period || r.period === "annual"))}
              />
            </TabsContent>
            <TabsContent value="report">
              <ReportSections report={report} />
            </TabsContent>
          </Tabs>
          {card && kpis.find((k) => k.id === card) && (
            <IndicatorCard
              key={card}
              kpi={kpis.find((k) => k.id === card) as (typeof kpis)[number]}
              plan={plan}
              editor={isEditor}
              close={() => setCard(null)}
              users={data.users}
            />
          )}
        </>
      )}
    </div>
  );
}
