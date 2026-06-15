/**
 * المحور الخامس: اتساق الأرقام
 * تنسيق موحّد للأرقام بالأرقام الغربية (1,2,3) فقط.
 */

export type FormatOpts = {
  decimals?: number;
  suffix?: string;
  prefix?: string;
};

export function formatNumber(value: number | null | undefined, opts: FormatOpts = {}): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const { decimals = 2, suffix = "", prefix = "" } = opts;
  return `${prefix}${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: true,
  }).format(value)}${suffix}`;
}

export function formatScore(v: number | null | undefined): string {
  return formatNumber(v, { decimals: 2 });
}

export function formatPct(v: number | null | undefined, decimals = 0): string {
  return formatNumber(v, { decimals, suffix: "%" });
}

export function formatBudget(n: number | null | undefined): string {
  if (!n) return "—";
  if (n >= 1_000_000) return `$${formatNumber(n / 1_000_000, { decimals: 1 })}M`;
  if (n >= 1_000) return `$${formatNumber(n / 1_000, { decimals: 0 })}K`;
  return `$${formatNumber(n, { decimals: 0 })}`;
}

export function formatCount(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return formatNumber(n, { decimals: 0 });
}
