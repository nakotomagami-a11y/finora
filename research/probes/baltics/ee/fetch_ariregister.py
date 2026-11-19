"""Download the Estonian e-Business Register open-data files.

Source: https://avaandmed.ariregister.rik.ee/en/downloading-open-data (CC BY 4.0).
Reads the download page, takes every JSON/CSV zip it links (XML twins and the stale
2023 parquet snapshots are skipped) and saves them, with the HTTP headers, under
research/.cache/baltics/ee/raw/ariregister/.

Usage: python -I research/probes/baltics/ee/fetch_ariregister.py
"""

import json
import re
import sys
import time
import urllib.request
from pathlib import Path

BASE = "https://avaandmed.ariregister.rik.ee"
PAGE = BASE + "/en/downloading-open-data"
UA = "finora-research/0.1 (+public repo)"
OUT = Path(__file__).resolve().parents[4] / "research" / ".cache" / "baltics" / "ee" / "raw" / "ariregister"


def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=600)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    page = get(PAGE).read().decode("utf-8")
    links = sorted(set(re.findall(r'href="(/sites/default/files/[^"]+\.zip)"', page)))
    links = [l for l in links if ".xml.zip" not in l and "parquet" not in l]
    meta = {}
    for link in links:
        name = link.rsplit("/", 1)[1]
        target = OUT / name
        with get(BASE + link) as resp:
            meta[name] = {"url": BASE + link, "last_modified": resp.headers.get("Last-Modified"),
                          "bytes": int(resp.headers.get("Content-Length") or 0)}
            if not (target.exists() and target.stat().st_size == meta[name]["bytes"]):
                with open(target, "wb") as fh:
                    while chunk := resp.read(1 << 20):
                        fh.write(chunk)
        print(name, meta[name]["bytes"], meta[name]["last_modified"], file=sys.stderr)
        time.sleep(0.5)
    (OUT / "_meta.json").write_text(json.dumps(meta, indent=2))


if __name__ == "__main__":
    main()
