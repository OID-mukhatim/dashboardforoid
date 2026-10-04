/**
 * قسم "أعمال المكتب" — أربعة تبويبات: خطط المكتب، الاجتماعات، الزيارات، متابعات المؤسسات.
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2, Plus, Trash2, Printer, Eye, ArrowLeft, CheckCircle2, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ORGS, type OrgId } from "@/lib/oid-data";
import { OrgLogo } from "@/components/oid/OrgLogo";
import { useLang } from "@/lib/lang-context";
import { Card, CardHeader } from "./_shared";
import { TasksSection } from "./TasksSection";
import { exportMeetingPDF, exportVisitPDF } from "@/lib/office-pdf";
import {
  loadMeetings, saveMeeting, deleteMeeting, convertDecisionToTask,
  loadVisits, saveVisit, deleteVisit, convertGapToTask, loadPrevVisitGaps,
  loadPlans, savePlan, deletePlan, saveActivity, deleteActivity, convertActivityToTask,
  type Attendee, type DecisionInput, type GapInput,
} from "@/lib/office-api";

const orgLabel = (lang: string, id: string) => { const org = ORGS.find(o => o.id === id); return org ? (lang === "en" ? org.nameEn : org.nameAr) : id; };

const SELECT_CLS =
  "text-xs px-3 py-2 rounded-md border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary/30";

const MEETING_TYPES = [
  { id: "internal", label: "داخلي" },
  { id: "with_institution", label: "مع مؤسسة" },
  { id: "board", label: "مجلس أمناء" },
];
const VISIT_TYPES = [
  { id: "scheduled", label: "دورية مجدولة" },
  { id: "surprise", label: "مفاجئة رقابية" },
  { id: "field", label: "ميدانية" },
  { id: "other", label: "أخرى" },
];
const PERFORMANCE = [
  { id: "excellent", label: "⭐⭐⭐ ممتاز", color: "#10b981" },
  { id: "good", label: "⭐⭐ جيد", color: "#2563eb" },
  { id: "medium", label: "⭐ متوسط", color: "#f59e0b" },
  { id: "weak", label: "ضعيف", color: "#dc2626" },
];
const ACT_STATUS = [
  { id: "open", label: "مفتوح", color: "#64748b" },
  { id: "inProgress", label: "جارٍ", color: "#2563eb" },
  { id: "done", label: "مكتمل", color: "#10b981" },
];

const labelOf = (list: { id: string; label: string }[], id: string) =>
  list.find((x) => x.id === id)?.label ?? id;

export function OfficeSection() {
  const { t } = useLang();
  const [tab, setTab] = useState<"plans" | "meetings" | "visits" | "tasks">("meetings");
  const TABS = [
    { id: "plans", icon: "📋", label: "خطط المكتب" },
    { id: "meetings", icon: "🤝", label: "الاجتماعات" },
    { id: "visits", icon: "🏢", label: "الزيارات" },
    { id: "tasks", icon: "✅", label: "متابعات المؤسسات" },
  ] as const;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Building2 size={20} className="text-primary" />
        <div>
          <h2 className="text-lg font-bold leading-tight">{t("office.أعمال المكتب")}</h2>
          <p className="text-[11px] text-muted-foreground">{t("office.مكتب الإشراف والتطوير المؤسسي — OID")}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border">
        {TABS.map((tabItem) => (
          <button
            key={tabItem.id}
            type="button"
            onClick={() => setTab(tabItem.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-2 ${
              tab === tabItem.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>{tabItem.icon}</span>
            {t("office." + tabItem.label)}
          </button>
        ))}
      </div>

      {tab === "plans" && <PlansTab />}
      {tab === "meetings" && <MeetingsTab />}
      {tab === "visits" && <VisitsTab />}
      {tab === "tasks" && <TasksSection />}
    </div>
  );
}

/* ══════════════════════ عناصر مشتركة ══════════════════════ */

function StatusBadge({ status }: { status: string }) {
  const { t } = useLang();
  const final = status === "final";
  return (
    <span
      className="text-[10px] px-1.5 py-0.5 rounded font-medium"
      style={{ background: final ? "#10b98122" : "#94a3b822", color: final ? "#10b981" : "#64748b" }}
    >
      {t("office." + (final ? "معتمد" : "مسودة"))}
    </span>
  );
}

