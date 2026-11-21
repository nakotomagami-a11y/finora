// `uk-sanctions-list`: the UK Sanctions List CSV (sanctions.md §3). Line 1 is the report date, line
// 2 the header; one row per name variant, grouped by Unique ID. Entities are stored for screening;
// individuals go to the in-memory person index only (§7a); ships are not loaded.
import { csvRows, columns } from "@finora/formats";
import { parserVersion } from "../../parser-version.ts";
import type { FieldMap, ParseContext, ParsedRecord, RawArtifact, SourceLoader, SourceMeta } from "../../types.ts";
import { countryCode } from "./countries.ts";
import { hostOf, isoDate, normalizeId, subjectRecord, type Identifier, type ListName } from "./shared.ts";

const ITEM = "S11.ALL.02";
const URL_FILE = "https://sanctionslist.fcdo.gov.uk/docs/UK-Sanctions-List.csv";

export const UK_META: SourceMeta = {
  id: "uk-sanctions-list",
  country: "intl",
  publisher: "UK Foreign, Commonwealth and Development Office",
  homepage: "https://www.gov.uk/government/publications/the-uk-sanctions-list",
  officialHosts: ["sanctionslist.fcdo.gov.uk", "www.gov.uk", "assets.publishing.service.gov.uk"],
  licence: "ogl-uk-3.0",
  attribution: "Contains public sector information licensed under the Open Government Licence v3.0. Source: UK Sanctions List, FCDO",
  storage: "store",
  cadence: "daily",
  publishedAtUtc: null,
  asOf: ["in_file_field"],
  maxPurgeShare: 0.02,
  purgeScope: "full",
  deepLink: null,
  rawCache: false,
  personIndex: true,
  orderUrl: null,
  requires: [],
  limits: { maxBytes: 150 * 1024 ** 2 },
  items: [ITEM],
};

const NAME_PARTS = ["Name 1", "Name 2", "Name 3", "Name 4", "Name 5", "Name 6"] as const;
const READ = [
  "Unique ID",
  "OFSI Group ID",
  "UN Reference Number",
  ...NAME_PARTS,
  "Name type",
  "Alias strength",
  "Name non-latin script",
  "Non-latin script language",
  "Regime Name",
  "Designation Type",
  "Date Designated",
  "D.O.B",
  "Nationality(/ies)",
  "Business registration number (s)",
  "Address Country",
  "Website",
] as const;

export const UK_FIELD_MAP: FieldMap = [
  { field: "Report Date", target: { resolutionKey: "upstream_as_of" }, personal: false },
  { field: "Unique ID", target: { resolutionKey: "recordKey" }, personal: false },
  { field: "OFSI Group ID", target: { prop: "authorityId" }, itemId: ITEM, personal: false },
  { field: "UN Reference Number", target: { prop: "unscId" }, itemId: ITEM, personal: false },
  ...NAME_PARTS.map((field) => ({ field, target: { prop: "name" }, itemId: ITEM, personal: false })),
  { field: "Name type", target: { prop: "alias" }, itemId: ITEM, personal: false },
  { field: "Alias strength", target: { prop: "weakAlias" }, itemId: ITEM, personal: false },
  { field: "Name non-latin script", target: { prop: "previousName" }, itemId: ITEM, personal: false },
  { field: "Non-latin script language", target: { resolutionKey: "lang" }, personal: false },
  { field: "Regime Name", target: { prop: "program" }, itemId: ITEM, personal: false },
  { field: "Designation Type", target: { resolutionKey: "subject_type" }, personal: false },
  { field: "Date Designated", target: { prop: "listingDate" }, itemId: ITEM, personal: false },
  { field: "D.O.B", target: { dropped: "person_entry" }, personal: true },
  { field: "Nationality(/ies)", target: { dropped: "person_entry" }, personal: true },
  { field: "Business registration number (s)", target: { prop: "number" }, itemId: ITEM, personal: false },
  { field: "Address Country", target: { prop: "country" }, itemId: ITEM, personal: false },
  { field: "Website", target: { prop: "website" }, itemId: ITEM, personal: false },
];

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** "Report Date: 17-Nov-2026" to ISO. */
function reportDate(line: string): string | null {
  const m = /^﻿?Report Date:\s*(\d{1,2})-([A-Za-z]{3})-(\d{4})/.exec(line.trim());
  const month = m ? MONTHS.indexOf(m[2]!.toLowerCase()) + 1 : 0;
  return m && month > 0 ? `${m[3]}-${String(month).padStart(2, "0")}-${m[1]!.padStart(2, "0")}` : null;
}

class SchemaChanged extends Error {
  override name = "schema_changed";
}

type Row = Record<(typeof READ)[number], string>;

function read(raw: RawArtifact[]): { reportDate: string | null; rows: Row[] } {
  const first = raw[0];
  if (!first) return { reportDate: null, rows: [] };
  const it = csvRows(new TextDecoder().decode(first.bytes));
  const date = reportDate((it.next().value ?? []).join(","));
  const { at, missing } = columns(it.next().value ?? [], READ);
  if (date === null || missing.length > 0) throw new SchemaChanged();
  const rows: Row[] = [];
  for (const cells of it) {
    const row = {} as Row;
    for (const name of READ) row[name] = (cells[at[name]] ?? "").trim();
    rows.push(row);
  }
  return { reportDate: date, rows };
}

