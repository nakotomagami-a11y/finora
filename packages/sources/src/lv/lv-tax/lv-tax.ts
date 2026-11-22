// The State Revenue Service's open data (lv-tax.md): taxes paid by quarter and by year, the
// taxpayer rating, VAT payers and activity suspensions. Five sources, one per data.gov.lv dataset,
// CC0. Every row is the record of a register entity: facts, statements and events attach to it and
// never create it. Natural persons' tax lines are dropped by the pipeline's gate, which knows the
// entity's form (Part H 8); a sole trader keeps only "VAT registered: yes / no".
import { idIsPersonalCode, type DropReason } from "@finora/domain";
import { parserVersion } from "../../parser-version.ts";
import type { AsOfStrategy, Cadence, FactReportInput, FieldMap, ParseContext, ParsedRecord, PurgeScope, RawArtifact, SourceLoader, SourceMeta } from "../../types.ts";
import { artifact, cleanCode, fetchCkanFile, isoDate, lvAsOf, lvCodeProblem, LV_DEEP_LINK, LV_PORTAL_HOST, readCsv, type CsvRecord } from "../shared.ts";

const S01 = "S01.LV.01";
const S07 = "S07.LV.01";
const S08 = "S08.LV.01";
const S09 = "S09.LV.01";

export const LV_VID_HOSTS = [LV_PORTAL_HOST, "info.ur.gov.lv", "www.vid.gov.lv"];

const today = (raw: RawArtifact[]) => (raw[0]?.fetchedAt ?? new Date().toISOString()).slice(0, 10);

/** A VID date, ` DD.MM.YYYY ` (space-padded) → ISO; text after the date is ignored, anything else is null. */
export function dmyDate(value: string): string | null {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})/.exec(value.trim());
  return m ? isoDate(`${m[3]}-${m[2]}-${m[1]}`) : null;
}

/** An amount in thousand EUR as published (`.` decimal point); empty is null. */
function amount(value: string): number | null | "bad" {
  if (value === "") return null;
  return /^-?\d*\.?\d+$/.test(value) ? Number(value) : "bad";
}

/**
 * The register code of a row, or why it is skipped. A personal-code-shaped value never goes
 * further (P3): it is a natural person's, whatever the register says.
 */
function codeOf(row: CsvRecord, column: string, natural: DropReason): { code: string } | { drop: DropReason } {
  const code = cleanCode(row.get(column));
  if (idIsPersonalCode("lv", code)) return { drop: natural };
  const problem = lvCodeProblem(code);
  return problem ? { drop: problem } : { code };
}

// The register entity a row belongs to: never created or changed here. A code the store lacks is
// refused by the store (`entity_missing`); a natural person's lines are dropped by the gate.
const attach = (code: string, statements: ParsedRecord["entities"][number]["statements"] = []) => ({ eid: `lv-${code}`, schema: "Company" as const, country: "lv", code, ref: true, statements });

/** A report's facts from their columns; a figure that is not a number is no fact, counted. */
function factsOf(values: [concept: string, value: string][], dropped: NonNullable<ParsedRecord["dropped"]>): FactReportInput["facts"] {
  const facts: FactReportInput["facts"] = [];
  for (const [concept, value] of values) {
    const n = amount(value);
    if (n === "bad") dropped.push({ reason: "invalid_record" });
    else if (n !== null) facts.push({ concept, value: n });
  }
  return facts;
}

/** Personal income tax withheld plus social contributions (concepts.ts `labour_taxes`); both empty → no fact. */
function labourTaxes(iin: string, vsaoi: string, dropped: NonNullable<ParsedRecord["dropped"]>): FactReportInput["facts"] {
  const parts = [amount(iin), amount(vsaoi)];
  if (parts.includes("bad")) {
    dropped.push({ reason: "invalid_record" });
    return [];
  }
  const present = parts.filter((p): p is number => p !== null);
  if (present.length === 0) return [];
  return [{ concept: "labour_taxes", value: Math.round(present.reduce((a, b) => a + b, 0) * 1000) / 1000 }];
}

