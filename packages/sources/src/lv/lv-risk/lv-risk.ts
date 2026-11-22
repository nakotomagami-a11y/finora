// The Latvian register's risk files (lv-risk.md): insolvency proceedings, securing measures,
// suspensions and the sanctions-links file. Each row becomes events on an existing register entity:
// these sources never create an entity. The pipeline drops S09 events on natural-person entities;
// a sanctions link loads only through the party gate on its subject, and a sanctioned person's
// name, nationality, birth date and code are never kept.
import { createHash } from "node:crypto";
import { LEGAL_FORMS, legalForm, type DropReason } from "@finora/domain";
import { parserVersion } from "../../parser-version.ts";
import type { EventInput, FieldMap, ParseContext, ParsedRecord, RawArtifact, SourceLoader, SourceMeta } from "../../types.ts";
import { artifact, caseNumber, cleanCode, closedValue, fetchCkanFile, isoDate, lvAsOf, lvCodeProblem, LV_DEEP_LINK, LV_REGISTER_HOSTS, readCsv, type CsvRecord } from "../shared.ts";

const S09 = "S09.LV.01";
const S11 = "S11.LV.01";

/** The Court Administration portal: a link target for S09 case numbers only, never fetched. */
const COURT_PORTAL_HOST = "manas.tiesas.lv";

const meta = (id: string, title: string, items: string[]): SourceMeta => ({
  id,
  country: "lv",
  publisher: "Uzņēmumu reģistrs (Register of Enterprises of the Republic of Latvia)",
  homepage: "https://www.ur.gov.lv",
  officialHosts: [...LV_REGISTER_HOSTS, COURT_PORTAL_HOST],
  licence: "cc0-1.0",
  attribution: `Source: Register of Enterprises of the Republic of Latvia, ${title}, data.gov.lv, CC0 1.0`,
  storage: "store",
  // M6 (S05 review): LV files hold natural persons or sole traders, so no LV file is kept in the raw cache.
  rawCache: false,
  cadence: "daily",
  publishedAtUtc: "21:40",
  asOf: ["max_date_in_data", "portal_metadata", "http_last_modified"],
  maxPurgeShare: 0.02,
  purgeScope: "full",
  deepLink: LV_DEEP_LINK,
  orderUrl: null,
  requires: [],
  limits: { requestsPerSecond: 2, maxBytes: 50 * 1024 ** 2 },
  items,
});

/** The LV legal-form table the gates depend on: a change to it re-parses (lv-risk.md § Source). */
const LV_FORMS = createHash("sha256")
  .update(JSON.stringify(LEGAL_FORMS.filter((f) => f.country === "lv")))
  .digest("hex")
  .slice(0, 8);

const today = (raw: RawArtifact[]) => (raw[0]?.fetchedAt ?? new Date().toISOString()).slice(0, 10);

type Dropped = { reason: DropReason; prop?: string };

/** The code of a row's subject, or null after counting why the row is skipped. */
function subjectOf(row: CsvRecord, column: string, ctx: ParseContext): string | null {
  const code = cleanCode(row.get(column));
  const problem = lvCodeProblem(code);
  if (problem) {
    ctx.onDrop?.(problem);
    return null;
  }
  return code;
}

type Family = {
  id: string;
  slug: string;
  file: string;
  title: string;
  items: string[];
  columns: readonly string[];
  dateColumn: string;
  fieldMap: FieldMap;
  revision: number;
  row: (row: CsvRecord, ctx: ParseContext) => ParsedRecord | null;
};

function loader(f: Family): SourceLoader {
  const m = meta(f.id, f.title, f.items);
  return {
    meta: m,
    parserVersion: `${parserVersion(f.id, f.revision, f.fieldMap, f.items)}-${LV_FORMS}`,
    fieldMap: f.fieldMap,
    fetch: async (ctx) => ({ artifacts: await fetchCkanFile(ctx, f.slug, f.file) }),
    asOf: (raw) =>
      lvAsOf(
        raw,
        f.file,
        function* (file) {
          for (const row of readCsv(file, ";", [f.dateColumn])) yield row.get(f.dateColumn);
        },
        today(raw),
      ),
    *parse(raw, ctx) {
      for (const row of readCsv(artifact(raw, f.file), ";", f.columns)) {
        const record = f.row(row, ctx);
        if (record) yield record;
      }
    },
  };
}

const withDropped = (record: ParsedRecord, dropped: Dropped[]): ParsedRecord => (dropped.length > 0 ? { ...record, dropped } : record);

