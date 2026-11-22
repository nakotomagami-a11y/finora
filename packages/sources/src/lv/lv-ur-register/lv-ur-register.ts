// The Latvian Enterprise Register's identity files (lv-register.md): the register itself, former
// names, liquidations, reorganisations, equity capital and memorandum dates. Six sources, one per
// data.gov.lv dataset; each is a full daily snapshot, CC0, and joins by the 11-digit register code.
import { createHash } from "node:crypto";
import { legalForm, type DropReason, type SchemaName } from "@finora/domain";
import { parserVersion } from "../../parser-version.ts";
import type { FieldMap, ParseContext, ParsedRecord, RawArtifact, SourceLoader, SourceMeta } from "../../types.ts";
import { artifact, cleanCode, fetchCkanFile, isoDate, lvAsOf, lvCodeProblem, LV_DEEP_LINK, LV_REGISTER_HOSTS, readCsv, type CsvRecord } from "../shared.ts";

const S01 = "S01.LV.01";
const S02 = "S02.LV.01";
const S13 = "S13.LV.01";
const S17 = "S17.LV.01";

const meta = (id: string, title: string, items: string[], maxBytes: number): SourceMeta => ({
  id,
  country: "lv",
  publisher: "Uzņēmumu reģistrs (Register of Enterprises of the Republic of Latvia)",
  homepage: "https://www.ur.gov.lv",
  officialHosts: LV_REGISTER_HOSTS,
  licence: "cc0-1.0",
  attribution: `Source: Register of Enterprises of the Republic of Latvia, ${title}, data.gov.lv, CC0 1.0`,
  storage: "store",
  cadence: "daily",
  publishedAtUtc: "21:40",
  asOf: ["max_date_in_data", "portal_metadata", "http_last_modified"],
  maxPurgeShare: 0.02,
  purgeScope: "full",
  deepLink: LV_DEEP_LINK,
  orderUrl: null,
  requires: [],
  limits: { requestsPerSecond: 2, maxBytes },
  items,
});

/** The natural-person forms of the register (legal rule 5): no address, no capital, no former names. */
const isNaturalForm = (type: string) => legalForm(`lv-${type.toLowerCase()}`)?.naturalPerson ?? true;

const sha8 = (value: string) => createHash("sha256").update(value).digest("hex").slice(0, 8);

const today = (raw: RawArtifact[]) => (raw[0]?.fetchedAt ?? new Date().toISOString()).slice(0, 10);

function datesOf(file: RawArtifact, columns: string[]): Generator<string> {
  return (function* () {
    for (const row of readCsv(file.bytes, ";", columns)) for (const c of columns) yield row.get(c);
  })();
}

/** The code of a row's entity, or the reason it is skipped. */
function codeOf(row: CsvRecord, column: string): { code: string } | { drop: DropReason } {
  const code = cleanCode(row.get(column));
  const problem = lvCodeProblem(code);
  return problem ? { drop: problem } : { code };
}


// ---------------------------------------------------------------- lv-ur-register

const REGISTER_FILE = "register.csv";
const REGISTER_COLUMNS = ["regcode", "name", "regtype", "type", "registered", "terminated", "closed", "address", "index", "addressid"] as const;

export const LV_UR_REGISTER_FIELD_MAP: FieldMap = [
  { field: "regcode", target: { resolutionKey: "registrationNumber" }, personal: false },
  { field: "name", target: { prop: "name" }, itemId: S01, personal: false },
  { field: "regtype", target: { resolutionKey: "schema" }, personal: false },
  { field: "type", target: { prop: "legalForm" }, itemId: S01, personal: false },
  { field: "registered", target: { prop: "incorporationDate" }, itemId: S01, personal: false },
  { field: "terminated", target: { prop: "dissolutionDate" }, itemId: S02, personal: false },
  { field: "closed", target: { prop: "status" }, itemId: S02, personal: false },
  { field: "address", target: { prop: "address" }, itemId: S01, personal: false },
  { field: "index", target: { prop: "address" }, itemId: S01, personal: false },
  { field: "addressid", target: { prop: "finora:addressId" }, itemId: S17, personal: false },
];

const SCHEMA_BY_REGTYPE: Record<string, SchemaName> = { K: "Company", B: "Organization", S: "Organization", R: "Organization", P: "Organization", O: "Organization", A: "Organization", T: "Organization", C: "LegalEntity", E: "LegalEntity", U: "LegalEntity" };

