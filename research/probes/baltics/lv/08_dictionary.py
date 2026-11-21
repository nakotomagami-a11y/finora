"""Write the Latvian data-dictionary rows from the CSV profiles (03_profile_csv.py output).

Usage: python -I 08_dictionary.py <cache_dir>

Writes <cache_dir>/dictionary-draft.md: one row per field with type and null rate. No cell values.
"""

import json
import os
import sys

FILES = {
    "uz__register": "Enterprise Register: register",
    "officers__officers": "Enterprise Register: officers",
    "members__members": "Enterprise Register: members",
    "members__members_joint_owners": "Enterprise Register: member joint owners",
    "patiesie-labuma-guveji__beneficial_owners": "Enterprise Register: beneficial owners",
    "maksatnespejas-procesi__insolvency_legal_person_proceeding": "Enterprise Register: insolvency proceedings",
    "securing-measures__securing_measures": "Enterprise Register: securing measures",
    "suspensions-prohibitions__suspensions_prohibitions": "Enterprise Register: suspensions",
    "liquidations__liquidations": "Enterprise Register: liquidations",
    "reorganizatons__reorganizations": "Enterprise Register: reorganisations",
    "equity-capitals__equity_capitals": "Enterprise Register: equity capital",
    "tiesibu-subjektu-vesturiskie-nosaukumi__register_name_history": "Enterprise Register: name history",
    "sanctions__sanctions": "Enterprise Register: sanctions links",
    "gada-parskatu-finansu-dati__financial_statements": "Annual reports: statements",
    "gada-parskatu-finansu-dati__balance_sheets": "Annual reports: balance sheets",
    "gada-parskatu-finansu-dati__income_statements": "Annual reports: income statements",
    "gada-parskatu-finansu-dati__cash_flow_statements": "Annual reports: cash flow",
    "nodoklu-maksataju-taksacijas-ceturksni-samaksato-vid-administreto-nodoklu-kopsummas__pdb_samaksato_nodoklu_kopsummas_cet": "VID: taxes paid per quarter",
    "komersantu-ieprieksejos-tris-taksacijas-gados-samaksato-vid-administreto-nodoklu-kopsummas__pdb_nm_komersantu_samaksato_nodoklu_kopsumas_odata": "VID: taxes paid per year",
    "nodoklu-maksataju-reitings__reitings_uznemumi": "VID: taxpayer rating",
    "pvn-maksataji__pdb_pvnmaksataji_odata": "VID: VAT payers",
    "saimnieciskas-darbibas-apturesana__pdb_saimndarbibaaptureta_odata": "VID: activity suspensions",
    "pdb_dd_minalgasmaksataji_odata__pdb_dd_minalgasmaksataji_odata": "VID: minimum-wage employers",
    "eiropas-savienibas-fondu-21-27-perioda-lidzfinansetie-projekti__es_fondu_projektu_saraksts": "CFLA: EU projects 2021-27",
    "eiropas-savienibas-fondu-21-27-perioda-lidzfinansetie-projekti__es_fondu_projektu_sadarbibas_partneri": "CFLA: EU project partners 2021-27",
}

MEANING = {
    "Registracijas_kods": "registry code", "Nosaukums": "name", "Taksacijas_gads_ceturksnis": "tax quarter (Latvian text)",
    "Taksacijas_gads": "tax year", "Samaksato_VID_administreto_nodoklu_kopsumma_tukst_EUR": "taxes paid, thousand EUR",
    "Taja_skaita_PVN_iemaksa": "of which VAT paid", "Taja_skaita_PVN_atmaksa": "of which VAT refunded",
    "Taja_skaita_IIN_summa": "of which personal income tax", "Taja_skaita_IIN": "of which personal income tax",
    "Taja_skaita_VSAOI_summa": "of which social contributions", "Taja_skaita_VSAOI": "of which social contributions",
    "Videjais_nodarbinato_personu_skaits_cilv": "average employees", "Uznemejdarbibas_forma": "legal form",
    "Pamatdarbibas_NACE_kods": "main activity NACE code", "Juridiska_adrese_ATVK_kods": "territory code of legal address",
    "Juridiska_adrese_ATVK_nosaukums": "territory name", "Reitings": "tax rating A/B/C/N/J",
    "Skaidrojums": "rating explanation (Latvian)", "Informacijas_atjaunosanas_datums": "rating update date",
    "Numurs": "VAT number (LV + code)", "Aktivs": "active VAT payer (ir/nav)", "Registrets": "VAT registration date",
    "Buvniecibas_pazime": "construction-sector flag", "PVN139_2_pazime": "VAT art. 139(2) flag", "Izslegts": "removed from VAT register",
    "Lemuma_datums": "suspension decision date", "Aizliegts_veikt_darijumus_no": "transactions banned from",
    "Aizliegts_veikt_darijumus_lidz": "transactions banned until", "Lemuma_par_atjaunosanu_datums": "restoration decision date",
    "Darba_deveja_reg_kods_vai_personas_koda_otra_dala": "employer code, or second half of a personal code",
    "Darba_deveja_dzimsanas_gads": "employer birth year", "Darba_deveja_nosaukums_vai_uzvards_vards_vardi": "employer name or person's name",
    "Periods_no": "period from", "Periods_lidz": "period to",
    "ProjektaNumurs": "project number", "RegNr": "partner registry code", "Adrese": "address",
    "IesniedzejaNosaukums": "applicant name", "IesniedzejaRegNo": "applicant registry code",
    "FinansejumaSanemejaTimeklaVietne": "applicant website", "FinansejumaSanemejaEpasts": "applicant email",
    "ProjektaStatuss": "project status", "ProjektamPieskirtaisESFonduLidzfinansejums": "EU co-financing amount",
    "ProjektaKopejasIzmaksas": "total project cost", "LigumaNoslegsanasDatums": "contract date",
}

