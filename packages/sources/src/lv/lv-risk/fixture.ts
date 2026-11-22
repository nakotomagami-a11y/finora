// Layout fixtures for the four LV risk files (lv-risk.md § Fixtures): the real headers, `;`, a
// byte-order mark and CRLF, on the LV fixture companies. Person names are fictional; the masked
// person code is built at run time, never a committed literal.
import { lvCsv, lvFixtureCode } from "../fixture-csv.ts";
import { LV_FX_INVALID_CODE, lvFx } from "../fixture-world.ts";

export const LV_INSOLVENCY_HEADER = [
  "proceeding_id", "debtor_name", "debtor_registration_number", "debtor_cleaned_name", "debtor_address", "proceeding_started_on",
  "proceeding_ended_on", "proceeding_form", "proceeding_type", "proceeding_subtype", "proceeding_resolution_type", "proceeding_resolution_name",
  "entry_created_on", "court_case_initial_number", "court_code", "court_name", "creditor_applications_deadline_date",
  "creditor_applications_deadline_in_days", "creditor_applications_deadline_in_weeks", "creditor_applications_deadline_in_months",
  "creditor_applications_deadline_in_years", "legislation_number", "legislation_version",
];
export const LV_SECURING_HEADER = ["id", "legal_entity_registration_number", "securing_measure_type", "securing_measure_type_text", "type_details", "date_from", "case_number", "institution_identifier", "institution_registration_number", "institution_name"];
export const LV_SUSPENSIONS_HEADER = ["id", "legal_entity_registration_number", "suspension_code", "suspension_code_text", "date_from", "ground_for"];
export const LV_SANCTIONS_HEADER = [
  "id", "registered_on", "entity_type", "name", "birth_date", "latvian_identity_number_masked", "nationality", "legal_form_code",
  "legal_entity_registration_number", "legal_entity_name", "legal_entity_country", "position", "position_text_lv", "position_text_en",
  "sanctions_subject_legal_form_code", "sanctions_subject_registration_number", "sanctions_subject_name", "list", "list_text", "program",
  "entry_date", "legal_base", "legal_base_url",
];

/** Text that must never survive a parse: free text, a bailiff's name, a sanctioned person's identity. */
export const LV_RISK_CANARIES = {
  debtorAddress: "7 Canary iela, Fixture Town",
  bailiff: "Test Person B, sworn bailiff",
  typeDetails: "Arrest of shares held by Test Person B",
  groundFor: "Decision of Test Person D, tax inspector",
  sanctionedPerson: "Test Person C",
  nationality: "Fixtureland",
  birthDate: "1971-02-31", // impossible on purpose (qa NIT on S05)
  legalBase: "Regulation on Test Person C",
};
export const lvRiskMaskedCode = () => [["07", "07", "71"].join(""), "*".repeat(5)].join("-");

/** An authority code in fixture form (a state institution) and a code no fixture register holds. */
export const LV_RISK_AUTHORITY_CODE = lvFixtureCode(5, "90000");
export const LV_RISK_UNKNOWN_CODE = lvFixtureCode(96);

const insolvency = (id: string, n: number | string, started: string, ended: string, form: string, type: string, subtype: string, resolution: string, court: string) => [
  id, "Debtor Name", typeof n === "number" ? lvFx(n).code : n, "debtor name", LV_RISK_CANARIES.debtorAddress, started, ended, form, type, subtype,
  resolution, resolution ? "Lietas izbeigšana" : "", `${started} 10:00:00`, court, "C01", court ? "Fixture District Court" : "", "", "", "", "", "", "L-1", "1",
];

export const lvInsolvencyCsv = () =>
  lvCsv(LV_INSOLVENCY_HEADER, [
    insolvency("5001", 17, "2026-10-01", "", "INSOLVENCY", "NATIONAL", "", "", "C30-0001-26"), // open: the company becomes insolvent
    insolvency("5002", 6, "2018-02-02", "2019-04-04", "INSOLVENCY", "NATIONAL", "", "M06", "C30-0002-18"), // closed with M06
    insolvency("5003", 22, "2025-05-05", "", "LEGAL_PROTECTION", "NATIONAL", "", "", "C30-0003-25"),
    insolvency("5004", 2, "2024-03-03", "2024-09-09", "OUT_OF_COURT_LEGAL_PROTECTION", "NATIONAL", "", "M01", ""),
    insolvency("5005", 4, "2023-01-01", "", "INSOLVENCY", "NATIONAL", "", "", "C30-0005-23"), // a sole trader: the gate drops it
    insolvency("5006", 3, "2022-06-06", "", "INSOLVENCY", "CROSS_BORDER", "MAIN", "", "C30-0006-22"),
    insolvency("5007", 5, "2021-01-01", "", "NEW_FORM", "NATIONAL", "", "", ""), // an unknown form: kept, counted
    insolvency("5008", "", "2021-01-01", "", "INSOLVENCY", "NATIONAL", "", "", ""), // no code
  ]);

