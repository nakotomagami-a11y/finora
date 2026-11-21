// Sanctions screening (sanctions.md §7; R8). A company is screened against the stored list entries
// (`sanc-*` organisations, never persons) by official identifier and by name; its current
// officers, only when a caller behind the purpose gate passes their names, against the in-memory
// person index. `listed` needs an official-ID match; a name alone is `possible_match`; an entry
// whose own registration number in the company's country differs is `ruled_out`.
import type { DatabaseSync } from "node:sqlite";
import { nameKey, namesMatch, nameTokens } from "./names.ts";
import { personIndexState, screenPersonName, type PersonCitation } from "./person-index.ts";

/** The stored lists, in display order (sanctions.md table). */
export const STORED_LISTS = ["eu-fsf", "us-ofac-sdn", "us-ofac-cons", "uk-sanctions-list", "esma-ncasp", "lv-fid-frozen"] as const;
const FROZEN_ASSETS = "register.frozen_assets";

export type ScreeningStatus = "listed" | "possible_match" | "ruled_out";
export type MatchBasis = "registration" | "tax" | "lei" | "frozen_assets" | "bare_number" | "name_exact" | "name_fuzzy";
export type EntryIdentifier = { type: string; number: string; country: string | null };

export type SanctionsHit = {
  sourceId: string;
  /** The list entry's stored eid (`sanc-<list>-<id>`), or the company itself for a frozen-assets row. */
  entryEid: string;
  status: ScreeningStatus;
  basis: MatchBasis;
  /** The entry name that matched, for a name match. */
  matchedName: string | null;
  /** The company's identifiers and the entry's, side by side (the match card). */
  companyIdentifiers: EntryIdentifier[];
  identifiers: EntryIdentifier[];
  /** The entry's own identifier that rules it out (rule 5). */
  ruledOutBy: EntryIdentifier | null;
  names: string[];
  programs: string[];
  authority: string | null;
  listingDate: string | null;
  asOf: string | null;
  checkedAt: string | null;
};

export type ListState = { sourceId: string; asOf: string | null; checkedAt: string | null };
export type OfficerScreening = { status: "screened"; matches: (PersonCitation & { signal: "officer_sanctions_possible_match" })[] } | { status: "not_screened_lists_loading" };

export type CompanyScreening = {
  eid: string;
  /** A sole trader or other natural person: no verdict and no list level, facts only (R5, rule 9). */
  naturalPerson: boolean;
  hits: SanctionsHit[];
  /** Present only when the caller passed names from behind the purpose gate. */
  officers: OfficerScreening | null;
  /** A natural-person subject's own name against the person index, behind the purpose gate. */
  ownName: PersonCitation[] | null;
  lists: ListState[];
};

type Entry = {
  eid: string;
  sourceId: string;
  names: string[];
  weak: string[];
  keys: string[];
  lei: string | null;
  identifiers: EntryIdentifier[];
  programs: string[];
  authority: string | null;
  listingDate: string | null;
};
type Index = { entries: Map<string, Entry>; byToken: Map<string, Entry[]>; lists: Map<string, ListState> };

export const normalizeId = (value: string) => value.toUpperCase().replace(/[\s\-./]/g, "");
const subjectOf = (eid: string) => eid.replace(/-(?:s|i\d+)$/, "");
const placeholders = (n: number) => Array.from({ length: n }, () => "?").join(", ");

function listStates(db: DatabaseSync): Map<string, ListState> {
  const out = new Map<string, ListState>();
  for (const sourceId of STORED_LISTS) {
    const row = db
      .prepare("SELECT upstream_as_of, finished_at FROM main.syncs WHERE source_id = ? AND kind IN ('content', 'unchanged') ORDER BY id DESC LIMIT 1")
      .get(sourceId) as { upstream_as_of: string | null; finished_at: string | null } | undefined;
    out.set(sourceId, { sourceId, asOf: row?.upstream_as_of ?? null, checkedAt: row?.finished_at ?? null });
  }
  return out;
}

