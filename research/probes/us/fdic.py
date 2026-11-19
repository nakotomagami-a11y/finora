"""Probe the FDIC BankFind Suite API (no key needed).

    python -I research/probes/us/fdic.py
"""

import collections
import json
import pathlib
import time
import urllib.parse
import urllib.request

UA = "Finora research (open-source; github.com/nakotomagami-a11y/finora)"
BASE = "https://api.fdic.gov/banks"
CACHE = pathlib.Path(__file__).resolve().parents[2] / ".cache" / "us" / "fdic"


def get(endpoint, **params):
    url = f"{BASE}/{endpoint}?{urllib.parse.urlencode({'format': 'json', **params})}"
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=120) as r:
        body = r.read()
        headers = dict(r.headers)
    CACHE.mkdir(parents=True, exist_ok=True)
    (CACHE / f"{endpoint}.json").write_bytes(body)
    time.sleep(0.5)
    return json.loads(body), headers


def main():
    for endpoint, params in [
        ("institutions", {"filters": "ACTIVE:1", "limit": 10000, "fields": "CERT,FED_RSSD,RSSDHCR,NAMEHCR,NAME,STALP,ASSET,REPDTE,ACTIVE,BKCLASS,WEBADDR"}),
        ("institutions", {"limit": 1}),
        ("failures", {"limit": 10000, "sort_by": "FAILDATE", "sort_order": "DESC", "fields": "CERT,NAME,FAILDATE,RESTYPE,COST,QBFASSET"}),
        ("financials", {"filters": "CERT:10004", "limit": 1, "sort_by": "REPDTE", "sort_order": "DESC"}),
        ("history", {"filters": "CERT:10004", "limit": 50}),
        ("locations", {"filters": "CERT:10004", "limit": 1}),
    ]:
        data, headers = get(endpoint, **params)
        rows = data["data"]
        first = rows[0]["data"] if rows else {}
        print(f"{endpoint}: total={data['meta']['total']} index={data['meta'].get('index', {})} "
              f"fields_in_row={len(first)} etag={'ETag' in headers or 'Etag' in headers} "
              f"rate-limit={headers.get('X-Ratelimit-Limit')}")
        if endpoint == "institutions" and params.get("filters") == "ACTIVE:1":
            filled = collections.Counter()
            for r in rows:
                for k in ("FED_RSSD", "RSSDHCR", "NAMEHCR", "WEBADDR"):
                    if str(r["data"].get(k) or "").strip() not in ("", "0"):
                        filled[k] += 1
            print("  active fill:", {k: f"{n / len(rows):.0%}" for k, n in filled.items()},
                  "latest REPDTE:", max(r["data"].get("REPDTE", "") for r in rows))
        if endpoint == "failures":
            years = collections.Counter(r["data"]["FAILDATE"][-4:] for r in rows)
            print("  failures last years:", sorted(years.items())[-6:], "latest:", rows[0]["data"]["FAILDATE"])
        if endpoint == "financials":
            print("  latest REPDTE:", first.get("REPDTE"))
        if endpoint == "history":
            print("  event types:", collections.Counter(r["data"].get("CHANGECODE_DESC") for r in rows).most_common(8))


if __name__ == "__main__":
    main()
