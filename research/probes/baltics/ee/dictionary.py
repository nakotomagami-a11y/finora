"""Write the Estonian data dictionary (public-safe: field names, meanings, types, null rates only).

Reads research/.cache/baltics/ee/stats/*.json (from build_index.py) and writes
research/.cache/baltics/ee/dictionary-draft.md. Book-keeping fields that repeat on every nested
record (card region/number/type, entry number, record id) are listed once per file, not per array.

Usage: python -I research/probes/baltics/ee/dictionary.py
"""

import json
from pathlib import Path

EE = Path(__file__).resolve().parents[4] / "research" / ".cache" / "baltics" / "ee"
BOOKKEEPING = ("kaardi_piirkond", "kaardi_nr", "kaardi_tyyp", "kande_nr", "kirje_id")

SOURCES = {
    "lihtandmed.csv": ("RIK e-Business Register", "basic data CSV"),
    "ettevotja_rekvisiidid__yldandmed.json": ("RIK e-Business Register", "general data JSON"),
    "ettevotja_rekvisiidid__kaardile_kantud_isikud.json": ("RIK e-Business Register", "persons on registry card"),
    "ettevotja_rekvisiidid__kandevalised_isikud.json": ("RIK e-Business Register", "persons not on registry card"),
    "ettevotja_rekvisiidid__osanikud.json": ("RIK e-Business Register", "shareholders (OÜ members)"),
    "ettevotja_rekvisiidid__kasusaajad.json": ("RIK e-Business Register", "beneficial owners"),
    "ettevotja_rekvisiidid__kommertspandid.json": ("RIK e-Business Register", "commercial pledges"),
    "ettevotja_rekvisiidid__maarused.json": ("RIK e-Business Register", "rulings"),
    "ettevotja_rekvisiidid__registrikaardid.json": ("RIK e-Business Register", "registry card entries"),
    "aruannete_yldandmed.csv": ("RIK annual reports", "1. report general data"),
    "EMTAK_myygitulu.csv": ("RIK annual reports", "2. revenue by activity"),
    "myygitulu_geograafiline.csv": ("RIK annual reports", "3. revenue by country"),
    "aruannete_elemendid_2025.csv": ("RIK annual reports", "4. key figures (one file per year 2019-2025)"),
    "emta_tasutud_maksud_kaesolev.csv": ("EMTA", "taxes paid, turnover, employees per quarter"),
    "emta_maksuvolglased.csv": ("EMTA", "tax debtors (legal persons)"),
}

