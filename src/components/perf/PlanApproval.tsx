import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { transitionPerfPlan } from "@/lib/perf/editor.functions";
import { approvalIssues } from "@/lib/perf/edit-rules";
import { useLang } from "@/lib/lang-context";
import { perfText, issueText } from "@/lib/perf/ui-text";
import type { KPI, Plan } from "@/lib/perf/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Check, Undo2, History } from "lucide-react";
import { usePerfEditor } from "./usePerfEditor";
type Event = { id: string; from_status: string; to_status: string; reason: string | null; changed_by: string | null; changed_at: string };
export function PlanApproval({ plan, kpis, events, editor, admin }: { plan: Plan; kpis: KPI[]; events: Event[]; editor: boolean; admin: boolean }) {
  const { lang } = useLang(); const t = (k: string) => perfText(k, lang);
  const fn = useServerFn(transitionPerfPlan); const { run, busy, message } = usePerfEditor();
  const [reason, setReason] = useState(""); const [opening, setOpening] = useState(false);
  const [issues, setIssues] = useState<ReturnType<typeof approvalIssues>>([]);
  const next = plan.status === "draft" ? "objectives_approved" : "matrix_approved";
  async function approve() { const found = approvalIssues(kpis, next === "matrix_approved"); setIssues(found); if (!found.length) await run(() => fn({ data: { planId: plan.id, status: next } })); }
  return <section className="space-y-3 border-y border-border py-4">
    <div className="flex flex-wrap items-center gap-3"><strong>{t(plan.status)}</strong><span className="text-xs text-muted-foreground">{t("prepared")}: {plan.prepared_by || "—"}</span><span className="text-xs text-muted-foreground">{t("approvedBy")}: {plan.approved_by || "—"} · {plan.matrix_approved_at || plan.objectives_approved_at || "—"}</span></div>
    <div className="flex flex-wrap gap-2">{editor && plan.status !== "matrix_approved" && <Button disabled={busy} onClick={approve}><Check size={16}/>{t(next === "objectives_approved" ? "approveObjectives" : "approveMatrix")}</Button>}{admin && plan.status !== "draft" && <Button variant="outline" disabled={busy} onClick={() => setOpening(!opening)}><Undo2 size={16}/>{t("reopen")}</Button>}</div>
    {opening && <div className="space-y-2 max-w-xl"><Textarea aria-label={t("reason")} placeholder={t("reason")} value={reason} onChange={(e) => setReason(e.target.value)}/><Button disabled={busy || reason.trim().length < 10} onClick={async () => { if (await run(() => fn({ data: { planId: plan.id, status: plan.status === "matrix_approved" ? "objectives_approved" : "draft", reason } }))) setOpening(false); }}>{t("reopen")}</Button></div>}
    {issues.length > 0 && <ul role="alert" className="text-destructive text-sm list-disc ps-5">{issues.map((i,n) => <li key={n}>{issueText(i.code, lang)} · {i.detail}</li>)}</ul>}
    {message && <p role="status" className="text-sm">{message}</p>}
    <details><summary className="cursor-pointer text-sm"><History size={14} className="inline me-2"/>{t("history")} ({events.length})</summary><ul className="space-y-2 pt-3 text-xs">{events.map((e) => <li key={e.id}>{t(e.from_status)} → {t(e.to_status)} · {new Date(e.changed_at).toLocaleString(lang)} · {e.changed_by}<p className="whitespace-pre-wrap">{e.reason}</p></li>)}</ul></details>
  </section>;
}