/** The entity's status: `L` struck off, `R` reorganised, blank with a termination date struck off. */
export function lvStatus(closed: string, terminated: string): "active" | "struck_off" | "reorganised" {
  if (closed === "L") return "struck_off";
  if (closed === "R") return "reorganised";
  return terminated ? "struck_off" : "active";
}

function* registerRecords(raw: RawArtifact[], _file: string, ctx: ParseContext): Generator<ParsedRecord> {
  for (const row of readCsv(artifact(raw, REGISTER_FILE).bytes, ";", REGISTER_COLUMNS)) {
    const coded = codeOf(row, "regcode");
    if ("drop" in coded) {
      ctx.onDrop?.(coded.drop);
      continue;
    }
    const { code } = coded;
    const regtype = row.get("regtype");
    if (regtype === "M") {
      ctx.onDrop?.("no_item");
      continue;
    }
    const type = row.get("type");
    const form = type ? `lv-${type.toLowerCase()}` : null;
    const dropped: { reason: DropReason; prop?: string }[] = [];
    if (form && !legalForm(form)) dropped.push({ reason: "unknown_legal_form", prop: "legalForm" });
    const natural = type ? isNaturalForm(type) : true;
    const status = lvStatus(row.get("closed"), row.get("terminated"));
    const registered = isoDate(row.get("registered"));
    const terminated = isoDate(row.get("terminated"));
    const name = row.get("name").replace(/\s+/g, " ");
    const statements = [
      ...(name ? [{ prop: "name", value: name, itemId: S01 }] : []),
      { prop: "registrationNumber", value: code, itemId: S01 },
      ...(form ? [{ prop: "legalForm", value: form, itemId: S01 }] : []),
      { prop: "status", value: row.get("closed") || "active", itemId: S02 },
      ...(registered ? [{ prop: "incorporationDate", value: registered, itemId: S01 }] : []),
      ...(terminated ? [{ prop: "dissolutionDate", value: terminated, itemId: S02 }] : []),
    ];
    // Load rule 3: struck-off and reorganised entities keep identity only. Natural persons keep no
    // address (the gate reduces it to the country) and no address id (Part H 3).
    if (status === "active") {
      if (natural) {
        statements.push({ prop: "country", value: "lv", itemId: S01 });
        if (row.get("address")) dropped.push({ reason: "natural_person_address", prop: "address" });
      } else {
        const address = row.get("address").replace(/\s+/g, " ");
        const index = row.get("index");
        if (address) statements.push({ prop: "address", value: index ? `${address}, LV-${index}` : address, itemId: S01 });
        const addressId = row.get("addressid");
        if (addressId && addressId !== "0") statements.push({ prop: "finora:addressId", value: addressId, itemId: S17 });
      }
    }
    yield {
      recordKey: code,
      rowRef: `line ${row.line}`,
      hashInput: REGISTER_COLUMNS.map((c) => row.get(c)),
      entities: [{ eid: `lv-${code}`, schema: SCHEMA_BY_REGTYPE[regtype] ?? "LegalEntity", country: "lv", legalForm: form, status, code, statements }],
      ...(dropped.length > 0 ? { dropped } : {}),
    };
  }
}

// ---------------------------------------------------------------- the dependent families

type Family = {
  id: string;
  slug: string;
  file: string;
  title: string;
  items: string[];
  maxBytes: number;
  dateColumns: string[];
  fieldMap: FieldMap;
  revision: number;
  records: (raw: RawArtifact[], file: string, ctx: ParseContext) => Iterable<ParsedRecord>;
};

function loader(f: Family): SourceLoader {
  const m = meta(f.id, f.title, f.items, f.maxBytes);
  return {
    meta: m,
    parserVersion: parserVersion(f.id, f.revision, f.fieldMap, f.items),
    fieldMap: f.fieldMap,
    fetch: async (ctx) => ({ artifacts: await fetchCkanFile(ctx, f.slug, f.file) }),
    asOf: (raw) => lvAsOf(raw, f.file, (file) => datesOf(file, f.dateColumns), today(raw)),
    parse: (raw, ctx) => f.records(raw, f.file, ctx),
  };
}

