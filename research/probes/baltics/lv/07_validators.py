"""Check HTTP validator support (ETag, Last-Modified, Content-Length) for every downloaded data.gov.lv resource.

Usage: python -I 07_validators.py <cache_dir>

Reads <cache_dir>/raw/*/_package.json, sends one HEAD request per CSV resource and writes
<cache_dir>/validators.json. Run twice on different days to see whether ETags survive regeneration.
"""

import json
import glob
import os
import sys
import time
import urllib.request

UA = "finora-research/0.1 (+public repo)"


def head(url):
    req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return {k: r.headers.get(k) for k in ("ETag", "Last-Modified", "Content-Length", "Content-Type")}


def main():
    cache = sys.argv[1]
    out = {}
    for pkg in sorted(glob.glob(os.path.join(cache, "raw", "*", "_package.json"))):
        p = json.load(open(pkg, encoding="utf-8"))
        for r in p["resources"]:
            if (r.get("format") or "").upper() != "CSV":
                continue
            try:
                out[r["url"]] = {"dataset": p["name"], "ckan_last_modified": r.get("last_modified"), **head(r["url"])}
            except Exception as e:  # keep going; record the failure
                out[r["url"]] = {"dataset": p["name"], "error": str(e)}
            time.sleep(0.3)
    stamp = time.strftime("%Y-%m-%dT%H:%M:%S")
    with open(os.path.join(cache, f"validators-{stamp[:10]}.json"), "w", encoding="utf-8") as f:
        json.dump({"checked": stamp, "resources": out}, f, indent=1)
    have = lambda k: sum(1 for v in out.values() if v.get(k))
    print(f"{len(out)} resources; ETag {have('ETag')}, Last-Modified {have('Last-Modified')}, Content-Length {have('Content-Length')}")


if __name__ == "__main__":
    main()
