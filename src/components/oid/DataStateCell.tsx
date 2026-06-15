/**
 * عرض موحّد للقيم مع تمييز حالة البيانات (المحور 2).
 */
import { DATA_STATES, type DataStateCode } from "@/lib/oid-data-states";
import { formatNumber } from "@/lib/oid-formatting";

type Props = {
  value: number | null | undefined;
  state?: DataStateCode;
  decimals?: number;
  suffix?: string;
  prefix?: string;
  className?: string;
};

export function DataStateCell({ value, state, decimals = 2, suffix = "", prefix = "", className = "" }: Props) {
  const code: DataStateCode =
    state ??
    (value === null || value === undefined || Number.isNaN(value)
      ? "noData"
      : value === 0
      ? "zero"
      : "achieved");

  if (code === "achieved") {
    return (
      <span className={`tabular-nums ${className}`} dir="ltr" style={{ unicodeBidi: "isolate" }}>
        {formatNumber(value as number, { decimals, suffix, prefix })}
      </span>
    );
  }

  const meta = DATA_STATES[code];
  return (
    <span
      title={meta.tooltip}
      className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded ${className}`}
      style={{ color: meta.color, background: meta.bg }}
    >
      <span aria-hidden>{meta.icon}</span>
      <span>{meta.display}</span>
    </span>
  );
}

/** Legend ثابت يُعرض أسفل الجداول. */
export function DataStateLegend({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground ${className}`}>
      <span className="font-medium">مفتاح:</span>
      {(["zero", "noData", "na"] as const).map((k) => {
        const m = DATA_STATES[k];
        return (
          <span key={k} className="inline-flex items-center gap-1">
            <span
              className="inline-flex items-center justify-center w-4 h-4 rounded text-[10px]"
              style={{ color: m.color, background: m.bg }}
            >
              {m.icon}
            </span>
            {m.label}
          </span>
        );
      })}
    </div>
  );
}
