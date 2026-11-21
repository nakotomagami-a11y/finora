// The synthetic fixture world (architecture §4.6, qa #22): about 2,000 entities in four countries,
// generated from a seed, never committed. Every name is obviously fictional and every id follows
// the fixture rule of §3.4, so nothing here can collide with a real register entry.
import { fixtureLei, fixtureRegisterCode, HIDE_ITEM_IDS, type BalticCountry } from "@finora/domain";

export const DEFAULT_SEED = 20261121;

/** mulberry32: small, fast and the same on every platform. */
function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type FixtureCompany = {
  eid: string;
  country: "lv" | "ee" | "lt" | "us";
  code: string;
  name: string;
  legalForm: string;
  status: string;
  address: string;
  capital: number | null;
  lei: string | null;
  ticker: string | null;
  /** A sole trader's register id, when it differs from the code (one LV row proves the refusal). */
  registrationNumber: string;
};
export type FixtureOfficer = { name: string; role: string; startDate: string; rowId: string };
export type FixtureRoleSet = { companyEid: string; country: "lv" | "ee"; lines: FixtureOfficer[] };
export type FixtureReport = { companyEid: string; country: string; periodEnd: string; revenue: number; equity: number; employees: number };
export type FixtureStateRecord = { eid: string; state: string; code: string; name: string; principals: string[] };
export type HideRow = { itemId: string; columns: string[]; rows: string[][] };

export type World = {
  seed: number;
  companies: FixtureCompany[];
  roleSets: FixtureRoleSet[];
  reports: FixtureReport[];
  eeTaxes: { companyEid: string; quarterEnd: string; taxesPaid: number }[];
  ltArrears: { companyEid: string; amount: number }[];
  stateRecords: FixtureStateRecord[];
  hide: HideRow[];
};

const FIRST = ["Example", "Sample", "Demo", "Test", "Placeholder", "Mock"];
const SECOND = ["Company", "Timber", "Logistics", "Bakery", "Trading", "Works", "Holding", "Systems", "Foods", "Energy"];
const LOCAL: Record<string, string[]> = {
  lv: ["Ābeļu", "Dārzs", "Ķēde", "Šķūnis", "Gaisma"],
  ee: ["Õun", "Pärn", "Küla", "Mägi", "Sõber"],
  lt: ["Ąžuolas", "Šilas", "Ūkis", "Žiedas", "Kelias"],
  us: ["Harbor", "Prairie", "Summit", "Canyon", "Lakeside"],
};
const SUFFIX: Record<string, Record<string, string>> = {
  lv: { "lv-sia": "SIA", "lv-as": "AS", "lv-ik": "IK" },
  ee: { "ee-ou": "OÜ", "ee-as": "AS", "ee-fie": "FIE" },
  lt: { "lt-uab": "UAB", "lt-ab": "AB", "lt-ii": "IĮ" },
  us: { "us-llc": "LLC", "us-corp": "Inc" },
};
const STATUS = ["active", "active", "active", "active", "active", "active", "liquidation", "struck_off"];
const ROLES = ["board_member", "board_member", "chair", "procurist", "auditor"];
const PEOPLE = ["Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot", "Golf", "Hotel", "India", "Juliet"];

const COUNTS = { lv: 500, ee: 380, lt: 320, us: 200 } as const;
const SOLE_TRADERS = { lv: 20, ee: 15, lt: 10 } as const;
const LV_PREFIXES = ["40003", "40103", "40203", "50003", "90000"];

/** Fixture register codes: (true check digit + 1) mod 10; a prefix with no valid code is skipped. */
function codes(country: BalticCountry, bodies: Iterable<string>, n: number): string[] {
  const out: string[] = [];
  for (const body of bodies) {
    const code = fixtureRegisterCode(country, body);
    if (code) out.push(code);
    if (out.length === n) break;
  }
  return out;
}

function* lvBodies(first: string[]): Generator<string> {
  for (let i = 0; ; i++) yield `${first[i % first.length]}${String(Math.floor(i / first.length) + 1).padStart(5, "0")}`;
}
function* counter(prefix: string, width: number): Generator<string> {
  for (let i = 1; ; i++) yield `${prefix}${String(i).padStart(width, "0")}`;
}

