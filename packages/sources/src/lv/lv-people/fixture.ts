// Layout fixtures for lv-ur-officers and lv-ur-members (lv-people.md § Fixtures): the real headers,
// `;`, a byte-order mark and CRLF, rows in ascending id order and not grouped by company, as
// upstream. Names are fictional; masked person codes are built at run time (never a committed literal).
import { lvCsv, lvFixtureCode } from "../fixture-csv.ts";
import { LV_FX_INVALID_CODE, lvFx } from "../fixture-world.ts";

export const LV_OFFICERS_HEADER = [
  "id", "uri", "at_legal_entity_registration_number", "entity_type", "position", "governing_body", "name", "latvian_identity_number_masked",
  "birth_date", "legal_entity_registration_number", "rights_of_representation_type", "representation_with_at_least", "registered_on", "last_modified_at",
];
export const LV_MEMBERS_HEADER = [
  "id", "uri", "at_legal_entity_registration_number", "entity_type", "name", "latvian_identity_number_masked", "birth_date",
  "legal_entity_registration_number", "number_of_shares", "share_nominal_value", "share_currency", "date_from", "registered_on", "last_modified_at",
];

/** A masked LV person code as the files print it (`DDMMYY-*****`): the canary that must never survive a parse. */
export const lvMaskedCodeCanary = () => [["01", "01", "90"].join(""), "*".repeat(5)].join("-");
export const LV_BIRTH_DATE_CANARY = "1990-01-01";

type Officer = { id: number; n: number; type?: string; position?: string; body?: string; name?: string; holder?: string; rights?: string; atLeast?: string; registered?: string };

const BODIES = ["EXECUTIVE_BOARD", "EXECUTIVE_BODY", "MANAGEMENT_BODY", "LIQUIDATION_COMMITTEE", "DIRECTORATE", "EXECUTIVE_COMMITTEE", "SUPERVISORY_BOARD", "STAFF_COMMITTEE", "SENATE", "AUDITOR"];

