import type { Country } from "./countries.ts";
import { normalizeText } from "../text/normalize.ts";

export type LegalForm = {
  code: string;
  country: Country;
  /** The form in the register's own words. */
  label: string;
  gloss: string;
  /** A sole trader or other natural person (legal rule 5): no verdict, facts only, never named in titles. */
  naturalPerson: boolean;
};

/**
 * The legal forms the v1 loaders meet, per country. The loader specs map each register's own
 * codes onto these; a form missing here makes the loader fail its field-map test, so an unknown
 * form can never default to "company".
 */
export const LEGAL_FORMS: readonly LegalForm[] = [
  // LV: every `type` code in the Enterprise Register file of 2026-11-19 (lv-register.md). Natural persons:
  // IK, ZEM, ZVJ, IND and GIM (legal rule 5). The Latvian labels are the file's `type_text`.
  { code: "lv-sia", country: "lv", label: "SIA", gloss: "private limited company", naturalPerson: false },
  { code: "lv-as", country: "lv", label: "AS", gloss: "public limited company", naturalPerson: false },
  { code: "lv-ks", country: "lv", label: "KS", gloss: "limited partnership", naturalPerson: false },
  { code: "lv-ps", country: "lv", label: "PS", gloss: "general partnership", naturalPerson: false },
  { code: "lv-ik", country: "lv", label: "IK", gloss: "individual merchant (sole trader)", naturalPerson: true },
  { code: "lv-zem", country: "lv", label: "ZEM", gloss: "farm", naturalPerson: true },
  { code: "lv-zvj", country: "lv", label: "ZVJ", gloss: "fishing farm", naturalPerson: true },
  { code: "lv-ind", country: "lv", label: "IND", gloss: "individual enterprise", naturalPerson: true },
  { code: "lv-gim", country: "lv", label: "GIM", gloss: "family enterprise", naturalPerson: true },
  { code: "lv-bdr", country: "lv", label: "BDR", gloss: "association", naturalPerson: false },
  { code: "lv-nod", country: "lv", label: "NOD", gloss: "foundation", naturalPerson: false },
  { code: "lv-kb", country: "lv", label: "KB", gloss: "cooperative society", naturalPerson: false },
  { code: "lv-kbs", country: "lv", label: "KBS", gloss: "union of cooperative societies", naturalPerson: false },
  { code: "lv-kbu", country: "lv", label: "KBU", gloss: "enterprise of cooperative societies", naturalPerson: false },
  { code: "lv-kss", country: "lv", label: "KSS", gloss: "enterprise of a union of cooperative societies", naturalPerson: false },
  { code: "lv-paj", country: "lv", label: "PAJ", gloss: "share company", naturalPerson: false },
  { code: "lv-pap", country: "lv", label: "PAP", gloss: "company with additional liability", naturalPerson: false },
  { code: "lv-lig", country: "lv", label: "LIG", gloss: "contractual company with full liability", naturalPerson: false },
  { code: "lv-se", country: "lv", label: "SE", gloss: "European company", naturalPerson: false },
  { code: "lv-eig", country: "lv", label: "EIG", gloss: "European economic interest grouping", naturalPerson: false },
  { code: "lv-fil", country: "lv", label: "FIL", gloss: "branch", naturalPerson: false },
  { code: "lv-akf", country: "lv", label: "AKF", gloss: "branch of a foreign merchant", naturalPerson: false },
  { code: "lv-par", country: "lv", label: "PAR", gloss: "representative office of a foreign merchant", naturalPerson: false },
  { code: "lv-por", country: "lv", label: "POR", gloss: "representative office of a foreign organisation", naturalPerson: false },
  { code: "lv-prv", country: "lv", label: "PRV", gloss: "representative", naturalPerson: false },
  { code: "lv-vu", country: "lv", label: "VU", gloss: "state enterprise", naturalPerson: false },
  { code: "lv-psv", country: "lv", label: "PSV", gloss: "municipal enterprise", naturalPerson: false },
  { code: "lv-uzn", country: "lv", label: "UZN", gloss: "enterprise of a commercial company", naturalPerson: false },
  { code: "lv-sab", country: "lv", label: "SAB", gloss: "public organisation", naturalPerson: false },
  { code: "lv-sou", country: "lv", label: "SOU", gloss: "enterprise of a public organisation", naturalPerson: false },
  { code: "lv-sav", country: "lv", label: "SAV", gloss: "union", naturalPerson: false },
  { code: "lv-roi", country: "lv", label: "ROI", gloss: "institution", naturalPerson: false },
  { code: "lv-ron", country: "lv", label: "RON", gloss: "division", naturalPerson: false },
  { code: "lv-arb", country: "lv", label: "ARB", gloss: "trade union", naturalPerson: false },
  { code: "lv-arv", country: "lv", label: "ARV", gloss: "independent unit of a trade union", naturalPerson: false },
  { code: "lv-ara", country: "lv", label: "ARA", gloss: "association of trade unions", naturalPerson: false },
  { code: "lv-pp", country: "lv", label: "PP", gloss: "political party", naturalPerson: false },
  { code: "lv-ppa", country: "lv", label: "PPA", gloss: "union of political parties", naturalPerson: false },
  { code: "lv-pol", country: "lv", label: "POL", gloss: "political organisation (party)", naturalPerson: false },
  { code: "lv-skt", country: "lv", label: "SKT", gloss: "court of arbitration", naturalPerson: false },
  { code: "lv-mil", country: "lv", label: "MIL", gloss: "mass medium", naturalPerson: false },
  { code: "lv-drz", country: "lv", label: "DRZ", gloss: "congregation", naturalPerson: false },
  { code: "lv-baz", country: "lv", label: "BAZ", gloss: "church", naturalPerson: false },
  { code: "lv-die", country: "lv", label: "DIE", gloss: "diocese", naturalPerson: false },
  { code: "lv-klo", country: "lv", label: "KLO", gloss: "monastery", naturalPerson: false },
  { code: "lv-mis", country: "lv", label: "MIS", gloss: "mission", naturalPerson: false },
  { code: "lv-rel", country: "lv", label: "REL", gloss: "enterprise of a religious organisation", naturalPerson: false },
  { code: "lv-kat", country: "lv", label: "KAT", gloss: "public-law legal person of the Catholic Church", naturalPerson: false },
  { code: "lv-spo", country: "lv", label: "SPO", gloss: "type code SPO (no label in the register file)", naturalPerson: false },
  { code: "lv-asf", country: "lv", label: "ASF", gloss: "type code ASF (no label in the register file)", naturalPerson: false },
  { code: "lv-kor", country: "lv", label: "KOR", gloss: "type code KOR (no label in the register file)", naturalPerson: false },
  { code: "lv-saa", country: "lv", label: "SAA", gloss: "type code SAA (no label in the register file)", naturalPerson: false },
  { code: "lv-spa", country: "lv", label: "SPA", gloss: "type code SPA (no label in the register file)", naturalPerson: false },
  { code: "lv-pro", country: "lv", label: "PRO", gloss: "type code PRO (no label in the register file)", naturalPerson: false },
  { code: "ee-ou", country: "ee", label: "OÜ", gloss: "private limited company", naturalPerson: false },
  { code: "ee-as", country: "ee", label: "AS", gloss: "public limited company", naturalPerson: false },
  { code: "ee-tu", country: "ee", label: "TÜ", gloss: "general partnership", naturalPerson: false },
  { code: "ee-uu", country: "ee", label: "UÜ", gloss: "limited partnership", naturalPerson: false },
  { code: "ee-fie", country: "ee", label: "FIE", gloss: "sole proprietor", naturalPerson: true },
  { code: "lt-uab", country: "lt", label: "UAB", gloss: "private limited company", naturalPerson: false },
  { code: "lt-ab", country: "lt", label: "AB", gloss: "public limited company", naturalPerson: false },
  { code: "lt-mb", country: "lt", label: "MB", gloss: "small partnership", naturalPerson: false },
  { code: "lt-ii", country: "lt", label: "IĮ", gloss: "individual enterprise (sole trader)", naturalPerson: true },
  { code: "us-corp", country: "us", label: "Corporation", gloss: "corporation", naturalPerson: false },
  { code: "us-llc", country: "us", label: "LLC", gloss: "limited liability company", naturalPerson: false },
  { code: "us-lp", country: "us", label: "LP", gloss: "limited partnership", naturalPerson: false },
  { code: "us-sole", country: "us", label: "Sole proprietorship", gloss: "sole proprietorship", naturalPerson: true },
];

