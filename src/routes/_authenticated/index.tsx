import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Target, Handshake, Home, FileText, Radar as RadarIcon, Landmark, Wallet, Building, Rocket, Upload, Download, FileBarChart, LogOut, Shield, Building2, Languages } from "lucide-react";
import { useLang } from "@/lib/lang-context";
import type { Lang } from "@/lib/i18n";
import { TerminologySection } from "./sections/TerminologySection";
import { generateExecutiveReport } from "@/lib/oid-report-generator";
import { computeProfileFromLive, type InstitutionProfile } from "@/lib/oid-composite";
import { ORGS, type OrgId } from "@/lib/oid-data";
import { useDashboardSnapshotQuery } from "./sections/_shared";
import { NotificationsPanel } from "@/components/oid/NotificationsPanel";
import { InstitutionProfileDrawer } from "@/components/oid/InstitutionProfileDrawer";
import { useLiveTimeline } from "@/lib/timeline-live";
import { DashboardSection } from "./sections/DashboardSection";
import { KPIsSection } from "./sections/KPIsSection";
import { QuarterlySection } from "./sections/QuarterlySection";
import { GapsSection } from "./sections/GapsSection";
import { GovernanceSection } from "./sections/GovernanceSection";
import { FinancialSection } from "./sections/FinancialSection";
import { PartnershipsSection } from "./sections/PartnershipsSection";
import { ProfilesSection } from "./sections/ProfilesSection";
import { InitiativesSection } from "./sections/InitiativesSection";
import { UploadSection } from "./sections/UploadSection";
import { OfficeSection } from "./sections/OfficeSection";
import { useTaskRequest } from "@/lib/tasks-store";
import { useEffect } from "react";

export const Route = createFileRoute("/_authenticated/")({ component: Page });

type SectionId =
  | "dashboard" | "kpis" | "quarterly" | "gaps" | "governance"
  | "financial" | "partnerships" | "profiles" | "initiatives" | "office" | "upload" | "terminology";

type NavItem = { id: SectionId; label: string; icon: any; adminOnly?: boolean };

const buildNav = (t: (p: string) => string): { group: string; items: NavItem[] }[] => [
  { group: t("nav.groupLeadership"), items: [
    { id: "dashboard", label: t("nav.dashboard"), icon: Home },
    { id: "kpis", label: t("nav.kpis"), icon: Target },
    { id: "quarterly", label: t("nav.quarterly"), icon: FileText },
  ]},
  { group: t("nav.groupAssessment"), items: [
    { id: "gaps", label: t("nav.gaps"), icon: RadarIcon },
    { id: "governance", label: t("nav.governance"), icon: Landmark },
    { id: "financial", label: t("nav.financial"), icon: Wallet },
    { id: "partnerships", label: t("nav.partnerships"), icon: Handshake },
  ]},
  { group: t("nav.groupOrgs"), items: [
    { id: "profiles", label: t("nav.profiles"), icon: Building },
    { id: "initiatives", label: t("nav.initiatives"), icon: Rocket },
    { id: "office", label: t("nav.office"), icon: Building2 },
  ]},
  { group: t("nav.groupTools"), items: [
    { id: "upload", label: t("nav.upload"), icon: Upload },
    { id: "terminology", label: t("nav.terminology"), icon: Languages, adminOnly: true },
  ]},
];

function Page() {
  const [section, setSection] = useState<SectionId>("dashboard");
  const { dir } = useLang();
  useLiveTimeline();
  const { pending } = useTaskRequest();
  useEffect(() => { if (pending) setSection("office"); }, [pending]);
  return (
    <div className="min-h-screen bg-background flex flex-col" dir={dir}>
      <Header onNavigate={setSection} />
      <div className="flex flex-1">
        <Sidebar current={section} onChange={setSection} />
        <main className="flex-1 p-6 overflow-x-hidden">
          {section === "dashboard" && <DashboardSection />}
          {section === "kpis" && <KPIsSection />}
          {section === "quarterly" && <QuarterlySection />}
          {section === "gaps" && <GapsSection />}
          {section === "governance" && <GovernanceSection />}
          {section === "financial" && <FinancialSection />}
          {section === "partnerships" && <PartnershipsSection />}
          {section === "profiles" && <ProfilesSection />}
          {section === "initiatives" && <InitiativesSection />}
          {section === "office" && <OfficeSection />}
          {section === "upload" && <UploadSection />}
          {section === "terminology" && <TerminologySection />}
        </main>
      </div>
      <InstitutionProfileDrawer />
    </div>
  );
}