/** Day 1. Company 1's lines are in file order Zed, A, Adam: row ids follow that order, never the names. */
export const LV_OFFICERS_DAY1: readonly Officer[] = [
  { id: 1001, n: 1, position: "BOARD_MEMBER", body: "EXECUTIVE_BOARD", name: "Test Person Zed", rights: "INDIVIDUALLY", registered: "2019-03-01" },
  { id: 1002, n: 2, position: "CHAIR_OF_BOARD", body: "EXECUTIVE_BOARD", name: "Test Person B", rights: "WITH_AT_LEAST", atLeast: "2", registered: "2018-01-01" },
  { id: 1003, n: 1, position: "CHAIR_OF_BOARD", body: "EXECUTIVE_BOARD", name: "Test Person A", rights: "WITH_ALL", registered: "2017-06-15" },
  { id: 1004, n: 4, position: "OWNER", name: "Test Person A", rights: "INDIVIDUALLY", registered: "2012-02-02" }, // the same fixture human, owner of a sole trader
  { id: 1005, n: 3, position: "PRESIDENT", body: "EXECUTIVE_BODY", name: "Test Person C", rights: "WITH_CHAIR", registered: "2016-01-01" },
  { id: 1006, n: 18, position: "LIQUIDATOR", body: "LIQUIDATION_COMMITTEE", name: "Test Person D", rights: "INDIVIDUALLY", registered: "2026-09-01" },
  { id: 1007, n: 3, position: "MEMBER", body: "SUPERVISORY_BOARD", name: "Test  Person   E", rights: "WITH_DEPUTY_CHAIR", registered: "2016-01-01" },
  { id: 1008, n: 5, position: "REPRESENTATIVE_MANAGER", name: "Test Person F", rights: "WITH_AT_LEAST/WITH_CHAIR", atLeast: "3", registered: "2015-05-05" },
  { id: 1009, n: 11, position: "CO_OWNER", name: "Test Person G", rights: "WITH_AT_LEAST/WITH_ALL", atLeast: "1", registered: "2014-04-04" },
  { id: 1010, n: 1, position: "BOARD_MEMBER", body: "EXECUTIVE_BOARD", name: "Test Person Adam", rights: "INDIVIDUALLY/WITH_ALL", registered: "2021-01-01" },
  { id: 1011, n: 13, position: "ADMINISTRATOR", name: "Test Person H", rights: "INDIVIDUALLY", registered: "2013-03-03" },
  { id: 1012, n: 14, position: "AUTHORISED_REPRESENTATIVE", name: "Test Person I", rights: "INDIVIDUALLY", registered: "2013-03-04" },
  { id: 1013, n: 21, position: "MANAGER", name: "Test Person J", rights: "INDIVIDUALLY", registered: "" }, // no start date
  { id: 1014, n: 22, position: "ESTATE_TRUSTEE", name: "Test Person K", rights: "", registered: "2020-02-20" }, // no signing rights
  { id: 1015, n: 22, position: "MANAGING_DIRECTOR", name: "Test Person L", rights: "INDIVIDUALLY", registered: "2020-02-21" },
  { id: 1016, n: 20, position: "CHAIR_OF_SUPERVISORY_BOARD", body: "SUPERVISORY_BOARD", name: "Test Person M", rights: "INDIVIDUALLY", registered: "2010-10-10" },
  { id: 1017, n: 18, position: "REPRESENTATIVE_OF_THE_LIQUIDATOR", body: "LIQUIDATION_COMMITTEE", name: "Test Person N", rights: "INDIVIDUALLY", registered: "2026-09-02" },
  { id: 1018, n: 2, type: "LEGAL_ENTITY", position: "BOARD_MEMBER", body: "EXECUTIVE_BOARD", name: 'SIA "Example Timber"', holder: lvFx(1).code, rights: "INDIVIDUALLY", registered: "2019-01-01" },
  { id: 1019, n: 5, type: "LEGAL_ENTITY", position: "LIQUIDATOR", name: "IK Test Person A", holder: lvFx(4).code, rights: "INDIVIDUALLY", registered: "2020-01-01" }, // an NP-form holder: never linked
  { id: 1020, n: 3, type: "FOREIGN_ENTITY", position: "BOARD_MEMBER", body: "EXECUTIVE_BOARD", name: "Sample Holdings Ltd", rights: "INDIVIDUALLY", registered: "2016-01-02" },
  { id: 1021, n: 9, position: "OWNER", name: "Test Person O", rights: "INDIVIDUALLY", registered: "2011-01-01" }, // owner of a farm (ZEM)
  { id: 1022, n: 2, type: "TRUSTEE_BODY", position: "BOARD_MEMBER", name: "Mystery Body", rights: "INDIVIDUALLY", registered: "2019-01-01" }, // an unknown holder type
  { id: 1023, n: 22, holder: "", name: "Test Person P", body: "", rights: "", registered: "2020-02-22" }, // no position, no body
  ...BODIES.map((body, i) => ({ id: 1030 + i, n: [17, 2, 3, 18, 5, 17, 20, 17, 14, 21][i]!, position: "", body, name: `Test Person Q${i}`, rights: "INDIVIDUALLY", registered: `2022-0${1 + (i % 9)}-01` })),
];

/** Day 2: a spelling fix on 1003, line 1010 removed, line 1050 added. */
export const LV_OFFICERS_DAY2: readonly Officer[] = [
  ...LV_OFFICERS_DAY1.filter((o) => o.id !== 1010).map((o) => (o.id === 1003 ? { ...o, name: "Test Persson A" } : o)),
  { id: 1050, n: 1, position: "BOARD_MEMBER", body: "EXECUTIVE_BOARD", name: "Test Person R", rights: "INDIVIDUALLY", registered: "2026-11-17" },
];

