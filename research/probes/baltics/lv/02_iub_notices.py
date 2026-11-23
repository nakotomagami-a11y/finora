"""Download daily procurement-notice JSON files from the Procurement Monitoring Bureau (open.iub.gov.lv).

Usage: python -I 02_iub_notices.py <cache_dir> <YYYY/MM> [<YYYY/MM> ...]

The bureau publishes one JSON file per day (e-form notices since 25 Oct 2023) under /data/notice/YYYY/MM/.
Writes <cache_dir>/raw/iub/notice/YYYY-MM/<DD-MM-YYYY>.json and the field description
<cache_dir>/raw/iub/publiskie_iepirkumi_metadata.json.
"""

import os
import re
import sys
import time
import urllib.request

BASE = "https://open.iub.gov.lv"
UA = "finora-research/0.1 (+public repo)"


def fetch(path):
    req = urllib.request.Request(BASE + path, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def main():
    cache, months = sys.argv[1], sys.argv[2:]
    root = os.path.join(cache, "raw", "iub")
    os.makedirs(root, exist_ok=True)
    meta = os.path.join(root, "publiskie_iepirkumi_metadata.json")
    if not os.path.exists(meta):
        open(meta, "wb").write(fetch("/data/publiskie_iepirkumi_metadata.json"))
    for month in months:
        listing = fetch(f"/data/notice/{month}").decode("utf-8")
        files = re.findall(rf'href="(/data/notice/{month}/[^"]+\.json)"', listing)
        out = os.path.join(root, "notice", month.replace("/", "-"))
        os.makedirs(out, exist_ok=True)
        for path in files:
            dest = os.path.join(out, os.path.basename(path))
            if os.path.exists(dest):
                continue
            open(dest, "wb").write(fetch(path))
            time.sleep(0.5)
        print(month, len(files), "files")


if __name__ == "__main__":
    main()
