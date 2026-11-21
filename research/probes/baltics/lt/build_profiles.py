"""Reality check for Lithuania: build company profiles from the downloaded open data, the way the app would.

Reads the files under research/.cache/baltics/lt/raw/ (fetched by fetch_uapi.py, fetch_gleif_lt.py and the
direct Registrų centras / Sodra downloads listed in the research notes) and writes, all under the cache:
  profiles/<n>.json   one profile per sampled company (entity-level, never committed)
  sample.json         which segment each sample came from (entity-level, never committed)
  fillrates.json      aggregate fill rates only: per canonical field and per report section S01-S18

Population = companies in the daily register file whose legal status is "no legal proceedings" (code 0).
Sample = 8 companies drawn at random within segments, seed below:
  micro (<10 insured), micro, small (10-49), small, medium (50-249), large (250+), bankrupt (status 5/6/26),
  tax debtor (overdue tax-authority arrears > 0). Size = insured persons in the Sodra daily file.
"""
import csv
import json
import random
import sys
from collections import defaultdict
from pathlib import Path

SEED = 20261119
RAW = Path(__file__).resolve().parents[3] / ".cache" / "baltics" / "lt" / "raw"
OUT = RAW.parent
csv.field_size_limit(1 << 30)
sys.stdout.reconfigure(encoding="utf-8")

REVENUE = {"ISLT00001", "ISLT00345", "ISLT00293", "BSLT00606"}
NET_PROFIT = {"ISLT00019", "ISLT00350", "ISLT00310", "BSLT00614", "ISLT00222"}
PRETAX = {"ISLT00017", "ISLT00365", "ISLT00309", "BSLT00612"}
EQUITY = {"BSLT00040", "BSLT00583"}
LIABILITIES = {"BSLT00055", "BSLT00110", "BSLT00467"}
NONCURRENT, CURRENT, TOTAL_ASSETS = "BSLT00001", "BSLT00021", "BSLT00115"
BANKRUPT = {"5", "6", "13", "26"}

SECTIONS = {
    "S01": ["legal_name", "reg_code", "legal_form", "address", "activity_code"],
    "S02": ["status"],
    "S03": ["officers"],
    "S04": ["members_shareholders", "beneficial_owners"],
    "S05": [],
    "S06": ["revenue", "net_profit", "total_assets", "equity"],
    "S07": ["employees_current"],
    "S08": ["taxes_paid"],
    "S09": ["insolvency"],
    "S10": ["court_or_official_notices"],
    "S11": ["sanctions_eu", "sanctions_un"],
    "S12": ["procurement_contracts", "eu_funds"],
    "S13": ["filings"],
    "S14": [],
    "S15": ["website_or_contact"],
    "S16": [],
    "S17": [],
    "S18": ["status", "tax_debt", "fs_latest_year"],
}


def rows(path: str, delimiter: str = ",", encoding: str = "utf-8"):
    with open(RAW / path, encoding=encoding, newline="") as fh:
        yield from csv.DictReader(fh, delimiter=delimiter)


def sodra_rows(path: str):
    """The daily Sodra files: cp1257, a title line, a header line, a dashed line, then ';' rows."""
    with open(RAW / path, encoding="cp1257") as fh:
        lines = fh.read().splitlines()
    for line in lines[3:]:
        parts = [p.strip() for p in line.split(";")]
        if parts and parts[0].isdigit():
            yield parts


def num(value: str) -> float | None:
    value = (value or "").strip().replace(",", ".")
    try:
        return float(value)
    except ValueError:
        return None


