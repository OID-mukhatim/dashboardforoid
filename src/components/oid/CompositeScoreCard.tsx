/**
 * بطاقة الدرجة المركّبة (المحور 1) — تعرض 4 مكوّنات + الدرجة الكلية.
 */
import { ORGS, type OrgId } from "@/lib/oid-data";
import { ORG_LOGOS } from "@/lib/oid-logos";
import { computeProfile } from "@/lib/oid-composite";
import { DATA_STATES } from "@/lib/oid-data-states";
import { formatScore, formatPct } from "@/lib/oid-formatting";
import { openOrgProfile } from "@/lib/oid-drill";
import { AlertTriangle } from "lucide-react";

export function CompositeScoreCard({ orgId }: { orgId: OrgId }) {
  const org = ORGS.find((o) => o.id === orgId)!;
  const p = computeProfile(orgId);
  const logo = ORG_LOGOS[orgId];

  return (
    <button
      type="button"
      onClick={() => openOrgProfile(orgId)}
      className="text-right bg-card rounded-xl border border-border shadow-sm p-4 space-y-3 hover:shadow-md hover:border-primary/40 transition cursor-pointer w-full"
      title="افتح الملف التفصيلي"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-12 h-12 rounded-lg bg-white border border-border flex items-center justify-center overflow-hidden shrink-0"
            style={{ borderColor: org.color + "40" }}
          >
            <img src={logo} alt={org.nameAr} className="max-w-full max-h-full object-contain" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-sm truncate">{org.nameAr}</div>
            <div className="text-[11px] text-muted-foreground truncate" dir="ltr">{org.nameEn}</div>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10px] text-muted-foreground">الأداء الكلي</div>
          <div className="text-2xl font-bold tabular-nums" dir="ltr" style={{ color: p.maturityColor ?? org.color }}>
            {p.compositeScore !== null ? formatScore(p.compositeScore) : "—"}
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        {p.components.map((c) => {
          const filled = c.score !== null ? (c.score / 5) * 100 : 0;
          const meta = c.state !== "achieved" ? DATA_STATES[c.state] : null;
          return (
            <div key={c.source} className="flex items-center gap-2 text-xs">
              <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${filled}%`, background: org.color }}
                />
              </div>
              <span className="w-32 truncate text-muted-foreground">{c.label}</span>
              <span className="w-14 text-left tabular-nums font-medium" dir="ltr">
                {c.score !== null ? formatScore(c.score) : (
                  <span style={{ color: meta?.color }} title={meta?.tooltip}>
                    {meta?.icon} {meta?.display}
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-border">
        <div className="text-[11px]">
          <span className="text-muted-foreground">اكتمال البيانات:</span>{" "}
          <span className="font-bold tabular-nums" dir="ltr">{formatPct(p.dataCompleteness * 100)}</span>
        </div>
        {p.maturityLabel && (
          <span
            className="text-[11px] px-2 py-0.5 rounded-full font-medium"
            style={{ color: p.maturityColor!, background: p.maturityColor! + "20" }}
          >
            {p.maturityLabel}
          </span>
        )}
      </div>

      {p.dataCompleteness < 0.5 && p.compositeScore !== null && (
        <div className="flex items-start gap-1.5 text-[11px] p-2 rounded bg-amber-50 text-amber-800 border border-amber-200">
          <AlertTriangle size={13} className="shrink-0 mt-0.5" />
          <span>درجة غير مكتملة — محسوبة من {p.components.filter(c=>c.state==="achieved").length} مصادر فقط من أصل 4</span>
        </div>
      )}
    </button>
  );
}