// The register entity a dependent row attaches to (`ref`): never created or changed here, so the
// register stays the only writer of identity. A code the store does not hold is refused by the
// store and counted `entity_missing`.
const attach = (code: string) => ({ eid: `lv-${code}`, schema: "Company" as const, country: "lv", code, ref: true, statements: [] });

export const LV_UR_NAME_HISTORY_FIELD_MAP: FieldMap = [
  { field: "regcode", target: { resolutionKey: "registrationNumber" }, personal: false },
  { field: "date_to", target: { resolutionKey: "recordKey" }, personal: false },
  { field: "name", target: { prop: "previousName" }, itemId: S02, personal: false },
];

function* nameHistory(raw: RawArtifact[], file: string, ctx: ParseContext): Generator<ParsedRecord> {
  for (const row of readCsv(artifact(raw, file).bytes, ";", ["regcode", "date_to", "name"])) {
    const coded = codeOf(row, "regcode");
    if ("drop" in coded) {
      ctx.onDrop?.(coded.drop);
      continue;
    }
    const name = row.get("name").replace(/\s+/g, " ");
    if (!name) {
      ctx.onDrop?.("invalid_record");
      continue;
    }
    const recordKey = `${coded.code}|${row.get("date_to")}|${sha8(name)}`;
    yield {
      recordKey,
      rowRef: `line ${row.line}`,
      hashInput: [coded.code, row.get("date_to"), name],
      entities: [{ ...attach(coded.code), statements: [{ prop: "previousName", value: name, itemId: S02 }] }],
    };
  }
}

export const LV_UR_LIQUIDATIONS_FIELD_MAP: FieldMap = [
  { field: "id", target: { resolutionKey: "recordKey" }, personal: false },
  { field: "legal_entity_registration_number", target: { resolutionKey: "registrationNumber" }, personal: false },
  { field: "liquidation_type", target: { event: "register.liquidation" }, itemId: S02, personal: false },
  { field: "date_from", target: { event: "register.liquidation" }, itemId: S02, personal: false },
  { field: "grounds_for_liquidation", target: { dropped: "free_text" }, personal: true },
  { field: "registered_on", target: { resolutionKey: "as_of" }, personal: false },
  { field: "last_modified_at", target: { resolutionKey: "as_of" }, personal: false },
];

const LIQUIDATION_TYPES = new Set(["LIQUIDATION", "ACTIVITY_TERMINATED", "ACTIVITY_TERMINATED_BY_COURT", "NON_REREGISTRATION", "REFORM_OF_POLITICAL_PARTIES", "REFORM_OF_ASSOCIATIONS"]);

function* liquidations(raw: RawArtifact[], file: string, ctx: ParseContext): Generator<ParsedRecord> {
  const cols = ["id", "legal_entity_registration_number", "liquidation_type", "date_from"];
  for (const row of readCsv(artifact(raw, file).bytes, ";", cols)) {
    const coded = codeOf(row, "legal_entity_registration_number");
    if ("drop" in coded) {
      ctx.onDrop?.(coded.drop);
      continue;
    }
    const kind = row.get("liquidation_type");
    const date = isoDate(row.get("date_from"));
    if (!date) {
      ctx.onDrop?.("invalid_record");
      continue;
    }
    yield {
      recordKey: row.get("id"),
      rowRef: `line ${row.line}`,
      hashInput: [coded.code, kind, date],
      entities: [attach(coded.code)],
      events: [{ entityEid: `lv-${coded.code}`, type: "register.liquidation", date, itemId: S02, data: { kind } }],
      dropped: [{ reason: "free_text", prop: "grounds_for_liquidation" }, ...(LIQUIDATION_TYPES.has(kind) ? [] : [{ reason: "unknown_enum" as const, prop: "liquidation_type" }])],
    };
  }
}

export const LV_UR_REORGANIZATIONS_FIELD_MAP: FieldMap = [
  { field: "id", target: { resolutionKey: "recordKey" }, personal: false },
  { field: "reorganization_type", target: { event: "register.reorganisation" }, itemId: S02, personal: false },
  { field: "source_entity_regcode", target: { event: "register.reorganisation" }, itemId: S02, personal: false },
  { field: "final_entity_regcode", target: { event: "register.reorganisation" }, itemId: S02, personal: false },
  { field: "registered", target: { event: "register.reorganisation" }, itemId: S02, personal: false },
];

const REORGANIZATION_TYPES = new Set(["ACQUISITION", "TRANSFORMATION", "SEPARATION", "REORGANISATION", "DIVISION", "MERGER"]);

