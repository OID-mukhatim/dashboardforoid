import { useMemo, useState, useEffect, useCallback } from "react";
import { Bell, XCircle, AlertTriangle, Info, CheckCheck } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { OrgId } from "@/lib/oid-data";
import { useLiveAlerts } from "@/lib/use-live-alerts";
import { useLang } from "@/lib/lang-context";
import { Button } from "@/components/ui/button";

export type SectionId =
  | "dashboard" | "kpis" | "reports" | "activities" | "gaps" | "governance"
  | "financial" | "partnerships" | "profiles" | "initiatives" | "upload";

export type NotificationSource =
  | "license_expiry"
  | "anomaly"
  | "upload_success"
;

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

/** Shared live rules; read state remains local. */
export function useAutoNotifications(): Notification[] {
  const { data: alerts = [] } = useLiveAlerts();
  const { t } = useLang();
  return useMemo(() => alerts.map((alert) => ({
    id: alert.id, type: alert.section === "profiles" ? "license_expiry" as const : "anomaly" as const,
    severity: alert.severity, title: alert.title, message: alert.message, orgId: alert.org_id as OrgId,
    createdAt: new Date(), read: false, action: { label: t("notifications.view"), sectionId: alert.section },
  })), [alerts, t]);
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
  critical: { bg: "bg-danger/5", border: "border-danger/20", text: "text-danger", Ic: XCircle, label: "حرج" },
  warning: { bg: "bg-warning/5", border: "border-warning/20", text: "text-warning", Ic: AlertTriangle, label: "تحذير" },
  info: { bg: "bg-info/5", border: "border-info/20", text: "text-info", Ic: Info, label: "معلومة" },
} as const;

export function NotificationsPanel({ onNavigate }: { onNavigate?: (s: SectionId) => void }) {
  const notifications = useAutoNotifications();
  const { lang, t, tFormat } = useLang();
  const { isError, isPending } = useLiveAlerts();
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
        <Button variant="ghost" size="icon" className="relative p-2 rounded-lg hover:bg-primary-foreground/15 transition" title={t("notifications.title")} aria-label={t("notifications.title")}>
          <Bell size={18} />
          {unread.length ? (
            <span
              className={`absolute -top-0.5 -left-0.5 text-[10px] ${criticalUnread ? "bg-danger" : "bg-warning"} text-primary-foreground rounded-full min-w-4 h-4 px-1 flex items-center justify-center font-bold`}
            >
              {unread.length}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0 max-h-[70vh] overflow-auto" dir={lang === "ar" ? "rtl" : "ltr"}>
        <div className="p-3 border-b bg-muted/40 flex items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold">{t("notifications.title")}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {tFormat("notifications.summary", { total: items.length, unread: unread.length, critical: criticalUnread })}
            </div>
          </div>
        </div>
        <div className="p-2 space-y-2">
          {items.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">{isError ? t("notifications.loadError") : isPending ? t("dashboard.loading") : t("dashboard.noAlerts")}</div>
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
                      <Button
                        variant="ghost" className="h-auto p-0 text-[11px] font-medium text-primary hover:underline"
                        onClick={() => { markRead(n.id); onNavigate(n.action?.sectionId ?? "dashboard"); setOpen(false); }}
                      >
                        {n.action.label} ←
                      </Button>
                    )}
                    {!n.read && (
                      <Button variant="ghost" className="h-auto p-0 text-[11px] text-muted-foreground hover:underline" onClick={() => markRead(n.id)}>
                        {t("notifications.markRead")}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {unread.length > 0 && (
          <div className="p-3 border-t bg-muted/40 sticky bottom-0">
            <Button
              onClick={markAllRead}
              variant="ghost" className="h-auto w-full flex items-center justify-center gap-1.5 text-xs font-medium text-primary hover:underline transition"
            >
              <CheckCheck size={14} /> {t("notifications.markAllRead")}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
