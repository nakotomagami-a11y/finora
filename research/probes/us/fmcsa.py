"""Probe FMCSA open data on data.transportation.gov (Socrata): Company Census and Licensing & Insurance.

Usage: python -I research/probes/us/fmcsa.py
Optional env SOCRATA_APP_TOKEN raises rate limits; works without it.
"""
import json
import os
import time
import urllib.parse
import urllib.request

UA = "Finora research (open-source; github.com/nakotomagami-a11y/finora)"
HOST = "https://data.transportation.gov"
DATASETS = {
    "az4n-8mr2": "Company Census File",
    "6eyk-hxee": "Carrier (L&I) - All With History",
    "9mw4-x3tu": "AuthHist - All With History",
    "sa6p-acbp": "Revocation - All With History",
    "ypjt-5ydn": "Insur - All With History",
    "2emp-mxtb": "BOC3 - All With History",
}


def get(path, params=None):
    url = HOST + path + ("?" + urllib.parse.urlencode(params) if params else "")
    headers = {"User-Agent": UA}
    if os.environ.get("SOCRATA_APP_TOKEN"):
        headers["X-App-Token"] = os.environ["SOCRATA_APP_TOKEN"]
    time.sleep(0.3)
    with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=300) as r:
        return json.load(r)


def soql(dataset, select, where=None, group=None, order=None, limit=50):
    params = {"$select": select, "$limit": limit}
    if where:
        params["$where"] = where
    if group:
        params["$group"] = group
    if order:
        params["$order"] = order
    return get(f"/resource/{dataset}.json", params)


def main():
    for ds, name in DATASETS.items():
        meta = get(f"/api/views/{ds}.json")
        rows = soql(ds, "count(*) as n")[0]["n"]
        updated = time.strftime("%Y-%m-%d", time.gmtime(meta.get("rowsUpdatedAt", 0)))
        print(f"{name} ({ds}): rows={rows} rowsUpdatedAt={updated} columns={len(meta['columns'])} license={meta.get('license')}")

    census = "az4n-8mr2"
    print("census status_code:", soql(census, "status_code, count(*) as n", group="status_code", order="n desc"))
    print("census carrier_operation:", soql(census, "carrier_operation, count(*) as n", group="carrier_operation", order="n desc"))
    active = "status_code='A'"
    total_active = int(soql(census, "count(*) as n", where=active)[0]["n"])
    for col in ("company_officer_1", "company_officer_2", "email_address", "phone", "power_units", "total_drivers", "safety_rating", "mcs150_date"):
        n = int(soql(census, "count(*) as n", where=f"{active} AND {col} IS NOT NULL")[0]["n"])
        print(f"  active census fill {col}: {n / total_active:.0%}")
    print("  active census by phy_country:", soql(census, "phy_country, count(*) as n", where=active, group="phy_country", order="n desc", limit=5))
    print("  latest mcs150_date:", soql(census, "max(mcs150_date) as d")[0])

    carrier = "6eyk-hxee"
    print("L&I broker_stat:", soql(carrier, "broker_stat, count(*) as n", group="broker_stat", order="n desc"))
    print("L&I common_stat:", soql(carrier, "common_stat, count(*) as n", group="common_stat", order="n desc"))
    print("L&I bond_file values (brokers need a BMC-84/85 bond):", soql(carrier, "bond_file, count(*) as n", where="broker_stat='A'", group="bond_file", order="n desc", limit=5))
    print("AuthHist actions:", soql("9mw4-x3tu", "original_action_desc, count(*) as n", group="original_action_desc", order="n desc", limit=10))
    print("AuthHist latest served:", soql("9mw4-x3tu", "max(orig_served_date) as d")[0])


if __name__ == "__main__":
    main()
