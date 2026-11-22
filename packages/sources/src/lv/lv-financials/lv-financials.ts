// The Latvian annual-report financial data (lv-financials.md): three files of one data.gov.lv
// dataset joined on the statement id, one fact report and one filing event per company fiscal year
// of the 5 newest fiscal years. Cash flow and consolidated reports are not loaded.
import { parserVersion } from "../../parser-version.ts";
import type { DropReason, FactReportInput, FieldMap, ParseContext, ParsedRecord, RawArtifact, SourceLoader, SourceMeta } from "../../types.ts";
import { artifact, cleanCode, fetchCkanFile, isoDate, lvAsOf, lvCodeProblem, LV_DEEP_LINK, LV_REGISTER_HOSTS, readCsv, type CsvRecord } from "../shared.ts";

const S06 = "S06.LV.01";
const S13 = "S13.LV.01";

export const LV_FINANCIALS_SLUG = "gada-parskatu-finansu-dati";
export const STATEMENTS_FILE = "financial_statements.csv";
export const BALANCE_FILE = "balance_sheets.csv";
export const INCOME_FILE = "income_statements.csv";

/** Load rule 3: the newest fiscal years in the file, and at most as many per company. */
export const WINDOW_YEARS = 5;

const STATEMENT_COLUMNS = ["id", "legal_entity_registration_number", "source_type", "year_started_on", "year_ended_on", "employees", "rounded_to_nearest", "currency", "created_at"] as const;
const BALANCE_LINES = [
  ["cash", "cash"],
  ["total_current_assets", "current_assets"],
  ["total_non_current_assets", "non_current_assets"],
  ["total_assets", "total_assets"],
  ["current_liabilities", "current_liabilities"],
  ["non_current_liabilities", "non_current_liabilities"],
  ["equity", "equity"],
] as const;
const INCOME_LINES = [
  ["net_turnover", "revenue"],
  ["income_before_income_taxes", "profit_before_tax"],
  ["net_income", "net_profit"],
] as const;

/** `UGP` annual reports, older schemas with no type, and association and foundation reports; `UKGP` is consolidated. */
const LOADED_TYPES = new Set(["UGP", "", "BNAGP"]);
const UNIT_SCALE: Record<string, number> = { ONES: 1, THOUSANDS: 1000 };

export const LV_FINANCIALS_FIELD_MAP: FieldMap = [
  { field: "id", target: { resolutionKey: "tie_break" }, personal: false },
  { field: "legal_entity_registration_number", target: { resolutionKey: "registrationNumber" }, personal: false },
  { field: "source_type", target: { resolutionKey: "selection" }, personal: false },
  { field: "year_started_on", target: { resolutionKey: "period_start" }, personal: false },
  { field: "year_ended_on", target: { resolutionKey: "period_end" }, personal: false },
  { field: "employees", target: { concept: "employees_avg" }, itemId: S06, personal: false },
  { field: "rounded_to_nearest", target: { resolutionKey: "unit_scale" }, personal: false },
  { field: "currency", target: { resolutionKey: "currency" }, personal: false },
  { field: "created_at", target: { event: "filing.annual_report" }, itemId: S13, personal: false },
  { field: "statement_id", target: { resolutionKey: "join" }, personal: false },
  ...[...BALANCE_LINES, ...INCOME_LINES].map(([field, concept]) => ({ field, target: { concept }, itemId: S06, personal: false })),
];

// ---------------------------------------------------------------- reading

/**
 * The rows of a `;` file through the shared chunked CSV reader (SEC-6 in the S05 review: quoted
 * line breaks, field and row limits), from memory or the streamed file. `keep` sees a row's first
 * column and may skip it (the line files are about 70% statements outside the window).
 */
export function* readTable(source: RawArtifact | Uint8Array, needed: readonly string[], keep?: (first: string) => boolean): Generator<CsvRecord> {
  for (const row of readCsv(source, ";", needed, { requireHeader: true })) {
    if (keep && !keep(row.get(needed[0]!))) continue;
    yield row;
  }
}

// ---------------------------------------------------------------- selection

/**
 * A selected statement, kept compact: the window holds about 547,000 of them for the join (S05
 * memory). Amounts are numbers, NaN where the file is empty and Infinity where it is not a number.
 */
type Statement = {
  id: number;
  code: string;
  line: number;
  ended: string;
  started: string | null;
  created: string;
  employees: string;
  rounded: string;
  currency: string;
  balance?: number[];
  income?: number[];
};

/**
 * A copy of a value that does not keep the reader's 1 MiB text chunk alive: a substring of 13 or
 * more characters is a slice of its parent string in V8, so a kept timestamp would pin every chunk.
 */
const own = (value: string) => (value.length < 13 ? value : (JSON.parse(JSON.stringify(value)) as string));

/** An amount as reported: NaN when empty (no fact, never 0), Infinity when not a number (counted). */
const amountOf = (value: string) => (value === "" ? NaN : /^-?\d+(\.\d+)?$/.test(value) ? Number(value) : Infinity);

