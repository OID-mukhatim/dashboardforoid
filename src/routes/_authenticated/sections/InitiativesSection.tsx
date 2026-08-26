import { useState, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Plus, Sparkles, Trash2, Pencil } from "lucide-react";
import { initiatives } from "@/lib/oid-data";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listInitiatives, upsertInitiative, deleteInitiative, updateInitiativeStatus, autoGenerateInitiatives, type Initiative } from "@/lib/initiatives.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Card, SectionTitle } from "./_shared";

/* ============================ INITIATIVES ============================ */
type InitiativeStatus = "مقترح" | "قيد التنفيذ" | "مكتمل";
const INITIATIVE_STATUSES: InitiativeStatus[] = ["مقترح", "قيد التنفيذ", "مكتمل"];
const INITIATIVE_PRIORITIES = ["حرج", "عالٍ", "متوسط", "منخفض", "جارٍ"] as const;

export function InitiativesSection() {
  const { isEditor } = useAuth();
  const qc = useQueryClient();
  const listFn = useServerFn(listInitiatives);
  const upsertFn = useServerFn(upsertInitiative);
  const deleteFn = useServerFn(deleteInitiative);
  const statusFn = useServerFn(updateInitiativeStatus);
  const autoFn = useServerFn(autoGenerateInitiatives);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["initiatives"],
    queryFn: () => listFn(),
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Initiative | null>(null);

  function openCreate() { setEditing(null); setDialogOpen(true); }
  function openEdit(i: Initiative) { setEditing(i); setDialogOpen(true); }

  async function handleSave(payload: any) {
    try {
      await upsertFn({ data: payload });
      toast.success(editing ? "تم تحديث المبادرة" : "تمت إضافة المبادرة");
      setDialogOpen(false);
      qc.invalidateQueries({ queryKey: ["initiatives"] });
    } catch (e: any) {
      toast.error(e?.message ?? "تعذر الحفظ");
    }
  }
  async function handleDelete(id: string) {
    if (!confirm("حذف هذه المبادرة؟")) return;
    try {
      await deleteFn({ data: { id } });
      toast.success("تم الحذف");
      qc.invalidateQueries({ queryKey: ["initiatives"] });
    } catch (e: any) { toast.error(e?.message ?? "تعذر الحذف"); }
  }
  async function handleStatusChange(id: string, status: InitiativeStatus) {
    const previous = qc.getQueryData<Initiative[]>(["initiatives"]) ?? [];
    const next = previous.map((r) => (r.id === id ? { ...r, status } : r));
    qc.setQueryData(["initiatives"], next);
    try {
      await statusFn({ data: { id, status } });
      toast.success("تم تحديث حالة المبادرة في قاعدة البيانات");
      qc.invalidateQueries({ queryKey: ["initiatives"] });
    } catch (e: any) {
      qc.setQueryData(["initiatives"], previous);
      toast.error(e?.message ?? "تعذر التحديث");
    }
  }
  async function handleAuto() {
    try {
      const res = await autoFn();
      toast.success(`تمت أتمتة ${res.inserted} مبادرة من الفجوات الحرجة`);
      qc.invalidateQueries({ queryKey: ["initiatives"] });
    } catch (e: any) { toast.error(e?.message ?? "تعذرت الأتمتة"); }
  }

  const cols: [InitiativeStatus, string][] = [["مقترح","#fef3c7"],["قيد التنفيذ","#dbeafe"],["مكتمل","#dcfce7"]];

  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<InitiativeStatus | null>(null);

  function onDragStart(e: React.DragEvent, id: string) {
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  }
  function onDragEnd() { setDragId(null); setDragOverCol(null); }
  function onDragOverCol(e: React.DragEvent, col: InitiativeStatus) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverCol !== col) setDragOverCol(col);
  }
  async function onDropCol(e: React.DragEvent, col: InitiativeStatus) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain") || dragId;
    setDragOverCol(null); setDragId(null);
    if (!id) return;
    const item = rows.find(r => r.id === id);
    if (!item || item.status === col) return;
    if (!isEditor) { toast.error("صلاحيات غير كافية لتغيير الحالة"); return; }
    await handleStatusChange(id, col);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <SectionTitle title="المبادرات التطويرية" subtitle="Kanban — اسحب البطاقة بين الأعمدة لتغيير الحالة" />
        {isEditor && (
          <div className="flex gap-2">
            <Button onClick={openCreate} className="gap-1.5">
              <Plus className="w-4 h-4" /> إضافة مبادرة
            </Button>
            <Button variant="outline" onClick={handleAuto} className="gap-1.5">
              <Sparkles className="w-4 h-4" /> أتمتة من الفجوات
            </Button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground text-center py-12">جارٍ التحميل…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {cols.map(([col, bg]) => {
            const items = rows.filter(i => i.status === col);
            const isOver = dragOverCol === col;
            return (
              <Card
                key={col}
                className={`overflow-hidden transition ${isOver ? "ring-2 ring-primary ring-offset-2" : ""}`}
                onDragOver={(e: React.DragEvent<HTMLDivElement>) => { if (isEditor) onDragOverCol(e, col); }}
                onDragLeave={() => setDragOverCol(prev => prev === col ? null : prev)}
                onDrop={(e: React.DragEvent<HTMLDivElement>) => onDropCol(e, col)}
              >
                <div className="px-4 py-3 border-b border-border flex items-center justify-between" style={{ background: bg }}>
                  <span className="font-bold text-sm">{col}</span>
                  <span className="text-xs bg-white/70 px-2 py-0.5 rounded-full font-bold">{items.length}</span>
                </div>
                <div className={`p-3 space-y-3 min-h-[300px] ${isOver ? "bg-primary/5" : ""}`}>
                  {items.map(i => (
                    <div
                      key={i.id}
                      draggable={isEditor}
                      onDragStart={(e) => onDragStart(e, i.id)}
                      onDragEnd={onDragEnd}
                      className={`border border-border rounded-lg p-3 bg-card hover:shadow-sm transition ${isEditor ? "cursor-grab active:cursor-grabbing" : ""} ${dragId === i.id ? "opacity-40" : ""}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-[10px] text-muted-foreground">{i.code ?? i.id.slice(0,8)}</span>
                        <div className="flex items-center gap-1">
                          {i.source === "auto" && <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">آلي</span>}
                          {i.source === "manual" && <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">يدوي</span>}
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${i.priority==="حرج"?"bg-red-100 text-red-700":i.priority==="عالٍ"?"bg-orange-100 text-orange-700":"bg-blue-100 text-blue-700"}`}>{i.priority}</span>
                        </div>
                      </div>
                      <div className="text-sm font-medium leading-tight mb-2">{i.title}</div>
                      {i.objective && <div className="text-xs text-muted-foreground mb-2">{i.objective}</div>}
                      <div className="flex flex-wrap gap-1 text-[10px] mb-2">
                        {i.domain && <span className="px-1.5 py-0.5 rounded bg-muted">{i.domain}</span>}
                        {i.timeline && <span className="px-1.5 py-0.5 rounded bg-muted">{i.timeline}</span>}
                        {i.orgs?.slice(0,3).map((o, idx) => <span key={idx} className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">{o}</span>)}
                      </div>
                      {i.cost && <div className="text-xs font-bold text-primary mb-2">{i.cost}</div>}
                      {isEditor && (
                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/50">
                          <select
                            value={i.status}
                            onChange={(e) => handleStatusChange(i.id, e.target.value as InitiativeStatus)}
                            className="text-[10px] border border-border rounded px-1.5 py-1 bg-background flex-1"
                          >
                            {INITIATIVE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                          <button onClick={() => openEdit(i)} className="p-1 hover:bg-muted rounded" title="تعديل">
                            <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                          <button onClick={() => handleDelete(i.id)} className="p-1 hover:bg-red-50 rounded" title="حذف">
                            <Trash2 className="w-3.5 h-3.5 text-red-600" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  {items.length === 0 && <div className="text-xs text-center text-muted-foreground py-8">{isOver ? "أفلت هنا" : "لا توجد عناصر"}</div>}
                </div>
              </Card>
            );
          })}
        </div>
      )}


      <InitiativeFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        onSave={handleSave}
      />
    </div>
  );
}

function InitiativeFormDialog({
  open, onOpenChange, editing, onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Initiative | null;
  onSave: (payload: any) => void;
}) {
  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");
  const [priority, setPriority] = useState<string>("متوسط");
  const [status, setStatus] = useState<InitiativeStatus>("مقترح");
  const [domain, setDomain] = useState("");
  const [objective, setObjective] = useState("");
  const [gap, setGap] = useState("");
  const [orgsStr, setOrgsStr] = useState("");
  const [timeline, setTimeline] = useState("");
  const [cost, setCost] = useState("");
  const [notes, setNotes] = useState("");

  // Reset on open
  const lastIdRef = useRef<string | null>(null);
  if (open && lastIdRef.current !== (editing?.id ?? "__new__")) {
    lastIdRef.current = editing?.id ?? "__new__";
    setTitle(editing?.title ?? "");
    setCode(editing?.code ?? "");
    setPriority(editing?.priority ?? "متوسط");
    setStatus((editing?.status as InitiativeStatus) ?? "مقترح");
    setDomain(editing?.domain ?? "");
    setObjective(editing?.objective ?? "");
    setGap(editing?.gap ?? "");
    setOrgsStr((editing?.orgs ?? []).join("، "));
    setTimeline(editing?.timeline ?? "");
    setCost(editing?.cost ?? "");
    setNotes(editing?.notes ?? "");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { toast.error("العنوان مطلوب"); return; }
    const orgs = orgsStr.split(/[،,]/).map(s => s.trim()).filter(Boolean);
    onSave({
      ...(editing?.id ? { id: editing.id } : {}),
      title: title.trim(),
      code: code.trim() || null,
      priority,
      status,
      domain: domain.trim() || null,
      objective: objective.trim() || null,
      gap: gap.trim() || null,
      orgs,
      timeline: timeline.trim() || null,
      cost: cost.trim() || null,
      notes: notes.trim() || null,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>{editing ? "تعديل مبادرة" : "إضافة مبادرة تطويرية"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label>العنوان *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>الكود (اختياري)</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} maxLength={50} placeholder="INI-009" />
            </div>
            <div>
              <Label>المجال</Label>
              <Input value={domain} onChange={(e) => setDomain(e.target.value)} maxLength={60} placeholder="حوكمة / مالي / تقني…" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>الأولوية</Label>
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full border border-input rounded-md px-3 py-2 bg-background text-sm">
                {INITIATIVE_PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <Label>الحالة</Label>
              <select value={status} onChange={(e) => setStatus(e.target.value as InitiativeStatus)} className="w-full border border-input rounded-md px-3 py-2 bg-background text-sm">
                {INITIATIVE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <Label>الهدف</Label>
            <Textarea value={objective} onChange={(e) => setObjective(e.target.value)} maxLength={500} rows={2} />
          </div>
          <div>
            <Label>الفجوة المستهدفة</Label>
            <Textarea value={gap} onChange={(e) => setGap(e.target.value)} maxLength={300} rows={2} />
          </div>
          <div>
            <Label>المؤسسات المستهدفة (مفصولة بفاصلة)</Label>
            <Input value={orgsStr} onChange={(e) => setOrgsStr(e.target.value)} placeholder="زاد، تيو، كافي…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>الجدول الزمني</Label>
              <Input value={timeline} onChange={(e) => setTimeline(e.target.value)} maxLength={80} placeholder="6 أشهر" />
            </div>
            <div>
              <Label>التكلفة التقديرية</Label>
              <Input value={cost} onChange={(e) => setCost(e.target.value)} maxLength={80} placeholder="$5,000-$10,000" />
            </div>
          </div>
          <div>
            <Label>ملاحظات</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} rows={2} />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
            <Button type="submit">{editing ? "حفظ التعديلات" : "إضافة"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
