// The Latvian Enterprise Register's people and owners (lv-people.md): current officers, one role
// set per company, and corporate members, one member set per company. People exist only inside
// their company's set (architecture §3.3): no person code is read except to drop it, and natural-
// person members never get past the type check. Beneficial owners, joint-stock shareholders and
// joint owners are never fetched.
import { createHash } from "node:crypto";
import { LEGAL_FORMS, type DropReason } from "@finora/domain";
import { parserVersion } from "../../parser-version.ts";
import type { FetchContext, FieldMap, ParseContext, ParsedEntity, ParsedRecord, PartyRef, RawArtifact, SourceLoader, SourceMeta } from "../../types.ts";
import { artifact, cleanCode, closedValue, CURRENCIES, fetchCkanFile, isoDate, lvAsOf, lvCodeProblem, LV_DEEP_LINK, LV_REGISTER_HOSTS, readCsv, type CsvRecord } from "../shared.ts";

const S03 = "S03.LV.01";
const S04 = "S04.LV.01";
const S17 = "S17.LV.01";

/** `LV_PERSON_ROWS` (§3.3, PS7): officer names behind the purpose gate, or role counts and dates only. */
export const LV_PERSON_ROWS_MODES = ["names_no_id", "role_counts"] as const;
export type LvPersonRows = (typeof LV_PERSON_ROWS_MODES)[number];
export type LvPeopleConfig = { personRows: LvPersonRows };
export const LV_PEOPLE_DEFAULT_CONFIG: LvPeopleConfig = { personRows: "names_no_id" };

/** Datasets and files that hold beneficial owners, shareholders or joint owners: never requested. */
export const LV_NEVER_FETCHED = {
  slugs: ["patiesie-labuma-guveji", "stockholders"],
  files: ["members_joint_owners.csv", "beneficial_owners.csv"],
} as const;

export class FetchDenied extends Error {
  override name = "fetch_denied";
}

/** The CKAN fetch, refused before any request for a denylisted dataset or file. */
export async function fetchLvPeopleFile(ctx: FetchContext, slug: string, fileName: string): Promise<RawArtifact[]> {
  if ((LV_NEVER_FETCHED.slugs as readonly string[]).includes(slug) || (LV_NEVER_FETCHED.files as readonly string[]).includes(fileName)) throw new FetchDenied();
  return fetchCkanFile(ctx, slug, fileName);
}

const meta = (id: string, title: string, items: string[]): SourceMeta => ({
  id,
  country: "lv",
  publisher: "Uzņēmumu reģistrs (Register of Enterprises of the Republic of Latvia)",
  homepage: "https://www.ur.gov.lv",
  officialHosts: LV_REGISTER_HOSTS,
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
  limits: { requestsPerSecond: 2, maxBytes: 100 * 1024 ** 2 },
  items,
});

/** The LV legal-form table the party gate depends on: a change to it re-parses (lv-people.md § Source). */
const LV_FORMS = createHash("sha256")
  .update(JSON.stringify(LEGAL_FORMS.filter((f) => f.country === "lv")))
  .digest("hex")
  .slice(0, 8);

const today = (raw: RawArtifact[]) => (raw[0]?.fetchedAt ?? new Date().toISOString()).slice(0, 10);

function* datesOf(file: RawArtifact): Generator<string> {
  for (const row of readCsv(file, ";", ["registered_on", "last_modified_at"])) {
    yield row.get("registered_on");
    yield row.get("last_modified_at");
  }
}

const personName = (value: string) => value.normalize("NFC").replace(/\s+/g, " ").trim();

const attach = (code: string): ParsedEntity => ({ eid: `lv-${code}`, schema: "Company", country: "lv", code, ref: true, statements: [] });

/**
 * The integer part of a set's row ids (`p-<n>-<position>`, `rel-<n>-<position>`). The store keeps
 * the parser's eids, so the number is fixed here: the family digit and the company's register code,
 * unique per set and never derived from a person.
 */
const setNumber = (family: 1 | 2, code: string) => `${family}${code}`;

/** `org-<20 hex>` for a foreign holder known only by name (§3.4): scoped to the company and the line. */
const orgEid = (sourceId: string, code: string, recordKey: string, lineId: string) =>
  `org-${createHash("sha256").update(JSON.stringify([sourceId, `lv-${code}`, recordKey, lineId])).digest("hex").slice(0, 20)}`;

