"""Measure Kohesio (EU cohesion policy projects and beneficiaries) for Lithuania, Latvia and Estonia.

Downloads (if missing) the per-country bulk CSVs that https://kohesio.ec.europa.eu/en/data links to:
  https://kohesio.ec.europa.eu/api/data/object?id=data/beneficiaries/latest/<CC>-latest.csv
  https://kohesio.ec.europa.eu/api/data/object?id=data/projects-2014-2020/latest/<CC>-pp14-20-latest.csv
  https://kohesio.ec.europa.eu/api/data/object?id=data/projects-2021-2027/latest/<CC>-pp21-27-latest.csv
The folder index is https://kohesio.ec.europa.eu/api/data/<beneficiaries|programmingPeriod20142020|...>.

Writes research/.cache/baltics/common/kohesio_stats.json: row counts, null rates, how beneficiaries are
identified, and how many beneficiary identifiers look like (and match) national register codes.
Aggregates only.
"""

import csv
import json
import re
import sys
import time
import urllib.request
from collections import Counter
from pathlib import Path

CACHE = Path(__file__).resolve().parents[4] / "research" / ".cache" / "baltics" / "common"
RAW = CACHE / "raw" / "kohesio"
API = "https://kohesio.ec.europa.eu/api/data/object?id=data/"
UA = {"User-Agent": "finora-research/0.1 (+public repo)"}
BALTIC = ("LT", "LV", "EE")
CODE_FORMAT = {"LT": re.compile(r"^\d{9}$"), "LV": re.compile(r"^\d{11}$"), "EE": re.compile(r"^\d{8}$")}
FILES = {
    "ben": "beneficiaries/latest/{cc}-latest.csv",
    "p1420": "projects-2014-2020/latest/{cc}-pp14-20-latest.csv",
    "p2127": "projects-2021-2027/latest/{cc}-pp21-27-latest.csv",
}

csv.field_size_limit(sys.maxsize)


def fetch(kind, cc):
    path = RAW / f"{kind}_{cc}.csv"
    if not path.exists():
        RAW.mkdir(parents=True, exist_ok=True)
        with urllib.request.urlopen(urllib.request.Request(API + FILES[kind].format(cc=cc), headers=UA)) as r:
            path.write_bytes(r.read())
        time.sleep(1)
    return path


def rows(path):
    with open(path, newline="", encoding="utf-8-sig") as fh:
        yield from csv.DictReader(fh)


def pct(part, whole):
    return round(100 * part / whole, 1) if whole else None


def null_rates(path):
    total, filled = 0, Counter()
    for row in rows(path):
        total += 1
        for key, value in row.items():
            filled[key] += bool(value and value.strip())
    return total, {key: round(100 - pct(n, total), 1) for key, n in filled.items()}


def split_ids(value):
    return [v.strip() for v in (value or "").split("|") if v.strip()]


def national_codes():
    """Register codes carried by Baltic LEIs (from gleif_probe.py), used as a join test."""
    codes = {cc: set() for cc in BALTIC}
    path = CACHE / "gleif_baltic.csv"
    if path.exists():
        for row in rows(path):
            codes[row["country"]].add(row["ra_entity_id"])
    return codes


def main():
    lei_codes = national_codes()
    stats = {}
    for cc in BALTIC:
        fmt = CODE_FORMAT[cc]
        out = {}
        total, nulls = null_rates(fetch("ben", cc))
        ids = [row["Beneficiary_Local_Identifier"].strip() for row in rows(fetch("ben", cc))]
        with_id = [i for i in ids if i]
        national = [i for i in with_id if fmt.match(i)]
        out["beneficiaries"] = {
            "rows": total,
            "null_pct": nulls,
            "pct_with_local_id": pct(len(with_id), total),
            "pct_local_id_in_national_register_format": pct(len(national), total),
            "local_id_shapes": dict(Counter(re.sub(r"\d", "9", i)[:16] for i in with_id).most_common(5)),
            "national_ids_also_in_gleif": len(set(national) & lei_codes[cc]),
        }
        for kind in ("p1420", "p2127"):
            path = fetch(kind, cc)
            total, nulls = null_rates(path)
            ben_ids, ben_with_local, multi, budget, starts = 0, 0, 0, 0.0, []
            for row in rows(path):
                uids = split_ids(row["Beneficiary_Unique_Identifier"])
                locals_ = split_ids(row["Beneficiary_Local_Identifier"])
                multi += len(uids) > 1
                ben_ids += bool(uids)
                ben_with_local += any(fmt.match(i) for i in locals_)
                try:
                    budget += float(row["Project_EU_Budget"] or 0)
                except ValueError:
                    pass
                if row["Operation_Start_Date"]:
                    starts.append(row["Operation_Start_Date"][-4:] + row["Operation_Start_Date"][3:5])
            out[kind] = {
                "rows": total,
                "null_pct": {k: v for k, v in nulls.items() if v > 0},
                "pct_with_beneficiary": pct(ben_ids, total),
                "pct_with_national_register_code": pct(ben_with_local, total),
                "pct_multi_beneficiary": pct(multi, total),
                "eu_budget_eur_total": round(budget),
                "latest_start_yyyymm": max(starts) if starts else None,
            }
        stats[cc] = out
    (CACHE / "kohesio_stats.json").write_text(json.dumps(stats, indent=2), encoding="utf-8")
    print(json.dumps(stats, indent=2))


if __name__ == "__main__":
    main()