def load():
    reg = {r["ja_kodas"]: r for r in rows("rc/JAR_IREGISTRUOTI.csv", "|")}
    uuid_to_code = {r["_id"]: r["ja_kodas"] for r in rows("iregistruoti/JuridinisAsmuo.csv")}
    managers = {r["ja_kodas"]: r for r in rows("rc/JAR_VALDYMAS.csv", "|")}
    insured = {p[0]: int(p[2]) for p in sodra_rows("sodra/Apdraustuju_skaicius/APDRAUSTUJU_SKAICIUS.CSV")}
    sodra_debt = {p[0]: num(p[2]) for p in sodra_rows("sodra/Skolos/SKOLA.CSV")}
    wage, activity = {}, {}
    for r in rows("sodra/m2026/monthly-2026.csv", ";", "utf-8-sig"):
        code = r["Juridinių asmenų registro kodas (jarCode)"]
        month = r["Mėnuo (month)"]
        if code and month >= wage.get(code, ("", None))[0]:
            wage[code] = (month, num(r["Vidutinis darbo užmokestis (avgWage)"]))
            if r["Ekonominės veiklos rūšies kodas EVRK(ecoActCodeStr)"]:
                activity[code] = r["Ekonominės veiklos rūšies kodas EVRK(ecoActCodeStr)"]
    vat = {}
    for r in rows("mm_registras/MokesciuMoketojas.csv"):
        if r["pvm_kodas"]:
            current = not r["pvm_isregistruota"]
            vat[r["ja_kodas"]] = vat.get(r["ja_kodas"], False) or current
        if r["ekonomine_veikla._id"] and r["pagrindine"] == "1":
            activity.setdefault(r["ja_kodas"], "ref:" + r["ekonomine_veikla._id"])
    taxes = defaultdict(dict)
    for r in rows("ja_mokesciai/Moketojas.csv"):
        code = uuid_to_code.get(r["mm_kodas._id"])
        if code:
            taxes[code][r["metai"]] = num(r["suma"])
    tax_debt = {r["ja_kodas"]: num(r["pradelsta_nepriemoka"]) for r in rows("ja_nepriemokos/NepriemokosSuma.csv")}
    fs = defaultdict(dict)
    for path in ("pelno_ataskaitos/PelnoAtaskaita_2024plus.csv", "balanso_ataskaitos/BalansoAtaskaita_2024plus.csv"):
        for r in rows(path):
            code = uuid_to_code.get(r["juridinis_asmuo._id"])
            if code:
                fs[code].setdefault(r["laikotarpis_iki"], {})[r["line_type_id"]] = num(r["reiksme"])
    late = {uuid_to_code.get(r["juridinis_asmuo._id"]) for r in rows("fa_dokumentu_nepateike/Nepateikes.csv")}
    docs = defaultdict(int)
    for r in rows("dokumentai/Dokumentas.csv"):
        docs[uuid_to_code.get(r["juridinis_asmuo._id"])] += 1
    bankruptcy = {r["imones_kodas"]: r for r in rows("imoniu_bankrotas/BankrotoAtaskaitosDatos.csv")}
    eu = defaultdict(int)
    for r in rows("sutartys/Contract.csv"):
        eu[r["executor_code"]] += 1
    tenders = defaultdict(int)
    for r in rows("new/Atn1TendererList.csv"):
        tenders[r["code"].split(".")[0]] += 1
    members = {uuid_to_code.get(r["juridinis_asmuo._id"]): r for r in rows("dalyviai/Dalyvis.csv")} \
        if (RAW / "dalyviai/Dalyvis.csv").exists() else {}
    lei = {r["registered_as"]: r["lei"] for r in rows("gleif/lt_lei.csv") if r["registered_at"] == "RA000430"}
    return locals()


