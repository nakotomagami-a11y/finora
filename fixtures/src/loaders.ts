// The `fixtures` load profile (architecture §4.6): one fake loader per storage class over the
// seeded world. Each is a named export, so a sync worker can import it by module URL; each
// regenerates the same world from the seed, so no file is ever needed.
import type { AsOfStrategy, ParsedEntity, ParsedRecord, RawArtifact, SourceLoader, SourceMeta, StorageClass } from "@finora/sources";
import { DEFAULT_SEED, generateWorld, type FixtureCompany, type World } from "./world.ts";

export const FIXTURE_AS_OF = "2026-11-20";
const HOST = "fixtures.finora.invalid";

let cached: World | null = null;
export function world(): World {
  cached ??= generateWorld(DEFAULT_SEED);
  return cached;
}

function meta(id: string, country: SourceMeta["country"], storage: StorageClass, items: string[], extra: Partial<SourceMeta> = {}): SourceMeta {
  return {
    id,
    country,
    publisher: "Finora fixture world",
    homepage: `https://${HOST}/`,
    officialHosts: [HOST],
    licence: storage === "share-alike-store" ? "cc-by-sa-3.0" : "cc0-1.0",
    attribution: "Synthetic fixture data",
    storage,
    cadence: "daily",
    publishedAtUtc: null,
    asOf: ["in_file_field"],
    maxPurgeShare: 0.02,
    purgeScope: "full",
    deepLink: null,
    orderUrl: null,
    requires: [],
    limits: {},
    items,
    ...extra,
  };
}

/** A loader whose artifact is the JSON of its records: parse is pure, a change moves the hash. */
function jsonLoader(m: SourceMeta, records: () => ParsedRecord[]): SourceLoader {
  return {
    meta: m,
    parserVersion: `fixtures-${DEFAULT_SEED}-1`,
    fieldMap: m.items.map((itemId, i) => ({ field: `field${i}`, target: { prop: "name" }, itemId, personal: itemId.startsWith("S03.") })),
    async fetch() {
      const bytes = new TextEncoder().encode(JSON.stringify(records()));
      return { artifacts: [{ name: `${m.id}.json`, bytes, fetchedAt: new Date().toISOString() }] };
    },
    asOf(): Partial<Record<AsOfStrategy, string | null>> {
      return { in_file_field: FIXTURE_AS_OF };
    },
    *parse(raw: RawArtifact[]) {
      const first = raw[0];
      if (first) yield* JSON.parse(new TextDecoder().decode(first.bytes)) as ParsedRecord[];
    },
  };
}

const item = (c: FixtureCompany) => (c.country === "us" ? "S01.US.01" : `S01.${c.country.toUpperCase()}.01`);

export function companyEntity(c: FixtureCompany): ParsedEntity {
  const s01 = item(c);
  return {
    eid: c.eid,
    schema: "Company",
    country: c.country,
    legalForm: c.legalForm,
    status: c.status,
    code: c.code,
    statements: [
      { prop: "name", value: c.name, itemId: s01 },
      { prop: "registrationNumber", value: c.registrationNumber, itemId: s01 },
      { prop: "address", value: c.address, itemId: s01 },
      ...(c.capital !== null ? [{ prop: "capital", value: String(c.capital), itemId: s01 }] : []),
      ...(c.lei ? [{ prop: "leiCode", value: c.lei, itemId: "S01.ALL.01" }] : []),
      ...(c.ticker ? [{ prop: "ticker", value: c.ticker, itemId: s01 }] : []),
    ],
  };
}

const register = (country: "lv" | "ee" | "lt" | "us") =>
  jsonLoader(meta(`fx-${country}-register`, country, "store", country === "us" ? ["S01.US.01", "S01.ALL.01"] : [`S01.${country.toUpperCase()}.01`, "S01.ALL.01"]), () =>
    world()
      .companies.filter((c) => c.country === country)
      .map((c) => ({ recordKey: c.eid, rowRef: `row-${c.code}`, hashInput: [JSON.stringify(c)], entities: [companyEntity(c)] })),
  );

export const fxLvRegister = register("lv");
export const fxEeRegister = register("ee");
export const fxLtRegister = register("lt");
export const fxUsRegister = register("us");

const officers = (country: "lv" | "ee") =>
  jsonLoader(meta(`fx-${country}-officers`, country, "store", [`S03.${country.toUpperCase()}.01`]), () =>
    world()
      .roleSets.filter((r) => r.country === country)
      .map((set, n) => {
        const itemId = `S03.${country.toUpperCase()}.01`;
        return {
          recordKey: `${set.companyEid}:officers`,
          hashInput: set.lines.map((l) => `${l.rowId}|${l.name}|${l.role}|${l.startDate}`),
          lineIds: set.lines.map((l) => l.rowId),
          entities: set.lines.flatMap((line, i) => [
            { eid: `p-${n + 1}-${i}`, schema: "Person" as const, country, statements: [{ prop: "name", value: line.name, itemId, line: i }] },
            {
              eid: `rel-${n + 1}-${i}`,
              schema: "Directorship" as const,
              country,
              statements: [
                { prop: "organization", value: set.companyEid, itemId, line: i },
                { prop: "director", value: `p-${n + 1}-${i}`, itemId, line: i },
                { prop: "role", value: line.role, itemId, line: i },
                { prop: "startDate", value: line.startDate, itemId, line: i },
              ],
            },
          ]),
        };
      }),
  );

export const fxLvOfficers = officers("lv");
export const fxEeOfficers = officers("ee");

