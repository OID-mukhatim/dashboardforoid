/**
 * قسم "متابعة المكتب" — تحويل التنبيهات والشذوذات إلى مهام قابلة للمتابعة.
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ORGS, orgName, type OrgId } from "@/lib/oid-data";
import { OrgLogo } from "@/components/oid/OrgLogo";
import { Plus, Trash2, Pencil, ClipboardList, CalendarDays } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Card, CardHeader } from "./_shared";
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

const SOURCE_LABELS: Record<string, string> = { manual: "يدوي", anomaly: "شذوذ", overdue: "تأخير" };

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
          (fStatus === "all" || t.status === fStatus),
      ),
    [rows, fOrg, fPriority, fStatus],
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
        <button
          type="button"
          className="text-xs px-3 py-2 rounded-md border border-border hover:bg-slate-50"
          onClick={() => { setFOrg("all"); setFPriority("all"); setFStatus("all"); }}
        >
          إعادة تعيين
        </button>
      </Card>

      {isLoading ? (
        <Card className="p-6 text-sm text-muted-foreground">جارٍ التحميل…</Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {(fStatus === "cancelled"
            ? STATUSES.filter((s) => s.id === "cancelled")
            : STATUSES.filter((s) => s.id !== "cancelled")
          ).map((s) => {
            const list = filtered.filter((t) => t.status === s.id);
            return (
              <Card key={s.id}>
                <CardHeader
                  title={s.label}
                  subtitle={`${list.length} مهمة`}
                  action={<span className="w-3 h-3 rounded-full" style={{ background: s.color }} />}
                />
                <div className="p-3 space-y-2">
                  {list.length === 0 && (
                    <p className="text-xs text-muted-foreground px-1 py-3">لا توجد مهام.</p>
                  )}
                  {list.map((t) => {
                    const p = metaOf(PRIORITIES, t.priority);
                    return (
                      <div
                        key={t.id}
                        className="border border-border rounded-lg p-3 bg-white hover:shadow-sm transition"
                        style={{ borderInlineStartWidth: 4, borderInlineStartColor: p.color }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className={`font-semibold text-sm leading-snug ${t.status === "cancelled" ? "line-through text-muted-foreground" : ""}`}>{t.title}</span>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => { setPrefill(null); setEditing(t); setOpen(true); }}
                              className="text-muted-foreground hover:text-primary"
                              title="تعديل"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => remove(t.id)}
                              className="text-muted-foreground hover:text-danger"
                              title="حذف"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                        {t.description && (
                          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{t.description}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          {t.org_id && (
                            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                              <OrgLogo orgId={t.org_id as OrgId} size={20} shape="circle" />
                              {orgName(t.org_id as OrgId)}
                            </span>
                          )}
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                            style={{ background: p.color + "22", color: p.color }}
                          >
                            {p.label}
                          </span>
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                            style={{ background: s.color + "22", color: s.color }}
                          >
                            {s.label}
                          </span>
                          {t.due_date && (
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 ${isOverdue(t) ? "bg-red-50 text-red-700 font-semibold" : "bg-slate-100 text-slate-600"}`}
                            >
                              <CalendarDays size={10} /> {t.due_date}{isOverdue(t) ? " — متأخرة" : ""}
                            </span>
                          )}
                          {t.source_type && t.source_type !== "manual" && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">
                              {SOURCE_LABELS[t.source_type] ?? t.source_type}
                            </span>
                          )}
                        </div>
                        <div className="mt-2">
                          <select
                            className={SELECT_CLS + " text-[11px] w-full"}
                            value={t.status}
                            onChange={(e) => changeStatus(t.id, e.target.value)}
                          >
                            {STATUSES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
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