export const lvSecuringMeasuresCsv = () =>
  lvCsv(LV_SECURING_HEADER, [
    ["6101", lvFx(22).code, "PROHIBITION", "Aizliegums", "", "2026-11-17", "11-0001-26", "", "", ""],
    ["6102", lvFx(22).code, "LIEN", "Piedziņa", LV_RISK_CANARIES.typeDetails, "2026-10-10", "11-0002-26", "B1", "", LV_RISK_CANARIES.bailiff], // a bailiff: name dropped
    ["6103", lvFx(1).code, "ATTACHMENT", "Arests", "", "2025-01-01", "11-0003-25", "I1", LV_RISK_AUTHORITY_CODE, "Fixture Tax Office"],
    ["6104", lvFx(2).code, "", "", "", "2024-01-01", "", "", "", ""], // an empty type
    ["6105", "", "PROHIBITION", "Aizliegums", "", "2024-01-01", "", "", "", ""], // no code
    ["6106", lvFx(4).code, "PROHIBITION", "Aizliegums", "", "2024-02-02", "", "", "", ""], // a sole trader: the gate drops it
    ["6107", lvFx(5).code, "LIEN", "Piedziņa", "", "2024-03-03", "", "B2", LV_FX_INVALID_CODE, LV_RISK_CANARIES.bailiff], // an authority code that fails the check
  ]);

export const lvSuspensionsCsv = () =>
  lvCsv(LV_SUSPENSIONS_HEADER, [
    ["7101", lvFx(24).code, "ECONOMIC_ACTIVITY_SUSPENDED", "Saimnieciskā darbība apturēta", "2026-11-17", LV_RISK_CANARIES.groundFor],
    ["7102", lvFx(22).code, "ACTIVITY_SUSPENDED", "Darbība apturēta", "2025-05-05", ""],
    ["7103", lvFx(14).code, "PROHIBITION_ON_PUBLIC_ACTIVITY", "Aizliegums", "2024-04-04", ""],
    ["7104", lvFx(4).code, "ECONOMIC_ACTIVITY_SUSPENDED", "Saimnieciskā darbība apturēta", "2023-03-03", ""], // a sole trader: the gate drops it
  ]);

type Link = { id: string; type: string; position: string; subject: number | string; list: string; program: string; url?: string; form?: string; partyCode?: string; partyName?: string; partyCountry?: string; person?: boolean };

const link = (l: Link) => [
  l.id, "2026-10-20", l.type,
  l.person ? LV_RISK_CANARIES.sanctionedPerson : "", l.person ? LV_RISK_CANARIES.birthDate : "", l.person ? lvRiskMaskedCode() : "", l.person ? LV_RISK_CANARIES.nationality : "",
  l.form ?? "", l.partyCode ?? "", l.partyName ?? "", l.partyCountry ?? "", l.position, "", "",
  "LIMITED_LIABILITY_COMPANY_SIA", typeof l.subject === "number" ? lvFx(l.subject).code : l.subject, "Subject Name", l.list, "", l.program,
  "2022-04-08", LV_RISK_CANARIES.legalBase, l.url ?? "",
];

export const lvSanctionsLinksCsv = () =>
  lvCsv(LV_SANCTIONS_HEADER, [
    link({ id: "8101", type: "NATURAL_PERSON", position: "BENEFICIAL_OWNER", subject: 1, list: "ES_SANCTIONS", program: "UKR", person: true, url: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32014R0269" }),
    link({ id: "8102", type: "LEGAL_ENTITY", position: "SHAREHOLDER", subject: 21, list: "SDN_OFAC_SANCTIONS", program: "RUSSIA-EO14024", form: "LIMITED_LIABILITY_COMPANY_SIA", partyCode: lvFx(1).code, partyName: 'SIA "Example Timber"', partyCountry: "LV" }),
    link({ id: "8103", type: "FOREIGN_ENTITY", position: "FOUNDER", subject: 2, list: "LV_SANCTIONS", program: "KRIEVIJA", partyName: "Sample Trading LLC", partyCountry: "RU", url: "https://mirror.example.com/act" }),
    link({ id: "8104", type: "LEGAL_ENTITY", position: "", subject: 5, list: "ES_SANCTIONS", program: "BLR", form: "SOLE_TRADER_IK", partyCode: lvFx(4).code, partyName: "IK Test Person A", partyCountry: "LV" }), // an NP-form party: neither linked nor named
    link({ id: "8105", type: "NATURAL_PERSON", position: "OWNER", subject: 4, list: "SDN_OFAC_SANCTIONS", program: "GLOMAG", person: true }), // the subject is a sole trader
    link({ id: "8106", type: "NATURAL_PERSON", position: "FOUNDER", subject: "", list: "ES_SANCTIONS", program: "UKR", person: true }), // no subject code
    link({ id: "8107", type: "FOREIGN_ENTITY", position: "PARTNER", subject: LV_RISK_UNKNOWN_CODE, list: "ES_SANCTIONS", program: "DPRK", partyName: "Mock Shipping Co", partyCountry: "GB" }), // a subject no register holds
  ]);
