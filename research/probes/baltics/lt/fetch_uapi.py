"""Download a whole model from Lithuania's open data API (get.data.gov.lt, Spinta UAPI) as CSV.

Usage: python fetch_uapi.py <model path> [query] [--out NAME]
  model path: e.g. datasets/gov/rc/jar/iregistruoti/JuridinisAsmuo
  query:      optional UAPI query, e.g. "select(ja_kodas,reiksme)&laikotarpis_iki>'2024-01-01'"

Without a limit the API streams the full table. Writes research/.cache/baltics/lt/raw/<dataset>/<Model>.csv
and appends a line (url, HTTP status, Last-Modified, bytes, rows, seconds) to fetch-log.tsv next to it.
"""
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

BASE = "https://get.data.gov.lt/"
UA = "finora-research/0.1 (+public repo)"
CACHE = Path(__file__).resolve().parents[3] / ".cache" / "baltics" / "lt" / "raw"


def fetch(model: str, query: str = "", out_name: str | None = None) -> Path:
    url = BASE + model + "/:format/csv" + ("?" + urllib.parse.quote(query, safe="()&=,'<>!*:-._\"") if query else "")
    parts = model.split("/")
    out = CACHE / parts[-2] / ((out_name or parts[-1]) + ".csv")
    out.parent.mkdir(parents=True, exist_ok=True)
    started = time.time()
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=1800) as resp, open(out, "wb") as fh:
        status, modified = resp.status, resp.headers.get("Last-Modified", "")
        size = 0
        while chunk := resp.read(1 << 20):
            fh.write(chunk)
            size += len(chunk)
    with open(out, "rb") as fh:
        rows = sum(1 for _ in fh) - 1
    took = round(time.time() - started, 1)
    with open(CACHE / "fetch-log.tsv", "a", encoding="utf-8") as log:
        log.write(f"{url}\t{status}\t{modified}\t{size}\t{rows}\t{took}\n")
    print(f"{out.name}: {rows} rows, {size} bytes, {took}s, Last-Modified {modified}")
    return out


if __name__ == "__main__":
    args = sys.argv[1:]
    name = None
    if "--out" in args:
        i = args.index("--out")
        name = args[i + 1]
        del args[i : i + 2]
    fetch(args[0], args[1] if len(args) > 1 else "", name)
