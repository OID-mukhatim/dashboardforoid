import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { savePerfKpi, deletePerfKpi, reorderPerfKpis } from "@/lib/perf/editor.functions";
import { fieldEditable } from "@/lib/perf/edit-rules";
import { PERSPECTIVES, type KPI, type Plan, type Quarter } from "@/lib/perf/types";
import { scorePlan } from "@/lib/perf/engine";
import { perfText, fieldLabel, formatNumber } from "@/lib/perf/ui-text";
import { optionLabel } from "@/lib/perf/dictionary";
import { useLang } from "@/lib/lang-context";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, ArrowUp, ArrowDown, Save, FileText } from "lucide-react";
import { ScrollableTable } from "@/components/oid/ScrollableTable";
import { Value } from "./PerformanceTables";
import { PerfField } from "./PerfField";
import { usePerfEditor } from "./usePerfEditor";
export const MATRIX_FIELDS = [
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
export function EditableMatrix({
  kpis,
  plan,
  period,
  editor,
  onCard,
}: {
  kpis: KPI[];
  plan: Plan;
  period: Quarter;
  editor: boolean;
  onCard: (id: string) => void;
}) {
  const { lang, dir } = useLang();
  const t = (k: string) => perfText(k, lang);
  const [drafts, setDrafts] = useState<Record<string, Record<string, string | number | null>>>({});
  const save = useServerFn(savePerfKpi),
    remove = useServerFn(deletePerfKpi),
    reorder = useServerFn(reorderPerfKpis);
  const { busy, run, message } = usePerfEditor();
  const merged = kpis.map((k) => ({ ...k, ...(k.id ? drafts[k.id] : {}) })) as KPI[];
  const score = scorePlan(merged, period);
  function change(k: KPI, field: string, value: string | number | null) {
    if (!k.id) return;
    setDrafts((old) => ({ ...old, [k.id as string]: { ...old[k.id as string], [field]: value } }));
  }
  async function move(k: KPI, delta: number) {
    const rows = kpis.filter((r) => r.perspective === k.perspective).sort((a, b) => a.seq - b.seq);
    const i = rows.findIndex((r) => r.id === k.id);
    const other = rows[i + delta];
    if (!other) return;
    const ids = kpis.map((r) => r.id).filter((v): v is string => Boolean(v));
    const a = ids.indexOf(k.id ?? ""),
      b = ids.indexOf(other.id ?? "");
    [ids[a], ids[b]] = [ids[b], ids[a]];
    await run(() => reorder({ data: { planId: plan.id, ids } }));
  }
  return (
    <div className="space-y-6">
      {message && <p role="status">{message}</p>}
      {PERSPECTIVES.map((p) => {
        const group = score.rows
          .filter((r) => r.kpi.perspective === p)
          .sort((a, b) => a.kpi.seq - b.kpi.seq);
        const total = score.perspectives.find((v) => v.id === p);
        return (
          <section key={p} className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-semibold">
                {optionLabel("perspective", p, lang)}{" "}
                <span className="text-xs font-normal ms-3">
                  {t("remaining")}: {formatNumber(25 - (total?.weight ?? 0))}
                </span>
              </h3>
              {editor && plan.status === "draft" && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    run(() =>
                      save({
                        data: {
                          planId: plan.id,
                          values: {
                            perspective: p,
                            name: "",
                            objective: "",
                          },
                        },
                      }),
                    )
                  }
                >
                  <Plus size={14} />
                  {t("add")}
                </Button>
              )}
            </div>
            <ScrollableTable direction={dir}>
              <table className="oid-table" aria-label={p}>
                <thead>
                  <tr>
                    {MATRIX_FIELDS.map((f) => (
                      <th key={f}>{fieldLabel(f, lang)}</th>
                    ))}
                    {editor && <th>{t("save")}</th>}
                  </tr>
                </thead>
                <tbody>
                  {group.map(({ kpi: k, annual, toDate }, i) => (
                    <tr key={k.id ?? k.code}>
                      {MATRIX_FIELDS.map((f) => {
                        const calculated = [
                          "total_bt",
                          "annual_achieved",
                          "annual_pct",
                          "weighted",
                          "to_date",
                        ].includes(f);
                        const val =
                          f === "to_date"
                            ? toDate.pct
                            : f in annual
                              ? annual[f as keyof typeof annual]
                              : (k as unknown as Record<string, unknown>)[f];
                        return (
                          <td key={f} className={calculated ? "!bg-accent tabular-nums" : ""}>
                            {f === "code" ? (
                              <div dir="ltr" className="whitespace-nowrap">
                                {k.code}
                                <span className="block text-xs text-muted-foreground">
                                  {t(k.calc_formula_status ?? "none")}
                                </span>
                                {editor && plan.status === "draft" && <PerfField field="perspective" row={k} value={k.perspective} disabled={busy} onChange={v => change(k, "perspective", v)} />}
                              </div>
                            ) : f === "name" ? (
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title={t("card")}
                                  aria-label={`${t("card")} ${k.code}`}
                                  onClick={() => k.id && onCard(k.id)}
                                >
                                  <FileText size={16} />
                                </Button>
                                {editor && fieldEditable(plan.status, f) ? (
                                  <PerfField
                                    field={f}
                                    row={k}
                                    value={val}
                                    onChange={(v) => change(k, f, v)}
                                  />
                                ) : (
                                  <Value field={f} value={val} />
                                )}
                              </div>
                            ) : f === "objective" &&
                              i > 0 &&
                              group[i - 1]?.kpi.objective === k.objective ? null : editor &&
                              !calculated &&
                              fieldEditable(plan.status, f) ? (
                              <PerfField
                                field={f}
                                row={k}
                                value={val}
                                onChange={(v) => change(k, f, v)}
                              />
                            ) : (
                              <Value field={f} value={val} />
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
                              aria-label={`${t("save")} ${k.code}`}
                              title={t("save")}
                              disabled={busy || !k.id || !drafts[k.id]}
                              onClick={async () => {
                                if (!k.id) return;
                                const key = k.id;
                                if (
                                  await run(() =>
                                    save({
                                      data: { id: key, planId: plan.id, values: drafts[key] ?? {} },
                                    }),
                                  )
                                )
                                  setDrafts((old) => {
                                    const next = { ...old };
                                    delete next[key];
                                    return next;
                                  });
                              }}
                            >
                              <Save size={14} />
                            </Button>
                            {plan.status === "draft" && (
                              <>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  title={t("up")}
                                  aria-label={`${t("up")} ${k.code}`}
                                  disabled={busy || i === 0}
                                  onClick={() => move(k, -1)}
                                >
                                  <ArrowUp size={14} />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  title={t("down")}
                                  aria-label={`${t("down")} ${k.code}`}
                                  disabled={busy || i === group.length - 1}
                                  onClick={() => move(k, 1)}
                                >
                                  <ArrowDown size={14} />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  title={t("delete")}
                                  aria-label={`${t("delete")} ${k.code}`}
                                  disabled={busy}
                                  onClick={() =>
                                    k.id &&
                                    run(() =>
                                      remove({ data: { id: k.id as string, planId: plan.id } }),
                                    )
                                  }
                                >
                                  <Trash2 size={14} />
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={8} className="font-semibold">
                      {t("total")}
                    </td>
                    <td>{formatNumber(total?.weight)}</td>
                    <td colSpan={13} />
                    <td>{formatNumber(total?.annual)}</td>
                    <td>{formatNumber(total?.toDatePct)}</td>
                    {editor && <td />}
                  </tr>
                </tbody>
              </table>
            </ScrollableTable>
          </section>
        );
      })}
    </div>
  );
}
