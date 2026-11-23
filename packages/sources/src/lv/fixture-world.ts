// The LV layout fixtures' companies (lv-register.md § Fixtures): one small fictional register that
// every LV loader's fixture joins to, so the files of all LV sources load together in the fixture
// profile. Codes are fixture-only (true check digit + 1); names are obviously fictional.
import { lvFixtureCode } from "./fixture-csv.ts";

export type LvFxCompany = {
  /** The company's place in this list; its code is `lvFixtureCode(n)`. */
  n: number;
  code: string;
  name: string;
  regtype: string;
  type: string;
  registered: string;
  terminated: string;
  closed: "" | "L" | "R";
  address: string;
  index: string;
  addressid: string;
};

const company = (n: number, name: string, type: string, extra: Partial<LvFxCompany> = {}): LvFxCompany => ({
  n,
  code: lvFixtureCode(n),
  name,
  regtype: "K",
  type,
  registered: `20${String(10 + (n % 15)).padStart(2, "0")}-0${1 + (n % 9)}-1${n % 10}`,
  terminated: "",
  closed: "",
  address: `${n} Example iela, Fixture Town`,
  index: `10${String(n).padStart(2, "0")}`,
  addressid: String(910000 + n),
  ...extra,
});

/** Every case the LV specs name, one company each (see the comments). */
export const LV_FX: readonly LvFxCompany[] = [
  company(1, 'SIA "Example Timber"', "SIA", { addressid: "900001" }), // shares an address with 2
  company(2, 'SIA "Demo Logistics"', "SIA", { addressid: "900001" }),
  company(3, 'AS "Sample Bakery"', "AS", { index: "" }), // address without a postal code
  company(4, "IK Test Person A", "IK", { addressid: "900002" }), // sole trader, at 5's address
  company(5, 'SIA "Example Works"', "SIA", { addressid: "900002" }), // that address is suppressed (Part H 3)
  company(6, 'SIA "Demo Closed"', "SIA", { closed: "L", terminated: "2020-05-05" }),
  company(7, 'SIA "Demo Merged"', "SIA", { closed: "R", terminated: "2021-06-06" }),
  company(8, 'SIA "Demo Terminated"', "SIA", { terminated: "2019-04-04" }), // blank closed, terminated set
  company(9, "Test Farm Person B", "ZEM"),
  company(10, "Test Enterprise Person C", "IND"),
  company(11, 'KS "Sample Partners"', "KS"),
  company(12, 'PS "Placeholder Partners"', "PS"),
  company(13, "Mock Branch FIL", "FIL", { regtype: "C" }),
  company(14, 'Biedrība "Example Club"', "BDR", { regtype: "B" }),
  company(15, "Fixture Media Outlet", "MIL", { regtype: "M" }), // media register: no item
  company(16, 'SIA "Unknown Form"', "XYZ"), // an unknown legal form
  company(17, 'SIA "Example Insolvent"', "SIA"), // an open insolvency (lv-risk)
  company(18, 'SIA "Example Liquidating"', "SIA"), // a liquidation row
  company(19, 'SIA "Example Renamed"', "SIA"), // two former names
  company(20, 'AS "Sample Holdings"', "AS"), // joint-stock: no member rows (lv-people)
  company(21, 'SIA "Demo Subsidiary"', "SIA"), // its member is company 1 (lv-people)
  company(22, 'SIA "Example Debtor"', "SIA"), // tax rating C and a securing measure (lv-tax, lv-risk)
  company(23, 'SIA "Sample Exporter"', "SIA"), // VAT payer, taxes, statements (lv-tax, lv-financials)
  company(24, 'SIA "Mock Suspended"', "SIA"), // a VID activity suspension (lv-tax)
];

export const lvFx = (n: number): LvFxCompany => {
  const found = LV_FX.find((c) => c.n === n);
  if (!found) throw new Error(`no LV fixture company ${n}`);
  return found;
};

/** A 9-digit legacy journal code and a code with a check digit that is neither real nor the fixture variant. */
export const LV_FX_LEGACY_CODE = "900009999";
export const LV_FX_INVALID_CODE = ((code) => `${code.slice(0, -1)}${(Number(code.at(-1)) + 1) % 10}`)(lvFixtureCode(99));
