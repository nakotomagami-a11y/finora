import type { Country } from "./countries.ts";

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
  { code: "lv-sia", country: "lv", label: "SIA", gloss: "private limited company", naturalPerson: false },
  { code: "lv-as", country: "lv", label: "AS", gloss: "public limited company", naturalPerson: false },
  { code: "lv-ks", country: "lv", label: "KS", gloss: "limited partnership", naturalPerson: false },
  { code: "lv-ps", country: "lv", label: "PS", gloss: "general partnership", naturalPerson: false },
  { code: "lv-ik", country: "lv", label: "IK", gloss: "individual merchant (sole trader)", naturalPerson: true },
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