/** The employee count, 0 kept as 0. */
function employees(value: string, dropped: NonNullable<ParsedRecord["dropped"]>): FactReportInput["facts"] {
  if (value === "") return [];
  if (!/^\d+$/.test(value)) {
    dropped.push({ reason: "invalid_record" });
    return [];
  }
  return [{ concept: "employees", value: Number(value) }];
}

type Source = {
  id: string;
  slug: string;
  file: string;
  title: string;
  items: string[];
  cadence: Cadence;
  purgeScope: PurgeScope;
  asOf: AsOfStrategy[];
  fieldMap: FieldMap;
  revision: number;
  /** Every date the file vouches for, as ISO; the latest not after the sync date is the as-of. */
  dates: (file: RawArtifact) => Iterable<string>;
  records: (raw: RawArtifact[], file: string, ctx: ParseContext) => Iterable<ParsedRecord>;
};

function loader(s: Source): SourceLoader {
  const meta: SourceMeta = {
    id: s.id,
    country: "lv",
    publisher: "Valsts ieņēmumu dienests (State Revenue Service of the Republic of Latvia)",
    homepage: "https://www.vid.gov.lv",
    officialHosts: LV_VID_HOSTS,
    licence: "cc0-1.0",
    attribution: `Source: State Revenue Service of Latvia, ${s.title}, data.gov.lv, CC0 1.0`,
    storage: "store",
    cadence: s.cadence,
    publishedAtUtc: "06:30",
    asOf: s.asOf,
    maxPurgeShare: 0.02,
    purgeScope: s.purgeScope,
    deepLink: LV_DEEP_LINK,
    orderUrl: null,
    requires: [],
    limits: { requestsPerSecond: 2, maxBytes: 100 * 1024 ** 2 },
    items: s.items,
  };
  return {
    meta,
    parserVersion: parserVersion(s.id, s.revision, s.fieldMap, s.items),
    fieldMap: s.fieldMap,
    fetch: async (ctx) => ({ artifacts: await fetchCkanFile(ctx, s.slug, s.file) }),
    asOf: (raw) => {
      const found = lvAsOf(raw, s.file, s.dates, today(raw));
      // The rating file states its date in every row: that is an in-file field, not a data maximum.
      return s.asOf[0] === "in_file_field" ? { in_file_field: found.max_date_in_data ?? null, portal_metadata: found.portal_metadata ?? null, http_last_modified: found.http_last_modified ?? null } : found;
    },
    parse: (raw, ctx) => s.records(raw, s.file, ctx),
  };
}

/** Rows of a VID file: `,`-separated, every field quoted, a byte-order mark, Latvian headers. */
const rows = (raw: RawArtifact[], file: string, columns: readonly string[]) => readCsv(artifact(raw, file).bytes, ",", columns);

function* datesIn(file: RawArtifact, columns: readonly string[], toIso: (value: string) => string | null): Generator<string> {
  for (const row of readCsv(file.bytes, ",", columns)) {
    for (const c of columns) {
      const d = toIso(row.get(c));
      if (d) yield d;
    }
  }
}

/** One record per key: a repeated key is counted and the first row kept. */
function once(ctx: ParseContext): (key: string) => boolean {
  const seen = new Set<string>();
  return (key) => {
    if (!seen.has(key)) return seen.add(key), true;
    ctx.onDrop?.("duplicate_key");
    return false;
  };
}

// ---------------------------------------------------------------- lv-vid-taxes-quarterly

const QUARTERLY_COLUMNS = ["Registracijas_kods", "Taksacijas_gads_ceturksnis", "Samaksato_VID_administreto_nodoklu_kopsumma_tukst_EUR", "Taja_skaita_PVN_iemaksa", "Taja_skaita_IIN_summa", "Taja_skaita_VSAOI_summa", "Videjais_nodarbinato_personu_skaits_cilv"] as const;