// ---------------------------------------------------------------- lv-ur-insolvency

export const LV_UR_INSOLVENCY_FIELD_MAP: FieldMap = [
  { field: "proceeding_id", target: { resolutionKey: "recordKey" }, personal: false },
  { field: "debtor_registration_number", target: { resolutionKey: "registrationNumber" }, personal: false },
  { field: "proceeding_started_on", target: { event: "register.insolvency_opened" }, itemId: S09, personal: false },
  { field: "proceeding_ended_on", target: { event: "register.insolvency_closed" }, itemId: S09, personal: false },
  { field: "proceeding_form", target: { event: "register.insolvency_opened" }, itemId: S09, personal: false },
  { field: "proceeding_type", target: { event: "register.insolvency_opened" }, itemId: S09, personal: false },
  { field: "proceeding_subtype", target: { event: "register.insolvency_opened" }, itemId: S09, personal: false },
  { field: "proceeding_resolution_type", target: { event: "register.insolvency_closed" }, itemId: S09, personal: false },
  { field: "court_case_initial_number", target: { event: "register.insolvency_opened" }, itemId: S09, personal: false },
  { field: "court_name", target: { event: "register.insolvency_opened" }, itemId: S09, personal: false },
  { field: "entry_created_on", target: { resolutionKey: "as_of" }, personal: false },
];

const INSOLVENCY_COLUMNS = [
  "proceeding_id", "debtor_registration_number", "proceeding_started_on", "proceeding_ended_on", "proceeding_form", "proceeding_type",
  "proceeding_subtype", "proceeding_resolution_type", "court_case_initial_number", "court_name", "entry_created_on",
] as const;
const PROCEEDING_FORMS = new Set(["INSOLVENCY", "LEGAL_PROTECTION", "OUT_OF_COURT_LEGAL_PROTECTION"]);
const PROCEEDING_TYPES = new Set(["NATIONAL", "CROSS_BORDER"]);
const PROCEEDING_SUBTYPES = new Set(["MAIN", "SECONDARY"]);

function insolvencyRow(row: CsvRecord, ctx: ParseContext): ParsedRecord | null {
  const code = subjectOf(row, "debtor_registration_number", ctx);
  if (code === null) return null;
  const opened = isoDate(row.get("proceeding_started_on"));
  if (!opened) {
    ctx.onDrop?.("invalid_record");
    return null;
  }
  const closed = isoDate(row.get("proceeding_ended_on"));
  const dropped: Dropped[] = [];
  const form = closedValue(PROCEEDING_FORMS, row.get("proceeding_form"), "proceeding_form", dropped);
  const scope = row.get("proceeding_type") ? closedValue(PROCEEDING_TYPES, row.get("proceeding_type"), "proceeding_type", dropped) : null;
  const subtype = row.get("proceeding_subtype") ? closedValue(PROCEEDING_SUBTYPES, row.get("proceeding_subtype"), "proceeding_subtype", dropped) : null;
  // The resolution is a register code (`M06`, `T14`): anything else is not stored.
  const rawResolution = row.get("proceeding_resolution_type");
  const resolution = /^[A-Z]\d{2}$/.test(rawResolution) ? rawResolution : null;
  if (rawResolution && !resolution) dropped.push({ reason: "unknown_enum", prop: "proceeding_resolution_type" });
  const entityEid = `lv-${code}`;
  const shared = { form, scope, subtype };
  const courtCase = caseNumber(row.get("court_case_initial_number"), "court_case_initial_number", dropped);
  const events: EventInput[] = [
    { entityEid, type: "register.insolvency_opened", date: opened, itemId: S09, data: { ...shared, courtCase, court: row.get("court_name") || null } },
  ];
  if (closed) events.push({ entityEid, type: "register.insolvency_closed", date: closed, itemId: S09, data: { ...shared, resolution } });
  return withDropped(
    {
      recordKey: row.get("proceeding_id"),
      rowRef: `line ${row.line}`,
      hashInput: [`lv-${code}`, ...INSOLVENCY_COLUMNS.slice(2, 10).map((c) => row.get(c))],
      entities: [],
      events,
    },
    dropped,
  );
}

// ---------------------------------------------------------------- lv-ur-securing-measures