def profile(code: str, d: dict) -> dict:
    r = d["reg"][code]
    m = d["managers"].get(code, {})
    statements = d["fs"].get(code, {})
    latest_end = max(statements) if statements else None
    periods = sorted(statements, reverse=True)

    def pick(ids):
        """The value from the latest period that reports any of these lines (P&L and balance sheet differ)."""
        for end in periods:
            found = next((statements[end][i] for i in ids if statements[end].get(i) is not None), None)
            if found is not None:
                return found
        return None

    assets = pick({TOTAL_ASSETS})
    if assets is None:
        parts = [pick({NONCURRENT}), pick({CURRENT})]
        assets = sum(v for v in parts if v is not None) if any(v is not None for v in parts) else None
    taxes = d["taxes"].get(code, {})
    debt_vmi, debt_sodra = d["tax_debt"].get(code), d["sodra_debt"].get(code)
    month, avg_wage = d["wage"].get(code, (None, None))
    mem = d["members"].get(code)
    return {
        "legal_name": r["ja_pavadinimas"], "reg_code": code, "legal_form": r["form_pavadinimas"],
        "status": r["stat_pavadinimas"], "reg_date": r["ja_reg_data"], "closed_date": None,
        "address": r["adresas"] or None, "activity_code": d["activity"].get(code),
        "vat_number": "present" if code in d["vat"] else None, "lei": d["lei"].get(code),
        "website_or_contact": None,
        "officers": None,
        "officer_roles_dates": {"manager": m.get("vadovas") == "1", "manager_since": m.get("vad_org_nuo") or None,
                                "board": m.get("valdyba") == "1", "council": m.get("taryba") == "1",
                                "supervisory_board": m.get("steb_taryba") == "1"} if m else None,
        "members_shareholders": None,
        "member_counts": {k: mem[k] for k in ("lr_fiziniai", "lr_juridiniai", "uzsienio_fiziniai", "uzsienio_juridiniai")}
        if mem else None,
        "beneficial_owners": None, "person_identifier": None,
        "fs_latest_year": latest_end, "revenue": pick(REVENUE), "net_profit": pick(NET_PROFIT),
        "profit_before_tax": pick(PRETAX), "total_assets": assets, "equity": pick(EQUITY),
        "liabilities": pick(LIABILITIES), "fs_employees": None,
        "employees_current": d["insured"].get(code), "avg_salary": avg_wage, "avg_salary_month": month,
        "taxes_paid": taxes or None,
        "tax_debt": {"tax_authority_overdue": debt_vmi, "social_insurance": debt_sodra},
        "vat_registered": d["vat"].get(code, False),
        "insolvency": {"status_code": r["stat_kodas"], "bankruptcy_report": code in d["bankruptcy"]},
        "pledges_securing_measures": None, "court_or_official_notices": None,
        "procurement_contracts": d["tenders"].get(code) or None, "eu_funds": d["eu"].get(code) or None,
        "filings": {"documents_since_2024": d["docs"].get(code, 0), "fs_not_filed_flag": code in d["late"]},
        "sanctions_eu": None, "sanctions_un": None,
    }


def filled(p: dict, field: str) -> bool:
    v = p.get(field)
    if field == "tax_debt":
        return True  # list-based: absence from both debtor lists means no overdue debt on the list date
    if field == "insolvency" or field == "status":
        return True
    if field == "filings":
        return bool(v and (v["documents_since_2024"] or p.get("fs_latest_year")))
    return v not in (None, {}, [], False) if field != "vat_registered" else True


