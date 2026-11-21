// The per-record gates of architecture §4.4 step 3: field map (load rule 2), personal code (P3),
// natural person (rule 5, Part H 7-9) and the proven-company party gate. A gate never throws: what
// it removes is counted in the sync report by reason, never silent.
import {
  COMPANY_ID_PROPS,
  findPersonalCodes,
  idIsPersonalCode,
  isLoadable,
  isNaturalPerson,
  isProp,
  item,
  naturalPersonDrop,
  PERSON_EID,
  eidKind,
  freeTextHoldsPersonalCode,
  isInternalEid,
  type DropReason,
} from "@finora/domain";
import type { ParsedEntity, ParsedRecord, PartyRef } from "@finora/sources";

export type Drop = { reason: DropReason; prop?: string; rowRef?: string };
export type GateResult = {
  entities: ParsedEntity[];
  reports: NonNullable<ParsedRecord["reports"]>;
  events: NonNullable<ParsedRecord["events"]>;
  withheld: { entityEid: string; prop: string; reason: string }[];
  drops: Drop[];
  /** Values refused as personal codes: masked in the record's hash input, so no hash covers them. */
  refused: string[];
};

/** Properties that name another row of the store: a person's row id there is by design (§3.3). */
const REFERENCE_PROPS = new Set(["organization", "director", "member", "owner", "asset", "holder", "parent", "subsidiary", "entity", "subject"]);
const leaksPerson = (value: string) => freeTextHoldsPersonalCode(value) || PERSON_EID.test(value);

export type PartyLookup = (country: string, code: string) => { naturalPerson: boolean } | null;

/** A row-local reference safe for a report: never a code or a person row id. */
function safeRowRef(rowRef: string | undefined): string | undefined {
  if (rowRef === undefined) return undefined;
  const codeShaped = findPersonalCodes(rowRef).length > 0 || ["lv", "ee", "lt", "us"].some((c) => idIsPersonalCode(c, rowRef));
  return codeShaped || /\bp-\d+-\d+\b/.test(rowRef) ? undefined : rowRef;
}

function itemDrop(itemId: string): DropReason | null {
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
  const drops: Drop[] = [];
  // Built field by field: a report entry is a known reason, a known property and a row-local
  // reference, never a loader's free text and never a value (SEC-2).
  const drop = (reason: DropReason, prop?: string) =>
    drops.push({ reason, ...(prop !== undefined && isProp(prop) ? { prop } : {}), ...(rowRef ? { rowRef } : {}) });
  for (const d of record.dropped ?? []) drop(d.reason, d.prop);
  const withheld: GateResult["withheld"] = [];
  const refused: string[] = [];

  const parties: ParsedEntity[] = [];
  const partyEvents: NonNullable<ParsedRecord["events"]> = [];
  for (const party of record.parties ?? []) {
    if (partyProven(party, options.companyPartyTypes, options.lookup)) {
      parties.push(...party.entities);
      partyEvents.push(...(party.events ?? []));
    } else drop("party_not_proven");
  }

  const natural = new Set<string>();
  const entities = [...record.entities, ...parties].map((entity) => {
    const naturalPerson = isNaturalPerson({ schema: entity.schema, legalForm: entity.legalForm ?? null });
    if (naturalPerson) natural.add(entity.eid);
    const statements = entity.statements.filter((s) => {
      const byItem = itemDrop(s.itemId);
      if (byItem) return void drop(byItem, s.prop), false;
      if (!naturalPerson) {
        // A company's free text is scanned too (legal on S04i, SEC-1 scope): a name, an address or
        // a description never carries a personal code. Its own ids and references to other rows are not.
        if (COMPANY_ID_PROPS.has(s.prop)) return true;
        // A reference is let through only when it has a row-id shape; anything else is scanned (qa on S04i).
        if (REFERENCE_PROPS.has(s.prop) && (eidKind(s.value) !== null || isInternalEid(s.value))) return true;
        if (!leaksPerson(s.value)) return true;
        drop("personal_code", s.prop);
        withheld.push({ entityEid: entity.eid, prop: s.prop, reason: "personal_code" });
        refused.push(s.value);
        return false;
      }
      const byRule = naturalPersonDrop(s);
      if (byRule) return void drop(byRule as DropReason, s.prop), false;
      const ownId = entity.schema !== "Person" && COMPANY_ID_PROPS.has(s.prop);
      const leaks = ownId ? idIsPersonalCode(entity.country, s.value) : freeTextHoldsPersonalCode(s.value);
      if (leaks) {
        drop("personal_code", s.prop);
        refused.push(s.value);
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
    if (byRule) return void drop(byRule as DropReason), false;
    return true;
  });
  const events = [...(record.events ?? []), ...partyEvents]
    .filter((e) => {
      const byItem = itemDrop(e.itemId);
      if (byItem) return void drop(byItem), false;
      const byRule = natural.has(e.entityEid) ? naturalPersonDrop({ prop: "", itemId: e.itemId }) : null;
      if (byRule) return void drop(byRule as DropReason), false;
      return true;
    })
    .map((e) => {
      // P3 for every value, not only a person's statements: an event's data (an administrator's
      // field, a free-text note) never carries a personal code or a person row id (SEC-1).
      if (!e.data) return e;
      const data: Record<string, string | number | null> = {};
      for (const [key, value] of Object.entries(e.data)) {
        if (typeof value === "string" && leaksPerson(value)) {
          drop("personal_code");
          refused.push(value);
          continue;
        }
        data[key] = value;
      }
      return { ...e, data };
    });
  return { entities, reports, events, withheld, drops, refused };
}