export const LV_VID_QUARTERLY_FIELD_MAP: FieldMap = [
  { field: "Registracijas_kods", target: { resolutionKey: "registrationNumber" }, personal: false },
  { field: "Taksacijas_gads_ceturksnis", target: { resolutionKey: "period" }, personal: false },
  { field: "Samaksato_VID_administreto_nodoklu_kopsumma_tukst_EUR", target: { concept: "taxes_paid" }, itemId: S08, personal: false },
  { field: "Taja_skaita_PVN_iemaksa", target: { concept: "vat_paid" }, itemId: S08, personal: false },
  { field: "Taja_skaita_IIN_summa", target: { concept: "labour_taxes" }, itemId: S08, personal: false },
  { field: "Taja_skaita_VSAOI_summa", target: { concept: "labour_taxes" }, itemId: S08, personal: false },
  { field: "Videjais_nodarbinato_personu_skaits_cilv", target: { concept: "employees" }, itemId: S07, personal: false },
];

const QUARTER_START = ["01-01", "04-01", "07-01", "10-01"];
const QUARTER_END = ["03-31", "06-30", "09-30", "12-31"];

/** `2026. gada 3. ceturksnis` → the quarter's first and last day; anything else is null. */
export function quarterOf(label: string): { start: string; end: string; key: string } | null {
  const m = /^(\d{4})\. gada ([1-4])\. ceturksnis$/.exec(label.trim());
  if (!m) return null;
  const q = Number(m[2]) - 1;
  return { start: `${m[1]}-${QUARTER_START[q]}`, end: `${m[1]}-${QUARTER_END[q]}`, key: `${m[1]}Q${m[2]}` };
}

function* quarterly(raw: RawArtifact[], file: string, ctx: ParseContext): Generator<ParsedRecord> {
  const first = once(ctx);
  for (const row of rows(raw, file, QUARTERLY_COLUMNS)) {
    const coded = codeOf(row, "Registracijas_kods", "natural_person_tax");
    if ("drop" in coded) {
      ctx.onDrop?.(coded.drop);
      continue;
    }
    const quarter = quarterOf(row.get("Taksacijas_gads_ceturksnis"));
    if (!quarter) {
      ctx.onDrop?.("bad_period");
      continue;
    }
    const recordKey = `${coded.code}|${quarter.key}`;
    if (!first(recordKey)) continue;
    const dropped: NonNullable<ParsedRecord["dropped"]> = [];
    const facts = [
      ...factsOf([["taxes_paid", row.get("Samaksato_VID_administreto_nodoklu_kopsumma_tukst_EUR")], ["vat_paid", row.get("Taja_skaita_PVN_iemaksa")]], dropped),
      ...labourTaxes(row.get("Taja_skaita_IIN_summa"), row.get("Taja_skaita_VSAOI_summa"), dropped),
    ];
    const staff = employees(row.get("Videjais_nodarbinato_personu_skaits_cilv"), dropped);
    yield {
      recordKey,
      rowRef: `line ${row.line}`,
      period: quarter.end,
      hashInput: QUARTERLY_COLUMNS.map((c) => row.get(c)),
      entities: [attach(coded.code)],
      // Taxes are in thousand EUR (S08); the head count is a plain number in its own S07 report.
      // A natural person's lines of both go with the gate's rule 5 sections.
      reports: [
        { entityEid: `lv-${coded.code}`, kind: "quarterly_tax", periodStart: quarter.start, periodEnd: quarter.end, currency: "EUR", unitScale: 1000, itemId: S08, facts },
        ...(staff.length > 0 ? [{ entityEid: `lv-${coded.code}`, kind: "quarterly_employees", periodStart: quarter.start, periodEnd: quarter.end, itemId: S07, facts: staff }] : []),
      ],
      ...(dropped.length > 0 ? { dropped } : {}),
    };
  }
}

