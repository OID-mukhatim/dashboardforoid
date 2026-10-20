import type { ReactNode } from "react";
import { ScrollableTable } from "@/components/oid/ScrollableTable";
import { TranslatableText } from "@/components/oid/TranslatableText";
import { useLang } from "@/lib/lang-context";
import { optionLabel, OPTIONS } from "@/lib/perf/dictionary";
import { perfText, fieldLabel, formatNumber } from "@/lib/perf/ui-text";
import { scorePlan, activityResult, activityTotals, operationalSummary } from "@/lib/perf/engine";
import { PERSPECTIVES, type KPI, type Activity, type Report, type Quarter } from "@/lib/perf/types";
const optionFields = [
  "perspective",
  "measurement",
  "role",
  "unit",
  "polarity",
  "calc_method",
  "activity_type",
];
export function Value({ field, value }: { field: string; value: unknown }) {
  const { lang } = useLang();
  if (value === null || value === undefined || value === "") return <>—</>;
  if (optionFields.includes(field))
    return <>{optionLabel(field as keyof typeof OPTIONS, String(value), lang)}</>;
  if (typeof value === "number") return <>{formatNumber(value)}</>;
  const s = String(value);
  if (["code", "kpi_code", "quarter"].includes(field)) return <span dir="ltr">{s}</span>;
  return <TranslatableText text={s} sourceLang={/[\u0600-\u06ff]/.test(s) ? "ar" : "en"} />;
}
export function DataTable({
  columns,
  rows,
  label,
}: {
  columns: string[];
  rows: Record<string, unknown>[];
  label: string;
}) {
  const { lang, dir } = useLang();
  return (
    <ScrollableTable direction={dir}>
      <table className="oid-table" aria-label={label}>
        <thead>
          <tr>
            {columns.map((f) => (
              <th key={f}>{fieldLabel(f, lang)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((r, i) => (
              <tr key={i}>
                {columns.map((f) => (
                  <td key={f} className={typeof r[f] === "number" ? "tabular-nums" : ""}>
                    <Value field={f} value={r[f]} />
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length}>—</td>
            </tr>
          )}
        </tbody>
      </table>
    </ScrollableTable>
  );
}
export function ScoreSummary({ score }: { score: ReturnType<typeof scorePlan> }) {
  const { lang, dir } = useLang();
  const t = (k: string) => perfText(k, lang);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-y border-border py-4">
        <div>
          <div className="text-xs text-muted-foreground">
            {t("overall")} · {t("annual")}
          </div>
          <strong className="text-2xl tabular-nums" data-testid="annual-overall">
            {formatNumber(score.annual)}%
          </strong>
          <span className="ms-2 text-sm">
            {optionLabel("rating", score.annualRating ?? "", lang)}
          </span>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">
            {t("overall")} · {t("toDate")}
          </div>
          <strong className="text-2xl tabular-nums text-primary" data-testid="to-date-overall">
            {formatNumber(score.toDate)}
            {score.toDate !== null ? "%" : ""}
          </strong>
          <span className="ms-2 text-sm">
            {score.toDateRating ? optionLabel("rating", score.toDateRating, lang) : "—"}
          </span>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">{t("completeness")}</div>
          <strong className="text-2xl tabular-nums">
            {formatNumber(score.completeness === null ? null : score.completeness * 100)}
            {score.completeness !== null ? "%" : ""}
          </strong>
          <span className="ms-2 text-sm" dir="ltr">
            {score.complete} / {score.due}
          </span>
        </div>
      </div>
      <ScrollableTable direction={dir}>
        <table className="oid-table" aria-label={t("overall")}>
          <thead>
            <tr>
              <th>{fieldLabel("perspective", lang)}</th>
              <th>{t("weight")}</th>
              <th>{t("annual")} /25</th>
              <th>{t("annualPct")}</th>
              <th>{t("toDate")} /25</th>
              <th>{t("pct")}</th>
            </tr>
          </thead>
          <tbody>
            {score.perspectives.map((p) => (
              <tr key={p.id}>
                <td>{optionLabel("perspective", p.id, lang)}</td>
                <td className="tabular-nums">{p.weight}</td>
                <td className="tabular-nums">{formatNumber(p.annual)}</td>
                <td className="tabular-nums">
                  {formatNumber(p.annualPct)}% ·{" "}
                  {p.annualRating ? optionLabel("rating", p.annualRating, lang) : "—"}
                </td>
                <td className="tabular-nums">{formatNumber(p.toDate)}</td>
                <td className="tabular-nums">
                  {formatNumber(p.toDatePct)}
                  {p.toDatePct !== null ? "%" : ""} ·{" "}
                  {p.toDatePct !== null
                    ? optionLabel(
                        "rating",
                        p.toDatePct < 60
                          ? "weak"
                          : p.toDatePct < 75
                            ? "average"
                            : p.toDatePct < 90
                              ? "good"
                              : "excellent",
                        lang,
                      )
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollableTable>
    </div>
  );
}
const matrixColumns = [
  "code",
  "objective",
  "name",
  "measurement",
  "role",
  "unit",
  "polarity",
  "calc_method",
  "weight",
  "baseline",
  "annual_target",
  "total_bt",
  "q1_plan",
  "q1_actual",
  "q2_plan",
  "q2_actual",
  "q3_plan",
  "q3_actual",
  "q4_plan",
  "q4_actual",
  "annual_achieved",
  "annual_pct",
  "weighted",
  "to_date",
];
export function Matrix({ kpis, period, year }: { kpis: KPI[]; period: Quarter; year: string }) {
  const { lang, dir } = useLang();
  const score = scorePlan(kpis, period);
  return (
    <div className="space-y-6">
      {PERSPECTIVES.map((p) => (
        <section key={p} className="space-y-2">
          <h3 className="font-semibold">{optionLabel("perspective", p, lang)}</h3>
          <ScrollableTable direction={dir}>
            <table className="oid-table" aria-label={p}>
              <thead>
                <tr>
                  {matrixColumns.map((c) => (
                    <th key={c}>{fieldLabel(c, lang)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {score.rows
                  .filter((r) => r.kpi.perspective === p)
                  .map(({ kpi, annual, toDate }) => (
                    <tr key={kpi.code}>
                      {matrixColumns.map((c) => {
                        const val =
                          c === "to_date"
                            ? toDate.pct
                            : c in annual
                              ? annual[c as keyof typeof annual]
                              : (kpi as unknown as Record<string, unknown>)[c];
                        return (
                          <td key={c} className={typeof val === "number" ? "tabular-nums" : ""}>
                            {c === "code" ? (
                              <div className="whitespace-nowrap" dir="ltr">
                                {kpi.code}
                                <span className="block text-xs text-muted-foreground">{year}</span>
                              </div>
                            ) : c === "to_date" ? (
                              <div>
                                <span dir="ltr">
                                  {formatNumber(val)}
                                  {val !== null ? "%" : ""}
                                </span>
                                {(!toDate.due || toDate.missing || toDate.no_plan) && (
                                  <div className="text-xs text-muted-foreground whitespace-normal">
                                    {!toDate.due && perfText("notDue", lang)}
                                    {toDate.missing && perfText("missing", lang)}
                                    {toDate.no_plan && <div>{perfText("noPlan", lang)}</div>}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <Value field={c} value={val} />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
              </tbody>
            </table>
          </ScrollableTable>
        </section>
      ))}
    </div>
  );
}
function Totals({ activities, label }: { activities: Activity[]; label: string }) {
  const { lang, dir } = useLang();
  const totals = activityTotals(activities);
  return (
    <section>
      <h3 className="font-medium mb-2">{label}</h3>
      <ScrollableTable direction={dir}>
        <table className="oid-table" aria-label={label}>
          <thead>
            <tr>
              {["activity_type", "beneficiaries", "planned", "achieved", "pct"].map((f) => (
                <th key={f}>{fieldLabel(f, lang)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(totals).map(([type, a]) => (
              <tr key={type}>
                <td>
                  {type === "total"
                    ? perfText("total", lang)
                    : optionLabel("activity_type", type, lang)}
                </td>
                <td className="tabular-nums">{formatNumber(a.beneficiaries)}</td>
                <td className="tabular-nums">{formatNumber(a.planned)}</td>
                <td className="tabular-nums">{formatNumber(a.achieved)}</td>
                <td className="tabular-nums">
                  {formatNumber(a.pct)}
                  {a.pct !== null ? "%" : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollableTable>
    </section>
  );
}
export function ActivityTables({
  activities,
  report,
  period,
}: {
  activities: Activity[];
  report: Report | undefined;
  period: Quarter;
}) {
  const { lang, dir } = useLang();
  const t = (k: string) => perfText(k, lang);
  const summary = operationalSummary(activities, period, report?.planned_beneficiaries ?? null);
  return (
    <section className="space-y-4">
      <h2 className="font-semibold text-lg">{t("activities")}</h2>
      <DataTable
        label={t("activities")}
        columns={[
          "quarter",
          "activity_type",
          "title",
          "target_group",
          "implementer",
          "beneficiaries",
          "planned",
          "achieved",
          "pct",
          "kpi_code",
          "notes",
        ]}
        rows={activities.map((a) => ({ ...a, pct: activityResult(a) }))}
      />
      <Totals label={t("selected")} activities={activities.filter((a) => a.quarter === period)} />
      <Totals label={t("fullYear")} activities={activities} />
      <h3 className="font-medium">{t("operational")}</h3>
      <ScrollableTable direction={dir}>
        <table className="oid-table" aria-label={t("operational")}>
          <thead>
            <tr>
              <th>{t("operational")}</th>
              <th>{t("planned")}</th>
              <th>{t("achieved")}</th>
              <th>{t("pct")}</th>
              <th>{t("status")}</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(summary).map(([key, row]) => (
              <tr key={key}>
                <td>
                  {key === "beneficiaries" ? t(key) : optionLabel("activity_type", key, lang)}
                </td>
                <td className="tabular-nums">{formatNumber(row.planned)}</td>
                <td className="tabular-nums">{formatNumber(row.achieved)}</td>
                <td className="tabular-nums">
                  {formatNumber(row.pct)}
                  {row.pct !== null ? "%" : ""}
                </td>
                <td>{row.rating ? optionLabel("rating", row.rating, lang) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollableTable>
    </section>
  );
}
export function ReportSections({ report }: { report: Report | undefined }) {
  const { lang } = useLang();
  if (!report) return null;
  return (
    <div className="space-y-6">
      <section>
        <h2 className="font-semibold mb-2">{perfText("executive", lang)}</h2>
        <p className="text-sm whitespace-pre-wrap">
          <Value field="executive_summary" value={report.executive_summary} />
        </p>
      </section>
      {(["annual_stats", "achievements", "challenges", "proposals"] as const).map((key) => {
        const columns = {
          annual_stats: ["category", "previous", "current", "note"],
          achievements: ["achievement", "area", "impact", "kpi_code", "note"],
          challenges: ["challenge", "category", "impact", "reasons", "action", "status", "notes"],
          proposals: [
            "proposal",
            "justification",
            "impact",
            "priority",
            "cost",
            "timeline",
            "notes",
          ],
        }[key];
        return (
          <section key={key}>
            <h2 className="font-semibold mb-2">{perfText(key, lang)}</h2>
            <DataTable columns={columns} rows={report[key]} label={perfText(key, lang)} />
          </section>
        );
      })}
    </div>
  );
}
