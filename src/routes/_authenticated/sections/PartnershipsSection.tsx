import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Plus, X } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, PieChart, Pie, Cell } from "recharts";
import { ORGS, type OrgId, partnerships as fallbackPartnerships } from "@/lib/oid-data";
import { ScrollableTable } from "@/components/oid/ScrollableTable";
import { Card, CardHeader, EmptyData, SectionTitle, OrgChip, FilterSelect } from "./_shared";
import { useLang } from "@/lib/lang-context";
import { TranslatableText } from "@/components/oid/TranslatableText";
import { Button } from "@/components/ui/button";

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
const TYPE_KEYS: Record<string, string> = { "استراتيجية": "strategic", "مذكرة تفاهم": "mou", "تشغيلية": "operational", "تنموية": "development", "أكاديمية": "academic", "عضوية": "membership" };
const STATUS_KEYS: Record<string, string> = { "فاعلة": "active", "معلّقة": "suspended", "منتهية": "expired", "قيد التفاوض": "negotiating" };
const GEO_KEYS: Record<string, string> = { "دولي": "international", "إقليمي — أفريقيا": "africa", "عربي": "arab", "محلي — الصومال": "somalia" };

/* ============================ MODAL ============================ */
function NewPartnershipModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { lang, t } = useLang();
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
    onError: (e: any) => setErrMsg(e?.message ?? t("partnerships.saveError")),
  });

  if (!open) return null;
  const set = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));
  const toggleOrg = (id: string) => setLinkedOrgs((prev) => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" dir={lang === "ar" ? "rtl" : "ltr"}>
      <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-bold text-foreground">{t("partnerships.addTitle")}</h3>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label={t("partnerships.close")}><X size={18} /></Button>
        </div>
        <div className="p-5 space-y-3">
          <label className="block">
            <span className="text-xs text-muted-foreground">{t("partnerships.partnerName")}</span>
            <input value={form.name} onChange={(e) => set("name", e.target.value)} className="mt-1 w-full px-3 py-2 rounded-md bg-muted border border-border text-sm focus:outline-none" placeholder={t("partnerships.partnerPlaceholder")} />
          </label>
          <label className="block">
            <span className="text-xs text-muted-foreground">{t("partnerships.englishName")}</span>
            <input value={form.name_en} onChange={(e) => set("name_en", e.target.value)} className="mt-1 w-full px-3 py-2 rounded-md bg-muted border border-border text-sm focus:outline-none" dir="ltr" />
          </label>
          <div className="grid grid-cols-3 gap-3">
            <label className="block">
              <span className="text-xs text-muted-foreground">{t("partnerships.type")}</span>
              <select value={form.type} onChange={(e) => set("type", e.target.value)} className="mt-1 w-full px-2 py-2 rounded-md bg-muted border border-border text-sm focus:outline-none">
                {TYPE_PRESETS.map(v => <option key={v} value={v}>{t(`partnerships.types.${TYPE_KEYS[v]}`)}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-muted-foreground">{t("partnerships.status")}</span>
              <select value={form.status} onChange={(e) => set("status", e.target.value)} className="mt-1 w-full px-2 py-2 rounded-md bg-muted border border-border text-sm focus:outline-none">
                {STATUS_PRESETS.map(v => <option key={v} value={v}>{t(`partnerships.statuses.${STATUS_KEYS[v]}`)}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-muted-foreground">{t("partnerships.geography")}</span>
              <select value={form.geography} onChange={(e) => set("geography", e.target.value)} className="mt-1 w-full px-2 py-2 rounded-md bg-muted border border-border text-sm focus:outline-none">
                {GEO_PRESETS.map(v => <option key={v} value={v}>{t(`partnerships.regions.${GEO_KEYS[v]}`)}</option>)}
              </select>
            </label>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">{t("partnerships.linkedOrgs")}</span>
            <div className="mt-1 flex flex-wrap gap-2">
              {ORGS.map(o => (
                <button key={o.id} type="button" onClick={() => toggleOrg(o.id)}
                  className={`text-xs px-2 py-1 rounded-full border ${linkedOrgs.includes(o.id) ? "bg-primary text-primary-foreground border-primary" : "bg-muted border-border hover:bg-muted/70"}`}>
                   {o.abbr} — {lang === "ar" ? o.nameAr : o.nameEn}
                </button>
              ))}
            </div>
          </div>
          <label className="block">
            <span className="text-xs text-muted-foreground">{t("partnerships.contact")}</span>
            <input value={form.contact} onChange={(e) => set("contact", e.target.value)} className="mt-1 w-full px-3 py-2 rounded-md bg-muted border border-border text-sm focus:outline-none" placeholder={t("partnerships.contactPlaceholder")} />
          </label>
          <label className="block">
            <span className="text-xs text-muted-foreground">{t("partnerships.description")}</span>
            <textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={3} className="mt-1 w-full px-3 py-2 rounded-md bg-muted border border-border text-sm focus:outline-none resize-y" />
          </label>
          {errMsg && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">{errMsg}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>{t("partnerships.cancel")}</Button>
            <Button onClick={() => mutation.mutate()} disabled={!form.name.trim() || mutation.isPending}>
              {mutation.isPending ? t("partnerships.saving") : t("partnerships.save")}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ============================ PARTNERSHIPS ============================ */
export function PartnershipsSection() {
  const { lang, t, tFormat } = useLang();
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
  const typeOpts = useMemo(() => [{ value: "all", label: t("partnerships.allTypes") }, ...uniq(activePartnerships.map(p => p.type)).map(v => ({ value: v, label: t(`partnerships.types.${TYPE_KEYS[v]}`) }))], [activePartnerships, t]);
  const statusOpts = useMemo(() => [{ value: "all", label: t("partnerships.allStatuses") }, ...uniq(activePartnerships.map(p => p.status)).map(v => ({ value: v, label: t(`partnerships.statuses.${STATUS_KEYS[v]}`) }))], [activePartnerships, t]);
  const geoOpts = useMemo(() => [{ value: "all", label: t("partnerships.allRegions") }, ...uniq(activePartnerships.map(p => p.geography)).map(v => ({ value: v, label: t(`partnerships.regions.${GEO_KEYS[v]}`) }))], [activePartnerships, t]);
  const orgOpts = [{ value: "all", label: t("partnerships.allOrgs") }, ...ORGS.map(o => ({ value: o.id, label: lang === "ar" ? o.nameAr : o.nameEn }))];

  // 4) تطبيق الفلترة
  const filtered = useMemo(() => {
    return activePartnerships
      .filter(p => {
        const matchType = filters.type === "all" || p.type === filters.type;
        const matchStat = filters.status === "all" || p.status === filters.status;
        const matchGeo = filters.geography === "all" || p.geography === filters.geography;
        const matchOrg = filters.org === "all" || (p.linkedOrgs ?? []).includes(filters.org);
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
    return Object.entries(m).map(([name, value]) => ({ name: GEO_KEYS[name] ? t(`partnerships.regions.${GEO_KEYS[name]}`) : name, value }));
  }, [filtered, t]);
  const byType = useMemo(() => {
    const m: Record<string, number> = {};
    filtered.forEach(p => { m[p.type] = (m[p.type] || 0) + 1; });
    return Object.entries(m).map(([name, value]) => ({ name: TYPE_KEYS[name] ? t(`partnerships.types.${TYPE_KEYS[name]}`) : name, value }));
  }, [filtered, t]);
  const colors = ["#0e4d2e", "#1558a0", "#2e9bd4", "#d97706", "#10b986", "#7c3aed"];
  const hasActive = filters.type !== "all" || filters.status !== "all" || filters.geography !== "all" || filters.org !== "all";
  const total = activePartnerships.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
           <h2 className="text-2xl font-bold text-foreground">{t("partnerships.title")}</h2>
          <p className="text-sm text-muted-foreground mt-1">
             {isLoading ? t("partnerships.loading") : tFormat("partnerships.total", { count: total })}
          </p>
        </div>
         <Button onClick={() => setShowModal(true)} className="gap-1.5"><Plus size={16} /> {t("partnerships.add")}</Button>
      </div>

      {/* 5) شريط الفلاتر والترتيب والعرض */}
      <Card className="p-3 flex flex-wrap items-center gap-3">
         <FilterSelect label={t("partnerships.type")} value={filters.type} onChange={(v) => update("type", v)} options={typeOpts} />
         <FilterSelect label={t("partnerships.status")} value={filters.status} onChange={(v) => update("status", v)} options={statusOpts} />
         <FilterSelect label={t("partnerships.geography")} value={filters.geography} onChange={(v) => update("geography", v)} options={geoOpts} />
         <FilterSelect label={t("partnerships.institution")} value={filters.org} onChange={(v) => update("org", v)} options={orgOpts} />
        <div className="h-6 w-px bg-border mx-1" />
         <FilterSelect label={t("partnerships.sort")} value={sortBy} onChange={(v) => setSortBy(v as any)} options={[
           { value: "name", label: t("partnerships.nameAlpha") },
           { value: "type", label: t("partnerships.type") },
           { value: "status", label: t("partnerships.status") },
        ]} />
        <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
           <Button variant="ghost" size="sm" onClick={() => setView("table")} className={view === "table" ? "bg-primary text-primary-foreground" : ""} title={t("partnerships.tableView")}>☰</Button>
           <Button variant="ghost" size="sm" onClick={() => setView("cards")} className={view === "cards" ? "bg-primary text-primary-foreground" : ""} title={t("partnerships.cardView")}>▦</Button>
        </div>
        {hasActive && (
           <Button variant="outline" size="sm" onClick={reset}>{t("partnerships.reset")}</Button>
        )}
        <div className="ml-auto text-xs text-muted-foreground">
           {tFormat("partnerships.showing", { count: filtered.length, total })}
        </div>
      </Card>

      {/* إحصاءات تتفاعل مع الفلتر */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-5">
           <div className="text-xs text-muted-foreground mb-1">{t("partnerships.shown")}</div>
          <div className="text-4xl font-bold text-primary tabular-nums">{filtered.length}</div>
           <div className="text-xs text-muted-foreground mt-2">{hasActive ? t("partnerships.filteredBase") : t("partnerships.totalBase")}</div>
        </Card>
        <Card>
           <CardHeader title={t("partnerships.geoDistribution")} />
          <div className="p-4 h-[220px]">
             {byGeo.length === 0 ? <EmptyData msg={t("partnerships.noData")} /> : (
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
           <CardHeader title={t("partnerships.typeDistribution")} />
          <div className="p-4 h-[220px]">
             {byType.length === 0 ? <EmptyData msg={t("partnerships.noData")} /> : (
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
           <EmptyData msg={t("partnerships.noMatches")} />
           <Button variant="outline" size="sm" onClick={reset}>{t("partnerships.resetFilters")}</Button>
        </Card>
      ) : view === "table" ? (
        <Card>
           <CardHeader title={t("partnerships.tableTitle")} />
           <ScrollableTable direction={lang === "ar" ? "rtl" : "ltr"}>
            <table className="oid-table">
              <thead>
                 <tr>{[t("partnerships.partner"), t("partnerships.type"), t("partnerships.status"), t("partnerships.geography"), t("partnerships.linkedOrgs")].map(h => <th key={h} className="px-3 py-2 text-start font-medium whitespace-nowrap">{h}</th>)}</tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id} className="border-t border-border hover:bg-muted/20">
                     <td className="px-3 py-2 font-medium"><TranslatableText text={lang === "en" && p.name_en ? p.name_en : p.name} sourceLang={lang === "en" && p.name_en ? "en" : "ar"} recordId={p.id} tableName="partnerships" fieldName="name" /></td>
                     <td className="px-3 py-2 text-xs">{t(`partnerships.types.${TYPE_KEYS[p.type]}`)}</td>
                     <td className="px-3 py-2"><span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">{t(`partnerships.statuses.${STATUS_KEYS[p.status]}`)}</span></td>
                     <td className="px-3 py-2 text-xs">{t(`partnerships.regions.${GEO_KEYS[p.geography]}`)}</td>
                     <td className="px-3 py-2"><div className="flex gap-1">{(p.linkedOrgs ?? []).map(o => <OrgChip key={o} id={o as OrgId} />)}</div></td>
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
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700">{STATUS_KEYS[p.status] ? t(`partnerships.statuses.${STATUS_KEYS[p.status]}`) : p.status}</span>
              </div>
               <div className="font-bold text-sm mb-2 leading-tight"><TranslatableText text={lang === "en" && p.name_en ? p.name_en : p.name} sourceLang={lang === "en" && p.name_en ? "en" : "ar"} recordId={p.id} tableName="partnerships" fieldName="name" /></div>
               <div className="text-xs text-muted-foreground mb-3">{t(`partnerships.types.${TYPE_KEYS[p.type]}`)} • {t(`partnerships.regions.${GEO_KEYS[p.geography]}`)}</div>
               {p.description && <div className="text-xs text-muted-foreground mb-3 line-clamp-2"><TranslatableText text={p.description} recordId={p.id} tableName="partnerships" fieldName="description" /></div>}
               <div className="flex flex-wrap gap-1">{(p.linkedOrgs ?? []).map(o => <OrgChip key={o} id={o as OrgId} />)}</div>
            </Card>
          ))}
        </div>
      )}

      <Card className="p-5 bg-yellow-50 border-yellow-200">
        <div className="flex gap-3">
          <AlertTriangle className="text-warning shrink-0" size={20} />
          <div>
             <div className="font-bold text-sm mb-1">{t("partnerships.methodologyTitle")}</div>
             <div className="text-xs text-muted-foreground">{t("partnerships.methodologySteps")}</div>
          </div>
        </div>
      </Card>

      <NewPartnershipModal open={showModal} onClose={() => setShowModal(false)} />
    </div>
  );
}
