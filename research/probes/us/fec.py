"""Probe FEC: the committee master bulk file and the openFEC API.

Uses FEC_API_KEY from the environment, or DEMO_KEY. Individual contributor
records are only counted, never printed: 52 U.S.C. 30111(a)(4) bars using them
for commercial purposes or solicitation.

    python -I research/probes/us/fec.py <generic employer or org term>
"""

import collections
import csv
import io
import json
import os
import pathlib
import sys
import urllib.parse
import urllib.request
import zipfile

UA = "Finora research (open-source; github.com/nakotomagami-a11y/finora)"
CACHE = pathlib.Path(__file__).resolve().parents[2] / ".cache" / "us" / "fec"
CYCLE = "2026"
CM_HEADER = ("CMTE_ID,CMTE_NM,TRES_NM,CMTE_ST1,CMTE_ST2,CMTE_CITY,CMTE_ST,CMTE_ZIP,CMTE_DSGN,"
             "CMTE_TP,CMTE_PTY_AFFILIATION,CMTE_FILING_FREQ,ORG_TP,CONNECTED_ORG_NM,CAND_ID").split(",")


def fetch(url, dest=None):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=120) as r:
        body = r.read()
        headers = dict(r.headers)
    if dest:
        CACHE.mkdir(parents=True, exist_ok=True)
        (CACHE / dest).write_bytes(body)
    return body, headers


def committee_master():
    url = f"https://www.fec.gov/files/bulk-downloads/{CYCLE}/cm{CYCLE[2:]}.zip"
    body, headers = fetch(url, f"cm{CYCLE[2:]}.zip")
    print(f"bulk cm{CYCLE[2:]}.zip bytes={len(body)} last-modified={headers.get('Last-Modified')}")
    with zipfile.ZipFile(io.BytesIO(body)) as z:
        text = z.read(z.namelist()[0]).decode("latin-1")
    rows = list(csv.reader(io.StringIO(text), delimiter="|"))
    org = collections.Counter(r[CM_HEADER.index("ORG_TP")] for r in rows)
    connected = sum(1 for r in rows if r[CM_HEADER.index("CONNECTED_ORG_NM")].strip())
    corp = [r for r in rows if r[CM_HEADER.index("ORG_TP")] == "C"]
    print(f"committees={len(rows)} with_connected_org={connected} org_type={dict(org)}")
    print(f"corporate-connected committees={len(corp)}")


def api(term):
    key = os.environ.get("FEC_API_KEY", "DEMO_KEY")
    base = "https://api.open.fec.gov/v1"
    q = urllib.parse.urlencode({"api_key": key, "q": term, "organization_type": "C", "per_page": 1})
    body, headers = fetch(f"{base}/committees/?{q}", "committees.json")
    data = json.loads(body)
    print(f"api key={'DEMO_KEY' if key == 'DEMO_KEY' else 'env'} "
          f"rate-limit={headers.get('X-Ratelimit-Limit')} remaining={headers.get('X-Ratelimit-Remaining')}")
    print(f"committees q=term org_type=C: count={data['pagination']['count']}")
    if data["results"]:
        print("committee fields:", sorted(data["results"][0]))
    q = urllib.parse.urlencode({"api_key": key, "contributor_employer": term,
                                "two_year_transaction_period": CYCLE, "per_page": 1})
    body, _ = fetch(f"{base}/schedules/schedule_a/?{q}", "schedule_a.json")
    data = json.loads(body)
    print(f"schedule_a contributor_employer=term cycle={CYCLE}: count={data['pagination'].get('count')}")
    if data["results"]:
        print("schedule_a fields:", len(data["results"][0]))


if __name__ == "__main__":
    committee_master()
    api(sys.argv[1] if len(sys.argv) > 1 else "freight")