// ---------------------------------------------------------------- lv-vid-taxes-yearly

const YEARLY_COLUMNS = ["Registracijas_kods", "Taksacijas_gads", "Pamatdarbibas_NACE_kods", "Samaksato_VID_administreto_nodoklu_kopsumma_tukst_EUR", "Taja_skaita_IIN", "Taja_skaita_VSAOI", "Videjais_nodarbinato_personu_skaits_cilv"] as const;

export const LV_VID_YEARLY_FIELD_MAP: FieldMap = [
  { field: "Registracijas_kods", target: { resolutionKey: "registrationNumber" }, personal: false },
  { field: "Taksacijas_gads", target: { resolutionKey: "period" }, personal: false },
  { field: "Samaksato_VID_administreto_nodoklu_kopsumma_tukst_EUR", target: { concept: "taxes_paid" }, itemId: S08, personal: false },
  { field: "Taja_skaita_IIN", target: { concept: "labour_taxes" }, itemId: S08, personal: false },
  { field: "Taja_skaita_VSAOI", target: { concept: "labour_taxes" }, itemId: S08, personal: false },
  { field: "Videjais_nodarbinato_personu_skaits_cilv", target: { concept: "employees" }, itemId: S07, personal: false },
  { field: "Pamatdarbibas_NACE_kods", target: { prop: "classification" }, itemId: S01, personal: false },
];

/** `4120` (a trailing `.` tolerated) → `NACE:41.20`; a `?` placeholder or anything else is null. */
export function naceClass(value: string): string | null {
  const m = /^(\d{2})(\d{2})\.?$/.exec(value.trim());
  return m ? `NACE:${m[1]}.${m[2]}` : null;
}

function* yearly(raw: RawArtifact[], file: string, ctx: ParseContext): Generator<ParsedRecord> {
  // The NACE code comes from each company's newest year only, so the file is read twice.
  const newest = new Map<string, string>();
  for (const row of rows(raw, file, YEARLY_COLUMNS)) {
    const code = cleanCode(row.get("Registracijas_kods"));
    const year = row.get("Taksacijas_gads");
    if (/^\d{4}$/.test(year) && year > (newest.get(code) ?? "")) newest.set(code, year);
  }
  const first = once(ctx);
  for (const row of rows(raw, file, YEARLY_COLUMNS)) {
    const coded = codeOf(row, "Registracijas_kods", "natural_person_tax");
    if ("drop" in coded) {
      ctx.onDrop?.(coded.drop);
      continue;
    }
    const year = row.get("Taksacijas_gads");
    if (!/^\d{4}$/.test(year)) {
      ctx.onDrop?.("bad_period");
      continue;
    }
    const recordKey = `${coded.code}|${year}`;
    if (!first(recordKey)) continue;
    const dropped: NonNullable<ParsedRecord["dropped"]> = [];
    const statements: ParsedRecord["entities"][number]["statements"] = [];
    if (newest.get(coded.code) === year) {
      const nace = naceClass(row.get("Pamatdarbibas_NACE_kods"));
      if (nace) statements.push({ prop: "classification", value: nace, itemId: S01 });
      else dropped.push({ reason: "bad_nace", prop: "classification" });
    }
    const facts = [
      ...factsOf([["taxes_paid", row.get("Samaksato_VID_administreto_nodoklu_kopsumma_tukst_EUR")]], dropped),
      ...labourTaxes(row.get("Taja_skaita_IIN"), row.get("Taja_skaita_VSAOI"), dropped),
    ];
    const staff = employees(row.get("Videjais_nodarbinato_personu_skaits_cilv"), dropped);
    yield {
      recordKey,
      rowRef: `line ${row.line}`,
      period: `${year}-12-31`,
      hashInput: YEARLY_COLUMNS.map((c) => row.get(c)),
      entities: [attach(coded.code, statements)],
      reports: [
        { entityEid: `lv-${coded.code}`, kind: "annual_tax", periodStart: `${year}-01-01`, periodEnd: `${year}-12-31`, currency: "EUR", unitScale: 1000, itemId: S08, facts },
        ...(staff.length > 0 ? [{ entityEid: `lv-${coded.code}`, kind: "annual_employees", periodStart: `${year}-01-01`, periodEnd: `${year}-12-31`, itemId: S07, facts: staff }] : []),
      ],
      ...(dropped.length > 0 ? { dropped } : {}),
    };
  }
}

