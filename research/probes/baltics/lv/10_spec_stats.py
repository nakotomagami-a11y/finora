"""Counts the Latvian loader specs need: party-gate outcomes, natural-person rows, shared addresses, key formats.

Usage: python -I 10_spec_stats.py <cache_dir>

Aggregates only (counts and shares); writes <cache_dir>/spec_stats.json and prints it.
"""

import collections
import csv
import json
import os
import sys

csv.field_size_limit(1 << 30)
NATURAL_FORMS = {"IK", "ZEM", "ZVJ", "IND", "GIM"}
WEIGHTS = [9, 1, 4, 8, 3, 10, 2, 5, 7, 6]


def rows(cache, dataset, file, delim=";"):
    with open(os.path.join(cache, "raw", dataset, file), encoding="utf-8-sig", newline="") as f:
        yield from csv.DictReader(f, delimiter=delim)


def valid(code):
    if len(code) != 11 or not code.isdigit():
        return False
    return (3 - sum(int(d) * w for d, w in zip(code[:10], WEIGHTS))) % 11 == int(code[10])


def main():
    cache = sys.argv[1]
    form, active, addr = {}, set(), {}
    for r in rows(cache, "uz", "register.csv"):
        form[r["regcode"]] = r["type"]
        if r["closed"].strip() == "" and not r["terminated"]:
            active.add(r["regcode"])
            addr[r["regcode"]] = r["addressid"]
    s = {}
    s["register_rows"] = len(form)
    s["register_invalid_11digit"] = sum(1 for c in form if len(c) == 11 and not valid(c))
    s["register_9digit"] = sum(1 for c in form if len(c) == 9)
    s["natural_form_rows"] = sum(1 for c in form if form[c] in NATURAL_FORMS)
    s["natural_form_active"] = sum(1 for c in active if form[c] in NATURAL_FORMS)

    def gate(code):
        if not code:
            return "no_code"
        if code not in form:
            return "code_not_in_register"
        if form[code] in NATURAL_FORMS:
            return "natural_person_form"
        return "ok"

    s["officers_entity_type"] = dict(collections.Counter(r["entity_type"] for r in rows(cache, "officers", "officers.csv")))
    s["officers_at_natural_form"] = sum(1 for r in rows(cache, "officers", "officers.csv")
                                        if form.get(r["at_legal_entity_registration_number"]) in NATURAL_FORMS)
    mem = list(rows(cache, "members", "members.csv"))
    s["members_entity_type"] = dict(collections.Counter(r["entity_type"] for r in mem))
    s["members_legal_gate"] = dict(collections.Counter(gate(r["legal_entity_registration_number"]) for r in mem if r["entity_type"] == "LEGAL_ENTITY"))
    s["companies_with_corporate_member"] = len({r["at_legal_entity_registration_number"] for r in mem if r["entity_type"] in ("LEGAL_ENTITY", "FOREIGN_ENTITY")})
    s["members_duplicate_ids"] = len(mem) - len({r["id"] for r in mem})

    s["insolvency_gate"] = dict(collections.Counter(gate(r["debtor_registration_number"]) for r in rows(
        cache, "maksatnespejas-procesi", "insolvency_legal_person_proceeding.csv")))
    s["securing_gate"] = dict(collections.Counter(gate(r["legal_entity_registration_number"]) for r in rows(
        cache, "securing-measures", "securing_measures.csv")))
    s["suspensions_gate"] = dict(collections.Counter(gate(r["legal_entity_registration_number"]) for r in rows(
        cache, "suspensions-prohibitions", "suspensions_prohibitions.csv")))
    s["sanctions_subject_gate"] = dict(collections.Counter(gate(r["sanctions_subject_registration_number"]) for r in rows(
        cache, "sanctions", "sanctions.csv")))
    s["sanctions_party_type"] = dict(collections.Counter(r["entity_type"] for r in rows(cache, "sanctions", "sanctions.csv")))
    s["fs_gate"] = dict(collections.Counter(gate(r["legal_entity_registration_number"]) for r in rows(
        cache, "gada-parskatu-finansu-dati", "financial_statements.csv")))
    q = "nodoklu-maksataju-taksacijas-ceturksni-samaksato-vid-administreto-nodoklu-kopsummas"
    s["vid_quarterly_gate"] = dict(collections.Counter(gate(r["Registracijas_kods"]) for r in rows(
        cache, q, "pdb_samaksato_nodoklu_kopsummas_cet.csv", ",")))
    y = "komersantu-ieprieksejos-tris-taksacijas-gados-samaksato-vid-administreto-nodoklu-kopsummas"
    s["vid_yearly_gate"] = dict(collections.Counter(gate(r["Registracijas_kods"]) for r in rows(
        cache, y, "pdb_nm_komersantu_samaksato_nodoklu_kopsumas_odata.csv", ",")))
    s["vid_rating_gate"] = dict(collections.Counter(gate(r["Registracijas_kods"]) for r in rows(
        cache, "nodoklu-maksataju-reitings", "reitings_uznemumi.csv", ",")))
    s["vid_vat_gate"] = dict(collections.Counter(gate(r["Numurs"][2:]) for r in rows(
        cache, "pvn-maksataji", "pdb_pvnmaksataji_odata.csv", ",")))
    s["vid_suspension_gate"] = dict(collections.Counter(gate(r["Registracijas_kods"]) for r in rows(
        cache, "saimnieciskas-darbibas-apturesana", "pdb_saimndarbibaaptureta_odata.csv", ",")))

    by_addr = collections.defaultdict(set)
    for c, a in addr.items():
        if a and a != "0":
            by_addr[a].add(c)
    tainted = {a for a, cs in by_addr.items() if any(form[c] in NATURAL_FORMS for c in cs)}
    company_active = [c for c in active if form[c] not in NATURAL_FORMS]
    shared = [c for c in company_active if addr.get(c) not in tainted and len(by_addr.get(addr.get(c), ())) > 1]
    sizes = sorted(len(cs) for a, cs in by_addr.items() if a not in tainted and len(cs) > 1)
    s["active_companies_non_natural"] = len(company_active)
    s["active_addressid_filled_pct"] = round(100 * sum(1 for c in active if addr.get(c) not in ("", "0", None)) / len(active), 2)
    s["shared_address_companies_pct"] = round(100 * len(shared) / len(company_active), 1)
    s["shared_addresses"] = len(sizes)
    s["shared_address_size_p50_p95_max"] = [sizes[len(sizes) // 2], sizes[int(0.95 * (len(sizes) - 1))], sizes[-1]] if sizes else None
    s["addresses_suppressed_natural_person"] = len(tainted)

    fs = list(rows(cache, "gada-parskatu-finansu-dati", "financial_statements.csv"))
    per = collections.Counter((r["legal_entity_registration_number"], r["year"]) for r in fs)
    s["fs_company_years_with_multiple_statements_pct"] = round(100 * sum(1 for v in per.values() if v > 1) / len(per), 1)
    s["fs_source_types"] = dict(collections.Counter(r["source_type"] or "(empty)" for r in fs))
    s["fs_lag_days_p50_p95"] = None
    lags = sorted((int(r["created_at"][:4]) * 365 + int(r["created_at"][5:7]) * 30 + int(r["created_at"][8:10]))
                  - (int(r["year_ended_on"][:4]) * 365 + int(r["year_ended_on"][5:7]) * 30 + int(r["year_ended_on"][8:10]))
                  for r in fs if r["created_at"] >= "2021" and r["year"] >= "2020")
    if lags:
        s["fs_lag_days_p50_p95"] = [lags[len(lags) // 2], lags[int(0.95 * (len(lags) - 1))]]
    out = os.path.join(cache, "spec_stats.json")
    json.dump(s, open(out, "w", encoding="utf-8"), indent=1)
    print(json.dumps(s, indent=1))


if __name__ == "__main__":
    main()