function FieldBox({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <Card className="p-6 text-sm text-muted-foreground text-center">{text}</Card>;
}

/* ══════════════════════ تبويب الاجتماعات ══════════════════════ */

function MeetingsTab() {
  const { t, lang } = useLang();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const { data: rows = [], isLoading } = useQuery({ queryKey: ["meetings"], queryFn: loadMeetings });

  async function remove(id: string) {
    if (!confirm(t("office.حذف هذا الاجتماع؟"))) return;
    try {
      await deleteMeeting(id);
      toast.success(t("office.تم الحذف"));
      qc.invalidateQueries({ queryKey: ["meetings"] });
    } catch (e: any) { toast.error(e.message); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{rows.length} {t("office.اجتماع")}</span>
        <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus size={15} className="ms-1" /> {t("office.اجتماع جديد")}
        </Button>
      </div>

      {isLoading ? <EmptyState text={t("office.جارٍ التحميل…")} /> : rows.length === 0 ? (
        <EmptyState text={t("office.لا توجد اجتماعات مسجّلة بعد.")} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {rows.map((m: any) => {
            const decisions = m.meeting_decisions ?? [];
            const converted = decisions.filter((d: any) => d.converted).length;
            return (
              <Card key={m.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-sm">{m.title}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {t("office." + labelOf(MEETING_TYPES, m.meeting_type))}
                      {m.org_id ? ` — ${orgLabel(lang, m.org_id)}` : ""}
                    </div>
                  </div>
                  <StatusBadge status={m.status} />
                </div>
                <div className="text-[11px] text-muted-foreground flex flex-wrap gap-2">
                  <span>📅 {m.date}</span>
                  {m.location && <span>📍 {m.location}</span>}
                  {m.duration && <span>⏱ {m.duration}</span>}
                </div>
                <div className="text-[11px]">
                  {t("office.القرارات:")} <b>{decisions.length}</b> — {t("office.المحوّلة لمهام:")} <b className="text-primary">{converted}</b>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={() => { setEditing(m); setOpen(true); }}>
                    <Eye size={14} className="ms-1" /> {t("office.عرض")}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => exportMeetingPDF(m, lang)}>
                    <Printer size={14} className="ms-1" /> {t("office.تصدير محضر")}
                  </Button>
                  <Button size="sm" variant="ghost" className="text-danger" onClick={() => remove(m.id)}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <MeetingDialog open={open} onOpenChange={setOpen} editing={editing} />
    </div>
  );
}

function MeetingDialog({ open, onOpenChange, editing }: { open: boolean; onOpenChange: (v: boolean) => void; editing: any | null }) {
  const { t, lang, dir } = useLang();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [duration, setDuration] = useState("");
  const [location, setLocation] = useState("");
  const [type, setType] = useState("internal");
  const [orgId, setOrgId] = useState("");
  const [objective, setObjective] = useState("");
  const [minutes, setMinutes] = useState("");
  const [outputs, setOutputs] = useState("");
  const [status, setStatus] = useState("draft");
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [decisions, setDecisions] = useState<DecisionInput[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(editing?.title ?? "");
    setDate(editing?.date ?? new Date().toISOString().slice(0, 10));
    setDuration(editing?.duration ?? "");
    setLocation(editing?.location ?? "");
    setType(editing?.meeting_type ?? "internal");
    setOrgId(editing?.org_id ?? "");
    setObjective(editing?.objective ?? "");
    setMinutes(editing?.minutes ?? "");
    setOutputs(editing?.outputs ?? "");
    setStatus(editing?.status ?? "draft");
    setAttendees((editing?.attendees as Attendee[]) ?? []);
    setDecisions((editing?.meeting_decisions ?? []).map((d: any) => ({ ...d })));
  }, [open, editing]);

  async function save() {
    if (!title.trim()) return toast.error(t("office.عنوان الاجتماع مطلوب"));
    if (!date) return toast.error(t("office.التاريخ مطلوب"));
    setSaving(true);
    try {
      await saveMeeting({
        id: editing?.id,
        title: title.trim(),
        date,
        duration: duration || null,
        location: location || null,
        meeting_type: type,
        org_id: type === "with_institution" ? orgId || null : null,
        objective: objective || null,
        minutes: minutes || null,
        outputs: outputs || null,
        attendees,
        status,
        decisions,
      });
      toast.success(t("office.تم حفظ الاجتماع"));
      qc.invalidateQueries({ queryKey: ["meetings"] });
      onOpenChange(false);
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  }

  async function convert(d: DecisionInput) {
    if (!d.id) return toast.error(t("office.احفظ الاجتماع أولاً قبل تحويل القرار لمهمة"));
    try {
      await convertDecisionToTask({
        decisionId: d.id,
        meetingId: editing.id,
        decision: d.decision,
        assignedTo: d.assigned_to,
        dueDate: d.due_date,
        orgId: orgId || null,
      });
      setDecisions((prev) => prev.map((x) => (x.id === d.id ? { ...x, converted: true } : x)));
      toast.success(t("office.تم إنشاء مهمة متابعة"));
      qc.invalidateQueries({ queryKey: ["office_tasks"] });
      qc.invalidateQueries({ queryKey: ["meetings"] });
    } catch (e: any) { toast.error(e.message); }
  }

  const upd = (i: number, patch: Partial<DecisionInput>) =>
    setDecisions((prev) => prev.map((d, ix) => (ix === i ? { ...d, ...patch } : d)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir={dir}>
        <DialogHeader><DialogTitle>{editing ? t("office.الاجتماع") : t("office.اجتماع جديد")}</DialogTitle></DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <FieldBox label={t("office.عنوان الاجتماع *")}>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </FieldBox>
            </div>
            <FieldBox label={t("office.التاريخ *")}><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></FieldBox>
            <FieldBox label={t("office.المدة")}><Input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder={t("office.ساعتان")} /></FieldBox>
            <FieldBox label={t("office.المكان")}><Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder={t("office.حضوري / عن بعد")} /></FieldBox>
            <FieldBox label={t("office.نوع الاجتماع")}>
              <select className={SELECT_CLS + " w-full"} value={type} onChange={(e) => setType(e.target.value)}>
                {MEETING_TYPES.map((item) => <option key={item.id} value={item.id}>{t("office." + item.label)}</option>)}
              </select>
            </FieldBox>
            {type === "with_institution" && (
              <FieldBox label={t("office.المؤسسة المعنية")}>
                <select className={SELECT_CLS + " w-full"} value={orgId} onChange={(e) => setOrgId(e.target.value)}>
                  <option value="">{t("office.— اختر —")}</option>
                  {ORGS.map((o) => <option key={o.id} value={o.id}>{lang === "en" ? o.nameEn : o.nameAr}</option>)}
                </select>
              </FieldBox>
            )}
            <FieldBox label={t("office.الحالة")}>
              <select className={SELECT_CLS + " w-full"} value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="draft">{t("office.مسودة")}</option>
                <option value="final">{t("office.معتمد")}</option>
              </select>
            </FieldBox>
          </div>

          {/* الحضور */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">{t("office.الحضور")}</Label>
              <Button size="sm" variant="outline" onClick={() => setAttendees([...attendees, { name: "", role: "" }])}>
                <Plus size={13} className="ms-1" /> {t("office.إضافة حاضر")}
              </Button>
            </div>
            {attendees.map((a, i) => (
              <div key={i} className="flex gap-2">
                <Input className="flex-1" placeholder={t("office.الاسم")} value={a.name}
                  onChange={(e) => setAttendees(attendees.map((x, ix) => ix === i ? { ...x, name: e.target.value } : x))} />
                <Input className="flex-1" placeholder={t("office.الصفة")} value={a.role}
                  onChange={(e) => setAttendees(attendees.map((x, ix) => ix === i ? { ...x, role: e.target.value } : x))} />
                <button type="button" className="text-muted-foreground hover:text-danger px-2"
                  onClick={() => setAttendees(attendees.filter((_, ix) => ix !== i))}><X size={15} /></button>
              </div>
            ))}
          </div>

          <FieldBox label={t("office.هدف الاجتماع")}><Textarea rows={2} value={objective} onChange={(e) => setObjective(e.target.value)} /></FieldBox>
          <FieldBox label={t("office.وقائع الاجتماع")}><Textarea rows={4} value={minutes} onChange={(e) => setMinutes(e.target.value)} /></FieldBox>
          <FieldBox label={t("office.مخرجات الاجتماع")}><Textarea rows={3} value={outputs} onChange={(e) => setOutputs(e.target.value)} /></FieldBox>

          {/* القرارات */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">{t("office.القرارات")}</Label>
              <Button size="sm" variant="outline" onClick={() => setDecisions([...decisions, { decision: "", assigned_to: "", due_date: "" }])}>
                <Plus size={13} className="ms-1" /> {t("office.إضافة قرار")}
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="oid-table">
                <thead>
                  <tr>
                    <th className="p-2 text-right">{t("office.القرار")}</th>
                    <th className="p-2 text-right w-32">{t("office.المكلف")}</th>
                    <th className="p-2 text-right w-36">{t("office.وقت الإنجاز")}</th>
                    <th className="p-2 text-right w-32">{t("office.تحويل")}</th>
                  </tr>
                </thead>
                <tbody>
                  {decisions.length === 0 && (
                    <tr><td colSpan={4} className="p-3 text-center text-muted-foreground">{t("office.لا توجد قرارات.")}</td></tr>
                  )}
                  {decisions.map((d, i) => (
                    <tr key={d.id ?? i} className="border-t border-border">
                      <td className="p-1"><Input value={d.decision} onChange={(e) => upd(i, { decision: e.target.value })} /></td>
                      <td className="p-1"><Input value={d.assigned_to ?? ""} onChange={(e) => upd(i, { assigned_to: e.target.value })} /></td>
                      <td className="p-1"><Input type="date" value={d.due_date ?? ""} onChange={(e) => upd(i, { due_date: e.target.value })} /></td>
                      <td className="p-1">
                        {d.converted ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
                            <CheckCircle2 size={13} /> {t("office.تم التحويل")}
                          </span>
                        ) : (
                          <div className="flex items-center gap-1">
                            <Button size="sm" variant="outline" onClick={() => convert(d)}>
                              <ArrowLeft size={12} className="ms-1" /> {t("office.مهمة")}
                            </Button>
                            <button type="button" className="text-muted-foreground hover:text-danger"
                              onClick={() => setDecisions(decisions.filter((_, ix) => ix !== i))}><X size={14} /></button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <DialogFooter>
          {editing && (
            <Button variant="outline" onClick={() => exportMeetingPDF({ ...editing, title, date, duration, location, meeting_type: type, org_id: orgId, objective, minutes, outputs, attendees, meeting_decisions: decisions }, lang)}>
              <Printer size={14} className="ms-1" /> {t("office.تصدير محضر")}
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("office.إغلاق")}</Button>
          <Button onClick={save} disabled={saving}>{saving ? t("office.جارٍ الحفظ…") : t("office.حفظ")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ══════════════════════ تبويب الزيارات ══════════════════════ */

function VisitsTab() {
  const { t, lang } = useLang();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const { data: rows = [], isLoading } = useQuery({ queryKey: ["visits"], queryFn: loadVisits });

  async function remove(id: string) {
    if (!confirm(t("office.حذف هذه الزيارة؟"))) return;
    try {
      await deleteVisit(id);
      toast.success(t("office.تم الحذف"));
      qc.invalidateQueries({ queryKey: ["visits"] });
    } catch (e: any) { toast.error(e.message); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{rows.length} {t("office.زيارة")}</span>
        <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus size={15} className="ms-1" /> {t("office.زيارة جديدة")}
        </Button>
      </div>

      {isLoading ? <EmptyState text={t("office.جارٍ التحميل…")} /> : rows.length === 0 ? (
        <EmptyState text={t("office.لا توجد زيارات مسجّلة بعد.")} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {rows.map((v: any) => {
            const gaps = v.visit_gaps ?? [];
            const converted = gaps.filter((g: any) => g.converted).length;
            const perf = PERFORMANCE.find((p) => p.id === v.performance);
            return (
              <Card key={v.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <OrgLogo orgId={v.org_id as OrgId} size={26} shape="circle" />
                    <div>
                      <div className="font-semibold text-sm">{orgLabel(lang, v.org_id)}</div>
                      <div className="text-[11px] text-muted-foreground">{t("office." + labelOf(VISIT_TYPES, v.visit_type))}</div>
                    </div>
                  </div>
                  <StatusBadge status={v.status} />
                </div>
                <div className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-2">
                  <span>📅 {v.date}</span>
                  {perf && (
                    <span className="px-1.5 py-0.5 rounded font-medium"
                      style={{ background: perf.color + "22", color: perf.color }}>{t("office." + perf.label)}</span>
                  )}
                </div>
                <div className="text-[11px]">
                  {t("office.الفجوات:")} <b>{gaps.length}</b> — {t("office.المحوّلة لمهام:")} <b className="text-primary">{converted}</b>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={() => { setEditing(v); setOpen(true); }}>
                    <Eye size={14} className="ms-1" /> {t("office.عرض")}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => exportVisitPDF(v, lang)}>
                    <Printer size={14} className="ms-1" /> {t("office.تصدير استمارة")}
                  </Button>
                  <Button size="sm" variant="ghost" className="text-danger" onClick={() => remove(v.id)}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <VisitDialog open={open} onOpenChange={setOpen} editing={editing} />
    </div>
  );
}

function VisitDialog({ open, onOpenChange, editing }: { open: boolean; onOpenChange: (v: boolean) => void; editing: any | null }) {
  const { t, lang, dir } = useLang();
  const qc = useQueryClient();
  const [orgId, setOrgId] = useState("");
  const [date, setDate] = useState("");
  const [objective, setObjective] = useState("");
  const [visitType, setVisitType] = useState("scheduled");
  const [oidDelegate, setOidDelegate] = useState("");
  const [orgDelegate, setOrgDelegate] = useState("");
  const [evals, setEvals] = useState<Record<string, string>>({});
  const [gaps, setGaps] = useState<GapInput[]>([]);
  const [outputs, setOutputs] = useState("");
  const [challenges, setChallenges] = useState("");
  const [performance, setPerformance] = useState("good");
  const [guidance, setGuidance] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("draft");
  const [saving, setSaving] = useState(false);

  const EVAL_FIELDS: [keyof any, string][] = [
    ["visual_identity", "الهوية البصرية (اللوحات، المكاتب، المطبوعات)"],
    ["discipline", "الانضباط (الحضور، التواجد، الزي)"],
    ["readiness", "الجاهزية والتوثيق"],
    ["prev_followups", "المتابعات السابقة"],
    ["best_practices", "الممارسات المتميزة والمبتكرة"],
    ["general_work", "سير العمل العام"],
  ];

  useEffect(() => {
    if (!open) return;
    setOrgId(editing?.org_id ?? "");
    setDate(editing?.date ?? new Date().toISOString().slice(0, 10));
    setObjective(editing?.objective ?? "");
    setVisitType(editing?.visit_type ?? "scheduled");
    setOidDelegate(editing?.oid_delegate ?? "");
    setOrgDelegate(editing?.org_delegate ?? "");
    setEvals({
      visual_identity: editing?.visual_identity ?? "",
      discipline: editing?.discipline ?? "",
      readiness: editing?.readiness ?? "",
      prev_followups: editing?.prev_followups ?? "",
      best_practices: editing?.best_practices ?? "",
      general_work: editing?.general_work ?? "",
    });
    setGaps((editing?.visit_gaps ?? []).map((g: any) => ({ ...g })));
    setOutputs(editing?.outputs ?? "");
    setChallenges(editing?.challenges ?? "");
    setPerformance(editing?.performance ?? "good");
    setGuidance(editing?.guidance ?? "");
    setNotes(editing?.notes ?? "");
    setStatus(editing?.status ?? "draft");
  }, [open, editing]);

  const { data: prevVisit } = useQuery({
    queryKey: ["prev-visit-gaps", orgId, editing?.id ?? null],
    enabled: open && !!orgId,
    queryFn: () => loadPrevVisitGaps(orgId),
  });
  const prevOpenGaps = useMemo(() => {
    if (!prevVisit || prevVisit.id === editing?.id) return [];
    return (prevVisit.visit_gaps ?? []) as any[];
  }, [prevVisit, editing]);

  async function save() {
    if (!orgId) return toast.error(t("office.اختر المؤسسة"));
    if (!date) return toast.error(t("office.التاريخ مطلوب"));
    setSaving(true);
    try {
      await saveVisit({
        id: editing?.id,
        org_id: orgId,
        date,
        objective: objective || null,
        visit_type: visitType,
        oid_delegate: oidDelegate || null,
        org_delegate: orgDelegate || null,
        visual_identity: evals.visual_identity || null,
        discipline: evals.discipline || null,
        readiness: evals.readiness || null,
        prev_followups: evals.prev_followups || null,
        best_practices: evals.best_practices || null,
        general_work: evals.general_work || null,
        outputs: outputs || null,
        challenges: challenges || null,
        performance,
        guidance: guidance || null,
        notes: notes || null,
        status,
        gaps,
      });
      toast.success(t("office.تم حفظ الزيارة"));
      qc.invalidateQueries({ queryKey: ["visits"] });
      onOpenChange(false);
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  }

  async function convert(g: GapInput) {
    if (!g.id) return toast.error(t("office.احفظ الزيارة أولاً قبل تحويل الفجوة لمهمة"));
    try {
      await convertGapToTask({
        gapId: g.id, visitId: editing.id, gap: g.gap, action: g.action,
        priority: g.priority, dueDate: g.due_date, orgId,
      });
      setGaps((prev) => prev.map((x) => (x.id === g.id ? { ...x, converted: true } : x)));
      toast.success(t("office.تم إنشاء مهمة متابعة"));
      qc.invalidateQueries({ queryKey: ["office_tasks"] });
      qc.invalidateQueries({ queryKey: ["visits"] });
    } catch (e: any) { toast.error(e.message); }
  }

  const upd = (i: number, patch: Partial<GapInput>) =>
    setGaps((prev) => prev.map((g, ix) => (ix === i ? { ...g, ...patch } : g)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir={dir}>
        <DialogHeader><DialogTitle>{editing ? t("office.الزيارة") : t("office.زيارة جديدة")}</DialogTitle></DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FieldBox label={t("office.المؤسسة *")}>
              <select className={SELECT_CLS + " w-full"} value={orgId} onChange={(e) => setOrgId(e.target.value)}>
                <option value="">{t("office.— اختر —")}</option>
                {ORGS.map((o) => <option key={o.id} value={o.id}>{lang === "en" ? o.nameEn : o.nameAr}</option>)}
              </select>
            </FieldBox>
            <FieldBox label={t("office.التاريخ *")}><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></FieldBox>
            <FieldBox label={t("office.نوع الزيارة")}>
              <select className={SELECT_CLS + " w-full"} value={visitType} onChange={(e) => setVisitType(e.target.value)}>
                {VISIT_TYPES.map((item) => <option key={item.id} value={item.id}>{t("office." + item.label)}</option>)}
              </select>
            </FieldBox>
            <FieldBox label={t("office.الحالة")}>
              <select className={SELECT_CLS + " w-full"} value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="draft">{t("office.مسودة")}</option>
                <option value="final">{t("office.معتمد")}</option>
              </select>
            </FieldBox>
            <FieldBox label={t("office.مندوب OID")}><Input value={oidDelegate} onChange={(e) => setOidDelegate(e.target.value)} /></FieldBox>
            <FieldBox label={t("office.مدير المؤسسة")}><Input value={orgDelegate} onChange={(e) => setOrgDelegate(e.target.value)} /></FieldBox>
            <div className="sm:col-span-2">
              <FieldBox label={t("office.هدف الزيارة")}><Textarea rows={2} value={objective} onChange={(e) => setObjective(e.target.value)} /></FieldBox>
            </div>
          </div>

          {orgId && prevOpenGaps.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs space-y-1">
              <div className="font-semibold text-amber-800">📋 {t("office.المتابعات السابقة")}</div>
              <div className="text-amber-700">{t("office.آخر زيارة:")} {prevVisit?.date}</div>
              <ul className="list-disc ps-5 text-amber-800 space-y-0.5">
                {prevOpenGaps.map((g: any) => (
                  <li key={g.id}>
                    {g.gap}
                    {g.converted ? " — " + t("office.محوّلة لمهمة") : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-3">
            <div className="text-xs font-bold text-primary">{t("office.التقييمات والملاحظات")}</div>
            {EVAL_FIELDS.map(([key, label]) => (
              <FieldBox key={String(key)} label={t("office." + label)}>
                <Textarea rows={2} value={evals[String(key)] ?? ""}
                  onChange={(e) => setEvals({ ...evals, [String(key)]: e.target.value })} />
              </FieldBox>
            ))}
          </div>

          {/* الفجوات */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">{t("office.الفجوات")}</Label>
              <Button size="sm" variant="outline" onClick={() => setGaps([...gaps, { gap: "", action: "", priority: "normal", due_date: "" }])}>
                <Plus size={13} className="ms-1" /> {t("office.إضافة فجوة")}
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="oid-table">
                <thead>
                  <tr>
                    <th className="p-2 text-right">{t("office.الفجوة")}</th>
                    <th className="p-2 text-right">{t("office.الإجراء التصحيحي")}</th>
                    <th className="p-2 text-right w-24">{t("office.الأولوية")}</th>
                    <th className="p-2 text-right w-36">{t("office.موعد الإنجاز")}</th>
                    <th className="p-2 text-right w-32">{t("office.تحويل")}</th>
                  </tr>
                </thead>
                <tbody>
                  {gaps.length === 0 && (
                    <tr><td colSpan={5} className="p-3 text-center text-muted-foreground">{t("office.لا توجد فجوات.")}</td></tr>
                  )}
                  {gaps.map((g, i) => (
                    <tr key={g.id ?? i} className="border-t border-border">
                      <td className="p-1"><Input value={g.gap} onChange={(e) => upd(i, { gap: e.target.value })} /></td>
                      <td className="p-1"><Input value={g.action ?? ""} onChange={(e) => upd(i, { action: e.target.value })} /></td>
                      <td className="p-1">
                        <select className={SELECT_CLS + " w-full"} value={g.priority} onChange={(e) => upd(i, { priority: e.target.value })}>
                          <option value="urgent">{t("office.عاجل")}</option>
                          <option value="normal">{t("office.غير عاجل")}</option>
                        </select>
                      </td>
                      <td className="p-1"><Input type="date" value={g.due_date ?? ""} onChange={(e) => upd(i, { due_date: e.target.value })} /></td>
                      <td className="p-1">
                        {g.converted ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
                            <CheckCircle2 size={13} /> {t("office.تم التحويل")}
                          </span>
                        ) : (
                          <div className="flex items-center gap-1">
                            <Button size="sm" variant="outline" onClick={() => convert(g)}>
                              <ArrowLeft size={12} className="ms-1" /> {t("office.مهمة")}
                            </Button>
                            <button type="button" className="text-muted-foreground hover:text-danger"
                              onClick={() => setGaps(gaps.filter((_, ix) => ix !== i))}><X size={14} /></button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-xs font-bold text-primary">{t("office.نتائج الزيارة")}</div>
            <FieldBox label={t("office.المخرجات والقرارات")}><Textarea rows={3} value={outputs} onChange={(e) => setOutputs(e.target.value)} /></FieldBox>
            <FieldBox label={t("office.التحديات والتوصيات")}><Textarea rows={3} value={challenges} onChange={(e) => setChallenges(e.target.value)} /></FieldBox>
            <div className="space-y-1">
              <Label className="text-xs">{t("office.مستوى الأداء العام")}</Label>
              <div className="flex flex-wrap gap-2">
                {PERFORMANCE.map((p) => (
                  <button key={p.id} type="button" onClick={() => setPerformance(p.id)}
                    className="px-3 py-1.5 rounded-md text-xs font-medium border transition"
                    style={performance === p.id
                      ? { background: p.color, color: "#fff", borderColor: p.color }
                      : { background: "transparent", color: p.color, borderColor: p.color + "66" }}>
                    {t("office." + p.label)}
                  </button>
                ))}
              </div>
            </div>
            <FieldBox label={t("office.توجيه رئيس المؤسسة")}><Textarea rows={2} value={guidance} onChange={(e) => setGuidance(e.target.value)} /></FieldBox>
            <FieldBox label={t("office.أخرى")}><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></FieldBox>
          </div>
        </div>

        <DialogFooter>
          {editing && (
            <Button variant="outline" onClick={() => exportVisitPDF({ ...editing, org_id: orgId, date, objective, visit_type: visitType, oid_delegate: oidDelegate, org_delegate: orgDelegate, ...evals, outputs, challenges, performance, guidance, notes, visit_gaps: gaps }, lang)}>
              <Printer size={14} className="ms-1" /> {t("office.تصدير استمارة")}
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("office.إغلاق")}</Button>
          <Button onClick={save} disabled={saving}>{saving ? t("office.جارٍ الحفظ…") : t("office.حفظ")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ══════════════════════ تبويب خطط المكتب ══════════════════════ */

function PlansTab() {
  const { t } = useLang();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [openPlan, setOpenPlan] = useState<string | null>(null);
  const { data: rows = [], isLoading } = useQuery({ queryKey: ["office_plans"], queryFn: loadPlans });

  async function remove(id: string) {
    if (!confirm(t("office.حذف هذه الخطة وأنشطتها؟"))) return;
    try {
      await deletePlan(id);
      toast.success(t("office.تم الحذف"));
      qc.invalidateQueries({ queryKey: ["office_plans"] });
    } catch (e: any) { toast.error(e.message); }
  }

  const byYear = useMemo(() => {
    const m = new Map<number, any[]>();
    for (const p of rows as any[]) m.set(p.year, [...(m.get(p.year) ?? []), p]);
    return [...m.entries()].sort((a, b) => b[0] - a[0]);
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{rows.length} {t("office.خطة")}</span>
        <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus size={15} className="ms-1" /> {t("office.خطة جديدة")}
        </Button>
      </div>

      {isLoading ? <EmptyState text={t("office.جارٍ التحميل…")} /> : rows.length === 0 ? (
        <EmptyState text={t("office.لا توجد خطط مسجّلة بعد.")} />
      ) : (
        byYear.map(([year, plans]) => (
          <div key={year} className="space-y-2">
            <div className="text-xs font-bold text-muted-foreground">{year}</div>
            {plans.map((p: any) => {
              const acts = p.plan_activities ?? [];
              const done = acts.filter((a: any) => a.status === "done").length;
              const pct = acts.length ? Math.round((done / acts.length) * 100) : 0;
              const expanded = openPlan === p.id;
              return (
                <Card key={p.id}>
                  <CardHeader
                    title={`${p.title} — ${p.quarter ? p.quarter : t("office.خطة سنوية")}`}
                    subtitle={p.objective ?? ""}
                    action={
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                          {t("office." + (p.status === "completed" ? "مكتملة" : p.status === "cancelled" ? "ملغاة" : "نشطة"))}
                        </span>
                        <Button size="sm" variant="outline" onClick={() => setOpenPlan(expanded ? null : p.id)}>
                          {expanded ? t("office.إخفاء") : t("office.الأنشطة")}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setEditing(p); setOpen(true); }}>{t("office.تعديل")}</Button>
                        <Button size="sm" variant="ghost" className="text-danger" onClick={() => remove(p.id)}>
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    }
                  />
                  <div className="px-4 pb-3">
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                      <span>{done}/{acts.length} ({pct}%)</span>
                    </div>
                  </div>
                  {expanded && <PlanActivities plan={p} />}
                </Card>
              );
            })}
          </div>
        ))
      )}

      <PlanDialog open={open} onOpenChange={setOpen} editing={editing} />
    </div>
  );
}

function PlanActivities({ plan }: { plan: any }) {
  const { t } = useLang();
  const qc = useQueryClient();
  const acts = (plan.plan_activities ?? []) as any[];
  const [title, setTitle] = useState("");
  const [assigned, setAssigned] = useState("");
  const [due, setDue] = useState("");

  const refresh = () => qc.invalidateQueries({ queryKey: ["office_plans"] });

  async function add() {
    if (!title.trim()) return toast.error(t("office.عنوان النشاط مطلوب"));
    try {
      await saveActivity({ plan_id: plan.id, title: title.trim(), assigned_to: assigned || null, due_date: due || null });
      setTitle(""); setAssigned(""); setDue("");
      toast.success(t("office.تمت إضافة النشاط"));
      refresh();
    } catch (e: any) { toast.error(e.message); }
  }

  async function setStatus(a: any, status: string) {
    try { await saveActivity({ id: a.id, plan_id: plan.id, title: a.title, status }); refresh(); }
    catch (e: any) { toast.error(e.message); }
  }

  async function convert(a: any) {
    try {
      await convertActivityToTask({
        activityId: a.id, planId: plan.id, title: a.title,
        description: a.description, assignedTo: a.assigned_to, dueDate: a.due_date,
      });
      toast.success(t("office.تم إنشاء مهمة متابعة"));
      qc.invalidateQueries({ queryKey: ["office_tasks"] });
      refresh();
    } catch (e: any) { toast.error(e.message); }
  }

  async function remove(id: string) {
    try { await deleteActivity(id); refresh(); } catch (e: any) { toast.error(e.message); }
  }

  return (
    <div className="border-t border-border p-4 space-y-2">
      {acts.length === 0 && <p className="text-xs text-muted-foreground">{t("office.لا توجد أنشطة بعد.")}</p>}
      {acts.map((a) => (
        <div key={a.id} className="border border-border rounded-lg p-3 bg-white flex flex-wrap items-center gap-2">
          <div className="flex-1 min-w-[180px]">
            <div className="text-sm font-medium">{a.title}</div>
            {a.description && <div className="text-[11px] text-muted-foreground">{a.description}</div>}
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {a.assigned_to ? `${t("office.المكلف:")} ${a.assigned_to}` : t("office.بدون مكلف")}{a.due_date ? ` — ${a.due_date}` : ""}
            </div>
          </div>
          <select className={SELECT_CLS} value={a.status} onChange={(e) => setStatus(a, e.target.value)}>
            {ACT_STATUS.map((s) => <option key={s.id} value={s.id}>{t("office." + s.label)}</option>)}
          </select>
          {a.task_id ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
              <CheckCircle2 size={13} /> {t("office.مهمة مرتبطة")}
            </span>
          ) : (
            <Button size="sm" variant="outline" onClick={() => convert(a)}>
              <ArrowLeft size={12} className="ms-1" /> {t("office.تحويل لمهمة")}
            </Button>
          )}
          <button type="button" className="text-muted-foreground hover:text-danger" onClick={() => remove(a.id)}>
            <Trash2 size={14} />
          </button>
        </div>
      ))}

      <div className="flex flex-wrap gap-2 pt-2">
        <Input className="flex-1 min-w-[160px]" placeholder={t("office.نشاط جديد")} value={title} onChange={(e) => setTitle(e.target.value)} />
        <Input className="w-40" placeholder={t("office.المكلف")} value={assigned} onChange={(e) => setAssigned(e.target.value)} />
        <Input className="w-40" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        <Button size="sm" onClick={add}><Plus size={14} className="ms-1" />{t("office.إضافة")}</Button>
      </div>
    </div>
  );
}

function PlanDialog({ open, onOpenChange, editing }: { open: boolean; onOpenChange: (v: boolean) => void; editing: any | null }) {
  const { t, dir } = useLang();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [year, setYear] = useState(2026);
  const [quarter, setQuarter] = useState("");
  const [objective, setObjective] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("active");

  useEffect(() => {
    if (!open) return;
    setTitle(editing?.title ?? "");
    setYear(editing?.year ?? new Date().getFullYear());
    setQuarter(editing?.quarter ?? "");
    setObjective(editing?.objective ?? "");
    setDescription(editing?.description ?? "");
    setStatus(editing?.status ?? "active");
  }, [open, editing]);

  async function save() {
    if (!title.trim()) return toast.error(t("office.عنوان الخطة مطلوب"));
    try {
      await savePlan({
        id: editing?.id, title: title.trim(), year: Number(year),
        quarter: quarter || null, objective: objective || null,
        description: description || null, status,
      });
      toast.success(t("office.تم حفظ الخطة"));
      qc.invalidateQueries({ queryKey: ["office_plans"] });
      onOpenChange(false);
    } catch (e: any) { toast.error(e.message); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" dir={dir}>
        <DialogHeader><DialogTitle>{editing ? t("office.تعديل خطة") : t("office.خطة جديدة")}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <FieldBox label={t("office.عنوان الخطة *")}><Input value={title} onChange={(e) => setTitle(e.target.value)} /></FieldBox>
          <div className="grid grid-cols-2 gap-3">
            <FieldBox label={t("office.السنة")}><Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} /></FieldBox>
            <FieldBox label={t("office.الربع")}>
              <select className={SELECT_CLS + " w-full"} value={quarter} onChange={(e) => setQuarter(e.target.value)}>
                <option value="">{t("office.خطة سنوية")}</option>
                {["Q1", "Q2", "Q3", "Q4"].map((q) => <option key={q} value={q}>{q}</option>)}
              </select>
            </FieldBox>
          </div>
          <FieldBox label={t("office.الهدف")}><Textarea rows={2} value={objective} onChange={(e) => setObjective(e.target.value)} /></FieldBox>
          <FieldBox label={t("office.الوصف")}><Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></FieldBox>
          <FieldBox label={t("office.الحالة")}>
            <select className={SELECT_CLS + " w-full"} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="active">{t("office.نشطة")}</option>
              <option value="completed">{t("office.مكتملة")}</option>
              <option value="cancelled">{t("office.ملغاة")}</option>
            </select>
          </FieldBox>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("office.إلغاء")}</Button>
          <Button onClick={save}>{t("office.حفظ")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