export const fxFinancials = jsonLoader(meta("fx-financials", "intl", "store", ["S06.LV.01", "S06.EE.01", "S06.LT.01"]), () =>
  world().reports.map((r) => ({
    recordKey: `${r.companyEid}:${r.periodEnd}`,
    hashInput: [JSON.stringify(r)],
    entities: [],
    reports: [
      {
        entityEid: r.companyEid,
        kind: "annual",
        periodStart: "2025-01-01",
        periodEnd: r.periodEnd,
        currency: "EUR",
        itemId: `S06.${r.country.toUpperCase()}.01`,
        facts: [
          { concept: "revenue", value: r.revenue },
          { concept: "equity", value: r.equity },
        ],
      },
    ],
  })),
);

/** EE taxes paid: share-alike, so finora-sa.db only (or memory only in live-no-store mode). */
export const fxEeTax = jsonLoader(meta("fx-ee-tax", "ee", "share-alike-store", ["S08.EE.01b"]), () =>
  world().eeTaxes.map((t) => ({
    recordKey: `${t.companyEid}:${t.quarterEnd}`,
    hashInput: [String(t.taxesPaid)],
    entities: [],
    reports: [{ entityEid: t.companyEid, kind: "taxes", periodEnd: t.quarterEnd, currency: "EUR", itemId: "S08.EE.01b", facts: [{ concept: "taxes_paid", value: t.taxesPaid }] }],
  })),
);

/** A small daily list read into memory at refresh and never written. */
export const fxLtArrears = jsonLoader(meta("fx-lt-arrears", "lt", "live-no-store", ["S08.LT.01"]), () =>
  world().ltArrears.map((a) => ({
    recordKey: a.companyEid,
    hashInput: [String(a.amount)],
    entities: [],
    reports: [{ entityEid: a.companyEid, kind: "arrears", periodEnd: FIXTURE_AS_OF, currency: "EUR", itemId: "S08.LT.01", facts: [{ concept: "tax_arrears", value: a.amount }] }],
  })),
);

/** Raw-layout rows of every HIDE item: all of it must be dropped at load and counted. */
export const fxHide = jsonLoader(meta("fx-hide", "intl", "store", []), () =>
  world().hide.map((h) => {
    const [code] = h.rows[0] ?? [];
    const owner = world().companies.find((c) => c.code === code);
    return {
      recordKey: `hide:${h.itemId}`,
      hashInput: h.rows.map((r) => r.join("|")),
      entities: owner
        ? [{ ...companyEntity(owner), statements: h.rows.map((r) => ({ prop: "notes", value: r.join(";"), itemId: h.itemId })) }]
        : [],
    };
  }),
);

/** Every bulk loader of the profile, in load order: registers first, so the others can join. */
export const FIXTURE_PROFILE: readonly { exportName: string; loader: SourceLoader }[] = [
  { exportName: "fxLvRegister", loader: fxLvRegister },
  { exportName: "fxEeRegister", loader: fxEeRegister },
  { exportName: "fxLtRegister", loader: fxLtRegister },
  { exportName: "fxUsRegister", loader: fxUsRegister },
  { exportName: "fxLvOfficers", loader: fxLvOfficers },
  { exportName: "fxEeOfficers", loader: fxEeOfficers },
  { exportName: "fxFinancials", loader: fxFinancials },
  { exportName: "fxEeTax", loader: fxEeTax },
  { exportName: "fxLtArrears", loader: fxLtArrears },
  { exportName: "fxHide", loader: fxHide },
];

export const FIXTURE_LOADERS_MODULE = new URL("./loaders.ts", import.meta.url).href;

/** A live-cached US state register: answers one company at a time, per dataset (§3.5). */
export const fxUsState = Object.assign(jsonLoader(meta("fx-us-state", "us", "live-cached", ["S01.US.02", "S03.US.03"], { cacheTtl: { refetchHours: 24, purgeUnviewedDays: 30 } }), () => []), {
  async fetchRecord(_ctx: unknown, recordKey: string) {
    const record = world().stateRecords.find((r) => r.code === recordKey);
    const bytes = (records: ParsedRecord[]): RawArtifact[] => [{ name: "r.json", bytes: new TextEncoder().encode(JSON.stringify(records)), fetchedAt: "" }];
    if (!record) return [{ dataset: "master", status: "empty" as const }, { dataset: "principals", status: "empty" as const }];
    const master: ParsedRecord = {
      recordKey: "master",
      hashInput: [record.name],
      entities: [{ eid: record.eid, schema: "Company", country: "us", legalForm: "us-llc", status: "active", code: record.code, statements: [{ prop: "name", value: record.name, itemId: "S01.US.02" }] }],
    };
    const principals: ParsedRecord = {
      recordKey: "principals",
      hashInput: record.principals,
      entities: record.principals.flatMap((name, i) => [
        { eid: `p-9${record.code.slice(2)}-${i}`, schema: "Person" as const, country: "us", statements: [{ prop: "name", value: name, itemId: "S03.US.03", line: i }] },
        {
          eid: `rel-9${record.code.slice(2)}-${i}`,
          schema: "Directorship" as const,
          country: "us",
          statements: [
            { prop: "organization", value: record.eid, itemId: "S03.US.03", line: i },
            { prop: "director", value: `p-9${record.code.slice(2)}-${i}`, itemId: "S03.US.03", line: i },
            { prop: "role", value: "principal", itemId: "S03.US.03", line: i },
          ],
        },
      ]),
    };
    return [
      { dataset: "master", status: "ok" as const, artifacts: bytes([master]) },
      { dataset: "principals", status: "ok" as const, artifacts: bytes([principals]) },
    ];
  },
});
