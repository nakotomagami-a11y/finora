"""Pick the US reality-check sample at random, reproducibly.

Private segments come from official open-data portals with a generic name filter;
public companies come from a local Forms 3/4/5 store (FORMS345_DB, read-only).
The picks are written to research/.cache/us/samples.json. Only the method,
candidate counts and seed are printed, never the entities.

    FORMS345_DB=<path> python -I research/probes/us/reality_sample.py
"""
import json
import os
import pathlib
import random
import sqlite3
import urllib.error
import urllib.parse
import urllib.request

SEED = 20261119
UA = "Finora research (open-source; github.com/nakotomagami-a11y/finora)"
OUT = pathlib.Path(__file__).resolve().parents[2] / ".cache" / "us" / "samples.json"

PRIVATE = [
    {
        "segment": "contractor",
        "state": "CO",
        "domain": "data.colorado.gov",
        "dataset": "4ykn-tg5h",
        "id": "entityid",
        "name": "entityname",
        "where": "upper(entityname) like '%CONSTRUCTION%' AND entitystatus = 'Good Standing'"
        " AND entityformdate >= '2018-01-01T00:00:00'",
    },
    {
        "segment": "coffee roaster",
        "state": "OR",
        "domain": "data.oregon.gov",
        "dataset": "tckn-sxa6",
        "id": "registry_number",
        "name": "business_name",
        "where": "upper(business_name) like '%COFFEE ROAST%'",
    },
    {
        "segment": "payroll firm",
        "state": "CT",
        "domain": "data.ct.gov",
        "dataset": "n7gp-d28j",
        "id": "accountnumber",
        "name": "name",
        "where": "upper(name) like '%PAYROLL%' AND status = 'Active'",
    },
    {
        "segment": "freight broker",
        "state": "FMCSA",
        "domain": "data.transportation.gov",
        "dataset": "6eyk-hxee",
        "id": "dot_number",
        "name": "legal_name",
        "where": "broker_stat = 'A' AND common_stat = 'N' AND contract_stat = 'N'"
        " AND bus_state_code in ('NY', 'CO', 'OR', 'CT', 'PA')",
    },
    {
        "segment": "solar installer",
        "state": "NY",
        "domain": "data.ny.gov",
        "dataset": "n9v6-gdp6",
        "id": "dos_id",
        "name": "current_entity_name",
        "where": "upper(current_entity_name) like '%SOLAR%' AND initial_dos_filing_date >= '2015-01-01T00:00:00'",
    },
]


def soql(domain, dataset, params):
    url = f"https://{domain}/resource/{dataset}.json?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return json.load(r)
    except urllib.error.HTTPError as err:
        raise SystemExit(f"{domain}/{dataset}: {err.code} {err.read()[:300]!r}")


def pick_private(rng, seg):
    ids = soql(
        seg["domain"],
        seg["dataset"],
        {"$select": f"{seg['id']}, max({seg['name']}) as pick_name", "$where": seg["where"],
         "$group": seg["id"], "$order": seg["id"], "$limit": 50000},
    )
    choice = rng.choice(ids)
    return len(ids), {"segment": seg["segment"], "state": seg["state"], "id": choice[seg["id"]], "name": choice["pick_name"]}


def pick_public(rng, n=5):
    con = sqlite3.connect(f"file:{os.environ['FORMS345_DB']}?mode=ro", uri=True)
    rows = con.execute(
        "select distinct issuer_cik from hist_filings where filing_date >= '2026-01-01' and ticker <> '' order by 1"
    ).fetchall()
    ciks = rng.sample([r[0] for r in rows], n)
    picks = []
    for cik in ciks:
        name = con.execute(
            "select issuer_name from hist_filings where issuer_cik = ? order by filing_date desc limit 1", (cik,)
        ).fetchone()[0]
        picks.append({"segment": "public company", "state": "SEC", "id": cik, "name": name})
    return len(rows), picks


def main():
    rng = random.Random(SEED)
    samples, method = [], []
    for seg in PRIVATE:
        count, pick = pick_private(rng, seg)
        samples.append(pick)
        method.append((seg["segment"], seg["state"], seg["dataset"], count))
    count, picks = pick_public(rng)
    samples += picks
    method.append(("public company", "SEC", "issuers with a Form 3/4/5 in 2026", count))
    OUT.write_text(json.dumps(samples, indent=2))
    print(f"seed={SEED}")
    for segment, state, source, count in method:
        print(f"{segment:16} {state:6} {source:40} candidates={count}")


if __name__ == "__main__":
    main()
