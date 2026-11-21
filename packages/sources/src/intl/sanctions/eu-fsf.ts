// `eu-fsf`: the EU consolidated financial sanctions list (sanctions.md §1). Long-format CSV: one
// row per entry x name x address x birth date x identifier, grouped by Entity_LogicalId. An
// enterprise is stored for screening; a person goes to the in-memory person index only (§7a).
import { csvRows, columns } from "../../formats/csv.ts";
import { parserVersion } from "../../parser-version.ts";
import type { FieldMap, ParseContext, ParsedRecord, RawArtifact, SourceLoader, SourceMeta } from "../../types.ts";
import { countryCode } from "./countries.ts";
import { hostOf, isoDate, normalizeId, subjectRecord, type Identifier, type IdentifierType, type ListName } from "./shared.ts";

const ITEM = "S11.ALL.01";
const URL_FILE = "https://webgate.ec.europa.eu/fsd/fsf/public/files/csvFullSanctionsList_1_1/content?token=dG9rZW4tMjAxNw";

export const EU_FSF_META: SourceMeta = {
  id: "eu-fsf",
  country: "intl",
  publisher: "European Commission, Financial Sanctions Files",
  homepage: "https://data.europa.eu/data/datasets/consolidated-list-of-persons-groups-and-entities-subject-to-eu-financial-sanctions",
  officialHosts: ["webgate.ec.europa.eu", "data.europa.eu", "eur-lex.europa.eu"],
  licence: "eu-reuse-2011-833",
  attribution: "Source: European Commission, Financial Sanctions Files (FSF), consolidated list. © European Union",
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
  limits: { maxBytes: 60 * 1024 ** 2 },
  items: [ITEM],
};

const READ = [
  "fileGenerationDate",
  "Entity_LogicalId",
  "Entity_EU_ReferenceNumber",
  "Entity_UnitedNationId",
  "Entity_DesignationDate",
  "Entity_SubjectType_ClassificationCode",
  "Entity_Regulation_Programme",
  "Entity_Regulation_PublicationUrl",
  "NameAlias_WholeName",
  "NameAlias_NameLanguage",
  "Address_CountryIso2Code",
  "BirthDate_BirthDate",
  "BirthDate_Year",
  "Citizenship_CountryIso2Code",
  "Identification_Number",
  "Identification_TypeCode",
  "Identification_CountryIso2Code",
] as const;

export const EU_FSF_FIELD_MAP: FieldMap = [
  { field: "fileGenerationDate", target: { resolutionKey: "upstream_as_of" }, personal: false },
  { field: "Entity_LogicalId", target: { resolutionKey: "recordKey" }, personal: false },
  { field: "Entity_EU_ReferenceNumber", target: { prop: "authorityId" }, itemId: ITEM, personal: false },
  { field: "Entity_UnitedNationId", target: { prop: "unscId" }, itemId: ITEM, personal: false },
  { field: "Entity_DesignationDate", target: { prop: "listingDate" }, itemId: ITEM, personal: false },
  { field: "Entity_SubjectType_ClassificationCode", target: { resolutionKey: "subject_type" }, personal: false },
  { field: "Entity_Regulation_Programme", target: { prop: "program" }, itemId: ITEM, personal: false },
  { field: "Entity_Regulation_PublicationUrl", target: { prop: "sourceUrl" }, itemId: ITEM, personal: false },
  { field: "NameAlias_WholeName", target: { prop: "name" }, itemId: ITEM, personal: false },
  { field: "NameAlias_NameLanguage", target: { resolutionKey: "lang" }, personal: false },
  { field: "Address_CountryIso2Code", target: { prop: "country" }, itemId: ITEM, personal: false },
  { field: "BirthDate_BirthDate", target: { dropped: "person_entry" }, personal: true },
  { field: "BirthDate_Year", target: { dropped: "person_entry" }, personal: true },
  { field: "Citizenship_CountryIso2Code", target: { dropped: "person_entry" }, personal: true },
  { field: "Identification_Number", target: { prop: "number" }, itemId: ITEM, personal: false },
  { field: "Identification_TypeCode", target: { prop: "type" }, itemId: ITEM, personal: false },
  { field: "Identification_CountryIso2Code", target: { resolutionKey: "identifier_country" }, personal: false },
];

/** Identifier types read for enterprises; persons' documents are never read (`person_document`). */
const ID_TYPES: Record<string, IdentifierType> = { regnumber: "registration", fiscalcode: "tax", taxid: "tax", imo: "imo", swiftbic: "swift", other: "other" };

class SchemaChanged extends Error {
  override name = "schema_changed";
}

type Row = Record<(typeof READ)[number], string>;

