// The in-memory person index (sanctions.md §7a; architecture §3.5 person view; LAW-SANCTIONS-PERSONS).
// Listed individuals from the EU, OFAC and UK lists live here only: never in the store, a cache
// file, a log line or an export. A match gives only the citation fields and its status.
import { nameKey, namesMatch, nameTokens } from "./names.ts";

/** One listed individual, as the parse hands it over (structurally the sources' `PersonEntry`). */
export type ListedPerson = {
  list: string;
  entryId: string;
  names: readonly string[];
  program: string | null;
  listDate: string | null;
  birthYear: number | null;
  nationalities: readonly string[];
};
export type PersonList = { asOf: string; loadedAt: string; entries: readonly ListedPerson[] };

/** All a match ever yields; no name, birth date or nationality from the list (§7a). */
export type PersonCitation = { list: string; entryId: string; listDate: string | null; status: "possible_match" };

type Held = { list: PersonList; byToken: Map<string, { entry: ListedPerson; names: string[] }[]> };
const held = new Map<string, Held>();

export function setPersonList(sourceId: string, list: PersonList): void {
  const byToken = new Map<string, { entry: ListedPerson; names: string[] }[]>();
  for (const entry of list.entries) {
    const names = [...new Set(entry.names.map(nameKey).filter(Boolean))];
    const ref = { entry, names };
    for (const token of new Set(names.flatMap((n) => n.split(" ")))) {
      const bucket = byToken.get(token);
      if (bucket) bucket.push(ref);
      else byToken.set(token, [ref]);
    }
  }
  held.set(sourceId, { list, byToken });
}

export const personListHeld = (sourceId: string) => held.has(sourceId);

export function clearPersonList(sourceId: string): void {
  held.delete(sourceId);
}

/** Counts only, for check 9's coverage note: which lists are held, as of when, how many entries. */
export function personIndexState(): { sourceId: string; asOf: string; entries: number }[] {
  return [...held].map(([sourceId, h]) => ({ sourceId, asOf: h.list.asOf, entries: h.list.entries.length })).sort((a, b) => a.sourceId.localeCompare(b.sourceId));
}

/**
 * Screens one person's name (a current officer behind the purpose gate, or a sole trader's own
 * name): `possible_match` at most, never `listed` or `ruled_out` (rules 4, 5, 8, 9).
 */
export function screenPersonName(name: string): PersonCitation[] {
  const tokens = nameTokens(name);
  const out: PersonCitation[] = [];
  const seen = new Set<string>();
  for (const [sourceId, h] of held) {
    for (const token of tokens) {
      for (const { entry, names } of h.byToken.get(token) ?? []) {
        const key = `${sourceId}|${entry.entryId}`;
        if (seen.has(key) || !names.some((n) => namesMatch(n, tokens.join(" ")))) continue;
        seen.add(key);
        out.push({ list: entry.list, entryId: entry.entryId, listDate: entry.listDate, status: "possible_match" });
      }
    }
  }
  return out.sort((a, b) => a.list.localeCompare(b.list) || a.entryId.localeCompare(b.entryId));
}