CANONICAL = {
    "regcode": "reg_code", "name": "legal_name", "type": "legal_form", "registered": "reg_date", "terminated": "closed_date",
    "closed": "status", "address": "address", "at_legal_entity_registration_number": "reg_code",
    "legal_entity_registration_number": "reg_code", "debtor_registration_number": "reg_code", "Registracijas_kods": "reg_code",
    "position": "officer_roles_dates", "registered_on": "officer_roles_dates", "latvian_identity_number_masked": "person_identifier",
    "birth_date": "person_identifier", "number_of_shares": "members_shareholders", "forename": "beneficial_owners",
    "surname": "beneficial_owners", "net_turnover": "revenue", "net_income": "net_profit", "total_assets": "total_assets",
    "equity": "equity", "employees": "fs_employees", "year": "fs_latest_year", "proceeding_form": "insolvency",
    "proceeding_started_on": "insolvency", "securing_measure_type": "pledges_securing_measures",
    "suspension_code": "pledges_securing_measures", "liquidation_type": "court_or_official_notices",
    "Samaksato_VID_administreto_nodoklu_kopsumma_tukst_EUR": "taxes_paid", "Videjais_nodarbinato_personu_skaits_cilv": "employees_current",
    "Taja_skaita_VSAOI_summa": "avg_salary (derived)", "Reitings": "tax_debt (proxy)", "Numurs": "vat_number", "Aktivs": "vat_registered",
    "Pamatdarbibas_NACE_kods": "activity_code", "Lemuma_datums": "pledges_securing_measures", "IesniedzejaRegNo": "eu_funds",
    "RegNr": "eu_funds", "list": "sanctions_eu", "sanctions_subject_registration_number": "sanctions_eu",
}


def main():
    cache = sys.argv[1]
    lines = [
        "## Latvia: data dictionary",
        "",
        "Null % measured on the 2026-11-19 pull (all rows of the file). Types inferred from values: int, dec, date, text.",
        "",
        "| Source | Table/file | Field (original) | English meaning | Type | Null % | Canonical field |",
        "|---|---|---|---|---|---|---|",
    ]
    for key, source in FILES.items():
        p = json.load(open(os.path.join(cache, "profile", key + ".json"), encoding="utf-8"))
        for c in p["columns"]:
            name = c["name"].strip('"').lstrip("﻿")
            meaning = MEANING.get(name, name.replace("_", " "))
            lines.append(f"| {source} | {p['file']} | {name} | {meaning} | {c['type']} | {c['null_pct']} | {CANONICAL.get(name, '')} |")
    lines += [
        "| IUB procurement | notice/DD-MM-YYYY.json | lots[].contracts[].winners[].winnerBusinessParties[].companyId | winner registry code | text | 0 for LV legal entities | procurement_contracts |",
        "| IUB procurement | notice/DD-MM-YYYY.json | ...winners[].tenderValue | awarded value, EUR | dec | 21 | procurement_contracts |",
        "| IUB procurement | notice/DD-MM-YYYY.json | ...winnerBusinessParties[].isNaturalPerson | winner is a natural person | bool | 0 | (filter) |",
        "| IUB procurement | notice/DD-MM-YYYY.json | noticeType, identifier, clonedFrom | notice type, ID, replaced notice | text | 0 | procurement_contracts |",
    ]
    with open(os.path.join(cache, "dictionary-draft.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    print(len(lines), "lines")


if __name__ == "__main__":
    main()
