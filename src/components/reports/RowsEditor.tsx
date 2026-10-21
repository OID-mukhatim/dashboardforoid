import { useState } from "react";
import type { ReportValue } from "@/lib/perf/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Save } from "lucide-react";
import { useLang } from "@/lib/lang-context";
import { ScrollableTable } from "@/components/oid/ScrollableTable";

export type Column = {
  key: string; ar: string; en: string;
  type?: "text" | "number";
  options?: { value: string; label: string }[];
  compute?: (r: Record<string, ReportValue>) => string;
};
type Row = Record<string, ReportValue>;

/** Editable list of narrative rows; read-only when `onSave` is absent. */
export function RowsEditor({ columns, rows, onSave, busy, seed }: {
  columns: Column[]; rows: Row[]; onSave?: (rows: Row[]) => void; busy?: boolean; seed?: Row[];
}) {
  const { lang, dir } = useLang();
  const [draft, setDraft] = useState<Row[] | null>(null);
  const list = draft ?? (rows.length ? rows : onSave && seed ? seed : rows);
  const set = (i: number, k: string, v: ReportValue) =>
    setDraft(list.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  if (!onSave && !list.length)
    return <p className="text-sm text-muted-foreground">{lang === "ar" ? "لا توجد بيانات للفترة" : "No data for this period"}</p>;
  return (
    <div className="space-y-2">
      <ScrollableTable direction={dir}>
        <table className="oid-table">
          <thead><tr>{columns.map((c) => <th key={c.key}>{lang === "ar" ? c.ar : c.en}</th>)}{onSave && <th />}</tr></thead>
          <tbody>
            {list.map((r, i) => (
              <tr key={i}>
                {columns.map((c) => (
                  <td key={c.key}>
                    {c.compute ? c.compute(r) : !onSave ? (
                      c.options ? (c.options.find((o) => o.value === r[c.key])?.label ?? String(r[c.key] ?? "—")) : String(r[c.key] ?? "—")
                    ) : c.options ? (
                      <select aria-label={c.ar} className="px-2 py-1.5 rounded-md bg-muted border border-border text-sm"
                        value={String(r[c.key] ?? "")} onChange={(e) => set(i, c.key, e.target.value || null)}>
                        <option value="">—</option>
                        {c.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    ) : (
                      <Input aria-label={`${c.ar} ${i + 1}`} type={c.type === "number" ? "number" : "text"} step="any"
                        className={c.type === "number" ? "min-w-24" : "min-w-40"} value={String(r[c.key] ?? "")}
                        onChange={(e) => set(i, c.key, c.type === "number" ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value)} />
                    )}
                  </td>
                ))}
                {onSave && (
                  <td><Button size="icon" variant="ghost" aria-label="delete" onClick={() => setDraft(list.filter((_, j) => j !== i))}><Trash2 size={14} /></Button></td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollableTable>
      {onSave && (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setDraft([...list, {}])}><Plus size={14} />{lang === "ar" ? "إضافة صف" : "Add row"}</Button>
          <Button size="sm" disabled={busy || draft === null && !(seed && !rows.length)} onClick={() => { onSave(list); setDraft(null); }}>
            <Save size={14} />{lang === "ar" ? "حفظ" : "Save"}
          </Button>
        </div>
      )}
    </div>
  );
}
