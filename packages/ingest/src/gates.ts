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
  freeTextHoldsPersonalCode,
  isInternalEid,
  type DropReason,
  eidKind,
} from "@finora/domain";
import type { FieldMap, ParsedEntity, ParsedRecord, PartyRef } from "@finora/sources";

export type Drop = { reason: DropReason; prop?: string; rowRef?: string };
export type GateResult = {
  entities: ParsedEntity[];
  reports: NonNullable<ParsedRecord["reports"]>;
  events: NonNullable<ParsedRecord["events"]>;
  withheld: { entityEid: string; prop: string; reason: string }[];
  drops: Drop[];
  /**
   * Per party of the record, whether it loaded. The record hash keeps an unproven party's slot with
   * no value, so adding or removing a party still changes it (legal on J2).
   */
  partySlots: boolean[];
  /** A reference waits for its target: the record's hash is salted, so the next sync writes it again. */
  retry: boolean;
};

const propKey = (itemId: string, prop: string) => `${itemId}\u0000${prop}`;

/** The (item, prop) pairs a loader's field map declares: the only statements it may store (M1-F2). */
export function allowedPropsOf(fieldMap: FieldMap): ReadonlySet<string> {
  return new Set(fieldMap.flatMap((e) => ("prop" in e.target && e.itemId ? [propKey(e.itemId, e.target.prop)] : [])));
}

/** Properties that name another row of the store: a person's row id there is by design (§3.3). */
const REFERENCE_PROPS = new Set(["organization", "director", "member", "owner", "asset", "holder", "parent", "subsidiary", "entity", "subject"]);
const leaksPerson = (value: string) => freeTextHoldsPersonalCode(value) || PERSON_EID.test(value);

export type PartyLookup = (country: string, code: string) => { naturalPerson: boolean; status?: string | null } | null;

/**
 * Load rule 3: a struck-off or reorganised entity keeps no current-business data from other sources
 * (people, owners, accounts, workforce, taxes, filings). Its identity and status history stay, and so
 * do its risk history (insolvency, courts, sanctions): "was it bankrupt?" is the question asked of it.
 */
const ENDED = new Set(["struck_off", "reorganised"]);
const DROPPED_WHEN_ENDED = new Set(["S03", "S04", "S06", "S07", "S08", "S13"]);

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

/** A ref's target as the store holds it, looked up by the eid it will be written to. */
export type EntityByEid = (eid: string) => { code: string | null; naturalPerson: boolean; status: string | null; person: boolean } | null;

/** Kinds of public eid that may name a company in event data. */
const COMPANY_EID_KINDS = new Set(["lv", "ee", "lt", "org", "lei", "sec", "usState"]);

/**
 * Whether a value has the shape of a public company eid (qa M4 on S05, legal): a whole value of a
 * public kind, never a person or relationship row id; an LV eid carries a register check digit (in
 * `eidKind`) and never the LV personal-code shape (a real DDMMYY date or the 32 prefix).
 */
function companyEidShape(value: string): boolean {
  const kind = eidKind(value);
  if (kind === null || !COMPANY_EID_KINDS.has(kind) || isInternalEid(value)) return false;
  return !(kind === "lv" && idIsPersonalCode("lv", value.slice(3)));
}