const BY_CODE = new Map(LEGAL_FORMS.map((form) => [form.code, form]));

export function legalForm(code: string): LegalForm | undefined {
  return BY_CODE.get(code);
}

/**
 * Company-form words as they appear in names, after `normalizeText`: the forms above and the
 * foreign forms the sanctions lists use. Screening drops them before comparing names (sanctions.md
 * §7); the LV frozen-assets party gate loads a foreign row only if its name carries one (§4).
 */
export const LEGAL_FORM_TOKENS: ReadonlySet<string> = new Set([
  "sia", "as", "ks", "ps", "ik", "ou", "tu", "uu", "fie", "uab", "ab", "mb", "ii", "llc", "inc", "corp", "corporation", "co", "company",
  "ltd", "limited", "plc", "lp", "llp", "gmbh", "ag", "kg", "ooo", "ao", "oao", "zao", "pao", "jsc", "ojsc", "cjsc",
  "pjsc", "tov", "pat", "prat", "bv", "nv", "sa", "sas", "sarl", "srl", "spa", "sl", "sro", "kft", "zrt", "doo",
  "ad", "ood", "eood", "fze", "fzco", "fzc", "fzllc", "dmcc", "pte", "pty", "bhd", "sdn", "lda", "ltda", "oy",
  "oyj", "aps", "asa", "ооо", "ао", "оао", "зао", "пао", "тоо", "тов", "ат", "пат",
]);

/**
 * Whether a name carries a company-form word of three letters or more. Two-letter forms (AS, AO,
 * SA) also occur in personal names, so they never prove a company on their own: a row they would
 * have admitted is dropped, the safe side of the party gate.
 */
export function namesCompany(name: string): boolean {
  return normalizeText(name)
    .split(" ")
    .some((token) => token.length >= 3 && LEGAL_FORM_TOKENS.has(token));
}