// ---------------------------------------------------------------- lv-vid-rating

const RATING_COLUMNS = ["Registracijas_kods", "Reitings", "Informacijas_atjaunosanas_datums"] as const;

export const LV_VID_RATING_FIELD_MAP: FieldMap = [
  { field: "Registracijas_kods", target: { resolutionKey: "registrationNumber" }, personal: false },
  { field: "Reitings", target: { prop: "finora:taxAuthorityRating" }, itemId: S08, personal: false },
  { field: "Informacijas_atjaunosanas_datums", target: { resolutionKey: "as_of" }, personal: false },
];

/** A good compliance, B needs improvement, C violations, N inactive taxpayer, J newly registered. */
export const LV_TAX_RATINGS = ["A", "B", "C", "N", "J"] as const;

function* rating(raw: RawArtifact[], file: string, ctx: ParseContext): Generator<ParsedRecord> {
  const first = once(ctx);
  for (const row of rows(raw, file, RATING_COLUMNS)) {
    const coded = codeOf(row, "Registracijas_kods", "natural_person_tax");
    if ("drop" in coded) {
      ctx.onDrop?.(coded.drop);
      continue;
    }
    const letter = row.get("Reitings");
    if (!letter) {
      ctx.onDrop?.("invalid_record");
      continue;
    }
    if (!first(coded.code)) continue;
    const known = (LV_TAX_RATINGS as readonly string[]).includes(letter);
    yield {
      recordKey: coded.code,
      rowRef: `line ${row.line}`,
      hashInput: [coded.code, letter, dmyDate(row.get("Informacijas_atjaunosanas_datums")) ?? ""],
      entities: [attach(coded.code, [{ prop: "finora:taxAuthorityRating", value: letter, itemId: S08 }])],
      ...(known ? {} : { dropped: [{ reason: "unknown_enum" as const, prop: "finora:taxAuthorityRating" }] }),
    };
  }
}

// ---------------------------------------------------------------- lv-vid-vat-payers

const VAT_COLUMNS = ["Numurs", "Aktivs", "Registrets", "Izslegts"] as const;

export const LV_VID_VAT_FIELD_MAP: FieldMap = [
  { field: "Numurs", target: { prop: "vatCode" }, itemId: S01, personal: false },
  { field: "Aktivs", target: { prop: "finora:vatRegistered" }, itemId: S01, personal: false },
  { field: "Registrets", target: { resolutionKey: "as_of" }, personal: false },
  { field: "Izslegts", target: { resolutionKey: "as_of" }, personal: false },
];

/**
 * One record per VAT number, its rows merged: active if any row is. Every number gets
 * `finora:vatRegistered`; an active one also its `vatCode`, which the gate drops for a sole trader
 * (an LV VAT number of a natural person embeds a personal code, Part H 1).
 */
