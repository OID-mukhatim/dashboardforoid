import { ORG_FISCAL_YEAR, type OrgId } from "@/lib/oid-data";

/**
 * منتقي سنة الخطة لمؤسسة واحدة.
 * السنة الدراسية تُعرض كمدى (2026–2027) لأن الربع الأول يبدأ في أكتوبر.
 */
export function YearSelector({
  orgId,
  activeYear,
  availableYears,
  onYearChange,
}: {
  orgId: string;
  activeYear?: number;
  availableYears: number[];
  onYearChange: (year: number) => void;
}) {
  const fiscalType = ORG_FISCAL_YEAR[orgId as OrgId] ?? "calendar";
  const label = (y: number) => (fiscalType === "academic" ? `${y}–${y + 1}` : String(y));
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground">السنة:</span>
      {availableYears.map((year) => (
        <button
          key={year}
          type="button"
          onClick={() => onYearChange(year)}
          className={`px-2.5 py-1 rounded-full border font-medium transition-colors ${
            activeYear === year
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-muted text-muted-foreground border-border hover:bg-accent"
          }`}
        >
          {label(year)}
        </button>
      ))}
      <span
        className={`px-2 py-0.5 rounded-full ${
          fiscalType === "academic" ? "bg-blue-50 text-blue-600" : "bg-green-50 text-green-600"
        }`}
      >
        {fiscalType === "academic" ? "📚 دراسي" : "📅 ميلادي"}
      </span>
    </div>
  );
}
