import { ChevronRight } from "lucide-react";
import { type OrgId, institutions, alerts } from "@/lib/oid-data";
import { OrgLogo } from "@/components/oid/OrgLogo";
import { openOrgProfile } from "@/lib/oid-drill";
import { loadInstitutionalProfiles } from "@/lib/dashboard.functions";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Card, EmptyData, SectionTitle, Row } from "./_shared";

/* ============================ PROFILES ============================ */
export function ProfilesSection() {
  const profilesFn = useServerFn(loadInstitutionalProfiles);
  const { data: liveProfiles = {} } = useQuery({
    queryKey: ["institutional-profiles"],
    queryFn: () => profilesFn(),
  });

  // Helper: pick the first matching live field by regex; falls back to static
  const pick = (orgCode: string, ...patterns: RegExp[]) => {
    const fields = liveProfiles[orgCode]?.fields ?? {};
    for (const re of patterns) {
      for (const [k, v] of Object.entries(fields)) {
        if (re.test(k) && v) return v;
      }
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <SectionTitle title="البيانات المؤسسية" subtitle="بطاقات تعريف الكيانات الست — تُثرى تلقائياً من ملفات الاستمارة المرفوعة" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {institutions.map(o => {
          const live = liveProfiles[o.id];
          const founded = pick(o.id, /تاريخ\s*التأسيس/) ?? o.founded;
          const license = pick(o.id, /رقم\s*الترخيص/) ?? o.license;
          const expiry = pick(o.id, /تاريخ\s*الصلاحية/) ?? o.licenseExpiry;
          const exec = pick(o.id, /المدير\s*التنفيذي.*العرب/, /المدير\s*التنفيذي/) ?? o.execAr;
          const email = pick(o.id, /الإيميل/, /email/i);
          const phone = pick(o.id, /رقم\s*التواصل/, /phone/i);
          const site = pick(o.id, /الموقع\s*الالكتروني|website/i);
          const address = pick(o.id, /عنوان\s*المقر|address/i);
          return (
          <Card key={o.id} className="p-5 hover:shadow-md hover:border-primary/40 transition cursor-pointer" >
            <div onClick={() => openOrgProfile(o.id as OrgId)} role="button" tabIndex={0}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && openOrgProfile(o.id as OrgId)}>
            <div className="flex items-start gap-3 mb-4">
              <OrgLogo orgId={o.id as OrgId} size={56} shape="rounded" />
              <div className="flex-1 min-w-0">
                <div className="font-bold leading-tight">{o.nameAr}</div>
                <div className="text-xs text-muted-foreground font-serif">{o.nameEn}</div>
              </div>
              {live && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0" title={`${live.fieldCount} حقل من ${live.fileName ?? "ملف مرفوع"}`}>
                  محدّث
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground mb-3">{o.sector}</div>
            <dl className="space-y-1.5 text-xs">
              <Row k="التأسيس" v={founded} />
              <Row k="الترخيص" v={license} />
              <Row k="الصلاحية" v={expiry} />
              <Row k="المدير التنفيذي" v={exec} />
              {phone && <Row k="هاتف" v={phone} />}
              {email && <Row k="الإيميل" v={<span dir="ltr" className="break-all">{email}</span>} />}
              {site && <Row k="الموقع" v={<a href={String(site).startsWith("http") ? String(site) : `https://${site}`} target="_blank" rel="noreferrer" dir="ltr" className="text-primary break-all">{site}</a>} />}
              {address && <Row k="المقر" v={address} />}
              <Row k="الموظفون" v={o.staff.total ? `${o.staff.total}` : null} />
              <Row k="الميزانية" v={o.budget ? `$${o.budget.toLocaleString()}` : null} />
            </dl>
            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border">
              <span className="text-xs">الأداء:</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: `${o.color}15`, color: o.color }}>
                {o.score !== null ? o.score.toFixed(2) : "—"}
              </span>
              <span className="text-xs ml-1">الحوكمة:</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-muted">{o.govScore !== null ? `${o.govScore.toFixed(2)}` : "—"}</span>
              {live && <span className="text-[10px] text-muted-foreground ml-auto">{live.fieldCount} حقل مرفوع</span>}
            </div>
            {o.alerts && o.alerts.length > 0 && (
              <div className="mt-3 space-y-1">
                {o.alerts.map((a, i) => <div key={i} className="text-xs p-2 rounded bg-red-50 text-red-700 border border-red-200">{a}</div>)}
              </div>
            )}
            {(o as any).dataStatus === "pending" && !live && <div className="mt-3"><EmptyData msg="بعض البيانات قيد الاستكمال" /></div>}
            </div>
            <button onClick={() => openOrgProfile(o.id as OrgId)} className="mt-4 w-full text-xs flex items-center justify-center gap-1 py-2 rounded-md border border-border text-primary hover:bg-primary/5">التقرير التفصيلي <ChevronRight size={14} className="rotate-180" /></button>
          </Card>
          );
        })}
      </div>
    </div>
  );
}