/* ========================= Language toggle ========================= */
function LanguageToggle() {
  const { lang, setLang } = useLang();
  return (
    <div className="flex items-center gap-1 p-0.5 rounded-lg bg-white/10 border border-white/20">
      {(["ar", "en"] as Lang[]).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className={`px-2.5 py-1 rounded-md text-xs transition ${
            lang === l ? "bg-white text-primary font-bold" : "text-white/70 hover:text-white"
          }`}
        >
          {l === "ar" ? "عربي" : "English"}
        </button>
      ))}
    </div>
  );
}

/* ============================== Header ============================== */
function Header({ onNavigate }: { onNavigate: (s: SectionId) => void }) {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  // بروفايلات حيّة من Supabase (نفس مصدر لوحة القيادة) لتقرير مطابق تماماً.
  const { data: snap } = useDashboardSnapshotQuery();
  const liveProfiles = useMemo(() => {
    const out = {} as Record<OrgId, InstitutionProfile>;
    for (const o of ORGS) {
      const m = snap?.matrix?.[o.id];
      const k = snap?.kpi?.[o.id];
      out[o.id] = computeProfileFromLive(o.id, {
        gapAvg: m?.gapAvg ?? null,
        govScore: m?.govScore ?? null,
        kpiScorePct: k?.weightedAvgPct ?? null,
        finScore: m?.finScore ?? null,
      });
    }
    return out;
  }, [snap]);
  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="header-grad text-white shadow-lg">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">{t("header.office")}</h1>
          <p className="text-lg text-white/80 font-serif mt-0.5">{t("header.officeEn")}</p>
        </div>
        <div className="flex items-center gap-3">
          <LanguageToggle />
          {isAdmin && (
            <Link to="/users" className="p-2 rounded-lg hover:bg-white/15 transition" title={t("header.users")}>
              <Shield size={18} />
            </Link>
          )}
          <span className="text-xs px-2 py-1 rounded-md bg-white/15 border border-white/20">v1.0 — 2026</span>
          <IconBtn icon={Download} label={t("header.exportPDF")} onClick={() => window.print()} />
          <button
            onClick={() => generateExecutiveReport("Q2", 2026, liveProfiles)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/15 hover:bg-white/25 text-white text-xs font-medium transition"
            title={t("header.execReport")}
          >
            <FileBarChart size={16} />
            <span>{t("header.execReport")}</span>
          </button>
          <NotificationsPanel onNavigate={onNavigate} />
          <button onClick={signOut} className="p-2 rounded-lg hover:bg-white/15 transition" title={t("header.signOut")}>
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </header>
  );
}
function IconBtn({ icon: Icon, label, badge, onClick }: any) {
  return (
    <button onClick={onClick} className="relative p-2 rounded-lg hover:bg-white/15 transition" title={label}>
      <Icon size={18} />
      {badge ? <span className="absolute -top-0.5 -left-0.5 text-[10px] bg-danger text-white rounded-full w-4 h-4 flex items-center justify-center font-bold">{badge}</span> : null}
    </button>
  );
}

/* ============================== Sidebar ============================== */
function Sidebar({ current, onChange }: { current: SectionId; onChange: (s: SectionId)=>void }) {
  const { t, isRTL } = useLang();
  const { isAdmin } = useAuth();
  const nav = buildNav(t);
  return (
    <aside className="w-[248px] shrink-0 text-white" style={{ background: "var(--sidebar-bg)" }}>
      <div className="p-4 space-y-5">
        {nav.map((g) => (
          <div key={g.group}>
            <div className="text-[11px] uppercase tracking-wider text-white/50 mb-2 px-2">{g.group}</div>
            <nav className="space-y-1">
              {g.items.filter((it) => !it.adminOnly || isAdmin).map((it) => {
                const active = current === it.id;
                return (
                  <button
                    key={it.id}
                    onClick={() => onChange(it.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition text-right ${
                      active ? "text-white font-medium" : "text-white/75 hover:bg-white/5"
                    }`}
                    style={ active ? { background: "var(--sidebar-active)", borderRight: "3px solid #a8d5b5" } : undefined }
                  >
                    <it.icon size={16} />
                    <span className="flex-1">{it.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        ))}
      </div>
    </aside>
  );
}
