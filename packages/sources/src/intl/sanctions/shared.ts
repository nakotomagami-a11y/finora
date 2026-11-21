// What every stored list entry becomes (sanctions.md §6): an `Organization` subject, its
// `Sanction` and its `Identification` rows, all keyed `sanc-<list>-<id>`, never a `Person`.
// Listed individuals never reach this file: the loaders hand them to the person index (§7a).
import type { ParsedEntity, ParsedRecord, ParsedStatement } from "../../types.ts";

export type IdentifierType = "registration" | "tax" | "lei" | "imo" | "swift" | "other";
export type Identifier = { type: IdentifierType; number: string; country: string | null };
export type ListName = { value: string; kind: "name" | "alias" | "previousName" | "weakAlias"; lang?: string };

export type Subject = {
  list: "eu" | "ofac" | "uk" | "esma" | "lvfid";
  id: string;
  itemId: string;
  names: ListName[];
  countries: string[];
  websites: string[];
  lei?: string | null;
  identifiers: Identifier[];
  incorporationDate?: string | null;
  sanction: {
    authority: string;
    authorityId?: string | null;
    unscId?: string | null;
    programs: string[];
    listingDate?: string | null;
    sourceUrl?: string | null;
    reason?: string | null;
    country?: string | null;
  };
};

/** An identifier number as screening compares it: upper-case, without spaces and `-./`. */
export const normalizeId = (value: string) => value.toUpperCase().replace(/[\s\-./]/g, "");

/** A website's host, lower-case and without `www.`; null for anything that is not a web address. */
export function hostOf(value: string): string | null {
  const raw = value.trim();
  if (!raw || /\s/.test(raw)) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (!url.hostname.includes(".")) return null;
    return url.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** `DD/MM/YYYY`, `DD.MM.YYYY` or ISO to ISO; null for anything else (partial dates too). */
export function isoDate(value: string): string | null {
  const v = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = /^(\d{1,2})[./](\d{1,2})[./](\d{4})\.?$/.exec(v);
  if (!dmy) return null;
  return `${dmy[3]}-${dmy[2]!.padStart(2, "0")}-${dmy[1]!.padStart(2, "0")}`;
}

const uniq = <T>(values: readonly T[]) => [...new Set(values)];

export function subjectRecord(s: Subject): ParsedRecord {
  const eid = `sanc-${s.list}-${s.id}`;
  const st = (prop: string, value: string | null | undefined, lang?: string): ParsedStatement[] =>
    value ? [{ prop, value, itemId: s.itemId, ...(lang ? { lang } : {}) }] : [];
  const seen = new Set<string>();
  const names = s.names.filter((n) => {
    const key = n.value.toLowerCase();
    if (!n.value || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const subject: ParsedEntity = {
    eid,
    schema: "Organization",
    country: "intl",
    statements: [
      ...names.flatMap((n) => st(n.kind, n.value, n.lang)),
      ...uniq(s.countries).flatMap((c) => st("country", c)),
      ...uniq(s.websites).flatMap((w) => st("website", w)),
      ...st("leiCode", s.lei),
      ...st("incorporationDate", s.incorporationDate),
    ],
  };
  const sanction: ParsedEntity = {
    eid: `${eid}-s`,
    schema: "Sanction",
    country: "intl",
    statements: [
      ...st("entity", eid),
      ...st("authority", s.sanction.authority),
      ...st("authorityId", s.sanction.authorityId),
      ...st("unscId", s.sanction.unscId),
      ...uniq(s.sanction.programs).flatMap((p) => st("program", p)),
      ...st("listingDate", s.sanction.listingDate),
      ...st("sourceUrl", s.sanction.sourceUrl),
      ...st("reason", s.sanction.reason),
      ...st("country", s.sanction.country),
    ],
  };
  const ids = uniq(s.identifiers.filter((i) => i.number).map((i) => JSON.stringify([i.type, i.number, i.country])))
    .sort()
    .map(
    (key) => JSON.parse(key) as [IdentifierType, string, string | null],
  );
  // An identifier's entity carries its issuing country, so an LV register code reads as one (P3 scan).
  const identifiers: ParsedEntity[] = ids.map(([type, number, country], n) => ({
    eid: `${eid}-i${n}`,
    schema: "Identification",
    country: country ?? "intl",
    statements: [...st("holder", eid), ...st("type", type), ...st("number", number), ...st("country", country)],
  }));
  const entities = [subject, sanction, ...identifiers];
  const hashInput = uniq(entities.flatMap((e) => e.statements.map((x) => `${e.eid}|${x.prop}|${x.lang ?? ""}|${x.value}`))).sort();
  return { recordKey: s.id, hashInput, entities, rowRef: `entry ${s.id}` };
}
