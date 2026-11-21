"""Pick the Lithuanian reality-check sample from the open Register of Legal Entities API (get.data.gov.lt).

Rule: companies whose 2024 profit-and-loss statement reports sales revenue in a band
(>=50M, 5-50M, 0.5-5M, <0.5M EUR), two per band (one for micro), ordered by sha256(seed + id),
plus one entity on the register's list of late financial-statement filers.
Writes only to the --out file (gitignored cache), merging with entries from other countries.

Usage: python -I select_samples_lt.py --out <samples.json>
"""

import argparse
import hashlib
import json
import time
import urllib.parse
import urllib.request

API = "https://get.data.gov.lt/datasets/gov/rc/jar"
UA = "finora-research/0.1 (+public repo)"
SEED = "finora-osint-2026-11"


def get(path: str, params: list) -> dict:
    query = "&".join(urllib.parse.quote(p, safe='=<>()"&') for p in params)
    req = urllib.request.Request(f"{API}/{path}?{query}", headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=120) as r:
        time.sleep(0.5)
        return json.load(r)


def order_key(value: str) -> str:
    return hashlib.sha256(f"{SEED}:{value}".encode()).hexdigest()


def entity(entity_id: str) -> dict:
    req = urllib.request.Request(f"{API}/iregistruoti/JuridinisAsmuo/{entity_id}", headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def band(lo: float, hi: float, n: int) -> list:
    params = ['line_name="PARDAVIMO PAJAMOS"', 'laikotarpis_iki="2024-12-31"', f"reiksme>={int(lo)}", "limit(300)"]
    if hi != float("inf"):
        params.insert(3, f"reiksme<{int(hi)}")
    rows = get("pelno_ataskaitos/PelnoAtaskaita", params)["_data"]
    ids = sorted({r["juridinis_asmuo"]["_id"] for r in rows}, key=order_key)
    picks = []
    for entity_id in ids:
        try:
            e = entity(entity_id)
        except Exception:
            continue
        if e.get("isreg_data"):
            continue
        picks.append(e)
        if len(picks) == n:
            break
    return picks


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    samples = []
    for bucket, lo, hi, n in [("large", 50e6, float("inf"), 2), ("medium", 5e6, 50e6, 2),
                              ("small", 5e5, 5e6, 2), ("micro", 1e4, 5e5, 1)]:
        for e in band(lo, hi, n):
            samples.append({"country": "LT", "code": str(e["ja_kodas"]), "name": e["ja_pavadinimas"], "bucket": bucket})
    late = get("fa_veluojantys/VeluojantisPateikti", ["limit(200)"])["_data"]
    codes = sorted((str(r.get("ja_kodas")) for r in late if r.get("ja_kodas")), key=order_key)
    if codes:
        rows = get("iregistruoti/JuridinisAsmuo", [f"ja_kodas={codes[0]}"])["_data"]
        if rows:
            samples.append({"country": "LT", "code": codes[0], "name": rows[0]["ja_pavadinimas"], "bucket": "distressed"})
    try:
        existing = json.load(open(args.out, encoding="utf-8"))
    except FileNotFoundError:
        existing = []
    merged = [s for s in existing if s["country"] != "LT"] + samples
    json.dump(merged, open(args.out, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print("picked LT", len(samples))


if __name__ == "__main__":
    main()
