import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Building, Plus, Archive, RotateCcw, Pencil } from "lucide-react";
import { toast } from "sonner";
import { saveOrganization, setOrganizationStatus } from "@/lib/orgs.functions";
import { useOrganizations, ORGANIZATIONS_KEY } from "@/lib/use-organizations";
import type { OrganizationRow } from "@/lib/org-registry";
import { useLang } from "@/lib/lang-context";
import { ScrollableTable } from "@/components/oid/ScrollableTable";
import { Card } from "./_shared";

type Form = { id: string; name_ar: string; name_en: string; abbr: string; color: string; fiscal_type: "calendar" | "academic"; aliases: string; sort_order: number; isNew: boolean };
const INP = "h-9 px-2 rounded-md border border-border bg-background text-sm w-full";

export function OrganizationsSection() {
  const { lang } = useLang();
  const ar = lang === "ar";
  const qc = useQueryClient();
  const { data: orgs = [] } = useOrganizations();
  const saveFn = useServerFn(saveOrganization);
  const statusFn = useServerFn(setOrganizationStatus);
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = async () => { await qc.invalidateQueries({ queryKey: ORGANIZATIONS_KEY }); await qc.invalidateQueries(); };
  const edit = (o: OrganizationRow) => setForm({ id: o.id, name_ar: o.name_ar, name_en: o.name_en, abbr: o.abbr, color: o.color, fiscal_type: o.fiscal_type === "academic" ? "academic" : "calendar", aliases: (o.aliases ?? []).join("\n"), sort_order: o.sort_order, isNew: false });
  const add = () => setForm({ id: "", name_ar: "", name_en: "", abbr: "", color: "#64748b", fiscal_type: "calendar", aliases: "", sort_order: (Math.max(0, ...orgs.map((o) => o.sort_order)) + 1), isNew: true });

  async function submit() {
    if (!form) return;
    setBusy(true);
    try {
      await saveFn({ data: { ...form, id: form.id.trim().toUpperCase(), aliases: form.aliases.split("\n").map((s) => s.trim()).filter(Boolean) } });
      toast.success(ar ? "تم الحفظ" : "Saved");
      setForm(null);
      await refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Error"); } finally { setBusy(false); }
  }
  async function toggle(o: OrganizationRow) {
    const next = o.status === "active" ? "archived" : "active";
    if (next === "archived" && !confirm(ar ? `أرشفة ${o.name_ar}؟ ستختفي من اللوحات وتبقى بياناتها.` : `Archive ${o.name_en || o.name_ar}? It will be hidden; its data is kept.`)) return;
    try { await statusFn({ data: { id: o.id, status: next } }); toast.success(ar ? "تم" : "Done"); await refresh(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Error"); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2"><Building size={20} /><h2 className="text-xl font-bold">{ar ? "إدارة المؤسسات" : "Manage Institutions"}</h2></div>
        <button onClick={add} className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm"><Plus size={16} />{ar ? "إضافة مؤسسة" : "Add institution"}</button>
      </div>
      {form && (
        <Card>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
            <label>{ar ? "الرمز" : "Code"}<input className={INP} dir="ltr" value={form.id} disabled={!form.isNew} onChange={(e) => setForm({ ...form, id: e.target.value })} /></label>
            <label>{ar ? "الاسم بالعربية" : "Arabic name"}<input className={INP} value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} /></label>
            <label>{ar ? "الاسم بالإنجليزية" : "English name"}<input className={INP} dir="ltr" value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} /></label>
            <label>{ar ? "الاختصار" : "Abbreviation"}<input className={INP} dir="ltr" value={form.abbr} onChange={(e) => setForm({ ...form, abbr: e.target.value })} /></label>
            <label>{ar ? "اللون" : "Color"}<input type="color" className={INP} value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} /></label>
            <label>{ar ? "السنة المالية" : "Fiscal year"}
              <select className={INP} value={form.fiscal_type} onChange={(e) => setForm({ ...form, fiscal_type: e.target.value as Form["fiscal_type"] })}>
                <option value="calendar">{ar ? "ميلادية" : "Calendar"}</option><option value="academic">{ar ? "أكاديمية" : "Academic"}</option>
              </select></label>
            <label>{ar ? "الترتيب" : "Order"}<input type="number" className={INP} value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) || 0 })} /></label>
            <label className="md:col-span-4">{ar ? "الأسماء البديلة (نمط في كل سطر)" : "Aliases (one pattern per line)"}<textarea dir="ltr" className={INP + " h-24 py-1"} value={form.aliases} onChange={(e) => setForm({ ...form, aliases: e.target.value })} /></label>
          </div>
          <div className="flex gap-2 mt-3">
            <button disabled={busy} onClick={submit} className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm disabled:opacity-50">{ar ? "حفظ" : "Save"}</button>
            <button onClick={() => setForm(null)} className="px-3 py-1.5 rounded-md border border-border text-sm">{ar ? "إلغاء" : "Cancel"}</button>
          </div>
        </Card>
      )}
      <Card>
        <ScrollableTable>
          <table className="oid-table w-full text-sm">
            <thead><tr><th>{ar ? "الرمز" : "Code"}</th><th>{ar ? "الاسم" : "Name"}</th><th>{ar ? "الاختصار" : "Abbr."}</th><th>{ar ? "اللون" : "Color"}</th><th>{ar ? "السنة المالية" : "Fiscal"}</th><th>{ar ? "الحالة" : "Status"}</th><th></th></tr></thead>
            <tbody>
              {orgs.map((o) => (
                <tr key={o.id} className={o.status === "archived" ? "opacity-60" : ""}>
                  <td dir="ltr">{o.id}</td>
                  <td>{ar ? o.name_ar : o.name_en || o.name_ar}</td>
                  <td dir="ltr">{o.abbr}</td>
                  <td><span className="inline-block w-5 h-5 rounded border border-border align-middle" style={{ background: o.color }} /></td>
                  <td>{o.fiscal_type === "academic" ? (ar ? "أكاديمية" : "Academic") : (ar ? "ميلادية" : "Calendar")}</td>
                  <td>{o.status === "active" ? (ar ? "نشطة" : "Active") : (ar ? "مؤرشفة" : "Archived")}</td>
                  <td className="whitespace-nowrap">
                    <button onClick={() => edit(o)} className="p-1.5 rounded hover:bg-muted" title={ar ? "تعديل" : "Edit"}><Pencil size={14} /></button>
                    <button onClick={() => toggle(o)} className="p-1.5 rounded hover:bg-muted" title={o.status === "active" ? (ar ? "أرشفة" : "Archive") : (ar ? "استعادة" : "Restore")}>
                      {o.status === "active" ? <Archive size={14} /> : <RotateCcw size={14} />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollableTable>
      </Card>
    </div>
  );
}
