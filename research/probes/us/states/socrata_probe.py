"""Measure state business-registry datasets published on Socrata portals.

For each dataset: columns, row count, last update, licence and attribution as the
portal reports them, plus a small sample saved to research/.cache (never committed).

Usage: python -I socrata_probe.py [cache_dir]
"""

import json
import pathlib
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone

UA = "Finora research (open-source; github.com/nakotomagami-a11y/finora)"

DATASETS = [
    ("NY", "data.ny.gov", "n9v6-gdp6", "Active Corporations: Beginning 1800"),
    ("NY", "data.ny.gov", "63wc-4exh", "Corporations and Other Entities: All Filings"),
    ("NY", "data.ny.gov", "2tms-hftb", "All Filings - Address"),
    ("NY", "data.ny.gov", "k4vb-judh", "Daily Corporation and Other Entity Filing Data"),
    ("NY", "data.ny.gov", "3gg2-jgnp", "All Filings - Entity Status History"),
    ("CO", "data.colorado.gov", "4ykn-tg5h", "Business Entities in Colorado"),
    ("CO", "data.colorado.gov", "casm-dbbj", "Business Entity Transaction History"),
    ("CO", "data.colorado.gov", "8upq-58vz", "UCC Debtor Information"),
    ("CO", "data.colorado.gov", "u7sb-g482", "Trade Names"),
    ("OR", "data.oregon.gov", "tckn-sxa6", "Active Businesses - ALL"),
    ("OR", "data.oregon.gov", "esjy-u4fc", "New Businesses Registered Last Month"),
    ("OR", "data.oregon.gov", "g77e-6bhs", "CCB Active Licenses"),
    ("CT", "data.ct.gov", "n7gp-d28j", "Business Registry - Business Master"),
    ("CT", "data.ct.gov", "ka36-64k6", "Business Registry - Principals"),
    ("CT", "data.ct.gov", "qh2m-n44y", "Business Registry - Agents"),
    ("CT", "data.ct.gov", "ah3s-bes7", "Business Registry - Business Filing History"),
    ("CT", "data.ct.gov", "xfev-8smz", "UCC Lien Filings"),
    ("PA", "data.pa.gov", "xvd7-5r2c", "Registered Businesses in PA Current by County"),
    ("TX", "data.texas.gov", "9cir-efmm", "Active Franchise Taxpayers"),
    ("WA", "data.wa.gov", "m8qx-ubtq", "L&I Contractor License Data - General"),
    ("WA", "data.wa.gov", "4xk5-x9j6", "L&I Contractor License - Principal Data"),
    ("DE", "data.delaware.gov", "5zy2-grhr", "Delaware Business Licenses"),
]


def get_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.load(r)


def iso(ts):
    return datetime.fromtimestamp(ts, timezone.utc).strftime("%Y-%m-%d") if ts else None


def probe(state, domain, ds_id, label, cache):
    meta = get_json(f"https://{domain}/api/views/{ds_id}.json")
    count = get_json(f"https://{domain}/resource/{ds_id}.json?$select=count(*)")
    sample = get_json(f"https://{domain}/resource/{ds_id}.json?$limit=5")
    out = cache / state.lower()
    out.mkdir(parents=True, exist_ok=True)
    (out / f"{ds_id}.sample.json").write_text(json.dumps(sample, indent=1), encoding="utf-8")
    cols = [c["fieldName"] for c in meta.get("columns", []) if not c["fieldName"].startswith(":")]
    return {
        "state": state,
        "domain": domain,
        "id": ds_id,
        "label": label,
        "name": meta.get("name"),
        "rows": int(list(count[0].values())[0]),
        "rows_updated": iso(meta.get("rowsUpdatedAt")),
        "license": (meta.get("license") or {}).get("name") or meta.get("licenseId"),
        "attribution": meta.get("attribution"),
        "provenance": meta.get("provenance"),
        "columns": cols,
    }


def main():
    cache = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "research/.cache/us/states")
    results = []
    for state, domain, ds_id, label in DATASETS:
        try:
            results.append(probe(state, domain, ds_id, label, cache))
        except Exception as e:  # noqa: BLE001 - record and keep probing the rest
            results.append({"state": state, "id": ds_id, "label": label, "error": repr(e)})
        time.sleep(0.5)
    (cache / "socrata_summary.json").write_text(json.dumps(results, indent=1), encoding="utf-8")
    for r in results:
        if "error" in r:
            print(f"{r['state']} {r['id']} ERROR {r['error']}")
        else:
            print(f"{r['state']} {r['id']} rows={r['rows']:,} updated={r['rows_updated']} "
                  f"license={r['license']!r} cols={len(r['columns'])} {r['label']}")


if __name__ == "__main__":
    main()
