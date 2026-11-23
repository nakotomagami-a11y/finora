"""Volumes and change feeds of state registry datasets on official open-data portals.

Per dataset: total rows, rows we would load (active), distinct entities, column count,
and rows whose system field :updated_at is newer than N days (the platform's
modified-since filter; a full re-publish touches every row).

    python -I research/probes/us/states/portal_volumes.py [days=2]
"""
import json
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

UA = "Finora research (open-source; github.com/nakotomagami-a11y/finora)"

# state, domain, dataset, entity key, "active" filter (None = the file is active-only)
DATASETS = [
    ("NY", "data.ny.gov", "n9v6-gdp6", "dos_id", None),
    ("CO", "data.colorado.gov", "4ykn-tg5h", "entityid", "entitystatus in ('Good Standing', 'Exists', 'Delinquent')"),
    ("OR", "data.oregon.gov", "tckn-sxa6", "registry_number", None),
    ("CT", "data.ct.gov", "n7gp-d28j", "id", "status = 'Active'"),
    ("CT principals", "data.ct.gov", "ka36-64k6", "business_id", None),
    ("PA", "data.pa.gov", "xvd7-5r2c", "filing_number", None),
    ("WA contractors", "data.wa.gov", "m8qx-ubtq", "contractorlicensenumber", None),
]


def get(domain, path, params=None):
    url = f"https://{domain}{path}" + ("?" + urllib.parse.urlencode(params) if params else "")
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=300) as r:
        return json.load(r)


def count(domain, ds, where=None, select="count(*)"):
    params = {"$select": f"{select} as n"}
    if where:
        params["$where"] = where
    return int(get(domain, f"/resource/{ds}.json", params)[0]["n"])


def main():
    days = int(sys.argv[1]) if len(sys.argv) > 1 else 2
    since = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%dT%H:%M:%S")
    print(f"| State | Dataset | Rows | Active rows | Distinct entities | Columns | Rows updated in {days} days |")
    print("|---|---|---|---|---|---|---|")
    for state, domain, ds, key, active in DATASETS:
        meta = get(domain, f"/api/views/{ds}.json")
        cols = len([c for c in meta.get("columns", []) if not c["fieldName"].startswith(":")])
        total = count(domain, ds)
        act = count(domain, ds, active) if active else total
        distinct = count(domain, ds, select=f"count(distinct {key})")
        changed = count(domain, ds, f":updated_at > '{since}'")
        print(f"| {state} | {ds} | {total:,} | {act:,} | {distinct:,} | {cols} | {changed:,} |")


if __name__ == "__main__":
    main()