export const LV_UR_SECURING_MEASURES_FIELD_MAP: FieldMap = [
  { field: "id", target: { resolutionKey: "recordKey" }, personal: false },
  { field: "legal_entity_registration_number", target: { resolutionKey: "registrationNumber" }, personal: false },
  { field: "securing_measure_type", target: { event: "register.securing_measure" }, itemId: S09, personal: false },
  { field: "date_from", target: { event: "register.securing_measure" }, itemId: S09, personal: false },
  { field: "case_number", target: { event: "register.securing_measure" }, itemId: S09, personal: false },
  { field: "institution_registration_number", target: { event: "register.securing_measure" }, itemId: S09, personal: false },
  { field: "institution_name", target: { dropped: "free_text" }, personal: true },
  { field: "type_details", target: { dropped: "free_text" }, personal: true },
];

const MEASURE_TYPES = new Set(["PROHIBITION", "LIEN", "ATTACHMENT"]);

/**
 * The imposing institution's own code, only with a register check digit: many are sworn bailiffs,
 * who are natural persons, so anything else is never kept. A public body sits in the public-persons
 * register, not the enterprise register, so this is a bare code: as an `lv-` id it would stay an
 * unresolved reference on every sync (S05 ruling 4).
 */
function authorityOf(value: string): string | null {
  const code = cleanCode(value);
  return code !== "" && lvCodeProblem(code) === null ? code : null;
}

function securingRow(row: CsvRecord, ctx: ParseContext): ParsedRecord | null {
  const code = subjectOf(row, "legal_entity_registration_number", ctx);
  if (code === null) return null;
  const date = isoDate(row.get("date_from"));
  if (!date) {
    ctx.onDrop?.("invalid_record");
    return null;
  }
  const dropped: Dropped[] = [];
  const kind = closedValue(MEASURE_TYPES, row.get("securing_measure_type"), "securing_measure_type", dropped);
  const authority = authorityOf(row.get("institution_registration_number"));
  const caseNo = caseNumber(row.get("case_number"), "case_number", dropped);
  dropped.push(
    ...(row.get("institution_name") ? [{ reason: "free_text" as const, prop: "institution_name" }] : []),
    ...(row.get("type_details") ? [{ reason: "free_text" as const, prop: "type_details" }] : []),
  );
  return withDropped(
    {
      recordKey: row.get("id"),
      rowRef: `line ${row.line}`,
      hashInput: [`lv-${code}`, kind, date, caseNo ?? "", authority ?? ""],
      entities: [],
      events: [{ entityEid: `lv-${code}`, type: "register.securing_measure", date, itemId: S09, data: { kind, case: caseNo, authorityCode: authority } }],
    },
    dropped,
  );
}

// ---------------------------------------------------------------- lv-ur-suspensions

export const LV_UR_SUSPENSIONS_FIELD_MAP: FieldMap = [
  { field: "id", target: { resolutionKey: "recordKey" }, personal: false },
  { field: "legal_entity_registration_number", target: { resolutionKey: "registrationNumber" }, personal: false },
  { field: "suspension_code", target: { event: "register.suspension" }, itemId: S09, personal: false },
  { field: "date_from", target: { event: "register.suspension" }, itemId: S09, personal: false },
  { field: "ground_for", target: { dropped: "free_text" }, personal: true },
];

const SUSPENSION_CODES = new Set(["ECONOMIC_ACTIVITY_SUSPENDED", "ACTIVITY_SUSPENDED", "PROHIBITION_ON_PUBLIC_ACTIVITY"]);

function suspensionRow(row: CsvRecord, ctx: ParseContext): ParsedRecord | null {
  const code = subjectOf(row, "legal_entity_registration_number", ctx);
  if (code === null) return null;
  const date = isoDate(row.get("date_from"));
  if (!date) {
    ctx.onDrop?.("invalid_record");
    return null;
  }
  const dropped: Dropped[] = [];
  const kind = closedValue(SUSPENSION_CODES, row.get("suspension_code"), "suspension_code", dropped);
  if (row.get("ground_for")) dropped.push({ reason: "free_text", prop: "ground_for" });
  return withDropped(
    {
      recordKey: row.get("id"),
      rowRef: `line ${row.line}`,
      hashInput: [`lv-${code}`, kind, date],
      entities: [],
      events: [{ entityEid: `lv-${code}`, type: "register.suspension", date, itemId: S09, data: { kind, authority: "ur" } }],
    },
    dropped,
  );
}

// ---------------------------------------------------------------- lv-ur-sanctions-links

