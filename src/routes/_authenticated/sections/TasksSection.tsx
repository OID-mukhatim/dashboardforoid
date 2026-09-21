/**
 * قسم "متابعة المكتب" — تحويل التنبيهات والشذوذات إلى مهام قابلة للمتابعة.
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ORGS, orgName, type OrgId } from "@/lib/oid-data";
import { OrgLogo } from "@/components/oid/OrgLogo";
import { ScrollableTable } from "@/components/oid/ScrollableTable";
import { Plus, Trash2, Pencil, ClipboardList, CalendarDays } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Card } from "./_shared";
import { useTaskRequest, consumeTaskRequest, type TaskPrefill } from "@/lib/tasks-store";

type Task = {
  id: string;
  title: string;
  description: string | null;
  org_id: string | null;
  section_ref: string | null;
  source_type: string | null;
  source_ref: string | null;
  priority: string;
  status: string;
  due_date: string | null;
  created_at: string;
};

const STATUSES = [
  { id: "open", label: "مفتوحة", color: "#64748b" },
  { id: "in_progress", label: "جارية", color: "#2563eb" },
  { id: "done", label: "مكتملة", color: "#10b981" },
  { id: "cancelled", label: "ملغاة", color: "#94a3b8" },
] as const;

const PRIORITIES = [
  { id: "critical", label: "حرجة", color: "#dc2626" },
  { id: "high", label: "عالية", color: "#ea580c" },
  { id: "medium", label: "متوسطة", color: "#2563eb" },
  { id: "low", label: "منخفضة", color: "#64748b" },
] as const;

const SECTION_REFS = [
  { id: "dashboard", label: "لوحة القيادة" },
  { id: "kpis", label: "مؤشرات الأداء" },
  { id: "gaps", label: "تحليل الفجوات" },
  { id: "governance", label: "الحوكمة والامتثال" },
  { id: "financial", label: "المالية" },
  { id: "partnerships", label: "الشراكات" },
  { id: "initiatives", label: "المبادرات" },
] as const;

const SOURCE_LABELS: Record<string, string> = {
  manual: "يدوي",
  anomaly: "شذوذ",
  overdue: "تأخير",
  meeting: "اجتماع",
  visit: "زيارة",
  plan: "خطة",
};

const SOURCES = [
  { id: "meeting", label: "اجتماعات" },
  { id: "visit", label: "زيارات" },
  { id: "plan", label: "خطط" },
  { id: "manual", label: "يدوي" },
  { id: "anomaly", label: "شذوذ" },
  { id: "overdue", label: "تأخير" },
] as const;

const SELECT_CLS =
  "text-xs px-3 py-2 rounded-md border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary/30";

function metaOf<T extends { id: string; label: string; color: string }>(list: readonly T[], id: string) {
  return list.find((x) => x.id === id) ?? { id, label: id, color: "#64748b" };
}

export function TasksSection() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [prefill, setPrefill] = useState<TaskPrefill | null>(null);
  const [editing, setEditing] = useState<Task | null>(null);

  const [fOrg, setFOrg] = useState<"all" | OrgId>("all");
  const [fPriority, setFPriority] = useState<string>("all");
  const [fStatus, setFStatus] = useState<string>("all");
  const [fSource, setFSource] = useState<string>("all");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["office_tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("office_tasks")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Task[];
    },
  });

  // طلب إنشاء مهمة قادم من لوحة الشذوذات
  const { pending } = useTaskRequest();
  useEffect(() => {
    if (!pending) return;
    const { _n, ...rest } = pending;
    setEditing(null);
    setPrefill(rest);
    setOpen(true);
    consumeTaskRequest();
  }, [pending]);

  const filtered = useMemo(
    () =>
      rows.filter(
        (t) =>
          (fOrg === "all" || t.org_id === fOrg) &&
          (fPriority === "all" || t.priority === fPriority) &&
          (fStatus === "all" || t.status === fStatus) &&
          (fSource === "all" || (t.source_type ?? "manual") === fSource),
      ),
    [rows, fOrg, fPriority, fStatus, fSource],
  );

  async function handleSave(payload: any) {
    if (editing) {
      const { error } = await supabase.from("office_tasks").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("تم تحديث المهمة");
    } else {
      const { error } = await supabase.from("office_tasks").insert(payload);
      if (error) return toast.error(error.message);
      toast.success("تمت إضافة المهمة");
    }
    setOpen(false);
    setPrefill(null);
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["office_tasks"] });
  }

  async function changeStatus(id: string, status: string) {
    const { error } = await supabase.from("office_tasks").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["office_tasks"] });
  }

  async function remove(id: string) {
    if (!confirm("حذف هذه المهمة؟")) return;
    const { error } = await supabase.from("office_tasks").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("تم الحذف");
    qc.invalidateQueries({ queryKey: ["office_tasks"] });
  }

  const today = new Date().toISOString().slice(0, 10);
  const isOverdue = (t: Task) => !!t.due_date && t.due_date < today && t.status !== "done" && t.status !== "cancelled";
  const stats = {
    open: filtered.filter((t) => t.status === "open").length,
    inProgress: filtered.filter((t) => t.status === "in_progress").length,
    done: filtered.filter((t) => t.status === "done").length,
    overdue: filtered.filter(isOverdue).length,
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ClipboardList size={20} className="text-primary" />
          <h2 className="text-lg font-bold">متابعة المكتب</h2>
          <span className="text-xs text-muted-foreground">({filtered.length} مهمة)</span>
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setPrefill(null); setOpen(true); }}>
          <Plus size={15} className="ms-1" /> إضافة مهمة
        </Button>
      </div>

      {/* شريط الإحصاء السريع */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "مفتوحة", value: stats.open, color: "#64748b" },
          { label: "جارية", value: stats.inProgress, color: "#2563eb" },
          { label: "مكتملة", value: stats.done, color: "#10b981" },
          { label: "متأخرة", value: stats.overdue, color: "#dc2626" },
        ].map((c) => (
          <Card key={c.label} className="p-3 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{c.label}</span>
            <span className="text-xl font-bold" style={{ color: c.color }}>{c.value}</span>
          </Card>
        ))}
      </div>

      {/* الفلاتر */}
      <Card className="p-4 flex flex-wrap gap-3 items-end">
        <Field label="المؤسسة">
          <select className={SELECT_CLS} value={fOrg} onChange={(e) => setFOrg(e.target.value as any)}>
            <option value="all">كل المؤسسات</option>
            {ORGS.map((o) => (
              <option key={o.id} value={o.id}>{o.nameAr ?? o.id}</option>
            ))}
          </select>
        </Field>
        <Field label="الأولوية">
          <select className={SELECT_CLS} value={fPriority} onChange={(e) => setFPriority(e.target.value)}>
            <option value="all">الكل</option>
            {PRIORITIES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </Field>
        <Field label="الحالة">
          <select className={SELECT_CLS} value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
            <option value="all">الكل</option>
            {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </Field>
        <Field label="المصدر">
          <select className={SELECT_CLS} value={fSource} onChange={(e) => setFSource(e.target.value)}>
            <option value="all">كل المصادر</option>
            {SOURCES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </Field>
        <button
          type="button"
          className="text-xs px-3 py-2 rounded-md border border-border hover:bg-slate-50"
          onClick={() => { setFOrg("all"); setFPriority("all"); setFStatus("all"); setFSource("all"); }}
        >
          إعادة تعيين
        </button>
      </Card>

      {isLoading ? (
        <Card className="p-6 text-sm text-muted-foreground">جارٍ التحميل…</Card>
      ) : (
        <Card>
          <ScrollableTable>
            <table className="oid-table">
              <thead><tr>{["المهمة", "المؤسسة", "الأولوية", "الحالة", "الاستحقاق", "المصدر", "الإجراءات"].map((h) => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {filtered.map((t) => {
                  const p = metaOf(PRIORITIES, t.priority);
                  const status = metaOf(STATUSES, t.status);
                  const statusTone = t.status === "done" ? "status-green" : t.status === "in_progress" ? "status-yellow" : t.status === "open" ? "status-gray" : "status-red";
                  return (
                    <tr key={t.id}>
                      <td className="min-w-[260px]"><div className="font-semibold">{t.title}</div>{t.description && <div className="mt-1 text-[11px] text-muted-foreground">{t.description}</div>}</td>
                      <td>{t.org_id ? <span className="inline-flex items-center gap-1"><OrgLogo orgId={t.org_id as OrgId} size={20} shape="circle" />{orgName(t.org_id as OrgId)}</span> : "—"}</td>
                      <td><span className="inline-flex items-center gap-1.5"><span className="size-2 shrink-0 rounded-full" style={{ background: p.color }} />{p.label}</span></td>
                      <td>
                        <span className={`${statusTone} inline-block rounded-full px-2.5 py-1 text-[11px]`}>{status.label}</span>
                        <select aria-label={`تغيير حالة ${t.title}`} className="mr-2 rounded border border-border bg-card px-1 py-0.5 text-[10px]" value={t.status} onChange={(e) => changeStatus(t.id, e.target.value)}>
                          {STATUSES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                        </select>
                      </td>
                      <td className={`numeric ${isOverdue(t) ? "status-red" : ""}`}>{t.due_date ? <span className="inline-flex items-center gap-1"><CalendarDays size={11} />{t.due_date}</span> : "—"}</td>
                      <td>{SOURCE_LABELS[t.source_type ?? "manual"] ?? t.source_type ?? "يدوي"}</td>
                      <td><div className="flex justify-center gap-2"><Button size="icon" variant="ghost" title="تعديل" onClick={() => { setPrefill(null); setEditing(t); setOpen(true); }}><Pencil size={14} /></Button><Button size="icon" variant="ghost" title="حذف" onClick={() => remove(t.id)}><Trash2 size={14} /></Button></div></td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && <tr><td colSpan={7} className="text-center text-muted-foreground">لا توجد مهام مطابقة.</td></tr>}
              </tbody>
            </table>
          </ScrollableTable>
        </Card>
      )}

      <TaskDialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setPrefill(null); setEditing(null); } }} prefill={prefill} editing={editing} onSave={handleSave} />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function TaskDialog({
  open, onOpenChange, prefill, editing, onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  prefill: TaskPrefill | null;
  editing: Task | null;
  onSave: (payload: any) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [orgId, setOrgId] = useState("");
  const [priority, setPriority] = useState("medium");
  const [status, setStatus] = useState("open");
  const [dueDate, setDueDate] = useState("");
  const [sectionRef, setSectionRef] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle(editing?.title ?? prefill?.title ?? "");
    setDescription(editing?.description ?? prefill?.description ?? "");
    setOrgId(editing?.org_id ?? prefill?.org_id ?? "");
    setPriority(editing?.priority ?? prefill?.priority ?? "medium");
    setStatus(editing?.status ?? "open");
    setDueDate(editing?.due_date ?? "");
    setSectionRef(editing?.section_ref ?? prefill?.section_ref ?? "");
  }, [open, prefill, editing]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle>{editing ? "تعديل مهمة" : "إضافة مهمة متابعة"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>العنوان *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان المهمة" />
          </div>
          <div className="space-y-1">
            <Label>الوصف</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>المؤسسة</Label>
              <select className={SELECT_CLS + " w-full"} value={orgId} onChange={(e) => setOrgId(e.target.value)}>
                <option value="">— غير محدد —</option>
                {ORGS.map((o) => <option key={o.id} value={o.id}>{o.nameAr ?? o.id}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label>الأولوية</Label>
              <select className={SELECT_CLS + " w-full"} value={priority} onChange={(e) => setPriority(e.target.value)}>
                {PRIORITIES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label>الحالة</Label>
              <select className={SELECT_CLS + " w-full"} value={status} onChange={(e) => setStatus(e.target.value)}>
                {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label>تاريخ الاستحقاق</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="space-y-1 col-span-2">
              <Label>القسم المرتبط</Label>
              <select className={SELECT_CLS + " w-full"} value={sectionRef} onChange={(e) => setSectionRef(e.target.value)}>
                <option value="">— غير محدد —</option>
                {SECTION_REFS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button
            onClick={() => {
              if (!title.trim()) return toast.error("العنوان مطلوب");
              onSave({
                title: title.trim(),
                description: description.trim() || null,
                org_id: orgId || null,
                section_ref: sectionRef || null,
                priority,
                status,
                due_date: dueDate || null,
                ...(editing ? {} : {
                  source_type: prefill?.source_type ?? "manual",
                  source_ref: prefill?.source_ref ?? null,
                }),
              });
            }}
          >
            حفظ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