function build(db: DatabaseSync): Index {
  // `sanc-` up to `sanc.`: the eid index's range, so no scan of the register entities.
  const rows = db
    .prepare(
      `SELECT e.eid, s.name AS schema, p.name AS prop, st.value, r.source_id
       FROM main.entities e JOIN main.schemas s ON s.id = e.schema_id
       JOIN main.statements st ON st.entity_id = e.id JOIN main.props p ON p.id = st.prop_id
       JOIN main.records r ON r.id = st.record_id
       WHERE e.eid >= 'sanc-' AND e.eid < 'sanc.' AND r.source_id IN (${placeholders(STORED_LISTS.length)})
       ORDER BY st.id`,
    )
    .all(...STORED_LISTS) as { eid: string; schema: string; prop: string; value: string; source_id: string }[];
  const entries = new Map<string, Entry>();
  const ids = new Map<string, Partial<EntryIdentifier> & { holder?: string }>();
  for (const row of rows) {
    const subject = subjectOf(row.eid);
    let entry = entries.get(subject);
    if (!entry) {
      entry = { eid: subject, sourceId: row.source_id, names: [], weak: [], keys: [], lei: null, identifiers: [], programs: [], authority: null, listingDate: null };
      entries.set(subject, entry);
    }
    if (row.schema === "Organization") {
      if (row.prop === "name" || row.prop === "alias" || row.prop === "previousName") entry.names.push(row.value);
      else if (row.prop === "weakAlias") entry.weak.push(row.value);
      else if (row.prop === "leiCode") entry.lei = row.value;
    } else if (row.schema === "Sanction") {
      if (row.prop === "program") entry.programs.push(row.value);
      else if (row.prop === "authority") entry.authority = row.value;
      else if (row.prop === "listingDate") entry.listingDate = row.value;
    } else if (row.schema === "Identification") {
      const id = ids.get(row.eid) ?? {};
      if (row.prop === "type" || row.prop === "number" || row.prop === "country") id[row.prop] = row.value;
      ids.set(row.eid, id);
    }
  }
  for (const [eid, id] of ids) {
    if (id.type && id.number) entries.get(subjectOf(eid))?.identifiers.push({ type: id.type, number: id.number, country: id.country ?? null });
  }
  const byToken = new Map<string, Entry[]>();
  for (const entry of entries.values()) {
    if (entry.names.length === 0) {
      entries.delete(entry.eid);
      continue;
    }
    // Weak aliases never make a candidate on their own (rule 2): only real names are indexed.
    entry.keys = [...new Set(entry.names.map(nameKey).filter(Boolean))];
    for (const token of new Set(entry.keys.flatMap((k) => k.split(" ")))) {
      const bucket = byToken.get(token);
      if (bucket) bucket.push(entry);
      else byToken.set(token, [entry]);
    }
  }
  return { entries, byToken, lists: listStates(db) };
}

const cache = new WeakMap<DatabaseSync, { version: string; index: Index }>();

/** The index, rebuilt after any sync of a stored list (sanctions.md §7: once per sync). */
function index(db: DatabaseSync): Index {
  const version = String(
    (db.prepare(`SELECT MAX(id) AS v FROM main.syncs WHERE source_id IN (${placeholders(STORED_LISTS.length)})`).get(...STORED_LISTS) as { v: number | null }).v ?? 0,
  );
  const held = cache.get(db);
  if (held?.version === version) return held.index;
  const fresh = build(db);
  cache.set(db, { version, index: fresh });
  return fresh;
}

function candidates(idx: Index, name: string): { entry: Entry; matched: string; kind: "exact" | "fuzzy" }[] {
  const key = nameKey(name);
  const seen = new Set<Entry>();
  const out: { entry: Entry; matched: string; kind: "exact" | "fuzzy" }[] = [];
  for (const token of nameTokens(name)) {
    for (const entry of idx.byToken.get(token) ?? []) {
      if (seen.has(entry)) continue;
      seen.add(entry);
      let best: { matched: string; kind: "exact" | "fuzzy" } | null = null;
      for (const n of entry.names) {
        const kind = namesMatch(n, key);
        if (kind === "exact" || (kind === "fuzzy" && best === null)) best = { matched: n, kind };
        if (kind === "exact") break;
      }
      if (best) out.push({ entry, ...best });
    }
  }
  return out;
}