function* vatPayers(raw: RawArtifact[], file: string, ctx: ParseContext): Generator<ParsedRecord> {
  const numbers = new Map<string, { line: number; rows: [string, string, string][] }>();
  for (const row of rows(raw, file, VAT_COLUMNS)) {
    const number = row.get("Numurs").replace(/\s/g, "").toUpperCase();
    const entry = numbers.get(number) ?? { line: row.line, rows: [] };
    entry.rows.push([row.get("Aktivs"), row.get("Registrets"), row.get("Izslegts")]);
    numbers.set(number, entry);
  }
  for (const [number, { line, rows: lines }] of numbers) {
    const m = /^LV(\d+)$/.exec(number);
    if (!m) {
      ctx.onDrop?.(number === "" ? "no_code" : "invalid_code");
      continue;
    }
    const code = m[1]!;
    if (idIsPersonalCode("lv", code)) {
      ctx.onDrop?.("natural_person_vat");
      continue;
    }
    const problem = lvCodeProblem(code);
    if (problem) {
      ctx.onDrop?.(problem);
      continue;
    }
    const active = lines.some(([a]) => a === "ir");
    const unknown = lines.some(([a]) => a !== "ir" && a !== "nav");
    yield {
      recordKey: number,
      rowRef: `line ${line}`,
      hashInput: lines.flat(),
      entities: [
        attach(code, [
          ...(active ? [{ prop: "vatCode", value: number, itemId: S01 }] : []),
          { prop: "finora:vatRegistered", value: active ? "yes" : "no", itemId: S01 },
        ]),
      ],
      ...(unknown ? { dropped: [{ reason: "unknown_enum" as const, prop: "finora:vatRegistered" }] } : {}),
    };
  }
}

// ---------------------------------------------------------------- lv-vid-suspensions

const SUSPENSION_COLUMNS = ["Registracijas_kods", "Lemuma_datums", "Aizliegts_veikt_darijumus_no", "Aizliegts_veikt_darijumus_lidz", "Lemuma_par_atjaunosanu_datums"] as const;

export const LV_VID_SUSPENSIONS_FIELD_MAP: FieldMap = [
  { field: "Registracijas_kods", target: { resolutionKey: "registrationNumber" }, personal: false },
  { field: "Lemuma_datums", target: { event: "register.suspension" }, itemId: S09, personal: false },
  { field: "Aizliegts_veikt_darijumus_no", target: { event: "register.suspension" }, itemId: S09, personal: false },
  { field: "Aizliegts_veikt_darijumus_lidz", target: { event: "register.suspension" }, itemId: S09, personal: false },
  { field: "Lemuma_par_atjaunosanu_datums", target: { event: "register.suspension" }, itemId: S09, personal: false },
];

function* suspensions(raw: RawArtifact[], file: string, ctx: ParseContext): Generator<ParsedRecord> {
  const first = once(ctx);
  for (const row of rows(raw, file, SUSPENSION_COLUMNS)) {
    const coded = codeOf(row, "Registracijas_kods", "natural_person_tax");
    if ("drop" in coded) {
      ctx.onDrop?.(coded.drop);
      continue;
    }
    const decided = dmyDate(row.get("Lemuma_datums"));
    if (!decided) {
      ctx.onDrop?.("bad_date");
      continue;
    }
    const recordKey = `${coded.code}|${decided}`;
    if (!first(recordKey)) continue;
    const dropped: NonNullable<ParsedRecord["dropped"]> = [];
    // An empty date is allowed (open-ended); one that does not parse is null, counted.
    const optional = (column: string) => {
      const value = row.get(column);
      const date = dmyDate(value);
      if (value && !date) dropped.push({ reason: "bad_date" });
      return date;
    };
    yield {
      recordKey,
      rowRef: `line ${row.line}`,
      hashInput: SUSPENSION_COLUMNS.map((c) => (c === "Registracijas_kods" ? coded.code : row.get(c))),
      entities: [attach(coded.code)],
      events: [
        {
          entityEid: `lv-${coded.code}`,
          type: "register.suspension",
          date: decided,
          itemId: S09,
          data: { authority: "vid", bannedFrom: optional("Aizliegts_veikt_darijumus_no"), bannedUntil: optional("Aizliegts_veikt_darijumus_lidz"), restoredOn: optional("Lemuma_par_atjaunosanu_datums") },
        },
      ],
      ...(dropped.length > 0 ? { dropped } : {}),
    };
  }
}

