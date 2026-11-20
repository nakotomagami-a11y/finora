// Load rule 2 (architecture §3.6): only SHOW and CAVEAT items are ever loaded or rendered; HIDE
// and LATER items are dropped at load and never queried. The restricted-section rules (country,
// legal form, section, legal basis) join this file with the report assembly in S09a, reviewed by legal.
import { ITEMS, type Item, type ItemId } from "./items.generated.ts";

const BY_ID = new Map<string, Item>(ITEMS.map((item) => [item.id, item]));

export function item(id: string): Item | undefined {
  return BY_ID.get(id);
}

/** True for SHOW and CAVEAT items; false for HIDE, LATER and unknown ids. */
export function isLoadable(id: string): boolean {
  const call = BY_ID.get(id)?.call;
  return call === "show" || call === "caveat";
}

export const HIDE_ITEM_IDS: readonly ItemId[] = ITEMS.filter((i) => i.call === "hide").map((i) => i.id);
