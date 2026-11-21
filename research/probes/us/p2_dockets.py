"""Probe provider P2 (a nonprofit court-data aggregator): bulk snapshots, anonymous API reach, and (with a token) search.

No token is read (H5). P2_BULK_BASE and P2_API_BASE come from the private provider map. Without it only the bulk files and
court metadata are reachable: every other v4 endpoint answers 401.

    python -I research/probes/us/p2_dockets.py ["party name query"]
"""

import bz2
import collections
import csv
import io
import json
import os
import pathlib
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

csv.field_size_limit(1 << 30)
UA = "Finora research (open-source; github.com/nakotomagami-a11y/finora)"
BUCKET = os.environ.get("P2_BULK_BASE", "")  # P2 bulk-file host, from the private provider map
API = os.environ.get("P2_API_BASE", "")  # P2 REST API base, from the private provider map
CACHE = pathlib.Path(__file__).resolve().parents[2] / ".cache" / "us" / "p2"


def get(url, token=None, limit=None):
    headers = {"User-Agent": UA}
    if token:
        headers["Authorization"] = f"Token {token}"
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return r.status, (r.read(limit) if limit else r.read()), dict(r.headers)
    except urllib.error.HTTPError as e:
        return e.code, e.read(), dict(e.headers)


def list_bulk():
    objects, token = [], None
    while True:
        params = {"list-type": "2", "prefix": "bulk-data/"}
        if token:
            params["continuation-token"] = token
        _, body, _ = get(f"{BUCKET}/?{urllib.parse.urlencode(params)}")
        text = body.decode()
        objects += re.findall(r"<Key>(.*?)</Key><LastModified>(.*?)</LastModified>.*?<Size>(\d+)</Size>", text)
        m = re.search(r"<NextContinuationToken>(.*?)</NextContinuationToken>", text)
        if not m:
            return objects
        token = m.group(1)


def latest_by_type(objects):
    latest = {}
    for key, modified, size in objects:
        m = re.match(r"bulk-data/(.+?)-(\d{4}-\d{2}-\d{2})\.(csv\.bz2|sql|.+)$", key)
        if not m:
            continue
        kind = m.group(1)
        if kind not in latest or m.group(2) > latest[kind][1]:
            latest[kind] = (key, m.group(2), int(size))
    return latest


def sample_bz2(key, rows=50_000):
    """Stream the head of a bulk CSV: header plus a row sample, without downloading it all."""
    req = urllib.request.Request(f"{BUCKET}/{key}", headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=300) as r:
        reader = csv.reader(io.TextIOWrapper(bz2.BZ2File(r), encoding="utf-8", errors="replace"))
        header = next(reader)
        sample = [row for _, row in zip(range(rows), reader)]
    return header, sample


def main(query):
    objects = list_bulk()
    latest = latest_by_type(objects)
    total = sum(int(s) for _, _, s in objects)
    print(f"bulk objects={len(objects)} total_bytes={total}")
    for kind, (key, date, size) in sorted(latest.items(), key=lambda kv: -kv[1][2])[:25]:
        print(f"  {kind:40s} {date} {size / 1e9:8.2f} GB")

    dockets = latest.get("dockets")
    if dockets:
        header, sample = sample_bz2(dockets[0])
        print(f"dockets columns={len(header)}: {', '.join(header)}")
        idx = {h: i for i, h in enumerate(header)}
        courts = collections.Counter(r[idx["court_id"]] for r in sample if len(r) == len(header))
        filled = {c: sum(1 for r in sample if len(r) == len(header) and r[idx[c]].strip()) / len(sample)
                  for c in ("case_name", "docket_number", "date_filed", "date_terminated", "nature_of_suit",
                            "pacer_case_id", "idb_data_id", "cause", "jurisdiction_type")
                  if c in idx}
        print(f"dockets sample rows={len(sample)} distinct courts={len(courts)}")
        print("dockets sample fill:", {k: f"{v:.0%}" for k, v in filled.items()})

    for path in ("courts/?id=nysd", "dockets/?page_size=1", "search/?q=test&type=r"):
        status, _, headers = get(f"{API}/{path}")
        print(f"anonymous GET {path.split('?')[0]} -> {status} etag={headers.get('ETag') is not None}")

    token = None  # keys are out of v1 (H5)
    if not token:
        print("no token (H5): skipping authenticated search")
        return
    q = urllib.parse.urlencode({"q": f'party:("{query}")', "type": "r"})
    status, body, _ = get(f"{API}/search/?{q}", token)
    CACHE.mkdir(parents=True, exist_ok=True)
    (CACHE / "search.json").write_bytes(body)
    data = json.loads(body)
    print(f"search status={status} count={data.get('count')}")
    if data.get("results"):
        print("search result fields:", sorted(data["results"][0]))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "Example Logistics LLC")