function hit(idx: Index, entry: Entry, fields: Pick<SanctionsHit, "status" | "basis" | "matchedName" | "ruledOutBy" | "companyIdentifiers">): SanctionsHit {
  const list = idx.lists.get(entry.sourceId);
  return {
    sourceId: entry.sourceId,
    entryEid: entry.eid,
    ...fields,
    identifiers: [...entry.identifiers, ...(entry.lei ? [{ type: "lei", number: entry.lei, country: null }] : [])],
    names: entry.names,
    programs: entry.programs,
    authority: entry.authority,
    listingDate: entry.listingDate,
    asOf: list?.asOf ?? null,
    checkedAt: list?.checkedAt ?? null,
  };
}

type Company = { id: number; eid: string; country: string; code: string | null; naturalPerson: boolean; names: string[]; ids: EntryIdentifier[]; lei: string | null };

function company(db: DatabaseSync, eid: string): Company | null {
  const row = db
    .prepare(
      `SELECT e.id, e.eid, e.country, e.code, e.natural_person, s.name AS schema FROM main.entities e
       JOIN main.schemas s ON s.id = e.schema_id WHERE e.eid = ?`,
    )
    .get(eid) as { id: number; eid: string; country: string; code: string | null; natural_person: number; schema: string } | undefined;
  if (!row || row.schema === "Person" || eid.startsWith("sanc-")) return null;
  const statements = db
    .prepare("SELECT p.name AS prop, st.value FROM main.statements st JOIN main.props p ON p.id = st.prop_id WHERE st.entity_id = ? ORDER BY st.id")
    .all(row.id) as { prop: string; value: string }[];
  const values = (...props: string[]) => statements.filter((s) => props.includes(s.prop)).map((s) => s.value);
  const ids: EntryIdentifier[] = [];
  const add = (type: string, value: string) => {
    const number = normalizeId(value);
    if (number && !ids.some((i) => i.number === number)) ids.push({ type, number, country: row.country });
  };
  if (row.code) add("registration", row.code);
  for (const v of values("registrationNumber")) add("registration", v);
  for (const v of values("vatCode", "taxNumber")) {
    add("tax", v);
    // A VAT number with its country prefix (LV40003000018) also matches the bare number.
    add("tax", v.replace(/^[A-Za-z]{2}(?=\d)/, ""));
  }
  return {
    id: row.id,
    eid: row.eid,
    country: row.country,
    code: row.code,
    naturalPerson: row.natural_person === 1,
    names: values("name", "alias", "previousName"),
    ids,
    lei: values("leiCode")[0] ?? null,
  };
}

const RANK: Record<ScreeningStatus, number> = { listed: 0, possible_match: 1, ruled_out: 2 };

