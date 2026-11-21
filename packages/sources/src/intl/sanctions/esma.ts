// `esma-ncasp`: ESMA's interim register of non-compliant crypto-asset service providers
// (sanctions.md §5). One row per entry, kept only with a valid LEI (a name alone does not prove a
// legal entity) and stored as an `Organization` for screening by LEI, name and website.
// `ae_comments` is free text that may name people: it is never read.
import { isFixtureLei, isValidLei } from "@finora/domain";
import { csvRows, columns } from "@finora/formats";
import { parserVersion } from "../../parser-version.ts";
import type { FieldMap, ParseContext, ParsedRecord, RawArtifact, SourceLoader, SourceMeta } from "../../types.ts";
import { countryCode } from "./countries.ts";
import { hostOf, isoDate, subjectRecord, type ListName } from "./shared.ts";

const ITEM = "S11.ALL.03";
const URL_FILE = "https://www.esma.europa.eu/sites/default/files/2024-12/NCASP.csv";

export const ESMA_META: SourceMeta = {
  id: "esma-ncasp",
  country: "intl",
  publisher: "European Securities and Markets Authority",
  homepage: "https://www.esma.europa.eu/esmas-activities/digital-finance-and-innovation/markets-crypto-assets-regulation-mica",
  officialHosts: ["www.esma.europa.eu"],
  licence: "esma-reuse-notice",
  attribution: "Source: ESMA, interim MiCA register of non-compliant entities",
  storage: "store",
  cadence: "weekly",
  publishedAtUtc: null,
  asOf: ["max_date_in_data"],
  maxPurgeShare: 0.05,
  purgeScope: "full",
  deepLink: null,
  orderUrl: null,
  requires: [],
  limits: { maxBytes: 10 * 1024 ** 2 },
  items: [ITEM],
};

const READ = [
  "ae_competentAuthority",
  "ae_homeMemberState",
  "ae_lei_name",
  "ae_lei",
  "ae_commercial_name",
  "ae_website",
  "ae_infrigment",
  "ae_reason",
  "ae_decision_date",
  "ae_lastupdate",
] as const;

export const ESMA_FIELD_MAP: FieldMap = [
  { field: "ae_competentAuthority", target: { prop: "authority" }, itemId: ITEM, personal: false },
  { field: "ae_homeMemberState", target: { prop: "country" }, itemId: ITEM, personal: false },
  { field: "ae_lei_name", target: { prop: "name" }, itemId: ITEM, personal: false },
  { field: "ae_lei", target: { prop: "leiCode" }, itemId: ITEM, personal: false },
  { field: "ae_commercial_name", target: { prop: "alias" }, itemId: ITEM, personal: false },
  { field: "ae_website", target: { prop: "website" }, itemId: ITEM, personal: false },
  { field: "ae_infrigment", target: { prop: "reason" }, itemId: ITEM, personal: false },
  { field: "ae_reason", target: { prop: "reason" }, itemId: ITEM, personal: false },
  { field: "ae_decision_date", target: { prop: "listingDate" }, itemId: ITEM, personal: false },
  { field: "ae_lastupdate", target: { resolutionKey: "upstream_as_of" }, personal: false },
  { field: "ae_comments", target: { dropped: "free_text" }, personal: false },
];

class SchemaChanged extends Error {
  override name = "schema_changed";
}

type Row = Record<(typeof READ)[number], string>;

function read(raw: RawArtifact[]): Row[] {
  const first = raw[0];
  if (!first) return [];
  const it = csvRows(new TextDecoder().decode(first.bytes));
  const { at, missing } = columns(it.next().value ?? [], READ);
  if (missing.length > 0) throw new SchemaChanged();
  const rows: Row[] = [];
  for (const cells of it) {
    const row = {} as Row;
    for (const name of READ) row[name] = (cells[at[name]] ?? "").trim();
    rows.push(row);
  }
  return rows;
}

function* entries(rows: Row[], onDrop?: ParseContext["onDrop"]): Generator<ParsedRecord> {
  for (const row of rows) {
    const lei = row.ae_lei.toUpperCase();
    const leiOk = /^[A-Z0-9]{20}$/.test(lei) && (isValidLei(lei) || isFixtureLei(lei));
    const name = row.ae_lei_name || row.ae_commercial_name;
    if (!name) continue;
    // Only a valid LEI proves the row is a legal entity: a name alone, even a company-like one, could
    // be a person trading under it (legal on S06, SEC-4).
    if (!leiOk) {
      onDrop?.("unproven_party");
      continue;
    }
    const names: ListName[] = [{ value: name, kind: "name" }, ...(row.ae_commercial_name && row.ae_commercial_name !== name ? [{ value: row.ae_commercial_name, kind: "alias" as const }] : [])];
    const record = subjectRecord({
      list: "esma",
      id: lei,
      itemId: ITEM,
      names,
      countries: [],
      websites: row.ae_website.split(/[\s;,]+/).map(hostOf).filter((h): h is string => h !== null),
      lei,
      identifiers: [],
      sanction: {
        authority: row.ae_competentAuthority || "ESMA",
        programs: [],
        listingDate: isoDate(row.ae_decision_date),
        reason: [row.ae_infrigment, row.ae_reason].filter(Boolean).join("; ") || null,
        country: countryCode(row.ae_homeMemberState),
      },
    });
    yield { ...record, hashInput: READ.map((c) => row[c]) };
  }
}

export const esmaNcasp: SourceLoader = {
  meta: ESMA_META,
  parserVersion: parserVersion(ESMA_META.id, 3, ESMA_FIELD_MAP, ESMA_META.items),
  fieldMap: ESMA_FIELD_MAP,
  async fetch(ctx) {
    const res = await ctx.fetcher(URL_FILE);
    return { artifacts: [{ name: "NCASP.csv", bytes: res.bytes, headers: res.headers, fetchedAt: ctx.now }] };
  },
  asOf(raw) {
    const dates = read(raw).map((r) => isoDate(r.ae_lastupdate)).filter((d): d is string => d !== null);
    return { max_date_in_data: dates.sort().at(-1) ?? null };
  },
  parse(raw, ctx) {
    return entries(read(raw), ctx.onDrop);
  },
};
