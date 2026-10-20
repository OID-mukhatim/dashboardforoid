import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useLang } from "@/lib/lang-context";
import { OPTIONS, optionLabel } from "@/lib/perf/dictionary";
import { fieldLabel } from "@/lib/perf/ui-text";
import { allowedUnits, allowedMethods, NUMERIC_FIELDS } from "@/lib/perf/edit-rules";
import type { KPI } from "@/lib/perf/types";
export function PerfField({ field, row, value, disabled, onChange }: { field: string; row: KPI; value: unknown; disabled?: boolean; onChange: (v: string | number | null) => void }) {
  const { lang } = useLang();
  const group = field as keyof typeof OPTIONS;
  if (field in OPTIONS) {
    const allowed = field === "unit" ? allowedUnits(row) : field === "calc_method" ? allowedMethods(row) : Object.keys(OPTIONS[group]);
    const current = String(value ?? "");
    const invalid = current && !allowed.includes(current);
    return <Select value={current} disabled={disabled} onValueChange={onChange}><SelectTrigger aria-label={fieldLabel(field, lang)} className={`min-w-40 ${invalid ? "border-destructive text-destructive" : ""}`}><SelectValue /></SelectTrigger><SelectContent>{invalid && <SelectItem value={current}>{optionLabel(group, current, lang)}</SelectItem>}{allowed.map((v) => <SelectItem key={v} value={v}>{optionLabel(group, v, lang)}</SelectItem>)}</SelectContent></Select>;
  }
  const numeric = (NUMERIC_FIELDS as readonly string[]).includes(field) || field === "seq";
  return <Input aria-label={fieldLabel(field, lang)} type={numeric ? "number" : "text"} step="any" min={field === "weight" ? 0 : undefined} className={numeric ? "min-w-24 w-28 tabular-nums" : "min-w-56"} value={value === null || value === undefined ? "" : String(value)} disabled={disabled} onChange={(e) => onChange(numeric ? e.target.value === "" ? null : Number(e.target.value) : e.target.value)} />;
}