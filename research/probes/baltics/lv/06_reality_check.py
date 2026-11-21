"""Reality check: build real profiles for 8 Latvian companies picked by rule, and their fill rates.

Usage: python -I 06_reality_check.py <cache_dir> [--no-gleif]

Picks AT RANDOM (random.Random(SEED).sample over the sorted candidate codes of each segment), among active
Commercial Register companies:
  2 micro (1-9 staff), 2 small (10-49), 1 medium (50-249), 1 large (250+)   staff = latest VID quarter
  1 in an open insolvency proceeding started in the last 24 months
  1 with tax-rating C ("violations in meeting tax obligations"), the open proxy for tax debt
Writes <cache_dir>/profiles/<bucket>-<n>.json (entity-level, cache only), <cache_dir>/sample_ids.json,
and <cache_dir>/fillrates.json (aggregates only). Looks up LEIs in the GLEIF API (one request each).
"""

import collections
import csv
import glob
import random
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

csv.field_size_limit(1 << 30)
UA = "finora-research/0.1 (+public repo)"
SEED = 20261120
SECTIONS = {
    "S01": ["legal_name", "reg_code", "legal_form", "address", "activity_code", "reg_date", "vat_number", "lei"],
    "S02": ["status", "closed_date", "name_history"],
    "S03": ["officers", "officer_roles_dates"],
    "S04": ["members_shareholders", "beneficial_owners"],
    "S05": ["group"],
    "S06": ["revenue", "net_profit", "total_assets", "equity"],
    "S07": ["employees_current", "avg_salary", "fs_employees"],
    "S08": ["taxes_paid", "tax_debt"],
    "S09": ["insolvency", "pledges_securing_measures", "court_or_official_notices"],
    "S10": ["courts"],
    "S11": ["sanctions_eu", "sanctions_un"],
    "S12": ["procurement_contracts", "eu_funds"],
    "S13": ["filings"],
    "S14": ["securities"],
    "S15": ["website_or_contact"],
    "S16": ["news"],
    "S17": ["network"],
    "S18": ["score_inputs"],
}
FIELDS = [
    "legal_name", "reg_code", "legal_form", "status", "reg_date", "closed_date", "address", "activity_code",
    "vat_number", "lei", "website_or_contact",
    "officers", "officer_roles_dates", "members_shareholders", "beneficial_owners", "person_identifier",
    "fs_latest_year", "revenue", "net_profit", "total_assets", "equity", "fs_employees",
    "employees_current", "avg_salary", "taxes_paid", "tax_debt", "vat_registered",
    "insolvency", "pledges_securing_measures", "court_or_official_notices",
    "procurement_contracts", "eu_funds", "sanctions_eu", "sanctions_un",
]


def rows(cache, dataset, file, delim=";"):
    with open(os.path.join(cache, "raw", dataset, file), encoding="utf-8-sig", newline="") as f:
        yield from csv.DictReader(f, delimiter=delim)




