import { useMemo, useState, useEffect, useCallback } from "react";
import { Bell, XCircle, AlertTriangle, Info, CheckCheck } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { institutions, kpiData, alerts as staticAlerts, type OrgId } from "@/lib/oid-data";
import { detectAllAnomalies } from "@/lib/oid-anomalies";

export type SectionId =
  | "dashboard" | "kpis" | "quarterly" | "gaps" | "governance"
  | "financial" | "partnerships" | "profiles" | "initiatives" | "upload";

export type NotificationSource =
  | "license_expiry"
  | "anomaly"
  | "upload_success"
  | "kpi_below_target"
  | "quarterly_due";

export type Notification = {
  id: string;
  type: NotificationSource;
  severity: "critical" | "warning" | "info";
  title: string;
  message: string;
  orgId?: OrgId;
  createdAt: Date;
  read: boolean;
  action?: { label: string; sectionId: SectionId };
};

/** يقبل التنسيقات: dd/mm/yyyy أو yyyy-mm-dd */
function parseDate(v: string): Date | null {
  const s = v.trim();
  let m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** توليد التنبيهات تلقائياً من البيانات الموجودة */
export function useAutoNotifications(): Notification[] {
  return useMemo(() => {
    const notifs: Notification[] = [];
    const now = new Date();

    // 1) التراخيص المنتهية أو التي تقترب من الانتهاء
    for (const inst of institutions) {
      if (!inst.licenseExpiry) continue;
      const expiry = parseDate(inst.licenseExpiry);
      if (!expiry) continue;
      const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / 86400000);
      if (daysLeft < 0) {
        notifs.push({
          id: `license-expired-${inst.id}`,
          type: "license_expiry",
          severity: "critical",
          title: `ترخيص ${inst.nameAr} منتهٍ`,
          message: `انتهى ترخيص ${inst.nameAr} منذ ${Math.abs(daysLeft)} يوم — يحتاج تجديداً فورياً`,
          orgId: inst.id as OrgId,
          createdAt: now,
          read: false,
          action: { label: "عرض البيانات المؤسسية", sectionId: "profiles" },
        });
      } else if (daysLeft <= 60) {
        notifs.push({
          id: `license-expiring-${inst.id}`,
          type: "license_expiry",
          severity: "warning",
          title: `ترخيص ${inst.nameAr} ينتهي قريباً`,
          message: `يتبقى ${daysLeft} يوم على انتهاء ترخيص ${inst.nameAr}`,
          orgId: inst.id as OrgId,
          createdAt: now,
          read: false,
          action: { label: "عرض البيانات المؤسسية", sectionId: "profiles" },
        });
      }
    }

    // 2) الشذوذات عالية الخطورة
    for (const anomaly of detectAllAnomalies().filter((a) => a.severity === "high")) {
      notifs.push({
        id: `anomaly-${anomaly.id}`,
        type: "anomaly",
        severity: "warning",
        title: anomaly.title,
        message: anomaly.message,
        orgId: anomaly.orgId,
        createdAt: now,
        read: false,
        action: { label: "عرض التفاصيل", sectionId: "dashboard" },
      });
    }

    // 3) مؤشرات تحت 30% من المستهدف
    for (const kpi of kpiData) {
      if (typeof kpi.progress !== "number" || kpi.progress >= 30) continue;
      notifs.push({
        id: `kpi-low-${kpi.code}`,
        type: "kpi_below_target",
        severity: "warning",
        title: `مؤشر متأخر: ${kpi.code}`,
        message: `${kpi.kpi} — ${kpi.progress}% فقط من المستهدف`,
        orgId: kpi.org as OrgId,
        createdAt: now,
        read: false,
        action: { label: "عرض المؤشرات", sectionId: "kpis" },
      });
    }

    // 4) تنبيهات عامة قائمة
    staticAlerts.forEach((a, i) => {
      notifs.push({
        id: `alert-${i}`,
        type: "quarterly_due",
        severity: a.level === "danger" ? "critical" : a.level === "warning" ? "warning" : "info",
        title: a.title,
        message: a.action,
        createdAt: now,
        read: false,
      });
    });

    const order = { critical: 0, warning: 1, info: 2 } as const;
    return notifs.sort((a, b) => order[a.severity] - order[b.severity]);
  }, []);
}

const STORAGE_KEY = "oid.notifications.read";

function useReadState() {
  const [read, setRead] = useState<string[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setRead(JSON.parse(raw) as string[]);
    } catch { /* ignore */ }
  }, []);
  const persist = useCallback((ids: string[]) => {
    setRead(ids);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(ids)); } catch { /* ignore */ }
  }, []);
  return { read, persist };
}

const STYLES = {
  critical: { bg: "bg-red-50", border: "border-red-200", text: "text-red-700", Ic: XCircle, label: "حرج" },
  warning: { bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-700", Ic: AlertTriangle, label: "تحذير" },
  info: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", Ic: Info, label: "معلومة" },
} as const;

export function NotificationsPanel({ onNavigate }: { onNavigate?: (s: SectionId) => void }) {
  const notifications = useAutoNotifications();
  const { read, persist } = useReadState();
  const [open, setOpen] = useState(false);

  const items = notifications.map((n) => ({ ...n, read: read.includes(n.id) }));
  const unread = items.filter((n) => !n.read);
  const criticalUnread = unread.filter((n) => n.severity === "critical").length;

  const markRead = (id: string) => { if (!read.includes(id)) persist([...read, id]); };
  const markAllRead = () => persist(items.map((n) => n.id));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="relative p-2 rounded-lg hover:bg-white/15 transition" title="تنبيهات" aria-label="تنبيهات">
          <Bell size={18} />
          {unread.length ? (
            <span
              className={`absolute -top-0.5 -left-0.5 text-[10px] ${criticalUnread ? "bg-danger" : "bg-orange-500"} text-white rounded-full min-w-4 h-4 px-1 flex items-center justify-center font-bold`}
            >
              {unread.length}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0 max-h-[70vh] overflow-auto" dir="rtl">
        <div className="p-3 border-b bg-muted/40 flex items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold">التنبيهات</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {items.length} تنبيه — {unread.length} غير مقروء — {criticalUnread} حرج
            </div>
          </div>
        </div>
        <div className="p-2 space-y-2">
          {items.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">لا توجد تنبيهات حالياً</div>
          ) : items.map((n) => {
            const s = STYLES[n.severity];
            const Ic = s.Ic;
            return (
              <div
                key={n.id}
                className={`flex items-start gap-2 p-2 rounded-md border ${s.bg} ${s.border} ${n.read ? "opacity-55" : ""}`}
              >
                <Ic size={16} className={`${s.text} mt-0.5 shrink-0`} />
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium ${s.text}`}>{n.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 break-words">{n.message}</div>
                  <div className="flex items-center gap-3 mt-1.5">
                    {n.action && onNavigate && (
                      <button
                        className="text-[11px] font-medium text-primary hover:underline"
                        onClick={() => { markRead(n.id); onNavigate(n.action!.sectionId); setOpen(false); }}
                      >
                        {n.action.label} ←
                      </button>
                    )}
                    {!n.read && (
                      <button className="text-[11px] text-muted-foreground hover:underline" onClick={() => markRead(n.id)}>
                        تعليم كمقروء
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
