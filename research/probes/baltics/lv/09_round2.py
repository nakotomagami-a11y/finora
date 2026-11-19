"""Round-2 measurements for Latvia: load volumes, UI vocabularies, field sizes, name collisions, headline counts.

Usage: python -I 09_round2.py <cache_dir>

Reads the CSVs from 01_ckan_download.py (and procurement JSON from 02_iub_notices.py) and writes
<cache_dir>/round2.json. Prints aggregates only: counts, percentages, lengths. No names or codes.
"""

import collections
import csv
import glob
import json
import os
import re
import statistics
import sys
import unicodedata

csv.field_size_limit(1 << 30)
BYTES_PER_STATEMENT = 123


def rows(cache, dataset, file, delim=";"):
    with open(os.path.join(cache, "raw", dataset, file), encoding="utf-8-sig", newline="") as f:
        yield from csv.DictReader(f, delimiter=delim)


def dist(counter):
    values = sorted(counter.values())
    if not values:
        return None
    return {"companies": len(values), "p50": statistics.median(values),
            "p95": values[int(0.95 * (len(values) - 1))], "max": values[-1]}


FORM_WORDS = r"\b(sia|as|ik|ks|ps|kb|zs|sabiedriba ar ierobezotu atbildibu|akciju sabiedriba|individualais komersants|" \
             r"zemnieku saimnieciba|komanditsabiedriba|pilnsabiedriba|kooperativa sabiedriba|filiale|ltd|llc|ou|uab)\b"


def normalise(name):
    s = unicodedata.normalize("NFKD", name.casefold())
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    s = re.sub(r"[^\w\s]", " ", s)
    s = re.sub(FORM_WORDS, " ", s)
    return re.sub(r"\s+", " ", s).strip()


