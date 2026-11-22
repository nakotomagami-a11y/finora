// Layout fixtures for the six lv-ur-* sources (lv-register.md § Fixtures): the real headers, `;`,
// UTF-8 with a byte-order mark and CRLF, over the LV fixture companies.
import { lvCsv } from "../fixture-csv.ts";
import { LV_FX, LV_FX_INVALID_CODE, LV_FX_LEGACY_CODE, lvFx } from "../fixture-world.ts";

export const LV_REGISTER_HEADER = ["regcode", "sepa", "name", "name_before_quotes", "name_in_quotes", "name_after_quotes", "without_quotes", "regtype", "regtype_text", "type", "type_text", "registered", "terminated", "closed", "address", "index", "addressid", "region", "city", "atvk", "reregistration_term"];

export function lvRegisterCsv(): Uint8Array {
  const rows = LV_FX.map((c) => [c.code, "", c.name, "", "", "", c.name, c.regtype, "", c.type, "", c.registered, c.terminated, c.closed, c.address, c.index, c.addressid, "", "", "", ""]);
  rows.push([LV_FX_LEGACY_CODE, "", "Old Journal Entry", "", "", "", "", "U", "", "IND", "", "1995-01-01", "2001-01-01", "L", "", "", "", "", "", "", ""]);
  rows.push([LV_FX_INVALID_CODE, "", 'SIA "Bad Digit"', "", "", "", "", "K", "", "SIA", "", "2015-01-01", "", "", "1 Example iela", "1001", "", "", "", "", ""]);
  return lvCsv(LV_REGISTER_HEADER, rows);
}

export const lvNameHistoryCsv = () =>
  lvCsv(["regcode", "date_to", "name"], [
    [lvFx(19).code, "2018-03-01", 'SIA "Example Oldname"'],
    [lvFx(19).code, "2022-07-01", 'SIA "Example Middlename"'],
    [lvFx(4).code, "2020-01-01", "IK Test Person A Former"], // a sole trader's former name: dropped
    [lvFx(1).code, "2015-01-01", ""], // an empty name: skipped
  ]);

/** A liquidation ground naming a fictional person: grounds are free text and are never stored (legal on S05). */
export const LV_LIQUIDATION_GROUND_CANARY = "Court ruling on a claim by Test Person S";

export const lvLiquidationsCsv = () =>
  lvCsv(["id", "legal_entity_registration_number", "liquidation_type", "liquidation_type_text", "date_from", "grounds_for_liquidation", "registered_on", "last_modified_at"], [
    ["7001", lvFx(18).code, "LIQUIDATION", "Likvidācijas process", "2026-09-01", "Dalībnieku sapulces lēmums", "2026-09-02", "2026-09-02T10:00:00"],
    ["7002", lvFx(6).code, "ACTIVITY_TERMINATED_BY_COURT", "Darbības izbeigšana ar tiesas nolēmumu", "2019-01-10", LV_LIQUIDATION_GROUND_CANARY, "2019-01-11", "2019-01-11T10:00:00"],
    ["7003", lvFx(14).code, "SOMETHING_NEW", "", "2025-02-02", "", "2025-02-03", "2025-02-03T10:00:00"], // an unknown type: kept, counted
  ]);

export const lvReorganizationsCsv = () =>
  lvCsv(["id", "reorganization_type", "reorganization_type_text", "source_entity_regcode", "final_entity_regcode", "registered"], [
    ["8001", "MERGER", "Apvienošana", lvFx(7).code, lvFx(1).code, "2021-06-06"],
    ["8002", "ACQUISITION", "Pievienošana", lvFx(2).code, "", ""], // one side only, no date
  ]);

export const lvEquityCapitalsCsv = () =>
  lvCsv(["id", "legal_entity_registration_number", "equity_capital_type", "equity_capital_type_text", "amount", "currency", "date_from", "last_modified_at"], [
    ["9001", lvFx(1).code, "REGISTERED_EQUITY", "", "5000.00", "EUR", "2020-01-01", "2026-11-17T10:00:00"],
    ["9002", lvFx(1).code, "PAID_UP_EQUITY", "", "2800.00", "EUR", "2019-01-01", "2026-11-17T10:00:00"], // paid-up beats registered
    ["9003", lvFx(2).code, "PAID_UP_EQUITY", "", "2000.00", "LVL", "2005-01-01", "2026-11-17T10:00:00"], // LVL kept
    ["9004", lvFx(2).code, "PAID_UP_EQUITY", "", "1000.00", "LVL", "2001-01-01", "2026-11-17T10:00:00"], // older: loses
    ["9005", lvFx(3).code, "INVESTMENT", "", "100.00", "EUR", "2020-01-01", "2026-11-17T10:00:00"], // no item
  ]);

export const lvMemorandumCsv = () =>
  lvCsv(["id", "legal_entity_registration_number", "document_date", "registered_on"], [
    ["6001", lvFx(1).code, "2010-02-01", "2010-02-05"],
    ["6002", lvFx(2).code, "0119-03-01", "2011-03-04"], // a typo year: the registration date is used
    ["6003", "", "2012-01-01", "2012-01-02"], // no code
  ]);