function* reorganizations(raw: RawArtifact[], file: string, ctx: ParseContext): Generator<ParsedRecord> {
  const cols = ["id", "reorganization_type", "source_entity_regcode", "final_entity_regcode", "registered"];
  for (const row of readCsv(artifact(raw, file).bytes, ";", cols)) {
    const kind = row.get("reorganization_type");
    const registered = isoDate(row.get("registered"));
    const date = registered ?? today(raw);
    const sides = (["source", "final"] as const).map((role) => {
      const code = cleanCode(row.get(`${role}_entity_regcode`));
      return { role, code: lvCodeProblem(code) === null ? code : null };
    });
    const known = sides.filter((s) => s.code !== null);
    if (known.length === 0) {
      ctx.onDrop?.("no_code");
      continue;
    }
    yield {
      recordKey: row.get("id"),
      rowRef: `line ${row.line}`,
      hashInput: [kind, row.get("source_entity_regcode"), row.get("final_entity_regcode"), row.get("registered")],
      entities: known.map((s) => attach(s.code!)),
      events: known.map((s) => {
        const other = sides.find((o) => o.role !== s.role)?.code ?? null;
        return {
          entityEid: `lv-${s.code}`,
          type: "register.reorganisation",
          date,
          itemId: S02,
          data: { kind, role: s.role, other: other ? `lv-${other}` : null, ...(registered ? {} : { date_estimated: 1 }) },
        };
      }),
      ...(REORGANIZATION_TYPES.has(kind) ? {} : { dropped: [{ reason: "unknown_enum" as const, prop: "reorganization_type" }] }),
    };
  }
}

export const LV_UR_EQUITY_FIELD_MAP: FieldMap = [
  { field: "legal_entity_registration_number", target: { resolutionKey: "registrationNumber" }, personal: false },
  { field: "equity_capital_type", target: { prop: "capital" }, itemId: S01, personal: false },
  { field: "amount", target: { prop: "capital" }, itemId: S01, personal: false },
  { field: "currency", target: { prop: "capital" }, itemId: S01, personal: false },
  { field: "date_from", target: { prop: "capital" }, itemId: S01, personal: false },
  { field: "id", target: { resolutionKey: "tie_break" }, personal: false },
  { field: "last_modified_at", target: { resolutionKey: "as_of" }, personal: false },
];

const CAPITAL_RANK: Record<string, number> = { PAID_UP_EQUITY: 2, REGISTERED_EQUITY: 1 };

/** One capital value per company: paid-up beats registered, then the latest `date_from`, then the highest `id`. */
function* equity(raw: RawArtifact[], file: string, ctx: ParseContext): Generator<ParsedRecord> {
  const cols = ["id", "legal_entity_registration_number", "equity_capital_type", "amount", "currency", "date_from"];
  type Kept = { code: string; rank: number; date: string; id: number; amount: string; currency: string; line: number };
  const kept = new Map<string, Kept>();
  for (const row of readCsv(artifact(raw, file).bytes, ";", cols)) {
    const coded = codeOf(row, "legal_entity_registration_number");
    if ("drop" in coded) {
      ctx.onDrop?.(coded.drop);
      continue;
    }
    const rank = CAPITAL_RANK[row.get("equity_capital_type")];
    if (!rank) {
      ctx.onDrop?.("no_item");
      continue;
    }
    const amount = Number(row.get("amount").replace(",", "."));
    if (!Number.isFinite(amount)) {
      ctx.onDrop?.("invalid_record");
      continue;
    }
    const next: Kept = { code: coded.code, rank, date: isoDate(row.get("date_from")) ?? "", id: Number(row.get("id")) || 0, amount: amount.toFixed(2), currency: row.get("currency") || "EUR", line: row.line };
    const prev = kept.get(coded.code);
    const better = !prev || [next.rank - prev.rank, next.date.localeCompare(prev.date), next.id - prev.id].find((d) => d !== 0)! > 0;
    if (better) kept.set(coded.code, next);
  }
  for (const k of kept.values()) {
    yield {
      recordKey: k.code,
      rowRef: `line ${k.line}`,
      hashInput: [k.amount, k.currency, k.date],
      entities: [{ ...attach(k.code), statements: [{ prop: "capital", value: `${k.amount} ${k.currency}`, itemId: S01 }] }],
    };
  }
}