def main():
    cache = sys.argv[1]
    out = {"A": {}, "B": {}, "C": {}}

    reg = list(rows(cache, "uz", "register.csv"))
    active = {r["regcode"] for r in reg if r["regtype"] == "K" and r["closed"].strip() == "" and not r["terminated"]}
    B = out["B"]
    B["register_closed_codes"] = dict(collections.Counter(r["closed"].strip() or "(active)" for r in reg))
    B["register_types"] = dict(collections.Counter(r["regtype"] + " " + r["regtype_text"] for r in reg).most_common())
    B["legal_forms_active"] = dict(collections.Counter(r["type"] + " " + r["type_text"] for r in reg if r["regcode"] in active).most_common())
    B["longest_name_chars"] = max(len(r["name"]) for r in reg)
    B["longest_address_chars"] = max(len(r["address"]) for r in reg)
    B["name_p95_chars"] = sorted(len(r["name"]) for r in reg)[int(0.95 * len(reg))]

    norm_all = collections.Counter()
    norm_of = {}
    for r in reg:
        n = normalise(r["name_in_quotes"] or r["name"])
        norm_of[r["regcode"]] = n
        norm_all[n] += 1
    norm_active = collections.Counter(norm_of[c] for c in active)
    B["active_name_shared_with_active_pct"] = round(100 * sum(1 for c in active if norm_active[norm_of[c]] > 1) / len(active), 2)
    B["active_name_shared_with_any_pct"] = round(100 * sum(1 for c in active if norm_all[norm_of[c]] > 1) / len(active), 2)

    officers = list(rows(cache, "officers", "officers.csv"))
    B["officer_positions"] = dict(collections.Counter(r["position"] or "(empty)" for r in officers).most_common())
    B["officer_bodies"] = dict(collections.Counter(r["governing_body"] or "(empty)" for r in officers).most_common())
    B["officers_per_company"] = dist(collections.Counter(r["at_legal_entity_registration_number"] for r in officers
                                                         if r["at_legal_entity_registration_number"] in active))
    members = list(rows(cache, "members", "members.csv"))
    B["members_per_company"] = dist(collections.Counter(r["at_legal_entity_registration_number"] for r in members
                                                        if r["at_legal_entity_registration_number"] in active))
    bos = list(rows(cache, "patiesie-labuma-guveji", "beneficial_owners.csv"))
    B["bo_per_company"] = dist(collections.Counter(r["legal_entity_registration_number"] for r in bos
                                                   if r["legal_entity_registration_number"] in active))

    masked = [r["latvian_identity_number_masked"] for r in officers + members + bos if r["latvian_identity_number_masked"]]
    legacy = sum(1 for m in masked if not m.startswith("32"))
    out["C"]["person_rows_with_masked_code"] = len(masked)
    out["C"]["legacy_birthdate_code_pct"] = round(100 * legacy / len(masked), 1)

    vocab = {
        "liquidation_types": ("liquidations", "liquidations.csv", "liquidation_type", "liquidation_type_text"),
        "reorganization_types": ("reorganizatons", "reorganizations.csv", "reorganization_type", "reorganization_type_text"),
        "securing_measure_types": ("securing-measures", "securing_measures.csv", "securing_measure_type", "securing_measure_type_text"),
        "suspension_codes": ("suspensions-prohibitions", "suspensions_prohibitions.csv", "suspension_code", "suspension_code_text"),
        "equity_capital_types": ("equity-capitals", "equity_capitals.csv", "equity_capital_type", "equity_capital_type_text"),
        "insolvency_forms": ("maksatnespejas-procesi", "insolvency_legal_person_proceeding.csv", "proceeding_form", "proceeding_type"),
        "insolvency_resolutions": ("maksatnespejas-procesi", "insolvency_legal_person_proceeding.csv", "proceeding_resolution_type", "proceeding_resolution_name"),
    }
    for key, (ds, f, code, label) in vocab.items():
        B[key] = dict(collections.Counter(f"{r[code]} | {r[label]}" for r in rows(cache, ds, f)).most_common())
    B["tax_rating"] = dict(collections.Counter(f"{r['Reitings']} | {r['Skaidrojums']}" for r in rows(
        cache, "nodoklu-maksataju-reitings", "reitings_uznemumi.csv", ",")).most_common())

    fs = list(rows(cache, "gada-parskatu-finansu-dati", "financial_statements.csv"))
    latest = {}
    for r in fs:
        c = r["legal_entity_registration_number"]
        if c in active and (c not in latest or (r["year"], r["created_at"]) > (latest[c]["year"], latest[c]["created_at"])):
            latest[c] = r
    B["fs_non_calendar_year_pct"] = round(100 * sum(1 for r in latest.values() if not (
        r["year_started_on"][5:10] == "01-01" and r["year_ended_on"][5:10] == "12-31")) / len(latest), 1)
    B["fs_currency_latest"] = dict(collections.Counter(r["currency"] for r in latest.values()))
    B["fs_rounding_latest"] = dict(collections.Counter(r["rounded_to_nearest"] for r in latest.values()))
    years = collections.defaultdict(set)
    for r in fs:
        if r["legal_entity_registration_number"] in active:
            years[r["legal_entity_registration_number"]].add(r["year"])
    B["fs_years_per_active_company"] = dist(collections.Counter({c: len(v) for c, v in years.items()}))
    B["fs_year_range"] = [min(r["year"] for r in fs), max(r["year"] for r in fs)]

    A = out["A"]

    def add(name, total, load, fields, note=""):
        A[name] = {"rows_total": total, "rows_load": load, "fields": fields, "statements": load * fields,
                   "mb": round(load * fields * BYTES_PER_STATEMENT / 1e6, 1), "note": note}

    add("register", len(reg), len(reg), 10, "all registers, terminated kept")
    add("name_history", sum(1 for _ in rows(cache, "tiesibu-subjektu-vesturiskie-nosaukumi", "register_name_history.csv")),
        sum(1 for _ in rows(cache, "tiesibu-subjektu-vesturiskie-nosaukumi", "register_name_history.csv")), 3)
    add("officers", len(officers), len(officers), 11, "file is current roles only")
    add("members", len(members), len(members), 11, "SIA only")
    add("beneficial_owners", len(bos), len(bos), 9, "load only if legal allows display")
    for name, ds, f, n in (("insolvency", "maksatnespejas-procesi", "insolvency_legal_person_proceeding.csv", 10),
                           ("securing_measures", "securing-measures", "securing_measures.csv", 7),
                           ("suspensions", "suspensions-prohibitions", "suspensions_prohibitions.csv", 5),
                           ("liquidations", "liquidations", "liquidations.csv", 5),
                           ("reorganizations", "reorganizatons", "reorganizations.csv", 5),
                           ("equity_capitals", "equity-capitals", "equity_capitals.csv", 5),
                           ("sanctions_links", "sanctions", "sanctions.csv", 8)):
        t = sum(1 for _ in rows(cache, ds, f))
        add(name, t, t, n)
    cutoff = str(int(max(r["year"] for r in fs)) - 5)
    recent_ids = {r["id"] for r in fs if r["year"] > cutoff}
    add("fs_statements", len(fs), len(recent_ids), 9, f"fiscal years > {cutoff}")
    for name, f, n in (("fs_balance_sheets", "balance_sheets.csv", 10), ("fs_income_statements", "income_statements.csv", 8),
                       ("fs_cash_flow", "cash_flow_statements.csv", 4)):
        t = load = 0
        for r in rows(cache, "gada-parskatu-finansu-dati", f):
            t += 1
            load += r["statement_id"] in recent_ids
        add(name, t, load, n, "last 5 fiscal years")
    for name, ds, f, n in (
            ("vid_taxes_quarterly", "nodoklu-maksataju-taksacijas-ceturksni-samaksato-vid-administreto-nodoklu-kopsummas", "pdb_samaksato_nodoklu_kopsummas_cet.csv", 7),
            ("vid_taxes_yearly", "komersantu-ieprieksejos-tris-taksacijas-gados-samaksato-vid-administreto-nodoklu-kopsummas", "pdb_nm_komersantu_samaksato_nodoklu_kopsumas_odata.csv", 8),
            ("vid_rating", "nodoklu-maksataju-reitings", "reitings_uznemumi.csv", 3),
            ("vid_vat_payers", "pvn-maksataji", "pdb_pvnmaksataji_odata.csv", 5),
            ("vid_suspensions", "saimnieciskas-darbibas-apturesana", "pdb_saimndarbibaaptureta_odata.csv", 5),
            ("eu_projects_2014_20", "es-lidzfinansetie-projekti", "es_fondu_projektu_saraksts.csv", 9),
            ("eu_projects_2021_27", "eiropas-savienibas-fondu-21-27-perioda-lidzfinansetie-projekti", "es_fondu_projektu_saraksts.csv", 9),
            ("eu_partners_2014_20", "es-lidzfinansetie-projekti", "es_fondu_projektu_sadarbibas_partneri.csv", 3),
            ("eu_partners_2021_27", "eiropas-savienibas-fondu-21-27-perioda-lidzfinansetie-projekti", "es_fondu_projektu_sadarbibas_partneri.csv", 3)):
        t = sum(1 for _ in rows(cache, ds, f, ","))
        add(name, t, t, n, "all published periods (fewer than the 8 quarters / 3 years proposed)" if "taxes" in name else "")
    winners = days = 0
    for path in glob.glob(os.path.join(cache, "raw", "iub", "notice", "*", "*.json")):
        days += 1
        for notice in json.load(open(path, encoding="utf-8")):
            for lot in notice.get("lots") or []:
                for contract in lot.get("contracts") or []:
                    for w in contract.get("winners") or []:
                        winners += len(w.get("winnerBusinessParties") or [])
    per_year = round(winners / days * 365)
    add("procurement_winner_rows", per_year * 3, per_year * 3, 8, f"estimated: {winners} winner rows in {days} days of 2026, x3 years since Oct 2023")
    A["_total"] = {"statements": sum(v["statements"] for v in A.values()), "mb": round(sum(v["mb"] for v in A.values()), 1)}

    out["C"]["active_commercial_register"] = len(active)
    out["C"]["bo_rows"] = len(bos)
    out["C"]["active_as"] = sum(1 for r in reg if r["regcode"] in active and r["type"] == "AS")
    out["C"]["active_as_with_member_rows"] = len({r["at_legal_entity_registration_number"] for r in members} & {
        r["regcode"] for r in reg if r["regcode"] in active and r["type"] == "AS"})
    rating = {r["Registracijas_kods"]: r["Reitings"] for r in rows(cache, "nodoklu-maksataju-reitings", "reitings_uznemumi.csv", ",")}
    out["C"]["active_rating_c_pct"] = round(100 * sum(1 for c in active if rating.get(c) == "C") / len(active), 1)

    with open(os.path.join(cache, "round2.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    for k, v in out["C"].items():
        print(f"C {k}: {v}")
    print("A total:", A["_total"])


if __name__ == "__main__":
    main()
