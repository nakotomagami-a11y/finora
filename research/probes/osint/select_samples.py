"""Pick the reality-check sample for the open-web (OSINT) probes, by rule, from registry bulk files.

Reads bulk files that the Baltic and US data seats already downloaded (paths passed as arguments),
and writes the chosen entities only to research/.cache/osint/samples.json (gitignored).
No names or codes are printed or committed.

Rules (deterministic: entities are ordered by sha256(seed + code)):
  EE  active companies that list a website in the e-Business Register contacts, two per annual-report
      size category (large, medium, small, micro), plus one in liquidation or bankruptcy that lists a website.
  LV  active limited companies by latest net turnover bucket (>=50M, 5-50M, 0.5-5M, <0.5M EUR),
      plus one terminated company. Websites are found later by web search (that step is measured).

Usage:
  python -I select_samples.py --ee-dir <ariregister extract dir> --lv-dir <data.gov.lv raw dir> --out <samples.json>
"""

import argparse
import csv
import hashlib
import json
import re
import sys
from pathlib import Path

SEED = "finora-osint-2026-11"
csv.field_size_limit(sys.maxsize)


def order_key(code: str) -> str:
    return hashlib.sha256(f"{SEED}:{code}".encode()).hexdigest()


def ee_contacts(general_json: Path):
    """Stream the 4+ GB general-data JSON line by line; yield (code, name, status, website)."""
    code = name = status = None
    want_www = False
    www = None
    top_code = re.compile(r'^ {8}"ariregistri_kood":(\d+)')
    top_name = re.compile(r'^ {8}"nimi":"(.*)",?$')
    status_re = re.compile(r'^ {12}"staatus":"(\w)"')
    with general_json.open(encoding="utf-8", errors="replace") as f:
        for line in f:
            m = top_code.match(line)
            if m:
                if code and www:
                    yield code, name, status, www
                code, name, status, www, want_www = m.group(1), None, None, None, False
                continue
            if name is None:
                m = top_name.match(line)
                if m:
                    name = m.group(1)
                    continue
            if status is None:
                m = status_re.match(line)
                if m:
                    status = m.group(1)
                    continue
            if '"liik":"WWW"' in line:
                want_www = True
            elif want_www and '"sisu":' in line:
                www = www or line.split('"sisu":', 1)[1].strip().rstrip(",").strip('"')
                want_www = False
    if code and www:
        yield code, name, status, www


def ee_size_categories(reports_csv: Path) -> dict:
    latest = {}
    with reports_csv.open(encoding="utf-8") as f:
        for row in csv.DictReader(f, delimiter=";"):
            code, year = row["registrikood"], int(row["aruandeaasta"] or 0)
            if year >= latest.get(code, (0, ""))[0]:
                latest[code] = (year, row["valitud aruanne kategooria"])
    return {code: cat for code, (_, cat) in latest.items()}


def pick_ee(ee_dir: Path) -> list:
    cats = ee_size_categories(ee_dir / "1.aruannete_yldandmed_kuni_31102026.csv")
    buckets = {"Suurettevõtja": "large", "Keskmise suurusega ettevõtja": "medium",
               "Väikeettevõtja": "small", "Mikroettevõtja": "micro"}
    pool = {b: [] for b in buckets.values()}
    distressed = []
    for code, name, status, www in ee_contacts(ee_dir / "ettevotja_rekvisiidid__yldandmed.json"):
        if status == "R" and buckets.get(cats.get(code)):
            pool[buckets[cats[code]]].append((order_key(code), code, name, www))
        elif status in ("L", "N"):
            distressed.append((order_key(code), code, name, www))
    picks = []
    for bucket, rows in pool.items():
        for _, code, name, www in sorted(rows)[:2]:
            picks.append({"country": "EE", "code": code, "name": name, "website": www, "bucket": bucket})
    for _, code, name, www in sorted(distressed)[:1]:
        picks.append({"country": "EE", "code": code, "name": name, "website": www, "bucket": "distressed"})
    return picks


def pick_lv(lv_dir: Path) -> list:
    register = {}
    with (lv_dir / "uz" / "register.csv").open(encoding="utf-8") as f:
        for row in csv.DictReader(f, delimiter=";"):
            if row["type"] in ("SIA", "AS"):
                register[row["regcode"]] = row
    statements = {}
    with (lv_dir / "gada-parskatu-finansu-dati" / "financial_statements.csv").open(encoding="utf-8") as f:
        for row in csv.DictReader(f, delimiter=";"):
            code = row["legal_entity_registration_number"]
            if code in register and int(row["year"] or 0) >= statements.get(code, (0, ""))[0]:
                statements[code] = (int(row["year"]), row["id"])
    wanted = {sid: code for code, (_, sid) in statements.items()}
    turnover = {}
    with (lv_dir / "gada-parskatu-finansu-dati" / "income_statements.csv").open(encoding="utf-8") as f:
        for row in csv.DictReader(f, delimiter=";"):
            code = wanted.get(row["statement_id"])
            if code and row["net_turnover"]:
                turnover[code] = float(row["net_turnover"])
    bands = [("large", 50e6, float("inf")), ("medium", 5e6, 50e6), ("small", 5e5, 5e6), ("micro", 1, 5e5)]
    picks = []
    active = {c: t for c, t in turnover.items() if not register[c]["terminated"]}
    for bucket, lo, hi in bands:
        rows = sorted((order_key(c), c) for c, t in active.items() if lo <= t < hi)
        for _, code in rows[:2 if bucket != "micro" else 1]:
            picks.append({"country": "LV", "code": code, "name": register[code]["name"], "bucket": bucket})
    gone = sorted((order_key(c), c) for c in turnover if register[c]["terminated"])
    for _, code in gone[:1]:
        picks.append({"country": "LV", "code": code, "name": register[code]["name"], "bucket": "distressed"})
    return picks


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--ee-dir", type=Path, required=True)
    ap.add_argument("--lv-dir", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    args = ap.parse_args()
    samples = pick_ee(args.ee_dir) + pick_lv(args.lv_dir)
    existing = json.loads(args.out.read_text(encoding="utf-8")) if args.out.exists() else []
    keep = [s for s in existing if s["country"] not in ("EE", "LV")]
    args.out.write_text(json.dumps(keep + samples, ensure_ascii=False, indent=2), encoding="utf-8")
    counts = {}
    for s in samples:
        counts[s["country"]] = counts.get(s["country"], 0) + 1
    print("picked", counts)


if __name__ == "__main__":
    main()
