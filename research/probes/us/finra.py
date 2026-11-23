"""Probe FINRA: the public Query API (no key) and the BrokerCheck JSON search.

BrokerCheck terms allow automated compiling only for investor-protection,
academic, compliance or regulatory purposes and without disturbing the service,
so this probe makes a handful of requests, one at a time.

    python -I research/probes/us/finra.py <generic search term>
"""

import json
import pathlib
import sys
import time
import urllib.parse
import urllib.request

UA = "Finora research (open-source; github.com/nakotomagami-a11y/finora)"
CACHE = pathlib.Path(__file__).resolve().parents[2] / ".cache" / "us" / "finra"


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        body = r.read()
    time.sleep(1)
    return body


def save(name, body):
    CACHE.mkdir(parents=True, exist_ok=True)
    (CACHE / name).write_bytes(body)


def keys(obj, prefix=""):
    if isinstance(obj, dict):
        for k, v in obj.items():
            yield from keys(v, f"{prefix}{k}.")
    elif isinstance(obj, list) and obj:
        yield from keys(obj[0], prefix + "[]")
    else:
        yield prefix.rstrip(".")


def main(term):
    meta = json.loads(get("https://api.finra.org/metadata/group/otcMarket/name/weeklySummary"))
    print("query-api public dataset otcMarket/weeklySummary fields:", [f["name"] for f in meta["fields"]])

    q = urllib.parse.urlencode({"query": term, "nrows": 5, "start": 0, "wt": "json"})
    search = get(f"https://api.brokercheck.finra.org/search/firm?{q}")
    save("firm-search.json", search)
    hits = json.loads(search)["hits"]
    print(f"brokercheck firm search: total={hits['total']}")
    print("search hit fields:", sorted(set(keys(hits["hits"][0]["_source"]))))

    crd = hits["hits"][0]["_source"]["firm_source_id"]
    detail = json.loads(get(f"https://api.brokercheck.finra.org/search/firm/{crd}"))
    content = json.loads(detail["hits"]["hits"][0]["_source"]["content"])
    save("firm-detail.json", json.dumps(content, indent=1).encode())
    print("firm detail top-level sections:", sorted(content))
    print("firm detail leaf fields:", len(set(keys(content))))

    q = urllib.parse.urlencode({"query": term, "nrows": 1, "start": 0, "wt": "json"})
    people = json.loads(get(f"https://api.brokercheck.finra.org/search/individual?{q}"))["hits"]
    print(f"brokercheck individual search: total={people['total']}")
    if people["hits"]:
        print("individual hit fields:", sorted(set(keys(people["hits"][0]["_source"]))))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "capital")
