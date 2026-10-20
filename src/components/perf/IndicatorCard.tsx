import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { savePerfKpi } from "@/lib/perf/editor.functions";
import { suggestPerfFormula, approvePerfFormula } from "@/lib/perf/formula.functions";
import { CARD_FIELDS, EDIT_FIELDS, fieldEditable } from "@/lib/perf/edit-rules";
import type { KPI, Plan } from "@/lib/perf/types";
import { useLang } from "@/lib/lang-context";
import { perfText, fieldLabel } from "@/lib/perf/ui-text";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Sparkles, Check, Save } from "lucide-react";
import { PerfField } from "./PerfField";
import { Value } from "./PerformanceTables";
import { usePerfEditor } from "./usePerfEditor";
export function IndicatorCard({ kpi, plan, editor, close }: { kpi: KPI; plan: Plan; editor: boolean; close: () => void }) {
  const {lang,dir}=useLang();const t=(k:string)=>perfText(k,lang);const [patch,setPatch]=useState<Record<string,string|number|null>>({});
  const row={...kpi,...patch} as KPI;const save=useServerFn(savePerfKpi), suggest=useServerFn(suggestPerfFormula), approve=useServerFn(approvePerfFormula);const {busy,run,message}=usePerfEditor();
  const dirty=Object.keys(patch).length>0;
  async function persist(){if(!kpi.id)return false; const ok=await run(()=>save({data:{id:kpi.id,planId:plan.id,values:patch}}));if(ok)setPatch({});return ok;}
  return <Sheet open onOpenChange={(open)=>!open&&close()}><SheetContent side={dir==="rtl"?"left":"right"} className="w-full sm:max-w-2xl overflow-y-auto" dir={dir}><SheetHeader><SheetTitle>{t("card")} · <span dir="ltr">{kpi.code}</span></SheetTitle></SheetHeader><div className="space-y-5 px-4 pb-8"><div className="flex flex-wrap gap-2 items-center"><span className="text-sm text-primary">{t(dirty && "calculation_formula" in patch ? "suggested" : kpi.calc_formula_status??"none")}</span>{kpi.calc_formula_approved_at && <span className="text-xs">{kpi.calc_formula_approved_by} · {kpi.calc_formula_approved_at}</span>}</div><div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{EDIT_FIELDS.filter((f)=>!(CARD_FIELDS as readonly string[]).includes(f)).map((f)=><label key={f} className="space-y-1 text-xs"><span className="block">{fieldLabel(f,lang)}</span><PerfField field={f} row={row} value={row[f as keyof KPI]} disabled={!editor||!fieldEditable(plan.status,f)||busy} onChange={(v)=>setPatch((old)=>({...old,[f]:v}))}/></label>)}</div>{CARD_FIELDS.map((f)=><label key={f} className="block space-y-1 text-sm"><span>{fieldLabel(f,lang)}</span>{editor ? <Textarea aria-label={fieldLabel(f,lang)} disabled={busy} value={String(row[f]??"")} onChange={(e)=>setPatch((old)=>({...old,[f]:e.target.value}))}/> : <div className="whitespace-pre-wrap"><Value field={f} value={row[f]}/></div>}</label>)}{editor && <div className="flex flex-wrap gap-2"><Button disabled={busy||!dirty} onClick={persist}><Save size={16}/>{t("save")}</Button><Button variant="outline" disabled={busy||dirty} onClick={()=>kpi.id&&run(()=>suggest({data:{id:kpi.id as string}}))}><Sparkles size={16}/>{t("suggestFormula")}</Button><Button variant="outline" disabled={busy||dirty||!kpi.calculation_formula||kpi.calc_formula_status==="approved"} onClick={()=>kpi.id&&run(()=>approve({data:{id:kpi.id as string}}))}><Check size={16}/>{t("approveFormula")}</Button></div>}{message&&<p role="status">{message}</p>}</div></SheetContent></Sheet>;
}