export function generateWorld(seed = DEFAULT_SEED): World {
  const rnd = random(seed);
  const pick = <T>(list: readonly T[]): T => list[Math.floor(rnd() * list.length)] as T;
  const int = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));
  const date = (fromYear: number, toYear: number) => `${int(fromYear, toYear)}-${String(int(1, 12)).padStart(2, "0")}-${String(int(1, 28)).padStart(2, "0")}`;

  const companies: FixtureCompany[] = [];
  const make = (country: FixtureCompany["country"], code: string, eid: string, legalForm: string, index: number): FixtureCompany => {
    const sole = ["lv-ik", "ee-fie", "lt-ii"].includes(legalForm);
    const base = index % 10 === 0 ? `Example Company ${index / 10 + 1}` : `${pick(index % 3 === 0 ? (LOCAL[country] ?? FIRST) : FIRST)} ${pick(SECOND)} ${index}`;
    const name = sole ? `Sample Trader ${index}` : base;
    return {
      eid,
      country,
      code,
      name: `${name} ${SUFFIX[country]?.[legalForm] ?? ""}`.trim(),
      legalForm,
      status: pick(STATUS),
      address: `${int(1, 99)} Example Street, Fixture Town ${int(1, 30)}`,
      capital: sole ? null : int(1, 500) * 1000,
      lei: null,
      ticker: null,
      registrationNumber: code,
    };
  };

  for (const country of ["lv", "ee", "lt"] as const) {
    const all = COUNTS[country] + SOLE_TRADERS[country];
    const list =
      country === "lv"
        ? codes("lv", lvBodies(LV_PREFIXES), all)
        : country === "ee"
          ? codes("ee", counter("1", 6), all)
          : codes("lt", counter("30", 6), all);
    list.forEach((code, i) => {
      const sole = i >= COUNTS[country];
      const forms = { lv: ["lv-sia", "lv-sia", "lv-as"], ee: ["ee-ou", "ee-ou", "ee-as"], lt: ["lt-uab", "lt-uab", "lt-ab"] }[country];
      const form = sole ? ({ lv: "lv-ik", ee: "ee-fie", lt: "lt-ii" } as const)[country] : pick(forms);
      companies.push(make(country, code, `${country}-${code}`, form, i));
    });
  }
  // One LV sole trader whose register id has the personal-code shape: the pipeline must refuse it
  // and keep the field as not loaded (lv-register.md, S04i acceptance 6). Built at run time only.
  const refused = companies.find((c) => c.legalForm === "lv-ik");
  if (refused) refused.registrationNumber = ["010190", "12345"].join("");

  for (let i = 0; i < COUNTS.us; i++) {
    const cik = `99${String(i + 1).padStart(8, "0")}`;
    const company = make("us", cik, `us-cik-${cik}`, i % 4 === 0 ? "us-llc" : "us-corp", i);
    if (i < 13) company.ticker = `ZZFX${String(i + 1).padStart(2, "0")}`;
    companies.push(company);
  }
  for (const [i, c] of companies.filter((c) => !["lv-ik", "ee-fie", "lt-ii"].includes(c.legalForm)).entries()) {
    if (i % 7 === 0) c.lei = fixtureLei(`FX00${String(i).padStart(14, "0")}`);
  }

  const roleSets: FixtureRoleSet[] = [];
  let rowId = 1000;
  for (const c of companies.filter((c) => (c.country === "lv" || c.country === "ee") && !["lv-ik", "ee-fie"].includes(c.legalForm))) {
    if (rnd() > 0.35) continue;
    const lines = Array.from({ length: int(1, 3) }, () => ({
      name: `Officer ${pick(PEOPLE)} ${int(1, 999)}`,
      role: pick(ROLES),
      startDate: date(2010, 2026),
      rowId: String(rowId++),
    }));
    roleSets.push({ companyEid: c.eid, country: c.country as "lv" | "ee", lines });
  }

  const reports: FixtureReport[] = companies
    .filter((c) => c.country !== "us" && !["lv-ik", "ee-fie", "lt-ii"].includes(c.legalForm) && rnd() < 0.5)
    .map((c) => ({ companyEid: c.eid, country: c.country, periodEnd: "2025-12-31", revenue: int(10, 5000) * 1000, equity: int(-200, 2000) * 1000, employees: int(0, 120) }));
  const eeTaxes = companies.filter((c) => c.country === "ee" && rnd() < 0.4).map((c) => ({ companyEid: c.eid, quarterEnd: "2026-09-30", taxesPaid: int(1, 900) * 100 }));
  const ltArrears = companies.filter((c) => c.country === "lt" && c.legalForm !== "lt-ii" && rnd() < 0.1).map((c) => ({ companyEid: c.eid, amount: int(1, 90) * 100 }));
  const stateRecords: FixtureStateRecord[] = Array.from({ length: 20 }, (_, i) => ({
    eid: `us-${["ny", "co", "ct", "pa"][i % 4]}-FX${String(i + 1).padStart(4, "0")}`,
    state: ["ny", "co", "ct", "pa"][i % 4] as string,
    code: `FX${String(i + 1).padStart(4, "0")}`,
    name: `${pick(LOCAL.us ?? FIRST)} ${pick(SECOND)} ${i} LLC`,
    principals: Array.from({ length: int(1, 2) }, () => `Principal ${pick(PEOPLE)} ${int(1, 99)}`),
  }));

  // Raw-layout rows for every HIDE item: no real loader ever fetches these files; the fixture
  // HIDE loader proves each one is dropped at load and counted (§10.4).
  const hide: HideRow[] = HIDE_ITEM_IDS.map((itemId) => {
    const owner = companies.find((c) => c.country === (itemId.split(".")[1]?.toLowerCase() === "all" ? "lv" : itemId.split(".")[1]?.toLowerCase()) ) ?? companies[0]!;
    return {
      itemId,
      columns: ["company_code", "holder_name", "share", "date_from"],
      rows: Array.from({ length: 3 }, (_, i) => [owner.code, `Hidden Holder ${i + 1}`, String(int(1, 100)), date(2015, 2026)]),
    };
  });

  return { seed, companies, roleSets, reports, eeTaxes, ltArrears, stateRecords, hide };
}

/** The bytes `pnpm fixtures:gen` writes: one stable JSON document per seed. */
export function serializeWorld(world: World): string {
  return `${JSON.stringify(world, null, 1)}\n`;
}

