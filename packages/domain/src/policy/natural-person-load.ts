// Load rules for natural persons and sole traders (legal rule 5; council Part H items 7-9 and the
// Baltic loader calls): what a natural-person entity never keeps, whatever its source says.

/** Sections dropped whole for a natural person: tax and arrears lines (S08), insolvency, securing measures and suspensions (S09). */
export const NATURAL_PERSON_DROPPED_SECTIONS: Readonly<Record<string, string>> = {
  S08: "natural_person_tax",
  S09: "natural_person_insolvency",
};

/** Properties a sole trader never keeps: an address finer than the country, and a VAT number (an LV VAT number embeds the personal code). */
export const SOLE_TRADER_DROPPED_PROPS: Readonly<Record<string, string>> = {
  address: "sole_trader_address",
  vatCode: "sole_trader_vat",
};

/** The drop reason for one value of a natural-person entity, or null if it may load. */
export function naturalPersonDrop(value: { prop: string; itemId: string }): string | null {
  return NATURAL_PERSON_DROPPED_SECTIONS[value.itemId.slice(0, 3)] ?? SOLE_TRADER_DROPPED_PROPS[value.prop] ?? null;
}
