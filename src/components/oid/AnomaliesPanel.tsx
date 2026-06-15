/**
 * لوحة الشذوذات والتناقضات (المحور 4).
 */
import { useMemo, useState } from "react";
import { AlertTriangle, AlertCircle, Info, ShieldAlert, Filter, ExternalLink } from "lucide-react";
import { ORGS, orgName, type OrgId } from "@/lib/oid-data";
import {
  detectAllAnomalies,
  getCategoryLabel,
  getSeverityMeta,
  type AnomalySeverity,
} from "@/lib/oid-anomalies";
import { openOrgProfile } from "@/lib/oid-drill";

const SEVERITY_ICON: Record<AnomalySeverity, React.ComponentType<{ size?: number }>> = {
  high: ShieldAlert,
  medium: AlertTriangle,
  low: Info,
};

export function AnomaliesPanel({ orgFilter = "all" as "all" | OrgId }: { orgFilter?: "all" | OrgId }) {
  const [sevFilter, setSevFilter] = useState<"all" | AnomalySeverity>("all");

  const anomalies = useMemo(() => {
    const all = detectAllAnomalies();
    return all.filter(
      (a) =>
        (orgFilter === "all" || a.orgId === orgFilter) &&
        (sevFilter === "all" || a.severity === sevFilter),
    );
  }, [orgFilter, sevFilter]);

  const counts = useMemo(() => {
    const all = detectAllAnomalies().filter((a) => orgFilter === "all" || a.orgId === orgFilter);
    return {
      high: all.filter((a) => a.severity === "high").length,
      medium: all.filter((a) => a.severity === "medium").length,
      low: all.filter((a) => a.severity === "low").length,
      total: all.length,
    };
  }, [orgFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Filter size={13} /> تصفية:
        </div>
        {(["all", "high", "medium", "low"] as const).map((s) => {
          const active = sevFilter === s;
          const label =
            s === "all"
              ? `الكل (${counts.total})`
              : `${getSeverityMeta(s).label} (${counts[s]})`;
          const meta = s === "all" ? null : getSeverityMeta(s);
          return (
            <button
              key={s}
              type="button"
              onClick={() => setSevFilter(s)}
              className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                active ? "border-transparent font-semibold" : "border-border bg-white hover:bg-slate-50"
              }`}
              style={
                active
                  ? meta
                    ? { background: meta.bg, color: meta.color }
                    : { background: "#0f172a", color: "white" }
                  : undefined
              }
            >
              {label}
            </button>
          );
        })}
      </div>

      {anomalies.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-4">
          <AlertCircle size={16} />
          لا توجد شذوذات ضمن المرشّحات الحالية.
        </div>
      ) : (
        <ul className="space-y-2">
          {anomalies.map((a) => {
            const meta = getSeverityMeta(a.severity);
            const org = ORGS.find((o) => o.id === a.orgId);
            const Icon = SEVERITY_ICON[a.severity];
            return (
              <li
                key={a.id}
                className="bg-card border border-border rounded-lg p-3 flex gap-3"
                style={{ borderInlineStartWidth: 4, borderInlineStartColor: meta.color }}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: meta.bg, color: meta.color }}
                >
                  <Icon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-semibold text-sm">{a.title}</span>
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                      style={{ background: meta.bg, color: meta.color }}
                    >
                      {meta.label}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                      {getCategoryLabel(a.category)}
                    </span>
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                      style={{ background: (org?.color ?? "#64748b") + "22", color: org?.color ?? "#64748b" }}
                    >
                      {orgName(a.orgId)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{a.message}</p>
                  <p className="text-xs mt-1.5 text-slate-700">
                    <span className="font-medium">↳ مقترح:</span> {a.suggestion}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
