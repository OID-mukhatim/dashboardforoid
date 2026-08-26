import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, PieChart, Pie, Cell } from "recharts";
import { ORGS, type OrgId, partnerships } from "@/lib/oid-data";
import { ScrollableTable } from "@/components/oid/ScrollableTable";
import { Card, CardHeader, EmptyData, SectionTitle, OrgChip, FilterSelect } from "./_shared";

/* ============================ PARTNERSHIPS ============================ */
export function PartnershipsSection() {
  const [filters, setFilters] = useState({ type: "all", status: "all", geography: "all", org: "all" });
  const [sortBy, setSortBy] = useState<"name"|"type"|"status">("name");
  const [view, setView] = useState<"table"|"cards">("table");
  const update = (k: keyof typeof filters, v: string) => setFilters((p) => ({ ...p, [k]: v }));
  const reset = () => setFilters({ type: "all", status: "all", geography: "all", org: "all" });

  const uniq = <T,>(arr: T[]) => Array.from(new Set(arr));
  const typeOpts = useMemo(() => [{ value: "all", label: "جميع الأنواع" }, ...uniq(partnerships.map(p=>p.type)).map(t=>({value:t,label:t}))], []);
  const statusOpts = useMemo(() => [{ value: "all", label: "جميع الحالات" }, ...uniq(partnerships.map(p=>p.status)).map(t=>({value:t,label:t}))], []);
  const geoOpts = useMemo(() => [{ value: "all", label: "جميع المناطق" }, ...uniq(partnerships.map(p=>p.geography)).map(t=>({value:t,label:t}))], []);
  const orgOpts = [{ value: "all", label: "جميع المؤسسات" }, ...ORGS.map(o => ({ value: o.id, label: o.nameAr }))];

  const filtered = useMemo(() => {
    const out = partnerships.filter(p =>
      (filters.type === "all" || p.type === filters.type) &&
      (filters.status === "all" || p.status === filters.status) &&
      (filters.geography === "all" || p.geography === filters.geography) &&
      (filters.org === "all" || p.linkedOrgs.includes(filters.org))
    );
    out.sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name, "ar");
      if (sortBy === "type") return a.type.localeCompare(b.type, "ar");
      return a.status.localeCompare(b.status, "ar");
    });
    return out;
  }, [filters, sortBy]);

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
  const colors = ["#0e4d2e","#1558a0","#2e9bd4","#d97706","#10b986","#7c3aed"];
  const hasActive = filters.type !== "all" || filters.status !== "all" || filters.geography !== "all" || filters.org !== "all";

  return (
    <div className="space-y-6">
      <SectionTitle title="الشراكات الاستراتيجية" subtitle={`إجمالي ${partnerships.length} شراكة`} />

      {/* شريط الفلاتر والترتيب والعرض */}
      <Card className="p-3 flex flex-wrap items-center gap-3">
        <FilterSelect label="النوع" value={filters.type} onChange={(v)=>update("type", v)} options={typeOpts} />
        <FilterSelect label="الحالة" value={filters.status} onChange={(v)=>update("status", v)} options={statusOpts} />
        <FilterSelect label="الجغرافيا" value={filters.geography} onChange={(v)=>update("geography", v)} options={geoOpts} />
        <FilterSelect label="المؤسسة" value={filters.org} onChange={(v)=>update("org", v)} options={orgOpts} />
        <div className="h-6 w-px bg-border mx-1" />
        <FilterSelect label="ترتيب" value={sortBy} onChange={(v)=>setSortBy(v as any)} options={[
          { value: "name", label: "الاسم (أبجدي)" },
          { value: "type", label: "النوع" },
          { value: "status", label: "الحالة" },
        ]} />
        <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
          <button onClick={()=>setView("table")} className={`text-xs px-2 py-1 rounded ${view==="table"?"bg-primary text-primary-foreground":"hover:bg-muted"}`} title="عرض جدولي">☰</button>
          <button onClick={()=>setView("cards")} className={`text-xs px-2 py-1 rounded ${view==="cards"?"bg-primary text-primary-foreground":"hover:bg-muted"}`} title="عرض بطاقات">▦</button>
        </div>
        {hasActive && (
          <button onClick={reset} className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted">↺ إعادة ضبط</button>
        )}
        <div className="ml-auto text-xs text-muted-foreground">
          عرض <span className="font-bold tabular-nums" dir="ltr">{filtered.length}</span> من{" "}
          <span className="tabular-nums" dir="ltr">{partnerships.length}</span> شراكة
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
                <tr>{["الكود","الشريك","النوع","الحالة","الجغرافيا","المؤسسات المرتبطة"].map(h=><th key={h} className="px-3 py-2 text-right font-medium whitespace-nowrap">{h}</th>)}</tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id} className="border-t border-border hover:bg-muted/20">
                    <td className="px-3 py-2 font-mono text-xs">{p.id}</td>
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
                <span className="font-mono text-[10px] text-muted-foreground">{p.id}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700">{p.status}</span>
              </div>
              <div className="font-bold text-sm mb-2 leading-tight">{p.name}</div>
              <div className="text-xs text-muted-foreground mb-3">{p.type} • {p.geography}</div>
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
    </div>
  );
}
