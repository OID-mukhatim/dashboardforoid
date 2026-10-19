export type GapRow = { org_id: string; domain_index: number; domain_name: string; score: number | string; period: string; updated_at: string };

/** Pick one latest assessment period per institution, then deduplicate its axes. */
export function latestGapRows(rows: GapRow[]): GapRow[] {
  const sorted = [...rows].sort((a, b) => b.updated_at.localeCompare(a.updated_at) || b.period.localeCompare(a.period));
  const periods = new Map<string, string>();
  const seen = new Set<string>();
  return sorted.filter((r) => {
    if (!periods.has(r.org_id)) periods.set(r.org_id, r.period);
    const key = `${r.org_id}-${r.domain_index}`;
    if (periods.get(r.org_id) !== r.period || seen.has(key) || !Number.isFinite(Number(r.score))) return false;
    seen.add(key);
    return true;
  });
}

export function gapInitiativeCandidates(rows: GapRow[]) {
  const latest = latestGapRows(rows);
  const domains = new Map<number, GapRow[]>();
  for (const r of latest) domains.set(r.domain_index, [...(domains.get(r.domain_index) ?? []), r]);
  const candidates: { code: string; title: string; objective: string; gap: string; priority: string; status: string; domain: string; orgs: string[]; source: string }[] = [];
  for (const [index, group] of domains) {
    const name = group[0]?.domain_name ?? String(index);
    const add = (suffix: string, value: number, orgs: string[]) => candidates.push({
      code: `AUTO-${index}-${suffix}`, title: `معالجة فجوة: ${name}`,
      objective: `رفع المجال من ${Number(value.toFixed(2))} إلى 3.5+`,
      gap: `${name} — ${Number(value.toFixed(2))}/5`, priority: suffix === "NET" ? "عالٍ" : "حرج",
      status: "مقترح", domain: name, orgs, source: "auto",
    });
    const avg = group.reduce((sum, r) => sum + Number(r.score), 0) / group.length;
    if (avg < 2.5) add("NET", avg, group.filter((r) => Number(r.score) < 2.5).map((r) => r.org_id).sort());
    for (const r of group) if (Number(r.score) < 1.5) add(r.org_id, Number(r.score), [r.org_id]);
  }
  return candidates;
}

/** Existing codes are never overwritten, including approved proposals. */
export function newGapInitiatives(rows: GapRow[], existing: { code: string | null; status: string }[]) {
  const codes = new Set(existing.map((r) => r.code));
  return gapInitiativeCandidates(rows).filter((r) => !codes.has(r.code));
}