/** The later filing wins a fiscal year: the latest `created_at`, then the highest `id`. */
const supersedes = (a: Statement, b: Statement) => (a.created !== b.created ? a.created > b.created : a.id > b.id);

/**
 * Keeps a company's newest WINDOW_YEARS fiscal years, one statement each (a company that moved its
 * year end can have one fiscal year more inside the window than that). The result does not
 * depend on row order: a year is evicted only once WINDOW_YEARS newer years are held, so it can
 * never come back, and a later correction of an evicted year is discarded the same way.
 */
function consider(list: Statement[], next: Statement): void {
  const same = list.findIndex((s) => s.ended === next.ended);
  if (same >= 0) {
    if (supersedes(next, list[same]!)) list[same] = next;
    return;
  }
  if (list.length < WINDOW_YEARS) {
    list.push(next);
    return;
  }
  let oldest = 0;
  for (let i = 1; i < list.length; i++) if (list[i]!.ended < list[oldest]!.ended) oldest = i;
  if (next.ended > list[oldest]!.ended) list[oldest] = next;
}

function select(raw: RawArtifact[], ctx: ParseContext): Map<string, Statement[]> {
  const byCompany = new Map<string, Statement[]>();
  const drop = (reason: DropReason) => ctx.onDrop?.(reason);
  const start = lvFinancialsWindowStart(raw) ?? "";
  for (const row of readTable(artifact(raw, STATEMENTS_FILE), STATEMENT_COLUMNS)) {
    const ended = isoDate(row.get("year_ended_on"));
    // A year that has left the window is an expected absence, not a skip.
    if (ended && ended < start) continue;
    const code = cleanCode(row.get("legal_entity_registration_number"));
    const problem = lvCodeProblem(code);
    if (problem) {
      drop(problem);
      continue;
    }
    const type = row.get("source_type");
    if (type === "UKGP") {
      drop("consolidated_report");
      continue;
    }
    const rounded = row.get("rounded_to_nearest");
    if (!LOADED_TYPES.has(type) || UNIT_SCALE[rounded] === undefined) {
      drop("unknown_enum");
      continue;
    }
    const id = Number(row.get("id"));
    if (!Number.isSafeInteger(id) || !ended) {
      drop("invalid_record");
      continue;
    }
    const statement: Statement = {
      id,
      code,
      line: row.line,
      ended,
      started: isoDate(row.get("year_started_on")),
      created: own(row.get("created_at")),
      employees: row.get("employees"),
      rounded,
      currency: row.get("currency"),
    };
    const list = byCompany.get(code);
    if (list) consider(list, statement);
    else byCompany.set(code, [statement]);
  }
  return byCompany;
}

/** Attaches each selected statement's balance or income line; rows of other statements are skipped unparsed. */
function join(file: RawArtifact, columns: readonly string[], selected: Map<number, Statement>, side: "balance" | "income", ctx: ParseContext): void {
  for (const row of readTable(file, ["statement_id", ...columns], (first) => selected.has(Number(first)))) {
    const statement = selected.get(Number(row.get("statement_id")));
    if (!statement) continue;
    if (statement[side]) {
      ctx.onDrop?.("conflicting_line");
      continue;
    }
    statement[side] = columns.map((c) => amountOf(row.get(c)));
  }
}

// ---------------------------------------------------------------- records


const attach = (code: string) => ({ eid: `lv-${code}`, schema: "Company" as const, country: "lv", code, ref: true, statements: [] });

function record(s: Statement): ParsedRecord {
  const eid = `lv-${s.code}`;
  const facts: FactReportInput["facts"] = [];
  const dropped: NonNullable<ParsedRecord["dropped"]> = [];
  const add = (concept: string, n: number) => {
    if (n === Infinity) dropped.push({ reason: "invalid_record" });
    else if (!Number.isNaN(n)) facts.push({ concept, value: n });
  };
  add("employees_avg", amountOf(s.employees));
  const balance = s.balance ?? BALANCE_LINES.map(() => NaN);
  const income = s.income ?? INCOME_LINES.map(() => NaN);
  const hashed = (n: number) => (Number.isNaN(n) ? "" : n === Infinity ? "bad" : String(n));
  BALANCE_LINES.forEach(([, concept], i) => add(concept, balance[i]!));
  INCOME_LINES.forEach(([, concept], i) => add(concept, income[i]!));
  const filed = isoDate(s.created);
  return {
    recordKey: `${s.code}|${s.ended}`,
    rowRef: `line ${s.line}`,
    period: s.ended,
    hashInput: [String(s.id), s.created, s.started ?? "", s.ended, s.employees, s.rounded, s.currency, ...balance.map(hashed), ...income.map(hashed)],
    entities: [attach(s.code)],
    reports: [{ entityEid: eid, kind: "annual_accounts", periodStart: s.started, periodEnd: s.ended, currency: s.currency || null, unitScale: UNIT_SCALE[s.rounded]!, itemId: S06, facts }],
    events: filed ? [{ entityEid: eid, type: "filing.annual_report", date: filed, itemId: S13, data: { periodEnd: s.ended } }] : [],
    ...(dropped.length > 0 ? { dropped } : {}),
  };
}

