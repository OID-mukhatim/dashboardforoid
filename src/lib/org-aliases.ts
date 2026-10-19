import type { OrgId } from "./oid-data";

export const ENTITY_ALIASES: { id: OrgId; name: string; patterns: RegExp[] }[] = [
  { id: "ZUST", name: "جامعة زمزم للعلوم والتكنولوجيا", patterns: [/جامعة\s*زمزم/, /\bZamzam\s+University\b/i, /\bZUST\b/i] },
  { id: "ZF", name: "مؤسسة زمزم", patterns: [/(?:مؤسسة|شركة)\s*زمزم/, /زمزم\s*للتنمية/, /\bZamzam\s+Foundation\b/i, /\bZF\b/i, /^زمزم$/] },
  { id: "ZAD", name: "زاد للتنمية", patterns: [/(?:مؤسسة|شركة)\s*زاد/, /زاد\s*للتنمية/, /\bZad\s+for\s+Development\b/i, /\bZAD\b/i] },
  { id: "TAYO", name: "تيو للتعليم", patterns: [/(?:مؤسسة|شركة|مدارس)\s*تيو/, /تيو\s*للتعليم/, /تيو\s*للتنمية/, /\bTayo\s+for\s+Education\b/i, /\bTAYO\b/i] },
  { id: "KAFI", name: "كافي للتنمية", patterns: [/(?:مؤسسة|شركة)\s*كافي/, /كافي\s*للتنمية/, /\bKafi\s+for\s+Development\b/i, /\bKAFI\b/i] },
  { id: "HAMDI", name: "منظمة حمدي للتنمية", patterns: [/(?:منظمة|مؤسسة|شركة)\s*حمد[يى]/, /حمد[يى]\s*لل(?:رعاية|تنمية)/, /\bHamdi\s+Organization\b/i, /\bHAMDI\b/i] },
];

export function matchOrganizations(raw: unknown) {
  const text = String(raw ?? "").replace(/[\u064B-\u065F\u0670\u0640]/g, "").replace(/[_-]+/g, " ").trim();
  // A university mention must not be attributed to the foundation too.
  const foundationText = text.replace(/جامعة\s*زمزم[^\n،;]*/g, "").replace(/\bZamzam\s+University\b/gi, "");
  return ENTITY_ALIASES.filter((a) => a.patterns.some((re) => re.test(a.id === "ZF" ? foundationText : text)));
}

export function matchOrganization(raw: unknown) {
  return matchOrganizations(raw)[0] ?? null;
}