export function lvOfficersCsv(rows: readonly Officer[] = LV_OFFICERS_DAY1): Uint8Array {
  return lvCsv(
    LV_OFFICERS_HEADER,
    rows.map((o) => {
      const type = o.type ?? "NATURAL_PERSON";
      const person = type === "NATURAL_PERSON";
      return [
        String(o.id), "", lvFx(o.n).code, type, o.position ?? "", o.body ?? "", o.name ?? "",
        person ? lvMaskedCodeCanary() : "", person ? LV_BIRTH_DATE_CANARY : "",
        o.holder ?? "", o.rights ?? "", o.atLeast ?? "0", o.registered ?? "", `${o.registered || "2026-11-17"}T10:00:00`,
      ];
    }),
  );
}

type Member = { id: number; n: number; type: string; name?: string; holder?: string; shares?: string; nominal?: string; currency?: string; from?: string; code?: boolean };

/** A code in fixture form that no fixture register row holds. */
export const LV_MEMBERS_UNKNOWN_HOLDER = lvFixtureCode(97);

export const LV_MEMBERS_ROWS: readonly Member[] = [
  { id: 2001, n: 21, type: "LEGAL_ENTITY", holder: lvFx(1).code, shares: "2800", nominal: "1.00", from: "2015-03-03" }, // 21 is a subsidiary of 1
  { id: 2002, n: 21, type: "NATURAL_PERSON", name: "Test Person F", shares: "100", nominal: "1.00" },
  { id: 2003, n: 1, type: "NATURAL_PERSON", name: "Test Person A", shares: "2800", nominal: "1.00" },
  { id: 2004, n: 2, type: "FOREIGN_ENTITY", name: "Sample Holdings Ltd", shares: "50", nominal: "40.00", from: "2011-01-01" },
  { id: 2005, n: 2, type: "JOINT_OWNERS", name: "Test Person G", shares: "50", nominal: "40.00" },
  { id: 2006, n: 5, type: "LEGAL_ENTITY", holder: lvFx(4).code, shares: "10", nominal: "1.00", from: "2016-01-01" }, // the holder is a sole trader
  { id: 2007, n: 5, type: "LEGAL_ENTITY", holder: LV_MEMBERS_UNKNOWN_HOLDER, shares: "10", nominal: "1.00", from: "2016-01-01" }, // not in the register
  { id: 2008, n: 22, type: "LEGAL_ENTITY", holder: lvFx(3).code, shares: "100", nominal: "10.00", currency: "LVL", from: "1999-05-05" }, // an LVL holding
  { id: 2008, n: 23, type: "FOREIGN_ENTITY", name: "Sample Trading LLC", shares: "1", nominal: "2800.00", from: "2020-01-01" }, // a duplicate id
  { id: 2009, n: 1, type: "LEGAL_ENTITY", holder: "", shares: "1", nominal: "1.00" }, // no holder code
  { id: 2010, n: 23, type: "LEGAL_ENTITY", holder: LV_FX_INVALID_CODE, shares: "1", nominal: "1.00" }, // a failed check digit
  { id: 2011, n: 22, type: "NATURAL_PERSON", name: "Test Person H", shares: "900", nominal: "10.00", currency: "LVL" },
  { id: 2012, n: 21, type: "FOREIGN_ENTITY", name: "Mock Capital GmbH", shares: "5", nominal: "1.00", from: "2018-08-08", code: true }, // a corporate line carrying a masked code
  { id: 2013, n: 21, type: "TRUST", name: "Mystery Trust", shares: "1", nominal: "1.00" }, // an unknown type
  { id: 2014, n: 17, type: "NATURAL_PERSON", name: "Test Person I", shares: "1", nominal: "1.00" },
];

export function lvMembersCsv(rows: readonly Member[] = LV_MEMBERS_ROWS): Uint8Array {
  return lvCsv(
    LV_MEMBERS_HEADER,
    rows.map((m) => {
      const person = m.type === "NATURAL_PERSON" || m.type === "JOINT_OWNERS" || m.code === true;
      return [
        String(m.id), "", lvFx(m.n).code, m.type, m.name ?? "", person ? lvMaskedCodeCanary() : "", person ? LV_BIRTH_DATE_CANARY : "",
        m.holder ?? "", m.shares ?? "", m.nominal ?? "", m.currency ?? "EUR", m.from ?? "", "2026-11-17", "2026-11-17T10:00:00",
      ];
    }),
  );
}
