"""Pick the US reality-check sample by rule.

Public companies: from a local, read-only database of SEC Forms 3/4/5 issuers with their public float
(path in the FORMS345_DB environment variable), one per float band (>=10B, 300M-2B, <100M USD).
Small private businesses: from the SAM.gov public entity extract (a zip passed as --sam), active
registrations that list a website, one per primary NAICS code: building contractor (236220),
coffee roaster (311920), payroll services (541214), freight broker (488510), electrical/solar installer (238210).

Order within each group is sha256(seed + id). Writes only to the --out file (gitignored cache).

Usage: FORMS345_DB=<path> python -I select_samples_us.py --sam <SAM_PUBLIC_...ZIP> --out <samples.json>
"""

import argparse
import hashlib
import io
import json
import os
import sqlite3
import zipfile

SEED = "finora-osint-2026-11"
NAICS = {"236220": "contractor", "311920": "coffee-roaster", "541214": "payroll",
         "488510": "freight-broker", "238210": "solar-electrical"}


def order_key(value: str) -> str:
    return hashlib.sha256(f"{SEED}:{value}".encode()).hexdigest()


def pick_public(db_path: str) -> list:
    con = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    rows = con.execute(
        "select i.cik, i.public_float, min(t.ticker), "
        "(select issuer_name from hist_filings h where h.issuer_cik = i.cik order by filing_date desc limit 1) "
        "from issuers i join listed_tickers t on t.cik = i.cik "
        "where i.public_float is not null and i.float_date >= '2025-01-01' group by i.cik"
    ).fetchall()
    bands = [("large", 10e9, float("inf")), ("medium", 3e8, 2e9), ("micro", 1e6, 1e8)]
    picks = []
    for bucket, lo, hi in bands:
        pool = sorted((order_key(cik), cik, ticker, name) for cik, pf, ticker, name in rows
                      if name and lo <= float(pf) < hi)
        for _, cik, ticker, name in pool[:1]:
            picks.append({"country": "US", "code": cik, "ticker": ticker, "name": name, "bucket": f"public-{bucket}"})
    return picks


def pick_private(sam_zip: str) -> list:
    outer = zipfile.ZipFile(sam_zip)
    inner = zipfile.ZipFile(io.BytesIO(outer.read(outer.namelist()[0])))
    pool = {code: [] for code in NAICS}
    with inner.open(inner.namelist()[0]) as f:
        f.readline()
        for raw in io.TextIOWrapper(f, encoding="utf-8", errors="replace"):
            cols = raw.split("|")
            if len(cols) < 33 or cols[5] != "A" or not cols[26].strip():
                continue
            if cols[32] in pool:
                pool[cols[32]].append((order_key(cols[0]), cols[0], cols[11], cols[26].strip(), cols[18]))
    picks = []
    for code, rows in pool.items():
        for _, uei, name, url, state in sorted(rows)[:1]:
            picks.append({"country": "US", "code": uei, "name": name, "website": url, "state": state,
                          "bucket": f"private-{NAICS[code]}"})
    return picks


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--sam", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    samples = pick_public(os.environ["FORMS345_DB"]) + pick_private(args.sam)
    try:
        existing = json.load(open(args.out, encoding="utf-8"))
    except FileNotFoundError:
        existing = []
    merged = [s for s in existing if s["country"] != "US"] + samples
    json.dump(merged, open(args.out, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print("picked US", len(samples))


if __name__ == "__main__":
    main()