/** Screens one company against every stored list (rules 1-7), and its officers when given (rule 8). */
export function screenCompany(db: DatabaseSync, eid: string, options: { officerNames?: readonly string[]; ownName?: string } = {}): CompanyScreening | null {
  const subject = company(db, eid);
  if (!subject) return null;
  const idx = index(db);
  const lists = [...idx.lists.values()];
  if (subject.naturalPerson) {
    // Rule 9: no list level for a natural person; at most a possible match on its own name.
    return { eid, naturalPerson: true, hits: [], officers: null, ownName: options.ownName !== undefined ? screenPersonName(options.ownName) : null, lists };
  }
  const byEntry = new Map<string, SanctionsHit>();
  const keep = (h: SanctionsHit) => {
    const prior = byEntry.get(h.entryEid);
    if (!prior || RANK[h.status] < RANK[prior.status]) byEntry.set(h.entryEid, h);
  };
  const companyIdentifiers = [...subject.ids, ...(subject.lei ? [{ type: "lei", number: subject.lei, country: null }] : [])];
  const numbers = new Set(subject.ids.map((i) => i.number));

  // Rule 4: official identifiers. Every entry is checked, not only name candidates.
  for (const entry of idx.entries.values()) {
    if (subject.lei && (entry.lei === subject.lei || entry.identifiers.some((i) => i.type === "lei" && i.number === subject.lei))) {
      keep(hit(idx, entry, { status: "listed", basis: "lei", matchedName: null, ruledOutBy: null, companyIdentifiers }));
      continue;
    }
    for (const id of entry.identifiers) {
      if (!numbers.has(id.number)) continue;
      const official = id.type === "registration" || id.type === "tax";
      if (official && id.country === subject.country) {
        keep(hit(idx, entry, { status: "listed", basis: id.type === "tax" ? "tax" : "registration", matchedName: null, ruledOutBy: null, companyIdentifiers }));
      } else if (id.country === null) {
        // A bare number collides across countries: never `listed` (rule 4).
        keep(hit(idx, entry, { status: "possible_match", basis: "bare_number", matchedName: null, ruledOutBy: null, companyIdentifiers }));
      }
    }
  }

  // Rules 2, 3 and 5: names, with the second-identifier exclusion.
  for (const name of new Set(subject.names)) {
    for (const { entry, matched, kind } of candidates(idx, name)) {
      const differing = entry.identifiers.find((i) => i.type === "registration" && i.country === subject.country && !numbers.has(i.number)) ?? null;
      keep(
        hit(idx, entry, {
          status: differing ? "ruled_out" : "possible_match",
          basis: kind === "exact" ? "name_exact" : "name_fuzzy",
          matchedName: matched,
          ruledOutBy: differing,
          companyIdentifiers,
        }),
      );
    }
  }

  // The LV frozen-assets list names the company by its register code: a fact, `listed`.
  const frozen = db
    .prepare(
      `SELECT ev.date FROM main.events ev JOIN main.event_types t ON t.id = ev.type_id JOIN main.records r ON r.id = ev.record_id
       WHERE ev.entity_id = ? AND t.name = ? AND r.source_id = 'lv-fid-frozen' ORDER BY ev.date LIMIT 1`,
    )
    .get(subject.id, FROZEN_ASSETS) as { date: string } | undefined;
  const hits = [...byEntry.values()];
  if (frozen) {
    const list = idx.lists.get("lv-fid-frozen");
    hits.push({
      sourceId: "lv-fid-frozen",
      entryEid: subject.eid,
      status: "listed",
      basis: "frozen_assets",
      matchedName: null,
      companyIdentifiers,
      identifiers: subject.ids.filter((i) => i.number === normalizeId(subject.code ?? "")),
      ruledOutBy: null,
      names: [],
      programs: [],
      authority: "Finanšu izlūkošanas dienests",
      listingDate: frozen.date,
      asOf: list?.asOf ?? null,
      checkedAt: list?.checkedAt ?? null,
    });
  }
  hits.sort((a, b) => RANK[a.status] - RANK[b.status] || STORED_LISTS.indexOf(a.sourceId as (typeof STORED_LISTS)[number]) - STORED_LISTS.indexOf(b.sourceId as (typeof STORED_LISTS)[number]) || a.entryEid.localeCompare(b.entryEid));

  let officers: OfficerScreening | null = null;
  if (options.officerNames !== undefined) {
    if (personIndexState().length === 0) officers = { status: "not_screened_lists_loading" };
    else {
      const matches = options.officerNames.flatMap((n) => screenPersonName(n));
      const unique = [...new Map(matches.map((m) => [`${m.list}|${m.entryId}`, m])).values()];
      officers = { status: "screened", matches: unique.map((m) => ({ ...m, signal: "officer_sanctions_possible_match" as const })) };
    }
  }
  return { eid, naturalPerson: false, hits, officers, ownName: null, lists };
}

/**
 * The name-only form (rule 10; MCP and API `screen_sanctions`): the stored organisation entries
 * only, `possible_match` at most. It never reaches the person index, so it never returns an individual.
 */
export function screenName(db: DatabaseSync, name: string): SanctionsHit[] {
  const idx = index(db);
  return candidates(idx, name)
    .map(({ entry, matched, kind }) => hit(idx, entry, { status: "possible_match", basis: kind === "exact" ? "name_exact" : "name_fuzzy", matchedName: matched, ruledOutBy: null, companyIdentifiers: [] }))
    .sort((a, b) => Number(b.basis === "name_exact") - Number(a.basis === "name_exact") || a.entryEid.localeCompare(b.entryEid));
}