export function applyGates(
  record: ParsedRecord,
  options: {
    companyPartyTypes: readonly string[];
    lookup: PartyLookup;
    knownCompany?: (eid: string) => boolean;
    byEid?: EntityByEid;
    /** The (item, prop) pairs the loader's field map allows; a statement outside them is refused (M1-F2). */
    allowedProps?: ReadonlySet<string>;
  },
): GateResult {
  const rowRef = safeRowRef(record.rowRef);
  const drops: Drop[] = [];
  // Built field by field: a report entry is a known reason, a known property and a row-local
  // reference, never a loader's free text and never a value (SEC-2).
  const drop = (reason: DropReason, prop?: string) =>
    drops.push({ reason, ...(prop !== undefined && isProp(prop) ? { prop } : {}), ...(rowRef ? { rowRef } : {}) });
  for (const d of record.dropped ?? []) drop(d.reason, d.prop);
  const withheld: GateResult["withheld"] = [];
  let retry = false;

  const parties: ParsedEntity[] = [];
  const partyEvents: NonNullable<ParsedRecord["events"]> = [];
  // Entities of a party the gate did not prove: a value naming one is refused for good, never
  // retried as an unresolved reference (an LV sanctions counterparty known by name, N4 on S05).
  const unproven = new Set<string>();
  // `needs` points at an earlier party that loaded, so a chain holds and a bad index fails closed.
  const loaded: boolean[] = [];
  for (const [i, party] of (record.parties ?? []).entries()) {
    const ok = partyProven(party, options.companyPartyTypes, options.lookup) && (party.needs === undefined || (party.needs < i && loaded[party.needs] === true));
    loaded.push(ok);
    if (ok) {
      parties.push(...party.entities);
      partyEvents.push(...(party.events ?? []));
    } else {
      drop("party_not_proven");
      for (const e of party.entities) unproven.add(e.eid);
    }
  }

  const natural = new Set<string>();
  // A ref is never a same-record eid (qa M3 on S05): it counts as a reference only through the store.
  const recordEids = new Set([...record.entities, ...parties].filter((e) => !e.ref).map((e) => e.eid));
  // A company this record carries, never a natural person (legal 7075401998).
  const companiesInRecord = new Set(
    [...record.entities, ...parties].filter((e) => !e.ref && e.schema !== "Person" && !isNaturalPerson({ schema: e.schema, legalForm: e.legalForm ?? null })).map((e) => e.eid),
  );
  /** The store holds this eid as a company that is not a natural person. */
  const companyHeld = (eid: string): boolean => {
    if (!options.byEid) return options.knownCompany?.(eid) === true;
    const held = options.byEid(eid);
    return held !== null && !held.person && !held.naturalPerson;
  };
  const inRecord = new Set<string>();
  const entities = [...record.entities, ...parties].map((entity) => {
    // A referenced entity is judged by the row it will be written to, looked up by eid (qa M2 on
    // S05); one the store lacks is treated as a natural person here and refused as `entity_missing`.
    const held = entity.ref ? (options.byEid?.(entity.eid) ?? null) : null;
    if (!entity.ref) inRecord.add(entity.eid);
    if (entity.ref && held && (held.person || isInternalEid(entity.eid) || (entity.code != null && held.code !== entity.code))) {
      // A person row, or a code that is not the target's own: nothing is attached (qa M1, M2; legal).
      for (const s of entity.statements) drop(held.person || isInternalEid(entity.eid) ? "ref_not_company" : "ref_mismatch", s.prop);
      return { ...entity, statements: [] };
    }
    const naturalPerson = entity.ref ? (held?.naturalPerson ?? true) : isNaturalPerson({ schema: entity.schema, legalForm: entity.legalForm ?? null });
    const ended = entity.ref && ENDED.has(held?.status ?? "");
    if (naturalPerson) natural.add(entity.eid);
    const statements = entity.statements.filter((s) => {
      const byItem = itemDrop(s.itemId);
      if (byItem) return void drop(byItem, s.prop), false;
      // Every value shown under an item is one its loader declared for it (M1-F2; session 0's rule that
      // every rendered field maps to a decided item): a prop filed under another item is refused.
      if (options.allowedProps && !options.allowedProps.has(propKey(s.itemId, s.prop))) return void drop("prop_not_in_item", s.prop), false;
      if (ended && DROPPED_WHEN_ENDED.has(s.itemId.slice(0, 3))) return void drop("struck_off_identity_only", s.prop), false;
      if (!naturalPerson) {
        // A company's free text is scanned too (legal on S04i, SEC-1 scope): a name, an address or
        // a description never carries a personal code. Its own ids and references to other rows are not.
        if (COMPANY_ID_PROPS.has(s.prop)) return true;
        // A reference passes unscanned only when it names a row for sure: a person or relationship row
        // id, an entity of this record, or a company the store holds. Anything merely id-shaped
        // (`lv-<code>`, `us-ca-<code>`, `sanc-x-<code>`) is scanned like free text (qa, legal on S04i, S06).
        if (REFERENCE_PROPS.has(s.prop) && (isInternalEid(s.value) || recordEids.has(s.value) || options.knownCompany?.(s.value) === true)) return true;
        if (!leaksPerson(s.value)) return true;
        drop("personal_code", s.prop);
        withheld.push({ entityEid: entity.eid, prop: s.prop, reason: "personal_code" });
        return false;
      }
      const byRule = naturalPersonDrop(s);
      if (byRule) return void drop(byRule as DropReason, s.prop), false;
      const ownId = entity.schema !== "Person" && COMPANY_ID_PROPS.has(s.prop);
      const leaks = ownId ? idIsPersonalCode(entity.country, s.value) : freeTextHoldsPersonalCode(s.value);
      if (leaks) {
        drop("personal_code", s.prop);
        if (ownId) withheld.push({ entityEid: entity.eid, prop: s.prop, reason: "personal_code" });
        return false;
      }
      return true;
    });
    return { ...entity, statements };
  });

  // A fact or event may sit on an entity this record does not carry (an LV insolvency row on a
  // register entity): the store decides whether that entity is a natural person (rule 5).
  const stored = (eid: string) => {
    if (options.byEid) return options.byEid(eid);
    const m = /^(lv|ee|lt)-(\d+)$/.exec(eid);
    return m ? options.lookup(m[1]!, m[2]!) : null;
  };
  // Fails closed (SEC-4 on S05): an entity neither in the record nor in the store is treated as a
  // natural person, so its facts and events get the natural-person rules (and the store refuses them).
  const naturalEid = (eid: string): boolean => {
    if (natural.has(eid)) return true;
    if (inRecord.has(eid)) return false;
    const held = stored(eid);
    // Unknown yet: retried on the next sync, once its register has loaded.
    if (held === null) retry = true;
    return held?.naturalPerson ?? true;
  };
  // Current-business data from another source on an entity the register has ended (load rule 3).
  const endedElsewhere = (eid: string, itemId: string): boolean =>
    !inRecord.has(eid) && DROPPED_WHEN_ENDED.has(itemId.slice(0, 3)) && ENDED.has(stored(eid)?.status ?? "");
  const reports = (record.reports ?? []).filter((r) => {
    const byItem = itemDrop(r.itemId);
    if (byItem) return void drop(byItem), false;
    const byRule = naturalEid(r.entityEid) ? naturalPersonDrop({ prop: "", itemId: r.itemId }) : null;
    if (byRule) return void drop(byRule as DropReason), false;
    if (endedElsewhere(r.entityEid, r.itemId)) return void drop("struck_off_identity_only"), false;
    return true;
  });
  const events = [...(record.events ?? []), ...partyEvents]
    .filter((e) => {
      const byItem = itemDrop(e.itemId);
      if (byItem) return void drop(byItem), false;
      const byRule = naturalEid(e.entityEid) ? naturalPersonDrop({ prop: "", itemId: e.itemId }) : null;
      if (byRule) return void drop(byRule as DropReason), false;
      if (endedElsewhere(e.entityEid, e.itemId)) return void drop("struck_off_identity_only"), false;
      return true;
    })
    .map((e) => {
      // P3 for every value, not only a person's statements: an event's data (an administrator's
      // field, a free-text note) never carries a personal code or a person row id (SEC-1).
      if (!e.data) return e;
      const data: Record<string, string | number | null> = {};
      for (const [key, value] of Object.entries(e.data)) {
        // A public company eid (the other side of an LV reorganisation) is a reference, not free
        // text, when the record carries that company or the store holds it: an LV register code can
        // fit the EE/LT personal-code check by chance. The shape and the store each have to agree
        // (legal). A company eid the store does not hold yet is withheld and retried (qa M5).
        // A person or relationship row id never travels in event data (PS5; qa M4 on S05), and an id
        // shaped like a Baltic register eid that fails its check is not a company (qa M4).
        // Already counted once, as the party's party_not_proven.
        if (typeof value === "string" && unproven.has(value) && !recordEids.has(value)) {
          continue;
        }
        if (typeof value === "string" && (isInternalEid(value) || (/^(lv|ee|lt)-\d{6,}$/.test(value) && !companyEidShape(value)))) {
          drop(isInternalEid(value) ? "person_field" : "invalid_code");
          continue;
        }
        const shaped = typeof value === "string" && companyEidShape(value);
        const reference = shaped && (companiesInRecord.has(value) || companyHeld(value));
        // Held, but as a natural person or a person row: refused for good, never retried (legal 7075401998).
        const heldAsPerson = shaped && !reference && (() => {
          const held = options.byEid?.(value as string);
          return held != null && (held.person || held.naturalPerson);
        })();
        if (heldAsPerson) {
          drop("natural_person_party");
          continue;
        }
        if (shaped && !reference) {
          drop("reference_unresolved");
          retry = true;
          continue;
        }
        if (typeof value === "string" && !reference && leaksPerson(value)) {
          drop("personal_code");
          continue;
        }
        data[key] = value;
      }
      return { ...e, data };
    });
  return { entities, reports, events, withheld, drops, partySlots: loaded, retry };
}
