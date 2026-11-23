"""Fetch Latvian open-data catalogs from data.gov.lv (CKAN) and download their CSV resources.

Usage: python -I 01_ckan_download.py <cache_dir> [--org ur] [--dataset name ...] [--catalog-only]

Writes <cache_dir>/raw/catalog_<org>.json (CKAN package_search result) and, per dataset,
<cache_dir>/raw/<dataset>/<file>.csv plus <cache_dir>/raw/<dataset>/_package.json.
Skips files that already exist with the size CKAN reports.
"""

import json
import os
import sys
import time
import urllib.parse
import urllib.request

API = "https://data.gov.lv/dati/api/3/action/"
UA = "finora-research/0.1 (+public repo)"


def get_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.load(r)


def download(url, dest, expected_size=None):
    if os.path.exists(dest) and expected_size and os.path.getsize(dest) == expected_size:
        return "cached"
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    tmp = dest + ".part"
    with urllib.request.urlopen(req, timeout=600) as r, open(tmp, "wb") as f:
        while chunk := r.read(1 << 20):
            f.write(chunk)
    os.replace(tmp, dest)
    return "downloaded"


def main():
    args = sys.argv[1:]
    cache = args[0]
    org = args[args.index("--org") + 1] if "--org" in args else None
    only = set()
    if "--dataset" in args:
        i = args.index("--dataset") + 1
        while i < len(args) and not args[i].startswith("--"):
            only.add(args[i])
            i += 1
    raw = os.path.join(cache, "raw")
    os.makedirs(raw, exist_ok=True)

    packages = []
    if org:
        start = 0
        while True:
            q = urllib.parse.urlencode({"fq": f"organization:{org}", "rows": 100, "start": start})
            res = get_json(API + "package_search?" + q)["result"]
            packages += res["results"]
            start += 100
            if start >= res["count"]:
                break
        with open(os.path.join(raw, f"catalog_{org}.json"), "w", encoding="utf-8") as f:
            json.dump(packages, f, ensure_ascii=False, indent=1)
    for name in only - {p["name"] for p in packages}:
        packages.append(get_json(API + "package_show?id=" + name)["result"])
        time.sleep(0.5)

    if "--catalog-only" in args:
        for p in packages:
            print(p["name"], p.get("license_id"), p.get("metadata_modified"))
        return

    for p in packages:
        if only and p["name"] not in only:
            continue
        d = os.path.join(raw, p["name"])
        os.makedirs(d, exist_ok=True)
        with open(os.path.join(d, "_package.json"), "w", encoding="utf-8") as f:
            json.dump(p, f, ensure_ascii=False, indent=1)
        for r in p["resources"]:
            if (r.get("format") or "").upper() not in ("CSV", "JSON"):
                continue
            fname = os.path.basename(urllib.parse.urlparse(r["url"]).path)
            try:
                status = download(r["url"], os.path.join(d, fname), r.get("size"))
            except Exception as e:  # report and continue; one broken resource must not stop the run
                status = f"error {e}"
            print(p["name"], fname, r.get("size"), status, flush=True)
            time.sleep(0.5)


if __name__ == "__main__":
    main()
