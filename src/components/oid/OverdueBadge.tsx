/**
 * شارة "متأخر" — تُعرض بجانب أي بند تجاوز موعده المخطط.
 */
import { AlertTriangle } from "lucide-react";
import { detectDeadline } from "@/lib/oid-overdue";

export function OverdueBadge({ text, className = "" }: { text: string; className?: string }) {
  const info = detectDeadline(text);
  if (!info.overdue) return null;
  const label = info.monthsLate >= 1
    ? `متأخر ${info.monthsLate} شهر عن ${info.targetLabel}`
    : `تجاوز الموعد (${info.targetLabel})`;
  return (
    <span
      title={label}
      className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 font-medium align-middle mx-1 ${className}`}
    >
      <AlertTriangle size={10} />
      {label}
    </span>
  );
}