type Dropped = { reason: DropReason; prop?: string };

/**
 * A line's own row id, kept for role-end detection (§3.3). Only the register's id shape is kept: at
 * most 10 digits (the 2026-11 files hold 1-8), so no 11-digit personal code, and no longer run that
 * holds one, can pass. Anything else is nulled and counted (legal on the S05 review; N1 in the
 * security re-check, qa 7083380788): a name or a code in the id column would otherwise sit in
 * `line_ids` and the hash.
 */
function lineId(value: string, dropped: Dropped[]): string | null {
  if (value === "") return null;
  if (/^\d{1,10}$/.test(value)) return value;
  dropped.push({ reason: /^\d+$/.test(value) ? "personal_code" : "free_text" });
  return null;
}

/** The rows of a file grouped by company in file order; sets come out in company-code order. */
function groupByCompany<T>(rows: Iterable<{ code: string; line: T }>): [string, T[]][] {
  const sets = new Map<string, T[]>();
  for (const { code, line } of rows) {
    const set = sets.get(code);
    if (set) set.push(line);
    else sets.set(code, [line]);
  }
  return [...sets].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

/** The company a line belongs to, or null after counting why it is skipped. */
function companyOf(row: CsvRecord, ctx: ParseContext): string | null {
  const code = cleanCode(row.get("at_legal_entity_registration_number"));
  const problem = lvCodeProblem(code);
  if (problem) {
    ctx.onDrop?.(problem);
    return null;
  }
  return code;
}

// ---------------------------------------------------------------- lv-ur-officers

const OFFICERS_FILE = "officers.csv";
const OFFICER_COLUMNS = [
  "id", "at_legal_entity_registration_number", "entity_type", "position", "governing_body", "name", "latvian_identity_number_masked",
  "birth_date", "legal_entity_registration_number", "rights_of_representation_type", "representation_with_at_least", "registered_on", "last_modified_at",
] as const;

export const LV_UR_OFFICERS_FIELD_MAP: FieldMap = [
  { field: "id", target: { resolutionKey: "line_id" }, personal: false },
  { field: "at_legal_entity_registration_number", target: { prop: "organization" }, itemId: S03, personal: false },
  { field: "entity_type", target: { resolutionKey: "holder_type" }, personal: false },
  { field: "name", target: { prop: "name" }, itemId: S03, personal: true },
  { field: "position", target: { prop: "role" }, itemId: S03, personal: false },
  { field: "governing_body", target: { prop: "finora:governingBody" }, itemId: S03, personal: false },
  { field: "rights_of_representation_type", target: { prop: "finora:signingRights" }, itemId: S03, personal: false },
  { field: "representation_with_at_least", target: { prop: "finora:signingRights" }, itemId: S03, personal: false },
  { field: "registered_on", target: { prop: "startDate" }, itemId: S03, personal: true },
  { field: "legal_entity_registration_number", target: { prop: "director" }, itemId: S03, personal: false },
  { field: "latvian_identity_number_masked", target: { dropped: "personal_code" }, personal: true },
  { field: "birth_date", target: { dropped: "personal_code" }, personal: true },
  { field: "last_modified_at", target: { resolutionKey: "as_of" }, personal: false },
];

const POSITIONS = new Set([
  "BOARD_MEMBER", "CHAIR_OF_BOARD", "OWNER", "LIQUIDATOR", "MEMBER", "REPRESENTATIVE_MANAGER", "ADMINISTRATOR", "CO_OWNER",
  "AUTHORISED_REPRESENTATIVE", "PRESIDENT", "MANAGER", "ESTATE_TRUSTEE", "MANAGING_DIRECTOR", "CHAIR_OF_SUPERVISORY_BOARD", "REPRESENTATIVE_OF_THE_LIQUIDATOR",
]);
const GOVERNING_BODIES = new Set([
  "EXECUTIVE_BOARD", "EXECUTIVE_BODY", "MANAGEMENT_BODY", "LIQUIDATION_COMMITTEE", "DIRECTORATE", "EXECUTIVE_COMMITTEE", "SUPERVISORY_BOARD", "STAFF_COMMITTEE", "SENATE", "AUDITOR",
]);
const HOLDER_TYPES = new Set(["NATURAL_PERSON", "LEGAL_ENTITY", "FOREIGN_ENTITY"]);
/** The signing-rights tokens of the register (`INDIVIDUALLY`, or several joined by `/`). */
const RIGHTS = new Set(["INDIVIDUALLY", "WITH_AT_LEAST", "WITH_ALL", "WITH_CHAIR", "WITH_DEPUTY_CHAIR"]);

/**
 * The signing-rights code: the type, and the number of co-signers when it is not 0 (`WITH_AT_LEAST:2`).
 * Every token must be a register value and the number a small integer; anything else is null (SEC-2).
 */
export function signingRights(type: string, atLeast: string): string | null {
  if (!type || !type.split("/").every((t) => RIGHTS.has(t))) return null;
  if (atLeast !== "" && !/^\d{1,2}$/.test(atLeast)) return null;
  const n = Number(atLeast);
  return n > 0 ? `${type}:${n}` : type;
}

type OfficerLine = {
  id: string;
  line: number;
  type: string;
  position: string;
  body: string;
  /** Read only for a foreign holder, and for a natural person in `names_no_id` mode. */
  name: string;
  holder: string;
  rights: string;
  atLeast: string;
  registeredOn: string;
  personalFields: number;
};

function officerRecord(sourceId: string, code: string, lines: OfficerLine[], mode: LvPersonRows): ParsedRecord {
  const recordKey = `lv-${code}|officers`;
  const n = setNumber(1, code);
  const company = `lv-${code}`;
  const entities: ParsedEntity[] = [attach(code)];
  const parties: PartyRef[] = [];
  const dropped: Dropped[] = [];
  const hashInput: string[] = [];
  const lineIds: (string | null)[] = [];
  lines.forEach((l, i) => {
    const pos = i + 1;
    const rel = `rel-${n}-${pos}`;
    const id = lineId(l.id, dropped);
    lineIds.push(id);
    // Closed sets only (SEC-2): an unknown position is "unspecified", an unknown body or signing
    // right is not stored; each is counted.
    const role = closedValue(POSITIONS, l.position, "role", dropped);
    const body = GOVERNING_BODIES.has(l.body) ? l.body : null;
    if (l.body && !body) dropped.push({ reason: "unknown_enum", prop: "finora:governingBody" });
    for (let k = 0; k < l.personalFields; k++) dropped.push({ reason: "personal_code" });
    const rights = signingRights(l.rights, l.atLeast);
    if (l.rights && !rights) dropped.push({ reason: "unknown_enum", prop: "finora:signingRights" });
    const start = isoDate(l.registeredOn);
    const statements = [
      { prop: "organization", value: company, itemId: S03, line: i },
      { prop: "role", value: role, itemId: S03, line: i },
      ...(body ? [{ prop: "finora:governingBody", value: body, itemId: S03, line: i }] : []),
      ...(rights ? [{ prop: "finora:signingRights", value: rights, itemId: S03, line: i }] : []),
      ...(start ? [{ prop: "startDate", value: start, itemId: S03, line: i }] : []),
    ];
    let hashedName = "";
    let hashedHolder = "";
    if (l.type === "NATURAL_PERSON") {
      if (mode === "role_counts") dropped.push({ reason: "lv_person_rows_role_counts", prop: "name" });
      else if (l.name) {
        const person = `p-${n}-${pos}`;
        entities.push({ eid: person, schema: "Person", country: "lv", statements: [{ prop: "name", value: l.name, itemId: S03, line: i }] });
        statements.push({ prop: "director", value: person, itemId: S03, line: i });
        hashedName = l.name;
      }
    } else if (l.type === "FOREIGN_ENTITY") {
      // A foreign holder known by name loads only through the party gate, which proves it a company
      // by its register type; unproven, it is dropped in every mode (legal on SEC-9).
      if (l.name) {
        const org = orgEid(sourceId, code, recordKey, id ?? `#${pos}`);
        parties.push({
          type: "FOREIGN_ENTITY",
          entities: [
            { eid: org, schema: "Organization", country: "intl", statements: [{ prop: "name", value: l.name, itemId: S03, line: i }] },
            { eid: rel, schema: "Directorship", country: "lv", statements: [{ prop: "director", value: org, itemId: S03, line: i }] },
          ],
        });
        hashedName = l.name;
      }
    } else {
      // A company holder is linked only through the party gate: it must resolve to a register
      // entity that is not a natural-person form. Otherwise the line shows "a company", unlinked.
      const problem = lvCodeProblem(l.holder);
      if (problem) dropped.push({ reason: problem, prop: "director" });
      else {
        hashedHolder = `lv-${l.holder}`;
        parties.push({ code: { country: "lv", value: l.holder }, entities: [{ eid: rel, schema: "Directorship", country: "lv", statements: [{ prop: "director", value: hashedHolder, itemId: S03, line: i }] }] });
      }
    }
    entities.push({ eid: rel, schema: "Directorship", country: "lv", statements });
    hashInput.push(JSON.stringify([id ?? "", l.type, role, body ?? "", hashedName, hashedHolder, rights ?? "", start ?? ""]));
  });
  return {
    recordKey,
    rowRef: `line ${lines[0]!.line}`,
    hashInput,
    entities,
    lineIds,
    ...(parties.length > 0 ? { parties } : {}),
    ...(dropped.length > 0 ? { dropped } : {}),
  };
}

function* officers(raw: RawArtifact[], sourceId: string, mode: LvPersonRows, ctx: ParseContext): Generator<ParsedRecord> {
  function* lines(): Generator<{ code: string; line: OfficerLine }> {
    for (const row of readCsv(artifact(raw, OFFICERS_FILE), ";", OFFICER_COLUMNS)) {
      const code = companyOf(row, ctx);
      if (code === null) continue;
      const type = row.get("entity_type");
      if (!HOLDER_TYPES.has(type)) {
        ctx.onDrop?.("unknown_enum");
        continue;
      }
      const readName = type === "FOREIGN_ENTITY" || (type === "NATURAL_PERSON" && mode === "names_no_id");
      yield {
        code,
        line: {
          id: row.get("id"),
          line: row.line,
          type,
          position: row.get("position"),
          body: row.get("governing_body"),
          name: readName ? personName(row.get("name")) : "",
          holder: type === "LEGAL_ENTITY" ? cleanCode(row.get("legal_entity_registration_number")) : "",
          rights: row.get("rights_of_representation_type"),
          atLeast: row.get("representation_with_at_least"),
          registeredOn: row.get("registered_on"),
          // Checked for presence only, to count the drop: the value is never kept.
          personalFields: (row.get("latvian_identity_number_masked") !== "" ? 1 : 0) + (row.get("birth_date") !== "" ? 1 : 0),
        },
      };
    }
  }
  for (const [code, set] of groupByCompany(lines())) yield officerRecord(sourceId, code, set, mode);
}

/** The officers loader for one `LV_PERSON_ROWS` mode; the mode is part of its parserVersion. */
export function lvUrOfficersLoader(config: LvPeopleConfig = LV_PEOPLE_DEFAULT_CONFIG): SourceLoader {
  const m = meta("lv-ur-officers", "Officers", [S03]);
  const mode = config.personRows;
  if (!LV_PERSON_ROWS_MODES.includes(mode)) throw new Error("LV_PERSON_ROWS must be names_no_id or role_counts");
  return {
    meta: m,
    parserVersion: `${parserVersion(m.id, 4, LV_UR_OFFICERS_FIELD_MAP, m.items)}-${LV_FORMS}-${mode}`,
    fieldMap: LV_UR_OFFICERS_FIELD_MAP,
    fetch: async (ctx) => ({ artifacts: await fetchLvPeopleFile(ctx, "officers", OFFICERS_FILE) }),
    asOf: (raw) => lvAsOf(raw, OFFICERS_FILE, datesOf, today(raw)),
    parse: (raw, ctx) => officers(raw, m.id, mode, ctx),
  };
}

// ---------------------------------------------------------------- lv-ur-members

const MEMBERS_FILE = "members.csv";
const MEMBER_COLUMNS = [
  "id", "at_legal_entity_registration_number", "entity_type", "name", "latvian_identity_number_masked", "birth_date",
  "legal_entity_registration_number", "number_of_shares", "share_nominal_value", "share_currency", "date_from", "registered_on", "last_modified_at",
] as const;

export const LV_UR_MEMBERS_FIELD_MAP: FieldMap = [
  { field: "entity_type", target: { resolutionKey: "party_gate" }, personal: false },
  { field: "id", target: { resolutionKey: "line_id" }, personal: false },
  { field: "at_legal_entity_registration_number", target: { prop: "asset" }, itemId: S04, personal: false },
  { field: "legal_entity_registration_number", target: { prop: "owner" }, itemId: S17, personal: false },
  { field: "name", target: { prop: "name" }, itemId: S04, personal: false },
  { field: "number_of_shares", target: { prop: "sharesCount" }, itemId: S04, personal: false },
  { field: "share_nominal_value", target: { prop: "sharesValue" }, itemId: S04, personal: false },
  { field: "share_currency", target: { prop: "sharesValue" }, itemId: S04, personal: false },
  { field: "date_from", target: { prop: "startDate" }, itemId: S04, personal: false },
  { field: "latvian_identity_number_masked", target: { dropped: "personal_code" }, personal: true },
  { field: "birth_date", target: { dropped: "personal_code" }, personal: true },
  { field: "registered_on", target: { resolutionKey: "as_of" }, personal: false },
  { field: "last_modified_at", target: { resolutionKey: "as_of" }, personal: false },
];

/** Member types that never get past the first field read (rule 1): the line is dropped whole. */
const PERSON_MEMBER_TYPES: Readonly<Record<string, DropReason>> = { NATURAL_PERSON: "natural_person_type", JOINT_OWNERS: "joint_owners" };

type MemberLine = {
  id: string;
  line: number;
  type: "LEGAL_ENTITY" | "FOREIGN_ENTITY";
  holder: string;
  name: string;
  shares: string;
  nominal: string;
  currency: string;
  dateFrom: string;
  personalFields: number;
};

const decimal = (value: string) => {
  const n = Number(value.replace(",", "."));
  return value !== "" && Number.isFinite(n) ? String(n) : null;
};

function memberRecord(sourceId: string, code: string, lines: MemberLine[], seen: Set<string>): ParsedRecord {
  const recordKey = `lv-${code}|members`;
  const n = setNumber(2, code);
  const company = `lv-${code}`;
  const parties: PartyRef[] = [];
  const dropped: Dropped[] = [];
  const hashInput: string[] = [];
  const lineIds: (string | null)[] = [];
  lines.forEach((l, i) => {
    const pos = i + 1;
    const id = lineId(l.id, dropped);
    lineIds.push(id);
    if (id !== null && seen.has(id)) dropped.push({ reason: "duplicate_key" });
    if (id !== null) seen.add(id);
    for (let k = 0; k < l.personalFields; k++) dropped.push({ reason: "personal_code" });
    const shares = decimal(l.shares);
    // The share value needs an ISO 4217 currency (or LVL); without one it is not stored (SEC-2).
    const currency = l.currency || "EUR";
    const knownCurrency = CURRENCIES.has(currency);
    if (!knownCurrency) dropped.push({ reason: "unknown_enum", prop: "sharesValue" });
    const nominal = knownCurrency ? decimal(l.nominal) : null;
    const start = isoDate(l.dateFrom);
    const ownership = (owner: string, ownerItem: string): ParsedEntity => ({
      eid: `rel-${n}-${pos}`,
      schema: "Ownership",
      country: "lv",
      statements: [
        { prop: "asset", value: company, itemId: S04, line: i },
        { prop: "owner", value: owner, itemId: ownerItem, line: i },
        ...(shares !== null ? [{ prop: "sharesCount", value: shares, itemId: S04, line: i }] : []),
        ...(nominal !== null ? [{ prop: "sharesValue", value: `${nominal} ${currency}`, itemId: S04, line: i }] : []),
        ...(start ? [{ prop: "startDate", value: start, itemId: S04, line: i }] : []),
      ],
    });
    if (l.type === "LEGAL_ENTITY") {
      // Loaded only when the holder's code resolves to a register entity that is not a natural-person form.
      parties.push({ code: { country: "lv", value: l.holder }, entities: [ownership(`lv-${l.holder}`, S17)] });
      hashInput.push(JSON.stringify([id ?? "", l.type, `lv-${l.holder}`, "", shares ?? "", nominal ?? "", knownCurrency ? currency : "", start ?? ""]));
    } else {
      const org = orgEid(sourceId, code, recordKey, id ?? `#${pos}`);
      parties.push({
        type: "FOREIGN_ENTITY",
        entities: [{ eid: org, schema: "Organization", country: "intl", statements: [{ prop: "name", value: l.name, itemId: S04, line: i }] }, ownership(org, S04)],
      });
      hashInput.push(JSON.stringify([id ?? "", l.type, "", l.name, shares ?? "", nominal ?? "", knownCurrency ? currency : "", start ?? ""]));
    }
  });
  return {
    recordKey,
    rowRef: `line ${lines[0]!.line}`,
    hashInput,
    entities: [attach(code)],
    parties,
    lineIds,
    ...(dropped.length > 0 ? { dropped } : {}),
  };
}

function* members(raw: RawArtifact[], sourceId: string, ctx: ParseContext): Generator<ParsedRecord> {
  function* lines(): Generator<{ code: string; line: MemberLine }> {
    for (const row of readCsv(artifact(raw, MEMBERS_FILE), ";", MEMBER_COLUMNS)) {
      // The party gate reads the type first: a person's line is dropped before any other field is read.
      const type = row.get("entity_type");
      const personType = PERSON_MEMBER_TYPES[type];
      if (personType) {
        ctx.onDrop?.(personType);
        continue;
      }
      if (type !== "LEGAL_ENTITY" && type !== "FOREIGN_ENTITY") {
        ctx.onDrop?.("unknown_enum");
        continue;
      }
      const code = companyOf(row, ctx);
      if (code === null) continue;
      const holder = type === "LEGAL_ENTITY" ? cleanCode(row.get("legal_entity_registration_number")) : "";
      const holderProblem = type === "LEGAL_ENTITY" ? lvCodeProblem(holder) : null;
      if (holderProblem) {
        ctx.onDrop?.(holderProblem);
        continue;
      }
      const name = type === "FOREIGN_ENTITY" ? personName(row.get("name")) : "";
      if (type === "FOREIGN_ENTITY" && !name) {
        ctx.onDrop?.("invalid_record");
        continue;
      }
      yield {
        code,
        line: {
          id: row.get("id"),
          line: row.line,
          type,
          holder,
          name,
          shares: row.get("number_of_shares"),
          nominal: row.get("share_nominal_value"),
          currency: row.get("share_currency"),
          dateFrom: row.get("date_from"),
          personalFields: (row.get("latvian_identity_number_masked") !== "" ? 1 : 0) + (row.get("birth_date") !== "" ? 1 : 0),
        },
      };
    }
  }
  const seen = new Set<string>();
  for (const [code, set] of groupByCompany(lines())) yield memberRecord(sourceId, code, set, seen);
}

const MEMBERS_META = meta("lv-ur-members", "Members", [S04, S17]);

export const lvUrMembers: SourceLoader = {
  meta: MEMBERS_META,
  parserVersion: `${parserVersion(MEMBERS_META.id, 4, LV_UR_MEMBERS_FIELD_MAP, MEMBERS_META.items)}-${LV_FORMS}`,
  fieldMap: LV_UR_MEMBERS_FIELD_MAP,
  fetch: async (ctx) => ({ artifacts: await fetchLvPeopleFile(ctx, "members", MEMBERS_FILE) }),
  asOf: (raw) => lvAsOf(raw, MEMBERS_FILE, datesOf, today(raw)),
  parse: (raw, ctx) => members(raw, MEMBERS_META.id, ctx),
};

export const lvUrOfficers = lvUrOfficersLoader();

/** The module's loaders in load order, for one `LV_PERSON_ROWS` mode. */
export const lvPeopleLoaders = (config: LvPeopleConfig = LV_PEOPLE_DEFAULT_CONFIG): SourceLoader[] => [
  config.personRows === LV_PEOPLE_DEFAULT_CONFIG.personRows ? lvUrOfficers : lvUrOfficersLoader(config),
  lvUrMembers,
];

export const LV_PEOPLE_LOADERS: readonly SourceLoader[] = lvPeopleLoaders();
