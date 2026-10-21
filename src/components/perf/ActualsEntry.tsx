import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { savePerfActuals } from "@/lib/perf/editor.functions";
import type { KPI, Plan, Quarter } from "@/lib/perf/types";
import { useLang } from "@/lib/lang-context";
import { perfText, fieldLabel } from "@/lib/perf/ui-text";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";
import { Value } from "./PerformanceTables";
import { ScrollableTable } from "@/components/oid/ScrollableTable";
import { usePerfEditor } from "./usePerfEditor";
import { correctPerf } from "@/lib/reports/reports.functions";
import { CorrectionDialog } from "@/components/reports/CorrectionDialog";
export function ActualsEntry({
  plan,
  kpis,
  period,
  editor,
  locked = false,
}: {
  plan: Plan;
  kpis: KPI[];
  period: Quarter;
  editor: boolean;
  locked?: boolean;
}) {
  const { lang, dir } = useLang();
  const t = (k: string) => perfText(k, lang);
  const [values, setValues] = useState<Record<string, number | null>>({});
  const fn = useServerFn(savePerfActuals);
  const { busy, run, message } = usePerfEditor();
  const correct = useServerFn(correctPerf);
  const [asking, setAsking] = useState(false);
  const actualField = `${period.toLowerCase()}_actual` as keyof KPI,
    planField = `${period.toLowerCase()}_plan` as keyof KPI;
  return (
    <section className="space-y-4">
      <ScrollableTable direction={dir}>
        <table className="oid-table" aria-label={t("actuals")}>
          <thead>
            <tr>
              {["code", "name", "unit", "calc_method", "planned", "achieved"].map((f) => (
                <th key={f}>{fieldLabel(f, lang)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {kpis.map((k) => (
              <tr key={k.id}>
                {["code", "name", "unit", "calc_method"].map((f) => (
                  <td key={f}>
                    <Value field={f} value={k[f as keyof KPI]} />
                  </td>
                ))}
                <td>
                  <Value field="planned" value={k[planField]} />
                  {k[planField] === null && (
                    <p className="text-xs text-muted-foreground">{t("notPlannedQuarter")}</p>
                  )}
                </td>
                <td>
                  <Input
                    aria-label={`${t("achieved")} ${k.code}`}
                    type="number"
                    step="any"
                    disabled={!editor || busy}
                    value={
                      k.id && k.id in values ? (values[k.id] ?? "") : String(k[actualField] ?? "")
                    }
                    onChange={(e) =>
                      k.id &&
                      setValues((old) => ({
                        ...old,
                        [k.id as string]: e.target.value === "" ? null : Number(e.target.value),
                      }))
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollableTable>
      {editor && (
        <Button
          disabled={busy}
          onClick={async () => {
            if (locked) return setAsking(true);
            if (
              await run(() =>
                fn({
                  data: {
                    planId: plan.id,
                    quarter: Number(period.slice(1)),
                    rows: kpis.flatMap((k) =>
                      k.id
                        ? [
                            {
                              id: k.id,
                              actual:
                                k.id in values
                                  ? (values[k.id] ?? null)
                                  : (k[actualField] as number | null),
                            },
                          ]
                        : [],
                    ),
                  },
                }),
              )
            )
              setValues({});
          }}
        >
          <Save size={16} />
          {t("save")}
        </Button>
      )}
      {message && <p role="status">{message}</p>}
      <CorrectionDialog
        open={asking}
        onCancel={() => setAsking(false)}
        onConfirm={async (reason) => {
          setAsking(false);
          const changed = kpis.filter((k) => k.id && k.id in values && values[k.id] !== k[actualField]);
          const ok = await run(async () => {
            for (const k of changed)
              await correct({ data: { planId: plan.id, period, table: "perf_kpis", recordId: k.id as string, field: String(actualField), value: values[k.id as string] ?? null, reason } });
          });
          if (ok) setValues({});
        }}
      />
    </section>
  );
}