def gleif(code):
    q = urllib.parse.urlencode({"filter[entity.registeredAs]": code, "filter[entity.legalAddress.country]": "LV"})
    req = urllib.request.Request("https://api.gleif.org/api/v1/lei-records?" + q, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        data = json.load(r)["data"]
    return [d["id"] for d in data]


def main():
    cache = sys.argv[1]
    use_gleif = "--no-gleif" not in sys.argv
    reg = {}
    for r in rows(cache, "uz", "register.csv"):
        if r["regtype"] == "K":
            reg[r["regcode"]] = r
    active = {c for c, r in reg.items() if r["closed"].strip() == "" and not r["terminated"]}

    q_ds = "nodoklu-maksataju-taksacijas-ceturksni-samaksato-vid-administreto-nodoklu-kopsummas"
    q_rows = collections.defaultdict(list)
    for r in rows(cache, q_ds, "pdb_samaksato_nodoklu_kopsummas_cet.csv", ","):
        q_rows[r["Registracijas_kods"]].append(r)
    latest_q = max(r["Taksacijas_gads_ceturksnis"] for v in q_rows.values() for r in v)
    staff = {c: int(r["Videjais_nodarbinato_personu_skaits_cilv"] or 0)
             for c, v in q_rows.items() for r in v if r["Taksacijas_gads_ceturksnis"] == latest_q}
    rating = {r["Registracijas_kods"]: r["Reitings"] for r in rows(cache, "nodoklu-maksataju-reitings", "reitings_uznemumi.csv", ",")}
    insolvency = collections.defaultdict(list)
    for r in rows(cache, "maksatnespejas-procesi", "insolvency_legal_person_proceeding.csv"):
        insolvency[r["debtor_registration_number"]].append(r)

    rng = random.Random(SEED)

    def pick(cands, n):
        return rng.sample(sorted(cands), n)

    sia = {c for c in active if reg[c]["type"] == "SIA"}
    buckets = {
        "micro": pick({c for c in sia if 1 <= staff.get(c, 0) <= 9}, 2),
        "small": pick({c for c in sia if 10 <= staff.get(c, 0) <= 49}, 2),
        "medium": pick({c for c in sia if 50 <= staff.get(c, 0) <= 249}, 1),
        "large": pick({c for c in active if reg[c]["type"] in ("SIA", "AS") and staff.get(c, 0) >= 250}, 1),
        "insolvent": pick({c for c, v in insolvency.items() if c in reg and any(
            p["proceeding_form"] == "INSOLVENCY" and not p["proceeding_ended_on"] and p["proceeding_started_on"] >= "2024-11-19"
            for p in v)}, 1),
        "taxdebt": pick({c for c in sia & active if rating.get(c) == "C" and staff.get(c, 0) >= 1}, 1),
    }
    sample = {c: b for b, cs in buckets.items() for c in cs}

    def collect(dataset, file, key, delim=";"):
        out = collections.defaultdict(list)
        for r in rows(cache, dataset, file, delim):
            if r.get(key) in sample:
                out[r[key]].append(r)
        return out

    person_companies = collections.defaultdict(set)
    legal_members = collections.defaultdict(set)
    for ds, file, key, first, last in (("officers", "officers.csv", "at_legal_entity_registration_number", "name", None),
                                       ("members", "members.csv", "at_legal_entity_registration_number", "name", None),
                                       ("patiesie-labuma-guveji", "beneficial_owners.csv", "legal_entity_registration_number", "forename", "surname")):
        for r in rows(cache, ds, file):
            if r.get("entity_type", "NATURAL_PERSON") == "NATURAL_PERSON" and r["latvian_identity_number_masked"]:
                name = (r[first] + " " + (r[last] if last else "")).strip().lower()
                person_companies[(name, r["latvian_identity_number_masked"])].add(r[key])
            if ds == "members" and r["entity_type"] in ("LEGAL_ENTITY", "FOREIGN_ENTITY"):
                legal_members[r[key]].add(r["legal_entity_registration_number"] or r["name"])
                if r["legal_entity_registration_number"]:
                    legal_members[r["legal_entity_registration_number"]].add(r[key])
    linked = collections.defaultdict(set)
    for comps in person_companies.values():
        if 1 < len(comps) < 200:
            for c in comps:
                linked[c] |= comps - {c}
    name_hist = {r["regcode"] for r in rows(cache, "tiesibu-subjektu-vesturiskie-nosaukumi", "register_name_history.csv")}

    officers = collect("officers", "officers.csv", "at_legal_entity_registration_number")
    members = collect("members", "members.csv", "at_legal_entity_registration_number")
    bos = collect("patiesie-labuma-guveji", "beneficial_owners.csv", "legal_entity_registration_number")
    securing = collect("securing-measures", "securing_measures.csv", "legal_entity_registration_number")
    suspensions = collect("suspensions-prohibitions", "suspensions_prohibitions.csv", "legal_entity_registration_number")
    liquidations = collect("liquidations", "liquidations.csv", "legal_entity_registration_number")
    vid_susp = collect("saimnieciskas-darbibas-apturesana", "pdb_saimndarbibaaptureta_odata.csv", "Registracijas_kods", ",")
    yearly = collect("komersantu-ieprieksejos-tris-taksacijas-gados-samaksato-vid-administreto-nodoklu-kopsummas",
                     "pdb_nm_komersantu_samaksato_nodoklu_kopsumas_odata.csv", "Registracijas_kods", ",")
    sanctions = collect("sanctions", "sanctions.csv", "sanctions_subject_registration_number")
    vat = collections.defaultdict(list)
    for r in rows(cache, "pvn-maksataji", "pdb_pvnmaksataji_odata.csv", ","):
        c = r["Numurs"].removeprefix("LV")
        if c in sample:
            vat[c].append(r)
    fs = collect("gada-parskatu-finansu-dati", "financial_statements.csv", "legal_entity_registration_number")
    stmt = {r["id"]: c for c, v in fs.items() for r in v}
    inc = {r["statement_id"]: r for r in rows(cache, "gada-parskatu-finansu-dati", "income_statements.csv") if r["statement_id"] in stmt}
    bal = {r["statement_id"]: r for r in rows(cache, "gada-parskatu-finansu-dati", "balance_sheets.csv") if r["statement_id"] in stmt}
    eu = collections.defaultdict(list)
    for ds in ("es-lidzfinansetie-projekti", "eiropas-savienibas-fondu-21-27-perioda-lidzfinansetie-projekti"):
        for r in rows(cache, ds, "es_fondu_projektu_saraksts.csv", ","):
            if r["IesniedzejaRegNo"] in sample:
                eu[r["IesniedzejaRegNo"]].append({"project": r["ProjektaNumurs"], "status": r["ProjektaStatuss"],
                                                  "eu_amount": r.get("ProjektamPieskirtaisESFonduLidzfinansejums") or r.get("EsFonduLidzfinansejums"),
                                                  "website": r.get("FinansejumaSanemejaTimeklaVietne")})
        for r in rows(cache, ds, "es_fondu_projektu_sadarbibas_partneri.csv", ","):
            if r["RegNr"] in sample:
                eu[r["RegNr"]].append({"project": r["ProjektaNumurs"], "role": "partner"})
    awards = collections.defaultdict(list)
    for path in sorted(glob.glob(os.path.join(cache, "raw", "iub", "notice", "*", "*.json"))):
        for notice in json.load(open(path, encoding="utf-8")):
            for lot in notice.get("lots") or []:
                for contract in lot.get("contracts") or []:
                    for w in contract.get("winners") or []:
                        for p in w.get("winnerBusinessParties") or []:
                            c = re.sub(r"\D", "", p.get("companyId") or "")
                            if c in sample:
                                awards[c].append({"notice": notice.get("identifier"), "type": notice.get("noticeType"),
                                                  "value": w.get("tenderValue"), "website": p.get("websiteURI")})

    profiles = {}
    for code, bucket in sample.items():
        r = reg[code]
        statements = sorted(fs.get(code, []), key=lambda s: (int(s["year"]), s["created_at"]))
        last = statements[-1] if statements else None
        i = inc.get(last["id"]) if last else None
        b = bal.get(last["id"]) if last else None
        q = sorted(q_rows.get(code, []), key=lambda x: x["Taksacijas_gads_ceturksnis"])
        lastq = q[-1] if q else None
        y = sorted(yearly.get(code, []), key=lambda x: x["Taksacijas_gads"])
        emp = int(lastq["Videjais_nodarbinato_personu_skaits_cilv"] or 0) if lastq else 0
        vsaoi = float(lastq["Taja_skaita_VSAOI_summa"] or 0) if lastq else 0
        lei = gleif(code) if use_gleif else []
        if use_gleif:
            time.sleep(0.5)
        websites = [x["website"] for x in eu.get(code, []) + awards.get(code, []) if x.get("website")]
        person_ids = [o["latvian_identity_number_masked"] or o["birth_date"] for o in officers.get(code, []) + bos.get(code, [])
                      if o.get("latvian_identity_number_masked") or o.get("birth_date")]
        p = {
            "bucket": bucket,
            "legal_name": r["name"], "reg_code": code, "legal_form": r["type"],
            "status": "closed" if r["closed"].strip() else "active", "reg_date": r["registered"],
            "closed_date": r["terminated"] or None, "address": r["address"],
            "activity_code": y[-1]["Pamatdarbibas_NACE_kods"] if y and y[-1]["Pamatdarbibas_NACE_kods"] not in ("", "0") else None,
            "vat_number": [v["Numurs"] for v in vat.get(code, []) if v["Aktivs"] == "ir"] or None,
            "lei": lei or None,
            "website_or_contact": websites or None,
            "officers": [{"name": o["name"], "position": o["position"], "body": o["governing_body"]} for o in officers.get(code, [])] or None,
            "officer_roles_dates": [o["registered_on"] for o in officers.get(code, []) if o["registered_on"]] or None,
            "members_shareholders": [{"name": m["name"], "type": m["entity_type"], "shares": m["number_of_shares"]} for m in members.get(code, [])] or None,
            "beneficial_owners": [{"name": f"{x['forename']} {x['surname']}", "nationality": x["nationality"]} for x in bos.get(code, [])] or None,
            "person_identifier": person_ids or None,
            "fs_latest_year": int(last["year"]) if last else None,
            "fs_years": sorted({int(s["year"]) for s in statements}),
            "revenue": i["net_turnover"] if i and i["net_turnover"] != "" else None,
            "net_profit": i["net_income"] if i and i["net_income"] != "" else None,
            "total_assets": b["total_assets"] if b and b["total_assets"] != "" else None,
            "equity": b["equity"] if b and b["equity"] != "" else None,
            "fs_employees": int(last["employees"]) if last and last["employees"] not in ("", "0") else None,
            "employees_current": emp or None, "employees_quarter": latest_q,
            "avg_salary": round(vsaoi * 1000 / 0.3409 / emp / 3) if emp and vsaoi > 0 else None,
            "taxes_paid": [{"year": x["Taksacijas_gads"], "kEUR": x["Samaksato_VID_administreto_nodoklu_kopsumma_tukst_EUR"]} for x in y]
                          + [{"quarter": x["Taksacijas_gads_ceturksnis"], "kEUR": x["Samaksato_VID_administreto_nodoklu_kopsumma_tukst_EUR"]} for x in q] or None,
            "tax_debt": {"tax_rating": rating.get(code)} if rating.get(code) else None,
            "vat_registered": bool([v for v in vat.get(code, []) if v["Aktivs"] == "ir"]) or None,
            "insolvency": [{k: x[k] for k in ("proceeding_form", "proceeding_started_on", "proceeding_ended_on", "proceeding_resolution_name")}
                           for x in insolvency.get(code, [])] or None,
            "pledges_securing_measures": [{"type": s["securing_measure_type"], "from": s["date_from"]} for s in securing.get(code, [])]
                                         + [{"type": s["suspension_code"], "from": s["date_from"]} for s in suspensions.get(code, [])]
                                         + [{"type": "VID_SUSPENSION", "from": s["Lemuma_datums"], "restored": s["Lemuma_par_atjaunosanu_datums"]} for s in vid_susp.get(code, [])] or None,
            "court_or_official_notices": [{"type": x["liquidation_type"], "from": x["date_from"]} for x in liquidations.get(code, [])]
                                        + [{"case": s["case_number"]} for s in securing.get(code, []) if s["case_number"]] or None,
            "procurement_contracts": awards.get(code) or None,
            "eu_funds": eu.get(code) or None,
            "sanctions_eu": [s["list"] for s in sanctions.get(code, [])] or None,
            "sanctions_un": None,
            "name_history": code in name_hist or None,
            "group": sorted(legal_members.get(code, [])) or None,
            "courts": None,
            "filings": sorted({int(s["year"]) for s in statements}) or None,
            "securities": None,
            "news": None,
            "network": len(linked.get(code, [])) or None,
            "score_inputs": bool(rating.get(code) and statements) or None,
        }
        profiles[code] = p

    os.makedirs(os.path.join(cache, "profiles"), exist_ok=True)
    counters = collections.Counter()
    for code, p in profiles.items():
        counters[p["bucket"]] += 1
        with open(os.path.join(cache, "profiles", f"{p['bucket']}-{counters[p['bucket']]}.json"), "w", encoding="utf-8") as f:
            json.dump(p, f, ensure_ascii=False, indent=1)
    with open(os.path.join(cache, "sample_ids.json"), "w", encoding="utf-8") as f:
        json.dump(sample, f, indent=1)

    n = len(profiles)
    fill = {k: round(100 * sum(1 for p in profiles.values() if p.get(k) not in (None, [], "")) / n, 1) for k in FIELDS}
    population = {}
    pop_path = os.path.join(cache, "population.json")
    if os.path.exists(pop_path):
        population = json.load(open(pop_path, encoding="utf-8"))["fill_pct"]
    filled = lambda p, ks: any(p.get(k) not in (None, [], "") for k in ks)
    active_n = len(active)
    pop_extra = {
        "S05": round(100 * len({c for c in active if legal_members.get(c)}) / active_n, 1),
        "S17": round(100 * len({c for c in active if linked.get(c)}) / active_n, 1),
        "S02": 100.0, "S10": 0.0, "S14": 0.0, "S16": 0.0,
        "S13": population.get("fs_latest_year"),
        "S18": population.get("tax_debt"),
    }
    sections = {}
    for sid, keys in SECTIONS.items():
        pops = [population[k] for k in keys if k in population]
        sections[sid] = {
            "sample_filled": sum(1 for p in profiles.values() if filled(p, keys)),
            "sample_n": n,
            "population_pct": pop_extra.get(sid, max(pops) if pops else None),
        }
    by_segment = collections.defaultdict(lambda: collections.Counter())
    for p in profiles.values():
        seg = p["bucket"]
        for sid, keys in SECTIONS.items():
            by_segment[seg][sid] += filled(p, keys)
    out = {"n_sample": n, "seed": SEED, "method": "random.Random(SEED).sample over sorted candidate codes per segment",
           "buckets": dict(collections.Counter(sample.values())), "sample": fill, "population": population,
           "sections": sections, "by_segment": {k: dict(v) for k, v in by_segment.items()}}
    with open(os.path.join(cache, "fillrates.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, indent=1)
    print(json.dumps({"sections": sections, "buckets": out["buckets"]}, indent=0))


if __name__ == "__main__":
    main()
