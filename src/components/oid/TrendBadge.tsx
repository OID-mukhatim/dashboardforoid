/**
 * شارة الاتجاه الزمني (المحور 3).
 */
import { ArrowUpRight, ArrowDownRight, Minus, Clock } from "lucide-react";
import { formatScore } from "@/lib/oid-formatting";
import type { TrendResult } from "@/lib/oid-timeline";

export function TrendBadge({ trend, label }: { trend: TrendResult; label?: string }) {
  if (trend.direction === "noData") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
        <Clock size={11} />
        {label ?? "لا يوجد تاريخ"}
      </span>
    );
  }
  const meta =
    trend.direction === "up"
      ? { Icon: ArrowUpRight, color: "#15803d", bg: "#dcfce7" }
      : trend.direction === "down"
      ? { Icon: ArrowDownRight, color: "#b91c1c", bg: "#fee2e2" }
      : { Icon: Minus, color: "#475569", bg: "#f1f5f9" };
  const Icon = meta.Icon;
  const sign = trend.delta !== null && trend.delta > 0 ? "+" : "";
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium tabular-nums"
      style={{ color: meta.color, background: meta.bg }}
      dir="ltr"
    >
      <Icon size={11} />
      {trend.delta !== null ? `${sign}${formatScore(trend.delta)}` : "—"}
      {trend.previous && <span className="opacity-60"> · vs {trend.previous.period}</span>}
    </span>
  );
}
