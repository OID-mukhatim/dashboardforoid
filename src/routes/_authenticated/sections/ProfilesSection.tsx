import { useMemo, useRef, useState } from "react";
import { ChevronRight, ImageUp, Loader2 } from "lucide-react";
import { type OrgId, institutions } from "@/lib/oid-data";
import { OrgLogo } from "@/components/oid/OrgLogo";
import { openOrgProfile } from "@/lib/oid-drill";
import { loadInstitutionalProfiles } from "@/lib/dashboard.functions";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, EmptyData, SectionTitle, Row } from "./_shared";

type DbInstitution = {
  id: string;
  name_ar: string | null;
  name_en: string | null;
  founded: string | null;
  license_number: string | null;
  license_expiry: string | null;
  address: string | null;
  website: string | null;
  exec_name_ar: string | null;
  exec_phone: string | null;
  exec_email: string | null;
  staff_total: number | null;
  budget: number | null;
  sector: string | null;
  logo_url: string | null;
};

/* ============================ PROFILES ============================ */
export function ProfilesSection() {
  const qc = useQueryClient();
  const profilesFn = useServerFn(loadInstitutionalProfiles);
  const { data: liveProfiles = {} } = useQuery({
    queryKey: ["institutional-profiles"],
    queryFn: () => profilesFn(),
  });

  // 1) بيانات المؤسسات من قاعدة البيانات
  const { data: dbInstitutions } = useQuery({
    queryKey: ["institutions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("institutions").select("*");
      if (error) throw error;
      return (data ?? []) as unknown as DbInstitution[];
    },
  });

  // 2) دمج: قاعدة البيانات تتغلب على البيانات الثابتة
  const merged = useMemo(
    () =>
      institutions.map((s) => {
        const d = dbInstitutions?.find((x) => x.id === s.id);
        return { ...s, db: d ?? null };
      }),
    [dbInstitutions],
  );

  // 4) رفع الشعار
  const [uploading, setUploading] = useState<string | null>(null);
  const handleLogoUpload = async (orgId: string, file: File) => {
    setUploading(orgId);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `logos/${orgId}-${Date.now()}.${ext}`;
      const { error: storageErr } = await supabase.storage.from("uploads").upload(path, file, { upsert: true });
      if (storageErr) throw storageErr;
      const { error: updErr } = await supabase.from("institutions").update({ logo_url: path } as any).eq("id", orgId);
      if (updErr) throw updErr;
      await qc.invalidateQueries({ queryKey: ["institutions"] });
      await qc.invalidateQueries({ queryKey: ["org-logo"] });
    } catch {
      /* تجاهل الخطأ بصمت — يبقى الشعار الافتراضي */
    } finally {
      setUploading(null);
    }
  };

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
      <SectionTitle title="البيانات المؤسسية" subtitle="بطاقات تعريف الكيانات الست — تُثرى تلقائياً من قاعدة البيانات وملفات الاستمارة المرفوعة" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {merged.map(o => {
          const db = o.db;
          const live = liveProfiles[o.id];
          const founded = db?.founded ?? pick(o.id, /تاريخ\s*التأسيس/) ?? o.founded;
          const license = db?.license_number ?? pick(o.id, /رقم\s*الترخيص/) ?? o.license;
          const expiry = db?.license_expiry ?? pick(o.id, /تاريخ\s*الصلاحية/) ?? o.licenseExpiry;
          const exec = db?.exec_name_ar ?? pick(o.id, /المدير\s*التنفيذي.*العرب/, /المدير\s*التنفيذي/) ?? o.execAr;
          const email = db?.exec_email ?? pick(o.id, /الإيميل/, /email/i);
          const phone = db?.exec_phone ?? pick(o.id, /رقم\s*التواصل/, /phone/i);
          const site = db?.website ?? pick(o.id, /الموقع\s*الالكتروني|website/i);
          const address = db?.address ?? pick(o.id, /عنوان\s*المقر|address/i);
          const staffTotal = db?.staff_total ?? o.staff.total;
          const budget = db?.budget ?? o.budget;
          return (
          <Card key={o.id} className="p-5 hover:shadow-md hover:border-primary/40 transition">
            <div onClick={() => openOrgProfile(o.id as OrgId)} role="button" tabIndex={0} className="cursor-pointer"
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && openOrgProfile(o.id as OrgId)}>
            <div className="flex items-start gap-3 mb-4">
              <LogoWithUpload orgId={o.id} logoPath={db?.logo_url ?? null} uploading={uploading === o.id} onUpload={handleLogoUpload} />
              <div className="flex-1 min-w-0">
                <div className="font-bold leading-tight">{db?.name_ar ?? o.nameAr}</div>
                <div className="text-xs text-muted-foreground font-serif">{db?.name_en ?? o.nameEn}</div>
              </div>
              {(db || live) && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0" title={db ? "من قاعدة البيانات" : `${live?.fieldCount} حقل من ${live?.fileName ?? "ملف مرفوع"}`}>
                  محدّث
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground mb-3">{db?.sector ?? o.sector}</div>
            <dl className="space-y-1.5 text-xs">
              <Row k="التأسيس" v={founded} />
              <Row k="الترخيص" v={license} />
              <Row k="الصلاحية" v={expiry} />
              <Row k="المدير التنفيذي" v={exec} />
              {phone && <Row k="هاتف" v={phone} />}
              {email && <Row k="الإيميل" v={<span dir="ltr" className="break-all">{email}</span>} />}
              {site && <Row k="الموقع" v={<a href={String(site).startsWith("http") ? String(site) : `https://${site}`} target="_blank" rel="noreferrer" dir="ltr" className="text-primary break-all">{site}</a>} />}
              {address && <Row k="المقر" v={address} />}
              <Row k="الموظفون" v={staffTotal ? `${staffTotal}` : null} />
              <Row k="الميزانية" v={budget ? `$${Number(budget).toLocaleString()}` : null} />
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
            {(o as any).dataStatus === "pending" && !live && !db && <div className="mt-3"><EmptyData msg="بعض البيانات قيد الاستكمال" /></div>}
            </div>
            <button onClick={() => openOrgProfile(o.id as OrgId)} className="mt-4 w-full text-xs flex items-center justify-center gap-1 py-2 rounded-md border border-border text-primary hover:bg-primary/5">التقرير التفصيلي <ChevronRight size={14} className="rotate-180" /></button>
          </Card>
          );
        })}
      </div>
    </div>
  );
}

/* شعار المؤسسة مع إمكانية الرفع إلى التخزين */
function LogoWithUpload({
  orgId, logoPath, uploading, onUpload,
}: { orgId: string; logoPath: string | null; uploading: boolean; onUpload: (orgId: string, file: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: signedUrl } = useQuery({
    queryKey: ["org-logo", orgId, logoPath],
    enabled: !!logoPath,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from("uploads").createSignedUrl(logoPath!, 60 * 60);
      if (error) throw error;
      return data.signedUrl;
    },
  });

  return (
    <div className="relative group shrink-0" onClick={(e) => e.stopPropagation()}>
      <OrgLogo orgId={orgId as OrgId} size={56} shape="rounded" src={signedUrl ?? null} />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        title="رفع شعار المؤسسة"
        aria-label="رفع شعار المؤسسة"
        className="absolute -bottom-1 -left-1 w-6 h-6 rounded-full bg-background border border-border flex items-center justify-center text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition"
      >
        {uploading ? <Loader2 size={12} className="animate-spin" /> : <ImageUp size={12} />}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUpload(orgId, f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
