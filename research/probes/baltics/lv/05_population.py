"""Population fill rates for Latvian companies, per canonical report field.

Usage: python -I 05_population.py <cache_dir>

Population: entities in the Commercial Register (regtype K) that are not closed or terminated.
Reads the CSVs downloaded by 01_ckan_download.py and the procurement JSON from 02_iub_notices.py.
Writes <cache_dir>/population.json with aggregate shares only, and prints a summary.
"""

import collections
import csv
import glob
import json
import os
import re
import sys

csv.field_size_limit(1 << 30)


def rows(cache, dataset, file, delim=";"):
    path = os.path.join(cache, "raw", dataset, file)
    with open(path, encoding="utf-8-sig", newline="") as f:
        yield from csv.DictReader(f, delimiter=delim)


def pct(part, whole):
    return round(100 * len(part & whole) / len(whole), 1) if whole else None


def main():
    cache = sys.argv[1]
    legal_form, active, reg = {}, set(), {}
    addr = set()
    for r in rows(cache, "uz", "register.csv"):
        if r["regtype"] != "K":
            continue
        code = r["regcode"]
        legal_form[code] = r["type"]
        if r["closed"].strip() == "" and not r["terminated"]:
            active.add(code)
            if r["address"]:
                addr.add(code)
    by_form = collections.Counter(legal_form[c] for c in active)

    officers, person_officers, masked, new_style = set(), set(), set(), 0
    with_dates = set()
    for r in rows(cache, "officers", "officers.csv"):
        c = r["at_legal_entity_registration_number"]
        officers.add(c)
        if r["registered_on"]:
            with_dates.add(c)
        if r["entity_type"] == "NATURAL_PERSON":
            person_officers.add(c)
            m = r["latvian_identity_number_masked"]
            if m or r["birth_date"]:
                masked.add(c)
            if m.startswith("32"):
                new_style += 1

    members = {r["at_legal_entity_registration_number"] for r in rows(cache, "members", "members.csv")}
    bo = {r["legal_entity_registration_number"] for r in rows(cache, "patiesie-labuma-guveji", "beneficial_owners.csv")}

    fs_latest = {}
    fs_emp = set()
    stmt_entity = {}
    for r in rows(cache, "gada-parskatu-finansu-dati", "financial_statements.csv"):
        c, y = r["legal_entity_registration_number"], int(r["year"])
        stmt_entity[r["id"]] = (c, y)
        if y > fs_latest.get(c, 0):
            fs_latest[c] = y
    fs_recent = {c for c, y in fs_latest.items() if y >= 2024}
    year_hist = collections.Counter(y for c, y in fs_latest.items() if c in active)
    for r in rows(cache, "gada-parskatu-finansu-dati", "financial_statements.csv"):
        if r["employees"] not in ("", "0") and stmt_entity[r["id"]][1] >= 2024:
            fs_emp.add(r["legal_entity_registration_number"])
    revenue = {stmt_entity[r["statement_id"]][0] for r in rows(cache, "gada-parskatu-finansu-dati", "income_statements.csv")
               if r["statement_id"] in stmt_entity and stmt_entity[r["statement_id"]][1] >= 2024 and r["net_turnover"] != ""}
    assets = {stmt_entity[r["statement_id"]][0] for r in rows(cache, "gada-parskatu-finansu-dati", "balance_sheets.csv")
              if r["statement_id"] in stmt_entity and stmt_entity[r["statement_id"]][1] >= 2024 and r["total_assets"] != ""}

    q_file = "pdb_samaksato_nodoklu_kopsummas_cet.csv"
    q_ds = "nodoklu-maksataju-taksacijas-ceturksni-samaksato-vid-administreto-nodoklu-kopsummas"
    quarters = collections.Counter()
    taxes_q, employees_q, vsaoi_q = set(), set(), set()
    latest_q = max(r["Taksacijas_gads_ceturksnis"] for r in rows(cache, q_ds, q_file, ","))
    for r in rows(cache, q_ds, q_file, ","):
        quarters[r["Taksacijas_gads_ceturksnis"]] += 1
        if r["Taksacijas_gads_ceturksnis"] != latest_q:
            continue
        c = r["Registracijas_kods"]
        if float(r["Samaksato_VID_administreto_nodoklu_kopsumma_tukst_EUR"] or 0) != 0:
            taxes_q.add(c)
        if int(r["Videjais_nodarbinato_personu_skaits_cilv"] or 0) > 0:
            employees_q.add(c)
        if float(r["Taja_skaita_VSAOI_summa"] or 0) > 0:
            vsaoi_q.add(c)

    y_ds = "komersantu-ieprieksejos-tris-taksacijas-gados-samaksato-vid-administreto-nodoklu-kopsummas"
    nace = {r["Registracijas_kods"] for r in rows(cache, y_ds, "pdb_nm_komersantu_samaksato_nodoklu_kopsumas_odata.csv", ",")
            if r["Pamatdarbibas_NACE_kods"] not in ("", "0")}

    vat_active = {r["Numurs"].removeprefix("LV") for r in rows(cache, "pvn-maksataji", "pdb_pvnmaksataji_odata.csv", ",") if r["Aktivs"] == "ir"}
    rating = {r["Registracijas_kods"]: r["Reitings"] for r in rows(cache, "nodoklu-maksataju-reitings", "reitings_uznemumi.csv", ",")}
    rating_active = collections.Counter(rating.get(c, "none") for c in active)

    insolvency_any, insolvency_open = set(), set()
    for r in rows(cache, "maksatnespejas-procesi", "insolvency_legal_person_proceeding.csv"):
        insolvency_any.add(r["debtor_registration_number"])
        if not r["proceeding_ended_on"]:
            insolvency_open.add(r["debtor_registration_number"])
    securing = {r["legal_entity_registration_number"] for r in rows(cache, "securing-measures", "securing_measures.csv")}
    suspended = {r["legal_entity_registration_number"] for r in rows(cache, "suspensions-prohibitions", "suspensions_prohibitions.csv")}
    vid_suspended = {r["Registracijas_kods"] for r in rows(cache, "saimnieciskas-darbibas-apturesana", "pdb_saimndarbibaaptureta_odata.csv", ",")
                     if not r["Lemuma_par_atjaunosanu_datums"]}
    ur_sanctions = {r["sanctions_subject_registration_number"] for r in rows(cache, "sanctions", "sanctions.csv")}

    eu = set()
    for ds in ("es-lidzfinansetie-projekti", "eiropas-savienibas-fondu-21-27-perioda-lidzfinansetie-projekti"):
        for r in rows(cache, ds, "es_fondu_projektu_saraksts.csv", ","):
            eu.add(r["IesniedzejaRegNo"])
        for r in rows(cache, ds, "es_fondu_projektu_sadarbibas_partneri.csv", ","):
            for k, v in r.items():
                if k and "Reg" in k:
                    eu.add(v)

    winners, months = set(), set()
    for path in glob.glob(os.path.join(cache, "raw", "iub", "notice", "*", "*.json")):
        months.add(os.path.basename(os.path.dirname(path)))
        for notice in json.load(open(path, encoding="utf-8")):
            for lot in notice.get("lots") or []:
                for contract in lot.get("contracts") or []:
                    for w in contract.get("winners") or []:
                        for p in w.get("winnerBusinessParties") or []:
                            if p.get("companyId"):
                                winners.add(re.sub(r"\D", "", p["companyId"]))

    fields = {
        "legal_name": active, "reg_code": active, "legal_form": active, "status": active, "reg_date": active,
        "address": addr, "activity_code": nace, "vat_registered": vat_active, "vat_number": vat_active,
        "officers": officers, "officer_roles_dates": with_dates, "members_shareholders": members,
        "beneficial_owners": bo, "person_identifier": masked,
        "fs_latest_year": fs_recent, "revenue": revenue, "total_assets": assets, "equity": assets, "net_profit": revenue,
        "fs_employees": fs_emp, "employees_current": employees_q, "avg_salary": vsaoi_q, "taxes_paid": taxes_q,
        "tax_debt": {c for c, v in rating.items() if v in ("A", "B", "C", "N", "J")},
        "insolvency": insolvency_any, "pledges_securing_measures": securing | suspended | vid_suspended,
        "eu_funds": eu, "procurement_contracts": winners, "sanctions_eu": ur_sanctions,
    }
    out = {
        "population": "LV Commercial Register, active (not closed or terminated)",
        "n_active": len(active),
        "by_legal_form": dict(by_form.most_common(12)),
        "fill_pct": {k: pct(v, active) for k, v in fields.items()},
        "notes": {
            "fs_latest_year_hist_active": dict(sorted(year_hist.items())[-6:]),
            "vid_quarters": dict(quarters), "latest_quarter": latest_q,
            "rating_active_pct": {k: round(100 * v / len(active), 1) for k, v in rating_active.most_common()},
            "insolvency_open_pct": pct(insolvency_open, active),
            "officer_masked_code_new_style_rows": new_style,
            "procurement_months_loaded": sorted(months),
            "sia_with_members_pct": pct(members, {c for c in active if legal_form[c] == "SIA"}),
            "sia_with_bo_pct": pct(bo, {c for c in active if legal_form[c] == "SIA"}),
            "as_with_bo_pct": pct(bo, {c for c in active if legal_form[c] == "AS"}),
            "sia_with_officers_pct": pct(officers, {c for c in active if legal_form[c] == "SIA"}),
            "ik_with_officers_pct": pct(officers, {c for c in active if legal_form[c] == "IK"}),
            "tax_debt_note": "rating file: presence of a rating, not a debt amount; C = violations",
        },
    }
    with open(os.path.join(cache, "population.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print(json.dumps(out, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
