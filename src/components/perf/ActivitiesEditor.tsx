import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { savePerfActivity, deletePerfActivity } from "@/lib/perf/editor.functions";
import type { Activity, KPI, Plan, Quarter, Report } from "@/lib/perf/types";
import { activityResult } from "@/lib/perf/engine";
import { useLang } from "@/lib/lang-context";
import { perfText, fieldLabel } from "@/lib/perf/ui-text";
import { OPTIONS, optionLabel } from "@/lib/perf/dictionary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Plus, Save, Trash2 } from "lucide-react";
import { ActivityTables, Value } from "./PerformanceTables";
import { ScrollableTable } from "@/components/oid/ScrollableTable";
import { usePerfEditor } from "./usePerfEditor";
const fields = [
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
];
const empty = (period: Quarter): Activity => ({
  quarter: period,
  activity_type: "program",
  title: "",
  target_group: null,
  implementer: null,
  beneficiaries: null,
  planned: null,
  achieved: null,
  kpi_id: null,
  kpi_code: null,
  notes: null,
});
export function ActivitiesEditor({
  activities,
  plan,
  kpis,
  period,
  report,
  editor,
}: {
  activities: Activity[];
  plan: Plan;
  kpis: KPI[];
  period: Quarter;
  report: Report | undefined;
  editor: boolean;
}) {
  const { lang, dir } = useLang();
  const t = (k: string) => perfText(k, lang);
  const [quarter, setQuarter] = useState("all"),
    [type, setType] = useState("all");
  const [drafts, setDrafts] = useState<Record<string, Activity>>({});
  const [adding, setAdding] = useState(false);
  const save = useServerFn(savePerfActivity),
    remove = useServerFn(deletePerfActivity);
  const { busy, run, message } = usePerfEditor();
  const rows = [...activities, ...(adding ? [{ ...empty(period), id: "new" }] : [])].filter(
    (a) =>
      (quarter === "all" || a.quarter === quarter) && (type === "all" || a.activity_type === type),
  );
  function update(row: Activity, field: string, value: unknown) {
    const key = row.id ?? "new";
    setDrafts((old) => ({ ...old, [key]: { ...row, ...old[key], [field]: value } }));
  }
  function chooser(
    label: string,
    value: string,
    options: { value: string; label: string }[],
    change: (v: string) => void,
    disabled = false,
  ) {
    return (
      <Select
        value={value || "__none"}
        onValueChange={(v) => change(v === "__none" ? "" : v)}
        disabled={disabled}
      >
        <SelectTrigger aria-label={label} className="min-w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value || "__none"}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap gap-3">
        {chooser(
          t("period"),
          quarter,
          [
            { value: "all", label: t("all") },
            ...["Q1", "Q2", "Q3", "Q4"].map((q) => ({ value: q, label: q })),
          ],
          setQuarter,
        )}
        {chooser(
          fieldLabel("activity_type", lang),
          type,
          [
            { value: "all", label: t("all") },
            ...Object.keys(OPTIONS.activity_type).map((v) => ({
              value: v,
              label: optionLabel("activity_type", v, lang),
            })),
          ],
          setType,
        )}
        {editor && (
          <Button
            variant="outline"
            disabled={adding}
            onClick={() => {
              setAdding(true);
              setQuarter("all");
              setType("all");
            }}
          >
            <Plus size={16} />
            {t("add")}
          </Button>
        )}
      </div>
      <ScrollableTable direction={dir}>
        <table className="oid-table" aria-label={t("activities")}>
          <thead>
            <tr>
              {fields.map((f) => (
                <th key={f}>{fieldLabel(f, lang)}</th>
              ))}
              {editor && <th>{t("save")}</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => {
              const row = drafts[a.id ?? "new"] ?? a;
              return (
                <tr key={a.id}>
                  {fields.map((f) => {
                    const val = f === "pct" ? activityResult(row) : row[f as keyof Activity];
                    return (
                      <td key={f} className={row.quarter === period ? "!bg-accent" : ""}>
                        {!editor || f === "pct" ? (
                          <Value field={f} value={val} />
                        ) : f === "quarter" ? (
                          chooser(
                            t("period"),
                            row.quarter,
                            ["Q1", "Q2", "Q3", "Q4"].map((q) => ({ value: q, label: q })),
                            (v) => update(a, f, v),
                            busy,
                          )
                        ) : f === "activity_type" ? (
                          chooser(
                            fieldLabel(f, lang),
                            row.activity_type,
                            Object.keys(OPTIONS.activity_type).map((v) => ({
                              value: v,
                              label: optionLabel("activity_type", v, lang),
                            })),
                            (v) => update(a, f, v),
                            busy,
                          )
                        ) : f === "kpi_code" ? (
                          chooser(
                            fieldLabel(f, lang),
                            row.kpi_id ?? "",
                            [
                              { value: "", label: "—" },
                              ...kpis.filter(k => k.id).map((k) => ({
                                value: k.id ?? "",
                                label: `${k.code} · ${k.name}`,
                              })),
                            ],
                            (v) => update(a, "kpi_id", v || null),
                            busy,
                          )
                        ) : (
                          <Input
                            aria-label={`${fieldLabel(f, lang)} ${a.id ?? "new"}`}
                            disabled={busy}
                            className={
                              ["beneficiaries", "planned", "achieved"].includes(f)
                                ? "min-w-24"
                                : "min-w-48"
                            }
                            type={
                              ["beneficiaries", "planned", "achieved"].includes(f)
                                ? "number"
                                : "text"
                            }
                            step="any"
                            value={String(val ?? "")}
                            onChange={(e) =>
                              update(
                                a,
                                f,
                                ["beneficiaries", "planned", "achieved"].includes(f)
                                  ? e.target.value === ""
                                    ? null
                                    : Number(e.target.value)
                                  : e.target.value,
                              )
                            }
                          />
                        )}
                      </td>
                    );
                  })}
                  {editor && (
                    <td>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="outline"
                          title={t("save")}
                          aria-label={`${t("save")} ${a.id}`}
                          disabled={busy || !row.title.trim()}
                          onClick={async () => {
                            const { id, plan_id, ...values } = row;
                            if (
                              await run(() =>
                                save({
                                  data: {
                                    id: id === "new" ? undefined : id,
                                    planId: plan.id,
                                    values,
                                  },
                                }),
                              )
                            ) {
                              setDrafts((old) => {
                                const next = { ...old };
                                delete next[a.id ?? "new"];
                                return next;
                              });
                              if (id === "new") setAdding(false);
                            }
                          }}
                        >
                          <Save size={14} />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          title={t("delete")}
                          aria-label={`${t("delete")} ${a.id}`}
                          disabled={busy}
                          onClick={() =>
                            a.id === "new"
                              ? setAdding(false)
                              : a.id &&
                                run(() => remove({ data: { id: a.id as string, planId: plan.id } }))
                          }
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </ScrollableTable>
      {message && <p role="status">{message}</p>}
      <ActivityTables activities={activities} report={report} period={period} />
    </section>
  );
}
