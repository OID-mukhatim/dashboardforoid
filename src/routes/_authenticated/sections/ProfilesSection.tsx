import { useMemo, useRef, useState } from "react";
import { ChevronRight, ImageUp, Loader2 } from "lucide-react";
import { ORGS, type OrgId } from "@/lib/oid-data";
import { OrgLogo } from "@/components/oid/OrgLogo";
import { openOrgProfile } from "@/lib/oid-drill";
import { loadInstitutionalProfiles } from "@/lib/dashboard.functions";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, SectionTitle, Row, useDashboardSnapshotQuery } from "./_shared";
import { useLang } from "@/lib/lang-context";
import { TranslatableText } from "@/components/oid/TranslatableText";
import { Button } from "@/components/ui/button";

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
  const { lang, t, tFormat } = useLang();
  const qc = useQueryClient();
  const { data: snap } = useDashboardSnapshotQuery();
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

  // 2) دمج: الهوية من ORGS (أسماء/ألوان) + كل الحقول من قاعدة البيانات والاستمارات المرفوعة
  const merged = useMemo(
    () =>
      ORGS.map((s) => {
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
      <SectionTitle title={t("profiles.title")} subtitle={t("profiles.subtitle")} />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {merged.map(o => {
          const db = o.db;
          const live = liveProfiles[o.id];
          const founded = db?.founded ?? pick(o.id, /تاريخ\s*التأسيس/);
          const license = db?.license_number ?? pick(o.id, /رقم\s*الترخيص/);
          const expiry = db?.license_expiry ?? pick(o.id, /تاريخ\s*الصلاحية/);
          const exec = db?.exec_name_ar ?? pick(o.id, /المدير\s*التنفيذي.*العرب/, /المدير\s*التنفيذي/);
          const email = db?.exec_email ?? pick(o.id, /الإيميل/, /email/i);
          const phone = db?.exec_phone ?? pick(o.id, /رقم\s*التواصل/, /phone/i);
          const site = extractUrl(db?.website ?? pick(o.id, /الموقع\s*الالكتروني|website/i));
          const address = db?.address ?? pick(o.id, /عنوان\s*المقر|address/i);
          const staffTotal = db?.staff_total ?? null;
          const budget = db?.budget ?? null;
          const gapScore = snap?.matrix?.[o.id as OrgId]?.gapAvg ?? null;
          const govScore = snap?.matrix?.[o.id as OrgId]?.govScore ?? null;
          return (
          <Card key={o.id} className="p-5 hover:shadow-md hover:border-primary/40 transition">
            <div onClick={() => openOrgProfile(o.id as OrgId)} role="button" tabIndex={0} className="cursor-pointer"
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && openOrgProfile(o.id as OrgId)}>
            <div className="flex items-start gap-3 mb-4">
              <LogoWithUpload orgId={o.id} logoPath={db?.logo_url ?? null} uploading={uploading === o.id} onUpload={handleLogoUpload} />
              <div className="flex-1 min-w-0">
                <div className="font-bold leading-tight">{lang === "ar" ? (db?.name_ar ?? o.nameAr) : (db?.name_en ?? o.nameEn)}</div>
                <div className="text-xs text-muted-foreground font-serif">{lang === "ar" ? (db?.name_en ?? o.nameEn) : (db?.name_ar ?? o.nameAr)}</div>
              </div>
              {(db || live) && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0" title={db ? t("profiles.fromDatabase") : tFormat("profiles.uploadedFile", { count: live?.fieldCount ?? 0, file: live?.fileName ?? t("profiles.uploadedFallback") })}>
                  {t("profiles.updated")}
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground mb-3"><TranslatableText text={db?.sector ?? null} /></div>
            <dl className="space-y-1.5 text-xs">
              <Row k={t("profiles.founded")} v={<TranslatableText text={founded} />} />
              <Row k={t("profiles.license")} v={<TranslatableText text={license} />} />
              <Row k={t("profiles.expiry")} v={<TranslatableText text={expiry} />} />
              <Row k={t("profiles.executive")} v={<TranslatableText text={exec} />} />
              {phone && <Row k={t("profiles.phone")} v={phone} />}
              {email && <Row k={t("profiles.email")} v={<span dir="ltr" className="break-all">{email}</span>} />}
              {site && <Row k={t("profiles.website")} v={<a href={String(site).startsWith("http") ? String(site) : `https://${site}`} target="_blank" rel="noreferrer" dir="ltr" className="text-primary break-all">{site}</a>} />}
              {address && <Row k={t("profiles.address")} v={<TranslatableText text={String(address)} />} />}
              <Row k={t("profiles.staff")} v={staffTotal ? `${staffTotal}` : null} />
              <Row k={t("profiles.budget")} v={budget ? `$${Number(budget).toLocaleString()}` : null} />
            </dl>
            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border">
              <span className="text-xs">{t("profiles.performance")}</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: `${o.color}15`, color: o.color }}>
                {gapScore !== null ? gapScore.toFixed(2) : "—"}
              </span>
              <span className="text-xs ml-1">{t("profiles.governance")}</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-muted">{govScore !== null ? `${govScore.toFixed(2)}` : "—"}</span>
              {live && <span className="text-[10px] text-muted-foreground ml-auto">{tFormat("profiles.uploadedFields", { count: live.fieldCount })}</span>}
            </div>
            </div>
            <Button variant="outline" onClick={() => openOrgProfile(o.id as OrgId)} className="mt-4 w-full text-xs text-primary">{t("profiles.detailedReport")} <ChevronRight size={14} className={lang === "ar" ? "rotate-180" : ""} /></Button>
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
  const { t } = useLang();
  const { data: signedUrl } = useQuery({
    queryKey: ["org-logo", orgId, logoPath],
    enabled: !!logoPath,
    queryFn: async () => {
      if (!logoPath) return null;
      const { data, error } = await supabase.storage.from("uploads").createSignedUrl(logoPath, 60 * 60);
      if (error) throw error;
      return data.signedUrl;
    },
  });

  return (
    <div className="relative group shrink-0" onClick={(e) => e.stopPropagation()}>
      <OrgLogo orgId={orgId as OrgId} size={56} shape="rounded" src={signedUrl ?? null} />
      <Button
        variant="outline"
        size="icon"
        type="button"
        onClick={() => inputRef.current?.click()}
        title={t("profiles.uploadLogo")}
        aria-label={t("profiles.uploadLogo")}
        className="absolute -bottom-1 -left-1 w-6 h-6 rounded-full text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition"
      >
        {uploading ? <Loader2 size={12} className="animate-spin" /> : <ImageUp size={12} />}
      </Button>
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

function extractUrl(raw: any): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  const m = s.match(/https?:\/\/[^\s،,؛;)]+/i) || s.match(/www\.[^\s،,؛;)]+/i) || s.match(/[\w.-]+\.[a-z]{2,}(\/\S*)?/i);
  return m ? m[0] : null;
}