def main():
    d = load()
    active = [c for c, r in d["reg"].items() if r["stat_kodas"] == "0"]
    fields = ["legal_name", "reg_code", "legal_form", "status", "reg_date", "address", "activity_code", "vat_number",
              "lei", "website_or_contact", "officers", "officer_roles_dates", "members_shareholders",
              "member_counts", "beneficial_owners", "person_identifier", "fs_latest_year", "revenue",
              "net_profit", "total_assets", "equity", "fs_employees", "employees_current", "avg_salary",
              "taxes_paid", "tax_debt", "vat_registered", "insolvency", "pledges_securing_measures",
              "court_or_official_notices", "procurement_contracts", "eu_funds", "filings"]
    pop = {f: 0 for f in fields}
    extra = {"has_overdue_tax_or_social_debt": 0, "vat_currently_registered": 0, "fs_not_filed_flag": 0}
    sections_pop = {s: 0 for s in SECTIONS}
    for code in active:
        p = profile(code, d)
        for f in fields:
            pop[f] += filled(p, f)
        extra["has_overdue_tax_or_social_debt"] += bool((p["tax_debt"]["tax_authority_overdue"] or 0) > 0
                                                       or (p["tax_debt"]["social_insurance"] or 0) > 0)
        extra["vat_currently_registered"] += bool(p["vat_registered"])
        extra["fs_not_filed_flag"] += p["filings"]["fs_not_filed_flag"]
        for s, fs in SECTIONS.items():
            sections_pop[s] += bool(fs) and any(filled(p, f) for f in fs)
    n = len(active)
    company_forms = {"Uždaroji akcinė bendrovė", "Akcinė bendrovė", "Mažoji bendrija", "Individuali įmonė",
                     "Tikroji ūkinė bendrija", "Komanditinė ūkinė bendrija", "Žemės ūkio bendrovė",
                     "Kooperatinė bendrovė"}
    companies = [c for c in active if d["reg"][c]["form_pavadinimas"] in company_forms]
    pop_co = {f: 0 for f in fields}
    for code in companies:
        p = profile(code, d)
        for f in fields:
            pop_co[f] += filled(p, f)

    rng = random.Random(SEED)
    size = d["insured"]
    segments = {
        "micro": [c for c in active if 0 < size.get(c, 0) < 10],
        "small": [c for c in active if 10 <= size.get(c, 0) < 50],
        "medium": [c for c in active if 50 <= size.get(c, 0) < 250],
        "large": [c for c in active if size.get(c, 0) >= 250],
        "bankrupt": sorted(c for c, r in d["reg"].items() if r["stat_kodas"] in BANKRUPT),
        "tax_debtor": [c for c in active if (d["tax_debt"].get(c) or 0) > 0],
    }
    plan = [("micro", 2), ("small", 2), ("medium", 1), ("large", 1), ("bankrupt", 1), ("tax_debtor", 1)]
    sample = []
    for seg, k in plan:
        pool = sorted(set(segments[seg]) - {c for _, c in sample})
        sample.extend((seg, c) for c in rng.sample(pool, k))
    (OUT / "profiles").mkdir(exist_ok=True)
    sample_fill = {f: 0 for f in fields}
    sections_sample = {s: 0 for s in SECTIONS}
    seg_rows = []
    for i, (seg, code) in enumerate(sample, 1):
        p = profile(code, d)
        p["_segment"] = seg
        (OUT / "profiles" / f"{i:02d}.json").write_text(json.dumps(p, ensure_ascii=False, indent=1), "utf-8")
        for f in fields:
            sample_fill[f] += filled(p, f)
        for s, fs in SECTIONS.items():
            ok = bool(fs) and any(filled(p, f) for f in fs)
            sections_sample[s] += ok
            seg_rows.append({"section": s, "segment": seg, "filled": int(ok)})
    (OUT / "sample.json").write_text(json.dumps(sample, indent=1), "utf-8")
    result = {
        "method": f"random.Random({SEED}).sample within segments {plan}; size = Sodra insured persons; "
                  "population = daily register file, legal status code 0",
        "segment_pool_sizes": {k: len(v) for k, v in segments.items()},
        "n_population": n, "n_sample": len(sample),
        "population": {f: round(100 * pop[f] / n, 1) for f in fields},
        "n_population_companies": len(companies),
        "population_companies": {f: round(100 * pop_co[f] / len(companies), 1) for f in fields},
        "population_extra": {k: round(100 * v / n, 1) for k, v in extra.items()},
        "sample": {f: round(100 * sample_fill[f] / len(sample), 1) for f in fields},
        "sections": {s: {"sample_filled": sections_sample[s], "sample_n": len(sample),
                         "population_pct": round(100 * sections_pop[s] / n, 1)} for s in SECTIONS},
        "by_segment": seg_rows,
    }
    (OUT / "fillrates.json").write_text(json.dumps(result, indent=1), "utf-8")
    print(json.dumps({k: result[k] for k in ("n_population", "n_population_companies", "population_companies", "population_extra")},
                     indent=0))
    print({s: (v["sample_filled"], v["population_pct"]) for s, v in result["sections"].items()})


if __name__ == "__main__":
    main()
