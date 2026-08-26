import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Plus, X } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, PieChart, Pie, Cell } from "recharts";
import { ORGS, type OrgId, partnerships as fallbackPartnerships } from "@/lib/oid-data";
import { ScrollableTable } from "@/components/oid/ScrollableTable";
import { Card, CardHeader, EmptyData, SectionTitle, OrgChip, FilterSelect } from "./_shared";

/* ============================ TYPES ============================ */
/** شكل موحّد للشراكة (camelCase) — يأتي من قاعدة البيانات أو من oid-data.ts */
interface UnifiedPartnership {
  id: string;
  name: string;
  name_en?: string | null;
  type: string;
  status: string;
  geography: string;
  linkedOrgs: string[];
  description?: string | null;
  contact?: string | null;
}

/** يحوّل صف قاعدة البيانات (snake_case) إلى الشكل الموحّد */
function normalizeRow(r: any): UnifiedPartnership {
  return {
    id: String(r.id),
    name: r.name ?? "",
    name_en: r.name_en ?? null,
    type: r.type ?? "",
    status: r.status ?? "",
    geography: r.geography ?? "",
    linkedOrgs: Array.isArray(r.linked_orgs) ? r.linked_orgs : Array.isArray(r.linkedOrgs) ? r.linkedOrgs : [],
    description: r.description ?? null,
    contact: r.contact ?? null,
  };
}

const TYPE_PRESETS = ["استراتيجية", "مذكرة تفاهم", "تشغيلية", "تنموية", "أكاديمية", "عضوية"];
const STATUS_PRESETS = ["فاعلة", "معلّقة", "منتهية", "قيد التفاوض"];
const GEO_PRESETS = ["دولي", "إقليمي — أفريقيا", "عربي", "محلي — الصومال"];

