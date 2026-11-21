// The per-record gates of architecture §4.4 step 3: field map (load rule 2), personal code (P3),
// natural person (rule 5, Part H 7-9) and the proven-company party gate. A gate never throws: what
// it removes is counted in the sync report by reason, never silent.
import {
  COMPANY_ID_PROPS,
  findPersonalCodes,
  idIsPersonalCode,
  isLoadable,
  isNaturalPerson,
  item,
  naturalPersonDrop,
} from "@finora/domain";
import type { ParsedEntity, ParsedRecord, PartyRef } from "@finora/sources";

export type Drop = { reason: string; prop?: string; rowRef?: string };
export type GateResult = {
  entities: ParsedEntity[];
  reports: NonNullable<ParsedRecord["reports"]>;
  events: NonNullable<ParsedRecord["events"]>;
  withheld: { entityEid: string; prop: string; reason: string }[];
  drops: Drop[];
};

export type PartyLookup = (country: string, code: string) => { naturalPerson: boolean } | null;

/** A row-local reference safe for a report: never a code or a person row id. */
function safeRowRef(rowRef: string | undefined): string | undefined {
  if (rowRef === undefined) return undefined;
  const codeShaped = findPersonalCodes(rowRef).length > 0 || ["lv", "ee", "lt", "us"].some((c) => idIsPersonalCode(c, rowRef));
  return codeShaped || /\bp-\d+-\d+\b/.test(rowRef) ? undefined : rowRef;
}

function itemDrop(itemId: string): string | null {
  if (isLoadable(itemId)) return null;
  return item(itemId)?.call === "hide" ? "hide_item" : "later_item";
}

/**
 * The proven-company gate (council final round): a party loads only if the register types it as a
 * company, or its code resolves to a register entity with a non-natural-person form.
 */
export function partyProven(party: PartyRef, companyTypes: readonly string[], lookup: PartyLookup): boolean {
  if (party.type && companyTypes.includes(party.type)) return true;
  if (party.code) {
    const found = lookup(party.code.country, party.code.value);
    return found !== null && !found.naturalPerson;
  }
  return false;
}

export function applyGates(record: ParsedRecord, options: { companyPartyTypes: readonly string[]; lookup: PartyLookup }): GateResult {
  const rowRef = safeRowRef(record.rowRef);
  const drops: Drop[] = (record.dropped ?? []).map((d) => ({ ...d, ...(rowRef ? { rowRef } : {}) }));
  const drop = (reason: string, prop?: string) => drops.push({ reason, ...(prop ? { prop } : {}), ...(rowRef ? { rowRef } : {}) });
  const withheld: GateResult["withheld"] = [];

  const parties: ParsedEntity[] = [];
  for (const party of record.parties ?? []) {
    if (partyProven(party, options.companyPartyTypes, options.lookup)) parties.push(...party.entities);
    else drop("party_not_proven", party.type ?? undefined);
  }

  const natural = new Set<string>();
  const entities = [...record.entities, ...parties].map((entity) => {
    const naturalPerson = isNaturalPerson({ schema: entity.schema, legalForm: entity.legalForm ?? null });
    if (naturalPerson) natural.add(entity.eid);
    const statements = entity.statements.filter((s) => {
      const byItem = itemDrop(s.itemId);
      if (byItem) return void drop(byItem, s.prop), false;
      if (!naturalPerson) return true;
      const byRule = naturalPersonDrop(s);
      if (byRule) return void drop(byRule, s.prop), false;
      const ownId = entity.schema !== "Person" && COMPANY_ID_PROPS.has(s.prop);
      const leaks = ownId ? idIsPersonalCode(entity.country, s.value) : findPersonalCodes(s.value).length > 0;
      if (leaks) {
        drop("personal_code", s.prop);
        if (ownId) withheld.push({ entityEid: entity.eid, prop: s.prop, reason: "personal_code" });
        return false;
      }
      return true;
    });
    return { ...entity, statements };
  });

  const reports = (record.reports ?? []).filter((r) => {
    const byItem = itemDrop(r.itemId);
    if (byItem) return void drop(byItem), false;
    const byRule = natural.has(r.entityEid) ? naturalPersonDrop({ prop: "", itemId: r.itemId }) : null;
    if (byRule) return void drop(byRule), false;
    return true;
  });
  const events = (record.events ?? []).filter((e) => {
    const byItem = itemDrop(e.itemId);
    if (byItem) return void drop(byItem), false;
    const byRule = natural.has(e.entityEid) ? naturalPersonDrop({ prop: "", itemId: e.itemId }) : null;
    if (byRule) return void drop(byRule), false;
    return true;
  });
  return { entities, reports, events, withheld, drops };
}