export const LV_UR_MEMORANDUM_FIELD_MAP: FieldMap = [
  { field: "id", target: { resolutionKey: "recordKey" }, personal: false },
  { field: "legal_entity_registration_number", target: { resolutionKey: "registrationNumber" }, personal: false },
  { field: "document_date", target: { event: "filing.founding_document" }, itemId: S13, personal: false },
  { field: "registered_on", target: { event: "filing.founding_document" }, itemId: S13, personal: false },
];

function* memorandum(raw: RawArtifact[], file: string, ctx: ParseContext): Generator<ParsedRecord> {
  for (const row of readCsv(artifact(raw, file).bytes, ";", ["id", "legal_entity_registration_number", "document_date", "registered_on"])) {
    const coded = codeOf(row, "legal_entity_registration_number");
    if ("drop" in coded) {
      ctx.onDrop?.(coded.drop);
      continue;
    }
    const registeredOn = isoDate(row.get("registered_on"));
    const documentDate = isoDate(row.get("document_date"));
    const useDocument = documentDate !== null && documentDate >= "1990-01-01";
    const date = useDocument ? documentDate : registeredOn;
    if (!date) {
      ctx.onDrop?.("invalid_record");
      continue;
    }
    yield {
      recordKey: row.get("id"),
      rowRef: `line ${row.line}`,
      hashInput: [coded.code, row.get("document_date"), row.get("registered_on")],
      entities: [attach(coded.code)],
      events: [{ entityEid: `lv-${coded.code}`, type: "filing.founding_document", date, itemId: S13, data: { registered_on: registeredOn, ...(useDocument ? {} : { date_from_registration: 1 }) } }],
    };
  }
}

// ---------------------------------------------------------------- the six loaders

export const lvUrRegister = loader({
  id: "lv-ur-register",
  slug: "uz",
  file: REGISTER_FILE,
  title: "Register",
  items: [S01, S02, S17],
  maxBytes: 400 * 1024 ** 2,
  dateColumns: ["registered", "terminated"],
  fieldMap: LV_UR_REGISTER_FIELD_MAP,
  revision: 1,
  records: registerRecords,
});

export const lvUrNameHistory = loader({
  id: "lv-ur-name-history",
  slug: "tiesibu-subjektu-vesturiskie-nosaukumi",
  file: "register_name_history.csv",
  title: "Historical names",
  items: [S02],
  maxBytes: 50 * 1024 ** 2,
  dateColumns: ["date_to"],
  fieldMap: LV_UR_NAME_HISTORY_FIELD_MAP,
  revision: 1,
  records: nameHistory,
});

export const lvUrLiquidations = loader({
  id: "lv-ur-liquidations",
  slug: "liquidations",
  file: "liquidations.csv",
  title: "Liquidations",
  items: [S02],
  maxBytes: 50 * 1024 ** 2,
  dateColumns: ["registered_on", "last_modified_at"],
  fieldMap: LV_UR_LIQUIDATIONS_FIELD_MAP,
  revision: 1,
  records: liquidations,
});

export const lvUrReorganizations = loader({
  id: "lv-ur-reorganizations",
  slug: "reorganizatons",
  file: "reorganizations.csv",
  title: "Reorganisations",
  items: [S02],
  maxBytes: 50 * 1024 ** 2,
  dateColumns: ["registered"],
  fieldMap: LV_UR_REORGANIZATIONS_FIELD_MAP,
  revision: 1,
  records: reorganizations,
});

export const lvUrEquityCapitals = loader({
  id: "lv-ur-equity-capitals",
  slug: "equity-capitals",
  file: "equity_capitals.csv",
  title: "Equity capital",
  items: [S01],
  maxBytes: 50 * 1024 ** 2,
  dateColumns: ["last_modified_at"],
  fieldMap: LV_UR_EQUITY_FIELD_MAP,
  revision: 1,
  records: equity,
});

export const lvUrMemorandumDates = loader({
  id: "lv-ur-memorandum-dates",
  slug: "memorandum-date",
  file: "memorandum_date.csv",
  title: "Memorandum dates",
  items: [S13],
  maxBytes: 50 * 1024 ** 2,
  dateColumns: ["registered_on"],
  fieldMap: LV_UR_MEMORANDUM_FIELD_MAP,
  revision: 1,
  records: memorandum,
});
