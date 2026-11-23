// A fake source for the pipeline tests and the fixture world (S04f): its artifact is the JSON of
// its records, so parse is pure and a change to the records changes the content hash. Every name
// and code it makes is fictional.
import { ITEMS, PROPS } from "@finora/domain";
import type { AsOfStrategy, FieldMap, ParsedRecord, RawArtifact, SourceLoader, SourceMeta } from "@finora/sources";

/**
 * Every (item, prop) pair, spelled out: the fake source writes whatever a test hands it, so its field
 * map allows it all. A test of the prop-to-item check (M1-F2) sets a narrow map of its own.
 */
export const ANY_ITEM_PROP: FieldMap = ITEMS.flatMap((item) => PROPS.map((prop) => ({ field: prop, target: { prop }, itemId: item.id, personal: item.personal })));

export type FakeState = {
  records: ParsedRecord[];
  asOf: Partial<Record<AsOfStrategy, string | null>>;
  /** fetch answers `{ unchanged: true }` (a change token that did not move). */
  unchanged?: boolean;
  token?: string;
  /** parse throws after this many records (a cut-off file). */
  throwAfter?: number;
  /** parse waits this long before every record (for the concurrency test). */
  delayMs?: number;
  windowStart?: string | null;
};

export type FakeLoader = SourceLoader & { state: FakeState; fetches: number };

export function fakeSource(meta: Partial<SourceMeta> & { parserVersion?: string } = {}, state: Partial<FakeState> = {}): FakeLoader {
  const { parserVersion = "fake-1", ...rest } = meta;
  const full: SourceMeta = {
    id: "fake-register",
    country: "lv",
    publisher: "Example register",
    homepage: "https://data.example.lv/",
    officialHosts: ["data.example.lv"],
    licence: "cc0-1.0",
    attribution: null,
    storage: "store",
    cadence: "daily",
    publishedAtUtc: null,
    asOf: ["in_file_field"],
    maxPurgeShare: 0.02,
    purgeScope: "full",
    deepLink: null,
    orderUrl: null,
    requires: [],
    limits: {},
    items: ["S01.LV.01"],
    ...rest,
  };
  const loader: FakeLoader = {
    meta: full,
    parserVersion,
    fieldMap: ANY_ITEM_PROP,
    state: { records: [], asOf: { in_file_field: "2026-11-01" }, ...state },
    fetches: 0,
    async fetch() {
      loader.fetches++;
      const { records, asOf, unchanged, token, windowStart } = loader.state;
      if (unchanged) return { unchanged: true, ...(token ? { token } : {}) };
      const bytes = new TextEncoder().encode(JSON.stringify({ records, asOf, windowStart: windowStart ?? null }));
      return { artifacts: [{ name: "records.json", bytes, fetchedAt: new Date().toISOString() }], ...(token ? { token } : {}) };
    },
    asOf(raw: RawArtifact[]) {
      return (decode(raw).asOf ?? {}) as Partial<Record<AsOfStrategy, string | null>>;
    },
    windowStart(raw: RawArtifact[]) {
      return decode(raw).windowStart ?? null;
    },
    async *parse(raw: RawArtifact[]) {
      let n = 0;
      for (const record of decode(raw).records) {
        if (loader.state.throwAfter !== undefined && n >= loader.state.throwAfter) throw new Error("cut-off file");
        if (loader.state.delayMs) await new Promise((r) => setTimeout(r, loader.state.delayMs));
        n++;
        yield record;
      }
    },
  };
  return loader;
}

function decode(raw: RawArtifact[]): { records: ParsedRecord[]; asOf?: Record<string, string | null>; windowStart?: string | null } {
  const first = raw[0];
  return first ? JSON.parse(new TextDecoder().decode(first.bytes)) : { records: [] };
}

const pad = (n: number) => String(n).padStart(11, "0");

/** A company record of the fake register: `lv-<11 digits>`, named "Example Company <n> SIA". */
export function companyRecord(n: number, overrides: { name?: string; status?: string; legalForm?: string; extra?: ParsedRecord["entities"][number]["statements"] } = {}): ParsedRecord {
  const eid = `lv-${pad(n)}`;
  const name = overrides.name ?? `Example Company ${n} SIA`;
  return {
    recordKey: eid,
    hashInput: [eid, name, overrides.status ?? "active", overrides.legalForm ?? "lv-sia", JSON.stringify(overrides.extra ?? [])],
    entities: [
      {
        eid,
        schema: "Company",
        country: "lv",
        legalForm: overrides.legalForm ?? "lv-sia",
        status: overrides.status ?? "active",
        code: pad(n),
        statements: [{ prop: "name", value: name, itemId: "S01.LV.01" }, ...(overrides.extra ?? [])],
      },
    ],
  };
}

export const companies = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => companyRecord(from + i));

/** A company's role set as one record, with row-local line ids. */
export function roleSetRecord(companyN: number, lines: { name: string; role: string; startDate?: string; rowId?: string | null }[], recordId = companyN): ParsedRecord {
  const company = `lv-${pad(companyN)}`;
  return {
    recordKey: `${company}:officers`,
    hashInput: lines.map((l) => `${l.rowId ?? ""}|${l.name}|${l.role}|${l.startDate ?? ""}`),
    lineIds: lines.map((l) => l.rowId ?? null),
    entities: lines.flatMap((line, position) => [
      { eid: `p-${recordId}-${position}`, schema: "Person" as const, country: "lv", statements: [{ prop: "name", value: line.name, itemId: "S03.LV.01", line: position }] },
      {
        eid: `rel-${recordId}-${position}`,
        schema: "Directorship" as const,
        country: "lv",
        statements: [
          { prop: "organization", value: company, itemId: "S03.LV.01", line: position },
          { prop: "director", value: `p-${recordId}-${position}`, itemId: "S03.LV.01", line: position },
          { prop: "role", value: line.role, itemId: "S03.LV.01", line: position },
          ...(line.startDate ? [{ prop: "startDate", value: line.startDate, itemId: "S03.LV.01", line: position }] : []),
        ],
      },
    ]),
  };
}

/** A fetcher that must never be called: fake sources do not touch the network. */
export const noNetwork = async (): Promise<never> => {
  throw new Error("fake sources do not fetch");
};
