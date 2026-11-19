"""Probe USPTO reachability: Open Data Portal (ODP) API, TSDR, and the bulk site.

Every data path needs a key: USPTO_ODP_KEY (ODP, header X-API-KEY) and USPTO_TSDR_KEY
(TSDR, header USPTO-API-KEY). Without them this reports what answers anonymously.

    python -I research/probes/us/uspto.py ["applicant name"]
"""

import json
import os
import pathlib
import sys
import urllib.error
import urllib.parse
import urllib.request

UA = "Finora research (open-source; github.com/nakotomagami-a11y/finora)"
CACHE = pathlib.Path(__file__).resolve().parents[2] / ".cache" / "us" / "uspto"


def get(url, headers=None):
    req = urllib.request.Request(url, headers={"User-Agent": UA, **(headers or {})})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()
    except urllib.error.URLError as e:
        return f"unreachable ({e.reason})", b""


def main(applicant):
    odp_key = os.environ.get("USPTO_ODP_KEY")
    tsdr_key = os.environ.get("USPTO_TSDR_KEY")
    odp_headers = {"X-API-KEY": odp_key} if odp_key else {}
    q = urllib.parse.urlencode({"q": f'applicationMetaData.firstApplicantName:"{applicant}"', "limit": 5})
    checks = {
        "odp datasets search": ("https://api.uspto.gov/api/v1/datasets/products/search?q=assignment", odp_headers),
        "odp patent search": (f"https://api.uspto.gov/api/v1/patent/applications/search?{q}", odp_headers),
        "tsdr case status": ("https://tsdrapi.uspto.gov/ts/cd/casestatus/sn00000000/info",
                             {"USPTO-API-KEY": tsdr_key} if tsdr_key else {}),
        "bulk site (WAF-challenged)": ("https://data.uspto.gov/bulkdata/datasets", {}),
        "legacy assignment api": ("https://assignment-api.uspto.gov/patent/lookup?query=x&filter=OwnerName", {}),
    }
    for name, (url, headers) in checks.items():
        status, body = get(url, headers)
        note = "challenge page" if b"awswaf" in body else ""
        print(f"{name}: {status} {note}")
        if name == "odp patent search" and status == 200:
            CACHE.mkdir(parents=True, exist_ok=True)
            (CACHE / "patent-search.json").write_bytes(body)
            data = json.loads(body)
            print(f"  count={data.get('count')} fields={sorted(data.get('patentFileWrapperDataBag', [{}])[0])}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "Example Solar LLC")