export const LV_UR_SANCTIONS_LINKS_FIELD_MAP: FieldMap = [
  { field: "id", target: { resolutionKey: "recordKey" }, personal: false },
  { field: "sanctions_subject_registration_number", target: { resolutionKey: "party_code" }, personal: false },
  { field: "position", target: { event: "register.sanctions_link" }, itemId: S11, personal: false },
  { field: "entity_type", target: { event: "register.sanctions_link" }, itemId: S11, personal: false },
  { field: "legal_form_code", target: { resolutionKey: "party_gate" }, personal: false },
  { field: "legal_entity_registration_number", target: { event: "register.sanctions_link" }, itemId: S11, personal: false },
  { field: "legal_entity_name", target: { event: "register.sanctions_link" }, itemId: S11, personal: false },
  { field: "legal_entity_country", target: { event: "register.sanctions_link" }, itemId: S11, personal: false },
  { field: "list", target: { event: "register.sanctions_link" }, itemId: S11, personal: false },
  { field: "program", target: { event: "register.sanctions_link" }, itemId: S11, personal: false },
  { field: "entry_date", target: { event: "register.sanctions_link" }, itemId: S11, personal: false },
  { field: "legal_base_url", target: { event: "register.sanctions_link" }, itemId: S11, personal: false },
  { field: "registered_on", target: { event: "register.sanctions_link" }, itemId: S11, personal: false },
  { field: "name", target: { dropped: "natural_person_party" }, personal: true },
  { field: "nationality", target: { dropped: "natural_person_party" }, personal: true },
  { field: "birth_date", target: { dropped: "personal_code" }, personal: true },
  { field: "latvian_identity_number_masked", target: { dropped: "personal_code" }, personal: true },
];

const SANCTIONS_COLUMNS = [
  "id", "registered_on", "entity_type", "name", "birth_date", "latvian_identity_number_masked", "nationality", "legal_form_code",
  "legal_entity_registration_number", "legal_entity_name", "legal_entity_country", "position", "sanctions_subject_registration_number",
  "list", "program", "entry_date", "legal_base_url",
] as const;
const LINK_POSITIONS = new Set([
  "BENEFICIAL_OWNER", "SHAREHOLDER", "MEMBER_OF_THE_BOARD", "CHAIRPERSON_OF_THE_BOARD", "FOUNDER", "OWNER", "PARTNER",
  "PERSON_ACTUALLY_EXERCISING_CONTROL", "BENEFICIARY_CONTROL_LEGAL_ENTITY", "HUSBAND",
]);
const LISTS = new Set(["ES_SANCTIONS", "LV_SANCTIONS", "SDN_OFAC_SANCTIONS"]);
const PARTY_TYPES: Readonly<Record<string, string>> = { NATURAL_PERSON: "person", LEGAL_ENTITY: "company", FOREIGN_ENTITY: "foreign_company" };

/** Hosts a legal-base link may point at: the EU and Latvian official journals. */
export const LEGAL_BASE_HOSTS = ["eur-lex.europa.eu", "likumi.lv", "www.likumi.lv", "vestnesis.lv", "www.vestnesis.lv"];