function* annualReports(raw: RawArtifact[], ctx: ParseContext): Generator<ParsedRecord> {
  const byCompany = select(raw, ctx);
  const selected = new Map<number, Statement>();
  for (const list of byCompany.values()) for (const s of list) selected.set(s.id, s);
  join(artifact(raw, BALANCE_FILE), BALANCE_LINES.map(([c]) => c), selected, "balance", ctx);
  join(artifact(raw, INCOME_FILE), INCOME_LINES.map(([c]) => c), selected, "income", ctx);
  selected.clear();
  for (const [code, list] of byCompany) {
    byCompany.delete(code);
    for (const s of list.sort((a, b) => a.ended.localeCompare(b.ended))) yield record(s);
  }
}

// ---------------------------------------------------------------- as-of and window

const today = (raw: RawArtifact[]) => (raw[0]?.fetchedAt ?? new Date().toISOString()).slice(0, 10);

type Summary = { lastFiled: string | null; newestYear: number | null };
const summaries = new WeakMap<RawArtifact, Map<string, Summary>>();

/** The latest filing date and the newest fiscal year in the statements file, ignoring dates after `day`. */
function summary(file: RawArtifact, day: string): Summary {
  const cached = summaries.get(file)?.get(day);
  if (cached) return cached;
  let lastFiled: string | null = null;
  let newestYear: number | null = null;
  for (const row of readTable(file, ["created_at", "year_ended_on"])) {
    const filed = isoDate(row.get("created_at"));
    if (filed && filed <= day && (lastFiled === null || filed > lastFiled)) lastFiled = filed;
    const ended = isoDate(row.get("year_ended_on"));
    if (ended && ended <= day && (newestYear === null || Number(ended.slice(0, 4)) > newestYear)) newestYear = Number(ended.slice(0, 4));
  }
  const result = { lastFiled, newestYear };
  summaries.set(file, (summaries.get(file) ?? new Map()).set(day, result));
  return result;
}

/**
 * The window's start: 1 January of the 5th-newest fiscal year in the file (FY 2022-2026 on the
 * 2026-11-19 file, as measured in the spec). A company that stopped filing has no statement in it.
 */
export function lvFinancialsWindowStart(raw: RawArtifact[]): string | null {
  const file = raw.find((a) => a.name === STATEMENTS_FILE);
  const newest = file ? summary(file, today(raw)).newestYear : null;
  return newest === null ? null : `${newest - (WINDOW_YEARS - 1)}-01-01`;
}

// ---------------------------------------------------------------- the loader

const ITEMS = [S06, S13];

const meta: SourceMeta = {
  id: "lv-ur-annual-reports",
  country: "lv",
  publisher: "Uzņēmumu reģistrs (Register of Enterprises of the Republic of Latvia)",
  homepage: "https://www.ur.gov.lv",
  officialHosts: LV_REGISTER_HOSTS,
  licence: "cc0-1.0",
  attribution: "Source: Register of Enterprises of the Republic of Latvia, Annual report financial data, data.gov.lv, CC0 1.0",
  storage: "store",
  // M6 (S05 review): LV files hold natural persons or sole traders, so no LV file is kept in the raw cache.
  rawCache: false,
  cadence: "weekly",
  publishedAtUtc: "21:40",
  asOf: ["max_date_in_data", "portal_metadata", "http_last_modified"],
  maxPurgeShare: 0.02,
  purgeScope: "window",
  deepLink: LV_DEEP_LINK,
  orderUrl: null,
  requires: [],
  limits: { requestsPerSecond: 2, maxBytes: 400 * 1024 ** 2 },
  items: ITEMS,
};

export const lvUrAnnualReports: SourceLoader = {
  meta,
  parserVersion: parserVersion(meta.id, 2, LV_FINANCIALS_FIELD_MAP, ITEMS),
  fieldMap: LV_FINANCIALS_FIELD_MAP,
  fetch: async (ctx) => {
    const artifacts: RawArtifact[] = [];
    for (const file of [STATEMENTS_FILE, BALANCE_FILE, INCOME_FILE]) {
      const got = await fetchCkanFile(ctx, LV_FINANCIALS_SLUG, file);
      // The portal's date is the statements file's: the as-of reads that file.
      artifacts.push(...(file === STATEMENTS_FILE ? got : got.filter((a) => a.name !== "resource.json")));
    }
    return { artifacts };
  },
  asOf: (raw) => lvAsOf(raw, STATEMENTS_FILE, (file) => [summary(file, today(raw)).lastFiled ?? ""], today(raw)),
  parse: (raw, ctx) => annualReports(raw, ctx),
  windowStart: lvFinancialsWindowStart,
};

export const LV_FINANCIALS_LOADERS: readonly SourceLoader[] = [lvUrAnnualReports];