MEANING = {
    "nimi": "legal name (on person records: surname or company name)", "ariregistri_kood": "registry code (8 digits)",
    "ettevotja_oiguslik_vorm": "legal form", "ettevotja_oigusliku_vormi_alaliik": "legal form subtype",
    "kmkr_nr": "VAT number", "ettevotja_staatus": "status code: R registered, L in liquidation, N in bankruptcy",
    "ettevotja_staatus_tekstina": "status as text", "ettevotja_esmakande_kpv": "date of first entry",
    "ettevotja_aadress": "address (always empty in this file)", "asukoht_ettevotja_aadressis": "street address",
    "asukoha_ehak_kood": "administrative unit code (EHAK)", "asukoha_ehak_tekstina": "administrative unit",
    "indeks_ettevotja_aadressis": "postcode", "ads_adr_id": "national address register id",
    "ads_ads_oid": "address object id (always empty here)", "ads_normaliseeritud_taisaadress": "normalised full address",
    "teabesysteemi_link": "link to the register portal page",
    "yldandmed.esmaregistreerimise_kpv": "registration date", "yldandmed.kustutamise_kpv": "deletion date (empty: deleted entities are not in the file)",
    "yldandmed.staatus": "status code", "yldandmed.oiguslik_vorm": "legal form short code",
    "yldandmed.oiguslik_vorm_tekstina": "legal form", "yldandmed.on_raamatupidamiskohustuslane": "has accounting obligation",
    "yldandmed.esitab_kasusaajad": "has submitted beneficial owners", "yldandmed.lahknevusteade_puudumisest": "no discrepancy notice on beneficial owners",
    "yldandmed.tegutseb_tekstina": "operating (yes/no)", "yldandmed.arinimed[].sisu": "business name",
    "yldandmed.aadressid[].tanav_maja_korter": "street, house, flat", "yldandmed.aadressid[].ehak": "administrative unit code",
    "yldandmed.aadressid[].aadress_ads__adr_id": "national address register id", "yldandmed.aadressid[].postiindeks": "postcode",
    "yldandmed.kapitalid[].kapitali_suurus": "share capital", "yldandmed.kapitalid[].kapitali_valuuta": "capital currency",
    "yldandmed.majandusaastad[].maj_aasta_lopp": "financial year end (dd.mm)",
    "yldandmed.sidevahendid[].liik": "contact type: EMAIL, TEL, MOB, WWW, ...", "yldandmed.sidevahendid[].sisu": "contact value",
    "yldandmed.teatatud_tegevusalad[].emtak_kood": "declared activity, EMTAK code", "yldandmed.teatatud_tegevusalad[].nace_kood": "declared activity, NACE code",
    "yldandmed.teatatud_tegevusalad[].on_pohitegevusala": "is main activity",
    "yldandmed.info_majandusaasta_aruannetest[].majandusaasta_perioodi_lopp_kpv": "annual report period end",
    "yldandmed.info_majandusaasta_aruannetest[].tootajate_arv": "employees in the annual report",
    "yldandmed.info_majandusaasta_aruannetest[].tegevusala_emtak_kood": "activity in the annual report (EMTAK)",
    "yldandmed.staatused[].staatus": "status (current entry)", "yldandmed.oigusjargsused[].tyyp_tekstina": "legal succession type (merger, division)",
    "yldandmed.seisundi_muutused[].tyyp_tekstina": "state change (e.g. bankruptcy, liquidation)",
    "yldandmed.markused_kaardil[].sisu": "remark on the registry card (free text)",
    "isiku_tyyp": "person type: F natural, J legal", "isiku_roll": "role code (JUHL board member, OSAN shareholder, ...)",
    "isiku_roll_tekstina": "role", "eesnimi": "first name", "nimi_arinimi": "surname or company name",
    "isikukood_hash": "pseudonymous person id: hash of the personal code (personal codes removed since 1 Nov 2024)",
    "isikukood_registrikood": "registry code when the person is a legal entity", "isikukood": "personal code (empty since 1 Nov 2024)",
    "valis_kood": "foreign id code", "valis_kood_riik": "country of the foreign id", "synniaeg": "birth date",
    "aadress_riik": "country of residence", "algus_kpv": "start date", "lopp_kpv": "end date",
    "osaluse_protsent": "holding, %", "osaluse_suurus": "holding, nominal amount", "osaluse_omandiliik_tekstina": "ownership type",
    "volituste_loppemise_kpv": "mandate end date", "kontrolli_teostamise_viis_tekstina": "how control is exercised (BO)",
    "lahknevusteade_esitatud": "discrepancy notice filed (BO)", "email": "person email (on card persons)",
    "pandi_summa": "pledge amount", "pandi_olek": "pledge state", "pidaja_nimi": "pledgee name", "pidaja_kood": "pledgee registry code",
    "maaruse_nr": "ruling number", "maaruse_kpv": "ruling date", "maaruse_liik_tekstina": "ruling type",
    "kandeliik_tekstina": "entry type (first entry, amendment, deletion, ...)", "joustumise_kpv": "date in force",
    "maaruse_olek_tekstina": "ruling state",
    "report_id": "report id (joins the four annual-report files)", "registrikood": "registry code",
    "aruandeaasta": "report year", "period_end": "period end", "esitatud_kpv": "submission date",
    "kas auditeeritud?": "audited", "valitud aruanne kategooria": "company size category chosen",
    "Audiitorettevõtja (AEV)": "audit firm", "audiitori otsuse tüüp": "auditor's opinion type",
    "emtak": "EMTAK code", "Jaotatud müügitulu": "revenue for this activity", "põhitegevusala": "is main activity",
    "Riigi nimetus": "country or region", "Müügitulu geograafiliste piirkondade lõikes": "revenue for that region",
    "tabel": "statement (balance sheet, income statement ...)", "elemendi_nimetus": "element (Revenue, Assets, Equity, ...)",
    "vaartus": "value, EUR",
    "Andmete seis": "data as of", "Registrikood": "registry code", "Nimi": "name", "Liik": "taxpayer type (company, FIE sole trader, non-resident, ...)",
    "Maakond": "county", "Tegevusala": "activity", "Aasta": "year",
    "Riiklikud maksud I kv": "state taxes paid, Q1 (also II-IV)", "Tööjõumaksud I kv": "labour taxes paid, Q1 (also II-IV)",
    "Käive I kv": "taxable turnover, Q1 (also II-IV)", "Töötajate arv I kv": "employees at quarter end, Q1 (also II-IV)",
    "Andmed on seisuga": "data as of", "Maksuvõlg": "tax debt, EUR", "sh vaidlustatud": "of which disputed",
    "sh tasumisgraafikus": "of which in a payment schedule", "Tasumisgraafiku lõppkuupäev": "payment schedule end date",
    "Vanima tasumata nõude tasumise tähtpäev": "due date of the oldest unpaid claim",
}