function allowedLink(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && LEGAL_BASE_HOSTS.includes(url.hostname) ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * Whether the register's own form code for a party (`LIMITED_LIABILITY_COMPANY_SIA`) names a form
 * that is not a natural person. Empty or unknown counts as a natural person, so a gap only over-protects.
 */
export function companyForm(formCode: string): boolean {
  const suffix = /_([A-Z]+)$/.exec(formCode)?.[1];
  return suffix ? legalForm(`lv-${suffix.toLowerCase()}`)?.naturalPerson === false : false;
}

function sanctionsRow(row: CsvRecord, ctx: ParseContext): ParsedRecord | null {
  const subject = subjectOf(row, "sanctions_subject_registration_number", ctx);
  if (subject === null) return null;
  const entityType = row.get("entity_type");
  const partyType = PARTY_TYPES[entityType];
  if (!partyType) {
    ctx.onDrop?.("unknown_enum");
    return null;
  }
  const date = isoDate(row.get("entry_date")) ?? isoDate(row.get("registered_on"));
  if (!date) {
    ctx.onDrop?.("invalid_record");
    return null;
  }
  const dropped: Dropped[] = [];
  const position = closedValue(LINK_POSITIONS, row.get("position"), "position", dropped);
  const list = row.get("list") ? closedValue(LISTS, row.get("list"), "list", dropped) : null;
  let party: string | null = null;
  let partyName: string | null = null;
  let partyCountry: string | null = null;
  if (entityType === "NATURAL_PERSON") {
    // Only the type and the role survive: the person's identity comes from the official lists.
    for (const column of ["name", "nationality"]) if (row.get(column)) dropped.push({ reason: "natural_person_party" });
    for (const column of ["birth_date", "latvian_identity_number_masked"]) if (row.get(column)) dropped.push({ reason: "personal_code" });
  } else {
    const company = entityType === "FOREIGN_ENTITY" || companyForm(row.get("legal_form_code"));
    const code = cleanCode(row.get("legal_entity_registration_number"));
    if (entityType === "LEGAL_ENTITY" && company && code && lvCodeProblem(code) === null) party = `lv-${code}`;
    else if (company) {
      partyName = row.get("legal_entity_name").replace(/\s+/g, " ") || null;
      const country = row.get("legal_entity_country").toLowerCase();
      partyCountry = /^[a-z]{2,3}$/.test(country) ? country : null;
      if (country && !partyCountry) dropped.push({ reason: "unknown_enum", prop: "country" });
    } else if (row.get("legal_entity_name")) dropped.push({ reason: "natural_person_party" });
  }
  const rawUrl = row.get("legal_base_url");
  const legalBaseUrl = rawUrl ? allowedLink(rawUrl) : null;
  if (rawUrl && !legalBaseUrl) dropped.push({ reason: "link_host", prop: "sourceUrl" });
  const registeredOn = isoDate(row.get("registered_on"));
  const event: EventInput = {
    entityEid: `lv-${subject}`,
    type: "register.sanctions_link",
    date,
    itemId: S11,
    data: { role: position, partyType, party, partyName, partyCountry, list, programme: row.get("program") || null, legalBaseUrl, registeredOn },
  };
  return withDropped(
    {
      recordKey: row.get("id"),
      rowRef: `line ${row.line}`,
      hashInput: [`lv-${subject}`, position, entityType, party ?? "", partyName ?? "", partyCountry ?? "", list ?? "", row.get("program"), row.get("entry_date"), legalBaseUrl ?? ""],
      entities: [],
      // The subject must resolve to a register entity that is not a natural-person form (party gate).
      parties: [{ code: { country: "lv", value: subject }, entities: [], events: [event] }],
    },
    dropped,
  );
}

// ---------------------------------------------------------------- the four loaders

export const lvUrInsolvency = loader({
  id: "lv-ur-insolvency",
  slug: "maksatnespejas-procesi",
  file: "insolvency_legal_person_proceeding.csv",
  title: "Insolvency proceedings",
  items: [S09],
  columns: INSOLVENCY_COLUMNS,
  dateColumn: "entry_created_on",
  fieldMap: LV_UR_INSOLVENCY_FIELD_MAP,
  revision: 2,
  row: insolvencyRow,
});

export const lvUrSecuringMeasures = loader({
  id: "lv-ur-securing-measures",
  slug: "securing-measures",
  file: "securing_measures.csv",
  title: "Securing measures",
  items: [S09],
  columns: ["id", "legal_entity_registration_number", "securing_measure_type", "type_details", "date_from", "case_number", "institution_registration_number", "institution_name"],
  dateColumn: "date_from",
  fieldMap: LV_UR_SECURING_MEASURES_FIELD_MAP,
  revision: 2,
  row: securingRow,
});

export const lvUrSuspensions = loader({
  id: "lv-ur-suspensions",
  slug: "suspensions-prohibitions",
  file: "suspensions_prohibitions.csv",
  title: "Suspensions and prohibitions",
  items: [S09],
  columns: ["id", "legal_entity_registration_number", "suspension_code", "date_from", "ground_for"],
  dateColumn: "date_from",
  fieldMap: LV_UR_SUSPENSIONS_FIELD_MAP,
  revision: 2,
  row: suspensionRow,
});

export const lvUrSanctionsLinks = loader({
  id: "lv-ur-sanctions-links",
  slug: "sanctions",
  file: "sanctions.csv",
  title: "Sanctions",
  items: [S11],
  columns: SANCTIONS_COLUMNS,
  dateColumn: "registered_on",
  fieldMap: LV_UR_SANCTIONS_LINKS_FIELD_MAP,
  revision: 2,
  row: sanctionsRow,
});

export const LV_RISK_LOADERS: readonly SourceLoader[] = [lvUrInsolvency, lvUrSecuringMeasures, lvUrSuspensions, lvUrSanctionsLinks];
