import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Target, Handshake, Home, FileText, Radar as RadarIcon, Landmark, Wallet, Building, Rocket, Upload, Bell, Download, AlertTriangle, CheckCircle2, XCircle, LogOut, Shield } from "lucide-react";
import { alerts } from "@/lib/oid-data";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

export const Route = createFileRoute("/_authenticated/")({ component: Page });

type SectionId =
  | "dashboard" | "kpis" | "quarterly" | "gaps" | "governance"
  | "financial" | "partnerships" | "profiles" | "initiatives" | "upload";

const NAV: { group: string; items: { id: SectionId; label: string; icon: any }[] }[] = [
  { group: "القيادة", items: [
    { id: "dashboard", label: "لوحة القيادة الرئيسية", icon: Home },
    { id: "kpis", label: "مؤشرات الأداء KPIs", icon: Target },
    { id: "quarterly", label: "التقارير الربعية", icon: FileText },
  ]},
  { group: "التقييم", items: [
    { id: "gaps", label: "تحليل الفجوات المؤسسية", icon: RadarIcon },
    { id: "governance", label: "الحوكمة والامتثال", icon: Landmark },
    { id: "financial", label: "المستشار المالي", icon: Wallet },
    { id: "partnerships", label: "الشراكات الاستراتيجية", icon: Handshake },
  ]},
  { group: "المؤسسات", items: [
    { id: "profiles", label: "البيانات المؤسسية", icon: Building },
    { id: "initiatives", label: "المبادرات التطويرية", icon: Rocket },
  ]},
  { group: "الأدوات", items: [
    { id: "upload", label: "رفع البيانات وتحديثها", icon: Upload },
  ]},
];

function Page() {
  const [section, setSection] = useState<SectionId>("dashboard");
  useLiveTimeline();
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
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
          {section === "upload" && <UploadSection />}
        </main>
      </div>
      <InstitutionProfileDrawer />
    </div>
  );
}

/* ============================== Header ============================== */
function Header() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="header-grad text-white shadow-lg">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">مكتب الإشراف والتطوير المؤسسي</h1>
          <p className="text-lg text-white/80 font-serif mt-0.5">Oversight & Institutional Development — OID</p>
        </div>
        <div className="flex items-center gap-3">

          {isAdmin && (
            <Link to="/users" className="p-2 rounded-lg hover:bg-white/15 transition" title="إدارة المستخدمين">
              <Shield size={18} />
            </Link>
          )}
          <span className="text-xs px-2 py-1 rounded-md bg-white/15 border border-white/20">v1.0 — 2026</span>
          <IconBtn icon={Download} label="تصدير PDF" onClick={() => window.print()} />
          <NotificationsBell alerts={alerts} />
          <button onClick={signOut} className="p-2 rounded-lg hover:bg-white/15 transition" title="خروج">
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

function NotificationsBell({ alerts }: { alerts: Array<{ level: string; title: string; action: string }> }) {
  const dangerCount = alerts.filter(a => a.level === "danger").length;
  const styleFor = (level: string) => ({
    danger: { bg: "bg-red-50", border: "border-red-200", text: "text-red-700", Ic: XCircle },
    warning: { bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-700", Ic: AlertTriangle },
    success: { bg: "bg-green-50", border: "border-green-200", text: "text-green-700", Ic: CheckCircle2 },
  }[level] as { bg: string; border: string; text: string; Ic: any });
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative p-2 rounded-lg hover:bg-white/15 transition"
          title="تنبيهات"
          aria-label="تنبيهات"
        >
          <Bell size={18} />
          {dangerCount ? (
            <span className="absolute -top-0.5 -left-0.5 text-[10px] bg-danger text-white rounded-full w-4 h-4 flex items-center justify-center font-bold">
              {dangerCount}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0 max-h-[70vh] overflow-auto" dir="rtl">
        <div className="p-3 border-b bg-muted/40">
          <div className="text-sm font-semibold">التنبيهات</div>
          <div className="text-xs text-muted-foreground mt-0.5">{alerts.length} تنبيه — {dangerCount} حرج</div>
        </div>
        <div className="p-2 space-y-2">
          {alerts.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">لا توجد تنبيهات حالياً</div>
          ) : alerts.map((a, i) => {
            const s = styleFor(a.level);
            const Ic = s.Ic;
            return (
              <div key={i} className={`flex items-start gap-2 p-2 rounded-md border ${s.bg} ${s.border}`}>
                <Ic size={16} className={s.text} />
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium ${s.text}`}>{a.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{a.action}</div>
                </div>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}


/* ============================== Sidebar ============================== */
function Sidebar({ current, onChange }: { current: SectionId; onChange: (s: SectionId)=>void }) {
  return (
    <aside className="w-[248px] shrink-0 text-white" style={{ background: "var(--sidebar-bg)" }}>
      <div className="p-4 space-y-5">
        {NAV.map((g) => (
          <div key={g.group}>
            <div className="text-[11px] uppercase tracking-wider text-white/50 mb-2 px-2">{g.group}</div>
            <nav className="space-y-1">
              {g.items.map((it) => {
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