CANONICAL = {
    "nimi": "legal_name", "ariregistri_kood": "reg_code", "registrikood": "reg_code", "Registrikood": "reg_code",
    "ettevotja_oiguslik_vorm": "legal_form", "yldandmed.oiguslik_vorm_tekstina": "legal_form",
    "ettevotja_staatus": "status", "yldandmed.staatus": "status", "ettevotja_esmakande_kpv": "reg_date",
    "yldandmed.esmaregistreerimise_kpv": "reg_date", "yldandmed.kustutamise_kpv": "closed_date",
    "ads_normaliseeritud_taisaadress": "address", "yldandmed.aadressid[].tanav_maja_korter": "address",
    "yldandmed.teatatud_tegevusalad[].emtak_kood": "activity_code", "yldandmed.teatatud_tegevusalad[].nace_kood": "activity_code",
    "kmkr_nr": "vat_number", "yldandmed.sidevahendid[].sisu": "website_or_contact",
    "isiku_roll": "officers", "algus_kpv": "officer_roles_dates", "osaluse_protsent": "members_shareholders",
    "isikukood_hash": "person_identifier", "kontrolli_teostamise_viis_tekstina": "beneficial_owners",
    "aruandeaasta": "fs_latest_year", "vaartus": "revenue, net_profit, total_assets, equity, fs_employees",
    "Töötajate arv I kv": "employees_current", "Riiklikud maksud I kv": "taxes_paid", "Maksuvõlg": "tax_debt",
    "pandi_summa": "pledges_securing_measures", "maaruse_liik_tekstina": "court_or_official_notices",
}


def rows():
    out = []
    for stats_file in sorted((EE / "stats").glob("*.json")):
        d = json.loads(stats_file.read_text(encoding="utf-8"))
        name = d.get("file")
        if name not in SOURCES and not (name or "").startswith("aruannete_elemendid_2025"):
            continue
        source, table = SOURCES[name]
        out.append(f"| {source} | {table} (`{name}`, {d['top_level_records']:,} records) | | | | | |")
        seen = set()
        for path, f in d["fields"].items():
            leaf = path.split(".")[-1].split("[]")[-1] or path
            if leaf in BOOKKEEPING:
                if leaf not in seen:
                    seen.add(leaf)
                    out.append(f"| | | `{leaf}` (on nested records) | registry card book-keeping | {','.join(f['types']) or '-'} | {f['null_pct']} | - |")
                continue
            meaning = MEANING.get(path) or MEANING.get(leaf) or MEANING.get(path.split("[].")[-1]) or ""
            canon = CANONICAL.get(path) or CANONICAL.get(leaf) or ""
            out.append(f"| | | `{path}` | {meaning} | {','.join(f['types']) or '-'} | {f['null_pct']} | {canon} |")
    return out


def main():
    head = ["# Estonia: data dictionary (draft)", "",
            "Measured on the files downloaded 19 Nov 2026. Null % = share of occurrences that are null or empty.",
            "Nested arrays are written `parent[].field`; their null % is over the nested records.", "",
            "| Source | Table/file | Field (original) | English meaning | Type | Null % | Canonical field |",
            "|---|---|---|---|---|---|---|"]
    (EE / "dictionary-draft.md").write_text("\n".join(head + rows()) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