/* ============================ MODAL ============================ */
function NewPartnershipModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: "", name_en: "", type: TYPE_PRESETS[0], status: STATUS_PRESETS[0],
    geography: GEO_PRESETS[0], description: "", contact: "",
  });
  const [linkedOrgs, setLinkedOrgs] = useState<string[]>([]);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        name_en: form.name_en.trim() || null,
        type: form.type,
        status: form.status,
        geography: form.geography,
        linked_orgs: linkedOrgs,
        description: form.description.trim() || null,
        contact: form.contact.trim() || null,
      };
      const { error } = await supabase.from("partnerships").insert(payload).select().single();
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["partnerships"] });
      onClose();
      setForm({ name: "", name_en: "", type: TYPE_PRESETS[0], status: STATUS_PRESETS[0], geography: GEO_PRESETS[0], description: "", contact: "" });
      setLinkedOrgs([]);
      setErrMsg(null);
    },
    onError: (e: any) => setErrMsg(e?.message ?? "فشل الحفظ في قاعدة البيانات")),
  });

  if (!open) return null;
  const set = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));
  const toggleOrg = (id: string) => setLinkedOrgs((prev) => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-bold text-foreground">إضافة شراكة جديدة</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="إغلاق"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-3">
          <label className="block">
            <span className="text-xs text-muted-foreground">اسم الشريك *</span>
            <input value={form.name} onChange={(e) => set("name", e.target.value)} className="mt-1 w-full px-3 py-2 rounded-md bg-muted border border-border text-sm focus:outline-none" placeholder="مثال: مؤسسة كذا" />
          </label>
          <label className="block">
            <span className="text-xs text-muted-foreground">الاسم بالإنجليزية (اختياري)</span>
            <input value={form.name_en} onChange={(e) => set("name_en", e.target.value)} className="mt-1 w-full px-3 py-2 rounded-md bg-muted border border-border text-sm focus:outline-none" dir="ltr" />
          </label>
          <div className="grid grid-cols-3 gap-3">
            <label className="block">
              <span className="text-xs text-muted-foreground">النوع</span>
              <select value={form.type} onChange={(e) => set("type", e.target.value)} className="mt-1 w-full px-2 py-2 rounded-md bg-muted border border-border text-sm focus:outline-none">
                {TYPE_PRESETS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-muted-foreground">الحالة</span>
              <select value={form.status} onChange={(e) => set("status", e.target.value)} className="mt-1 w-full px-2 py-2 rounded-md bg-muted border border-border text-sm focus:outline-none">
                {STATUS_PRESETS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-muted-foreground">الجغرافيا</span>
              <select value={form.geography} onChange={(e) => set("geography", e.target.value)} className="mt-1 w-full px-2 py-2 rounded-md bg-muted border border-border text-sm focus:outline-none">
                {GEO_PRESETS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">المؤسسات المرتبطة</span>
            <div className="mt-1 flex flex-wrap gap-2">
              {ORGS.map(o => (
                <button key={o.id} type="button" onClick={() => toggleOrg(o.id)}
                  className={`text-xs px-2 py-1 rounded-full border ${linkedOrgs.includes(o.id) ? "bg-primary text-primary-foreground border-primary" : "bg-muted border-border hover:bg-muted/70"}`}>
                  {o.abbr} — {o.nameAr}
                </button>
              ))}
            </div>
          </div>
          <label className="block">
            <span className="text-xs text-muted-foreground">جهة الاتصال (اختياري)</span>
            <input value={form.contact} onChange={(e) => set("contact", e.target.value)} className="mt-1 w-full px-3 py-2 rounded-md bg-muted border border-border text-sm focus:outline-none" placeholder="اسم / بريد / هاتف" />
          </label>
          <label className="block">
            <span className="text-xs text-muted-foreground">الوصف (اختياري)</span>
            <textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={3} className="mt-1 w-full px-3 py-2 rounded-md bg-muted border border-border text-sm focus:outline-none resize-y" />
          </label>
          {errMsg && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">{errMsg}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="text-sm px-3 py-1.5 rounded-md border border-border hover:bg-muted">إلغاء</button>
            <button onClick={() => mutation.mutate()} disabled={!form.name.trim() || mutation.isPending}
              className="text-sm px-4 py-1.5 rounded-md bg-primary text-primary-foreground disabled:opacity-50">
              {mutation.isPending ? "جارٍ الحفظ…" : "حفظ الشراكة"}
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ============================ PARTNERSHIPS ============================ */
export function PartnershipsSection() {
  // 1) قراءة الشراكات من Supabase
  const { data: dbPartnerships, isLoading } = useQuery<UnifiedPartnership[]>({
    queryKey: ["partnerships"],
    queryFn: async () => {
      const { data, error } = await supabase.from("partnerships").select("*").order("name");
      if (error) throw error;
      return (data ?? []).map(normalizeRow);
    },
  });

  // 2) استخدام بيانات قاعدة البيانات إن توفرت، وإلا fallback إلى oid-data.ts
  const activePartnerships: UnifiedPartnership[] = useMemo(() => {
    if (dbPartnerships && dbPartnerships.length >= 0) return dbPartnerships;
    return fallbackPartnerships.map(p => ({
      id: p.id, name: p.name, type: p.type, status: p.status,
      geography: p.geography, linkedOrgs: p.linkedOrgs, name_en: null, description: null, contact: null,
    }));
  }, [dbPartnerships]);

  // 3) حالة الفلاتر
  const [filters, setFilters] = useState({ type: "all", status: "all", geography: "all", org: "all" });
  const [sortBy, setSortBy] = useState<"name" | "type" | "status">("name");
  const [view, setView] = useState<"table" | "cards">("cards");
  const [showModal, setShowModal] = useState(false);
  const update = (k: keyof typeof filters, v: string) => setFilters((p) => ({ ...p, [k]: v }));
  const reset = () => setFilters({ type: "all", status: "all", geography: "all", org: "all" });

  const uniq = <T,>(arr: T[]) => Array.from(new Set(arr));
  const typeOpts = useMemo(() => [{ value: "all", label: "جميع الأنواع" }, ...uniq(activePartnerships.map(p => p.type)).map(t => ({ value: t, label: t }))], [activePartnerships]);
  const statusOpts = useMemo(() => [{ value: "all", label: "جميع الحالات" }, ...uniq(activePartnerships.map(p => p.status)).map(t => ({ value: t, label: t }))], [activePartnerships]);
  const geoOpts = useMemo(() => [{ value: "all", label: "جميع المناطق" }, ...uniq(activePartnerships.map(p => p.geography)).map(t => ({ value: t, label: t }))], [activePartnerships]);
  const orgOpts = [{ value: "all", label: "جميع المؤسسات" }, ...ORGS.map(o => ({ value: o.id, label: o.nameAr }))];

  // 4) تطبيق الفلترة
  const filtered = useMemo(() => {
    return activePartnerships
      .filter(p => {
        const matchType = filters.type === "all" || p.type === filters.type;
        const matchStat = filters.status === "all" || p.status === filters.status;
        const matchGeo = filters.geography === "all" || p.geography === filters.geography;
        const matchOrg = filters.org === "all" || p.linkedOrgs.includes(filters.org);
        return matchType && matchStat && matchGeo && matchOrg;
      })
      .sort((a, b) => {
        if (sortBy === "name") return a.name.localeCompare(b.name, "ar");
        if (sortBy === "type") return (a.type ?? "").localeCompare(b.type ?? "", "ar");
        if (sortBy === "status") return (a.status ?? "").localeCompare(b.status ?? "", "ar");
        return 0;
      });
  }, [activePartnerships, filters, sortBy]);

  const byGeo = useMemo(() => {
    const m: Record<string, number> = {};
    filtered.forEach(p => { m[p.geography] = (m[p.geography] || 0) + 1; });
    return Object.entries(m).map(([name, value]) => ({ name, value }));
  }, [filtered]);
  const byType = useMemo(() => {
    const m: Record<string, number> = {};
    filtered.forEach(p => { m[p.type] = (m[p.type] || 0) + 1; });
    return Object.entries(m).map(([name, value]) => ({ name, value }));
  }, [filtered]);
  const colors = ["#0e4d2e", "#1558a0", "#2e9bd4", "#d97706", "#10b986", "#7c3aed"];
  const hasActive = filters.type !== "all" || filters.status !== "all" || filters.geography !== "all" || filters.org !== "all";
  const total = activePartnerships.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">الشراكات الاستراتيجية</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {isLoading ? "جارٍ التحميل…" : `إجمالي ${total} شراكة`}
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="text-sm flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90">
          <Plus size={16} /> إضافة شراكة
        </button>
      </div>

      {/* 5) شريط الفلاتر والترتيب والعرض */}
      <Card className="p-3 flex flex-wrap items-center gap-3">
        <FilterSelect label="النوع" value={filters.type} onChange={(v) => update("type", v)} options={typeOpts} />
        <FilterSelect label="الحالة" value={filters.status} onChange={(v) => update("status", v)} options={statusOpts} />
        <FilterSelect label="الجغرافيا" value={filters.geography} onChange={(v) => update("geography", v)} options={geoOpts} />
        <FilterSelect label="المؤسسة" value={filters.org} onChange={(v) => update("org", v)} options={orgOpts} />
        <div className="h-6 w-px bg-border mx-1" />
        <FilterSelect label="ترتيب" value={sortBy} onChange={(v) => setSortBy(v as any)} options={[
          { value: "name", label: "الاسم (أبجدي)" },
          { value: "type", label: "النوع" },
          { value: "status", label: "الحالة" },
        ]} />
        <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
          <button onClick={() => setView("table")} className={`text-xs px-2 py-1 rounded ${view === "table" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`} title="عرض جدولي">☰</button>
          <button onClick={() => setView("cards")} className={`text-xs px-2 py-1 rounded ${view === "cards" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`} title="عرض بطاقات">▦</button>
        </div>
        {hasActive && (
          <button onClick={reset} className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted">↺ إعادة ضبط</button>
        )}
        <div className="ml-auto text-xs text-muted-foreground">
          عرض <span className="font-bold tabular-nums" dir="ltr">{filtered.length}</span> من{" "}
          <span className="tabular-nums" dir="ltr">{total}</span> شراكة
        </div>
      </Card>

      {/* إحصاءات تتفاعل مع الفلتر */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-5">
          <div className="text-xs text-muted-foreground mb-1">الشراكات المعروضة</div>
          <div className="text-4xl font-bold text-primary tabular-nums">{filtered.length}</div>
          <div className="text-xs text-muted-foreground mt-2">{hasActive ? "حسب الفلتر النشط" : "إجمالي القاعدة"}</div>
        </Card>
        <Card>
          <CardHeader title="التوزيع الجغرافي" />
          <div className="p-4 h-[220px]">
            {byGeo.length === 0 ? <EmptyData msg="لا بيانات" /> : (
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={byGeo} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={{ fontSize: 10 }}>
                    {byGeo.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
        <Card>
          <CardHeader title="التوزيع حسب النوع" />
          <div className="p-4 h-[220px]">
            {byType.length === 0 ? <EmptyData msg="لا بيانات" /> : (
              <ResponsiveContainer>
                <BarChart data={byType} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={90} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#1558a0" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-8 text-center space-y-3">
          <EmptyData msg="لا توجد شراكات مطابقة لهذا الفلتر" />
          <button onClick={reset} className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted">↺ إعادة ضبط الفلاتر</button>
        </Card>
      ) : view === "table" ? (
        <Card>
          <CardHeader title="جدول الشراكات" />
          <ScrollableTable>
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>{["الشريك", "النوع", "الحالة", "الجغرافيا", "المؤسسات المرتبطة"].map(h => <th key={h} className="px-3 py-2 text-right font-medium whitespace-nowrap">{h}</th>)}</tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id} className="border-t border-border hover:bg-muted/20">
                    <td className="px-3 py-2 font-medium">{p.name}</td>
                    <td className="px-3 py-2 text-xs">{p.type}</td>
                    <td className="px-3 py-2"><span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">{p.status}</span></td>
                    <td className="px-3 py-2 text-xs">{p.geography}</td>
                    <td className="px-3 py-2"><div className="flex gap-1">{p.linkedOrgs.map(o => <OrgChip key={o} id={o as OrgId} />)}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollableTable>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(p => (
            <Card key={p.id} className="p-4 hover:shadow-md transition">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[10px] text-muted-foreground">{p.id.slice(0, 8)}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700">{p.status}</span>
              </div>
              <div className="font-bold text-sm mb-2 leading-tight">{p.name}</div>
              <div className="text-xs text-muted-foreground mb-3">{p.type} • {p.geography}</div>
              {p.description && <div className="text-xs text-muted-foreground mb-3 line-clamp-2">{p.description}</div>}
              <div className="flex flex-wrap gap-1">{p.linkedOrgs.map(o => <OrgChip key={o} id={o as OrgId} />)}</div>
            </Card>
          ))}
        </div>
      )}

      <Card className="p-5 bg-yellow-50 border-yellow-200">
        <div className="flex gap-3">
          <AlertTriangle className="text-warning shrink-0" size={20} />
          <div>
            <div className="font-bold text-sm mb-1">المكتب في مرحلة بناء منهجية الشراكات</div>
            <div className="text-xs text-muted-foreground">الخطوات المقترحة: إعداد قوالب رسمية (يونيو 2026) ← تحديث البيانات ← وضع معايير التقييم ← إطلاق خطة الشراكات 2026-2027</div>
          </div>
        </div>
      </Card>

      <NewPartnershipModal open={showModal} onClose={() => setShowModal(false)} />
    </div>
  );
}