/**
 * "UK Company no. 06527449", "(INN): 190950894 (Belarus), 7704734000/770301001 (Russia)": each
 * piece's numbers of five characters or more, its country from the trailing parentheses, else
 * the entry's single address country.
 */
function registrations(value: string, fallback: string | null): Identifier[] {
  return value.split(/[;,]/).flatMap((piece) => {
    const named = /\(([^()]+)\)\s*$/.exec(piece.trim())?.[1];
    const country = (named ? countryCode(named) : null) ?? (/\bUK\b/.test(piece) ? "gb" : fallback);
    const body = named ? piece.trim().slice(0, -named.length - 2) : piece;
    return body
      .split(/[\s/:]+/)
      .map(normalizeId)
      .filter((t) => t.length >= 5 && /\d/.test(t) && /^[A-Z0-9]+$/.test(t))
      .map((number) => ({ type: "registration" as const, number, country }));
  });
}

const fullName = (row: Row) => NAME_PARTS.map((p) => row[p]).filter(Boolean).join(" ");

function* entries(rows: Row[], ctx: ParseContext): Generator<ParsedRecord> {
  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    if (!row["Unique ID"]) continue;
    const group = groups.get(row["Unique ID"]);
    if (group) group.push(row);
    else groups.set(row["Unique ID"], [row]);
  }
  for (const [id, group] of groups) {
    const head = group[0]!;
    // Fail closed (S06 security review, SEC-3; as eu-fsf): any Individual row sends the whole
    // designation to the person index; rows that disagree otherwise are dropped, so a person's name
    // can never be stored as an organisation's alias.
    const kinds = new Set(group.map((r) => r["Designation Type"].toLowerCase()));
    const kind = kinds.has("individual") ? "individual" : kinds.size === 1 ? head["Designation Type"].toLowerCase() : "mixed";
    const listDate = isoDate(head["Date Designated"]);
    const program = head["Regime Name"] || null;
    const primaryFirst = [...group].sort((a, b) => Number(b["Name type"].toLowerCase() === "primary name") - Number(a["Name type"].toLowerCase() === "primary name"));
    if (kind === "individual") {
      const year = /(\d{4})\s*$/.exec(head["D.O.B"])?.[1];
      ctx.onPerson?.({
        list: "uk-sanctions-list",
        entryId: id,
        names: [...new Set(primaryFirst.flatMap((r) => [fullName(r), r["Name non-latin script"]]).filter(Boolean))],
        program,
        listDate,
        birthYear: year ? Number(year) : null,
        nationalities: [...new Set(head["Nationality(/ies)"].split(/[,;]/).map((n) => countryCode(n)).filter((c): c is string => c !== null))],
      });
      ctx.onDrop?.("person_entry");
      continue;
    }
    if (kind === "ship") {
      ctx.onDrop?.("subject_out_of_scope");
      continue;
    }
    const names: ListName[] = primaryFirst.flatMap((r, i): ListName[] => {
      const type = r["Name type"].toLowerCase();
      const value = fullName(r);
      const kindOf: ListName["kind"] = i === 0 ? "name" : r["Alias strength"].toLowerCase().startsWith("low") ? "weakAlias" : "alias";
      const latin: ListName[] = value && (type !== "" || i === 0) ? [{ value, kind: kindOf }] : [];
      const lang = r["Non-latin script language"].toLowerCase();
      const script = r["Name non-latin script"];
      return [...latin, ...(script ? [{ value: script, kind: "alias" as const, ...(lang ? { lang } : {}) }] : [])];
    });
    if (kind !== "entity" || names.length === 0) {
      ctx.onDrop?.("unknown_subject_type");
      continue;
    }
    if (names[0]!.kind !== "name") names[0] = { ...names[0]!, kind: "name" };
    const countries = [...new Set(group.map((r) => countryCode(r["Address Country"])).filter((c): c is string => c !== null))];
    yield subjectRecord({
      list: "uk",
      id,
      itemId: ITEM,
      names,
      countries,
      websites: group.map((r) => hostOf(r.Website)).filter((h): h is string => h !== null),
      identifiers: registrations(head["Business registration number (s)"], countries.length === 1 ? countries[0]! : null),
      sanction: {
        authority: "United Kingdom",
        authorityId: head["OFSI Group ID"] || null,
        unscId: head["UN Reference Number"] || null,
        programs: program ? [program] : [],
        listingDate: listDate,
      },
    });
  }
}

export const ukSanctionsList: SourceLoader = {
  meta: UK_META,
  parserVersion: parserVersion(UK_META.id, 1, UK_FIELD_MAP, UK_META.items),
  fieldMap: UK_FIELD_MAP,
  async fetch(ctx) {
    const res = await ctx.fetcher(URL_FILE);
    return { artifacts: [{ name: "UK-Sanctions-List.csv", bytes: res.bytes, headers: res.headers, fetchedAt: ctx.now }] };
  },
  asOf(raw) {
    const first = raw[0];
    if (!first) return {};
    const line = new TextDecoder().decode(first.bytes.subarray(0, 200)).split(/\r?\n/)[0] ?? "";
    return { in_file_field: reportDate(line) };
  },
  parse(raw, ctx) {
    return entries(read(raw).rows, ctx);
  },
};