// ---------------------------------------------------------------- the five loaders

const DATA_FIRST: AsOfStrategy[] = ["max_date_in_data", "portal_metadata", "http_last_modified"];

export const lvVidTaxesQuarterly = loader({
  id: "lv-vid-taxes-quarterly",
  slug: "nodoklu-maksataju-taksacijas-ceturksni-samaksato-vid-administreto-nodoklu-kopsummas",
  file: "pdb_samaksato_nodoklu_kopsummas_cet.csv",
  title: "Taxes administered by the State Revenue Service paid by taxpayers per quarter",
  items: [S07, S08],
  cadence: "weekly",
  purgeScope: "periods_in_file",
  asOf: DATA_FIRST,
  fieldMap: LV_VID_QUARTERLY_FIELD_MAP,
  revision: 1,
  dates: (file) => datesIn(file, ["Taksacijas_gads_ceturksnis"], (v) => quarterOf(v)?.end ?? null),
  records: quarterly,
});

export const lvVidTaxesYearly = loader({
  id: "lv-vid-taxes-yearly",
  slug: "komersantu-ieprieksejos-tris-taksacijas-gados-samaksato-vid-administreto-nodoklu-kopsummas",
  file: "pdb_nm_komersantu_samaksato_nodoklu_kopsumas_odata.csv",
  title: "Taxes administered by the State Revenue Service paid by merchants in the previous three taxation years",
  items: [S01, S07, S08],
  cadence: "weekly",
  purgeScope: "periods_in_file",
  asOf: DATA_FIRST,
  fieldMap: LV_VID_YEARLY_FIELD_MAP,
  revision: 1,
  dates: (file) => datesIn(file, ["Taksacijas_gads"], (v) => (/^\d{4}$/.test(v) ? `${v}-12-31` : null)),
  records: yearly,
});

export const lvVidRating = loader({
  id: "lv-vid-rating",
  slug: "nodoklu-maksataju-reitings",
  file: "reitings_uznemumi.csv",
  title: "Taxpayer rating",
  items: [S08],
  cadence: "weekly",
  purgeScope: "full",
  asOf: ["in_file_field", "portal_metadata", "http_last_modified"],
  fieldMap: LV_VID_RATING_FIELD_MAP,
  revision: 1,
  dates: (file) => datesIn(file, ["Informacijas_atjaunosanas_datums"], dmyDate),
  records: rating,
});

export const lvVidVatPayers = loader({
  id: "lv-vid-vat-payers",
  slug: "pvn-maksataji",
  file: "pdb_pvnmaksataji_odata.csv",
  title: "VAT payers",
  items: [S01],
  cadence: "weekly",
  purgeScope: "full",
  asOf: DATA_FIRST,
  fieldMap: LV_VID_VAT_FIELD_MAP,
  revision: 1,
  dates: (file) => datesIn(file, ["Registrets", "Izslegts"], dmyDate),
  records: vatPayers,
});

export const lvVidSuspensions = loader({
  id: "lv-vid-suspensions",
  slug: "saimnieciskas-darbibas-apturesana",
  file: "pdb_saimndarbibaaptureta_odata.csv",
  title: "Suspension of economic activity",
  items: [S09],
  cadence: "daily",
  purgeScope: "full",
  asOf: DATA_FIRST,
  fieldMap: LV_VID_SUSPENSIONS_FIELD_MAP,
  revision: 1,
  dates: (file) => datesIn(file, ["Lemuma_datums"], dmyDate),
  records: suspensions,
});

export const LV_TAX_LOADERS: readonly SourceLoader[] = [lvVidTaxesQuarterly, lvVidTaxesYearly, lvVidRating, lvVidVatPayers, lvVidSuspensions];
