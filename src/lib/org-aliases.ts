import { ENTITY_ALIASES } from "./org-registry";
export { ENTITY_ALIASES };

export function matchOrganizations(raw: unknown) {
  const text = String(raw ?? "").replace(/[\u064B-\u065F\u0670\u0640]/g, "").replace(/[_-]+/g, " ").trim();
  // A university mention must not be attributed to the foundation too.
  const foundationText = text.replace(/جامعة\s*زمزم[^\n،;]*/g, "").replace(/\bZamzam\s+University\b/gi, "");
  return ENTITY_ALIASES.filter((a) => a.patterns.some((re) => re.test(a.id === "ZF" ? foundationText : text)));
}

export function matchOrganization(raw: unknown) {
  return matchOrganizations(raw)[0] ?? null;
}