function rows(raw: RawArtifact[]): Row[] {
  const first = raw[0];
  if (!first) return [];
  const it = csvRows(new TextDecoder().decode(first.bytes), ";");
  const header = it.next().value ?? [];
  const { at, missing } = columns(header, READ);
  if (missing.length > 0) throw new SchemaChanged();
  const out: Row[] = [];
  for (const cells of it) {
    const row = {} as Row;
    for (const name of READ) row[name] = (cells[at[name]] ?? "").trim();
    out.push(row);
  }
  return out;
}

/** The number before the list's own note: "892 (regnumber-Registration Number) (...)" is 892. */
const idNumber = (value: string) => normalizeId(value.split(" (")[0] ?? "");

function* entries(all: Row[], ctx: ParseContext): Generator<ParsedRecord> {
  const groups = new Map<string, Row[]>();
  for (const row of all) {
    if (!/^\d+$/.test(row.Entity_LogicalId)) continue;
    const group = groups.get(row.Entity_LogicalId);
    if (group) group.push(row);
    else groups.set(row.Entity_LogicalId, [row]);
  }
  for (const [id, group] of groups) {
    const head = group[0]!;
    const names = [...new Set(group.map((r) => r.NameAlias_WholeName).filter(Boolean))];
    const program = head.Entity_Regulation_Programme || null;
    const listDate = isoDate(head.Entity_DesignationDate);
    // Fail closed (legal on S06, S2): any person row sends the whole entry to the person index;
    // rows that disagree otherwise are dropped, so a person's name can never be stored as an alias.
    const kinds = new Set(group.map((r) => r.Entity_SubjectType_ClassificationCode));
    if (kinds.has("person")) {
      const years = group.map((r) => Number(r.BirthDate_Year || r.BirthDate_BirthDate.slice(0, 4))).filter((y) => y > 1800);
      ctx.onPerson?.({
        list: "eu-fsf",
        entryId: id,
        names,
        program,
        listDate,
        birthYear: years[0] ?? null,
        nationalities: [...new Set(group.map((r) => r.Citizenship_CountryIso2Code.toLowerCase()).filter(Boolean))],
      });
      ctx.onDrop?.("person_entry");
      continue;
    }
    if (kinds.size !== 1 || !kinds.has("enterprise") || names.length === 0) {
      ctx.onDrop?.("unknown_subject_type");
      continue;
    }
    const langOf = new Map(group.map((r) => [r.NameAlias_WholeName, r.NameAlias_NameLanguage.toLowerCase()]));
    const listNames: ListName[] = names.map((value, i) => {
      const lang = langOf.get(value);
      return { value, kind: i === 0 ? "name" : "alias", ...(lang ? { lang } : {}) };
    });
    const identifiers: Identifier[] = group.flatMap((r) => {
      const type = ID_TYPES[r.Identification_TypeCode];
      const number = idNumber(r.Identification_Number);
      return type && number ? [{ type, number, country: countryCode(r.Identification_CountryIso2Code) }] : [];
    });
    const url = head.Entity_Regulation_PublicationUrl;
    yield subjectRecord({
      list: "eu",
      id,
      itemId: ITEM,
      names: listNames,
      countries: group.map((r) => countryCode(r.Address_CountryIso2Code)).filter((c): c is string => c !== null),
      websites: [],
      identifiers,
      sanction: {
        authority: "European Union",
        authorityId: head.Entity_EU_ReferenceNumber || null,
        unscId: head.Entity_UnitedNationId || null,
        programs: program ? [program] : [],
        listingDate: listDate,
        sourceUrl: hostOf(url) === "eur-lex.europa.eu" ? url : null,
      },
    });
  }
}

export const euFsf: SourceLoader = {
  meta: EU_FSF_META,
  parserVersion: parserVersion(EU_FSF_META.id, 2, EU_FSF_FIELD_MAP, EU_FSF_META.items),
  fieldMap: EU_FSF_FIELD_MAP,
  async fetch(ctx) {
    const res = await ctx.fetcher(URL_FILE);
    return { artifacts: [{ name: "csvFullSanctionsList_1_1.csv", bytes: res.bytes, headers: res.headers, fetchedAt: ctx.now }] };
  },
  asOf(raw) {
    const first = raw[0];
    if (!first) return {};
    const it = csvRows(new TextDecoder().decode(first.bytes.subarray(0, 64 * 1024)), ";");
    const header = it.next().value ?? [];
    const row = it.next().value ?? [];
    const value = row[header.indexOf("fileGenerationDate")] ?? "";
    return { in_file_field: isoDate(value) };
  },
  parse(raw, ctx) {
    return entries(rows(raw), ctx);
  },
};
