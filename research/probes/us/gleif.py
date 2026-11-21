"""Probe GLEIF: API counts by country and the golden copy (LEI level 1 + relationship records).

Usage: python -I research/probes/us/gleif.py [--golden]
Without flags: API counts for US/LT/LV/EE. With --golden: downloads the latest lei2 and rr CSV golden copies
into research/.cache/us/gleif/ and profiles registration authorities, statuses and parent coverage.
"""
import collections
import csv
import io
import json
import pathlib
import sys
import time
import urllib.parse
import urllib.request
import zipfile

UA = "Finora research (open-source; github.com/nakotomagami-a11y/finora)"
API = "https://api.gleif.org/api/v1/lei-records"
GOLDEN = "https://goldencopy.gleif.org/api/v2/golden-copies/publishes/latest"
OUT = pathlib.Path(__file__).resolve().parents[2] / ".cache" / "us" / "gleif"
COUNTRIES = ("US", "LT", "LV", "EE")


def get_json(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=120) as r:
        return json.load(r)


def count(filters):
    query = urllib.parse.urlencode({**{f"filter[{k}]": v for k, v in filters.items()}, "page[size]": 1})
    time.sleep(0.3)
    return get_json(f"{API}?{query}")["meta"]["pagination"]["total"]


def api_counts():
    for c in COUNTRIES:
        total = count({"entity.legalAddress.country": c})
        issued = count({"entity.legalAddress.country": c, "registration.status": "ISSUED"})
        lapsed = count({"entity.legalAddress.country": c, "registration.status": "LAPSED"})
        print(f"{c}: legal-address LEIs={total} issued={issued} lapsed={lapsed}")


def download(url):
    OUT.mkdir(parents=True, exist_ok=True)
    target = OUT / url.rsplit("/", 1)[-1]
    if not target.exists():
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=1800) as r:
            target.write_bytes(r.read())
    return target


def rows(path):
    z = zipfile.ZipFile(path)
    with z.open(z.namelist()[0]) as f:
        yield from csv.DictReader(io.TextIOWrapper(f, encoding="utf-8", newline=""))


def classify_us_authorities(counter):
    """Group US LEIs by the kind of registration authority behind RegistrationAuthorityID."""
    kinds = collections.Counter()
    for code, n in counter.items():
        if code in ("(none)", "RA999999"):
            kinds["no registration authority"] += n
            continue
        if code == "RA888888":
            kinds["other (free text)"] += n
            continue
        time.sleep(0.25)
        attrs = get_json(f"https://api.gleif.org/api/v1/registration-authorities/{code}")["data"]["attributes"]
        name = (attrs.get("internationalName") or attrs.get("localName") or "").lower()
        juris = [j.get("jurisdiction") for j in attrs.get("jurisdictions", [])]
        if "edgar" in name:
            kinds["SEC EDGAR (registeredAs = CIK)"] += n
        elif any(j and j != "United States of America" for j in juris) and attrs["jurisdictions"][0].get("countryCode") == "US":
            kinds["US state registry"] += n
        else:
            kinds[f"other: {attrs.get('internationalName') or attrs.get('localName')}"] += n
    total = sum(counter.values())
    print("  US LEIs by registration-authority kind:")
    for k, n in kinds.most_common(15):
        print(f"    {k}: {n} ({n / total:.1%})")


def golden():
    latest = get_json(GOLDEN)["data"]
    print("golden copy publish date:", latest["publish_date"])
    lei2 = download(latest["lei2"]["full_file"]["csv"]["url"])
    rr = download(latest["rr"]["full_file"]["csv"]["url"])

    by_country = {c: collections.Counter() for c in COUNTRIES}
    ra = {c: collections.Counter() for c in COUNTRIES}
    juris = collections.Counter()
    us_leis, total, header = set(), 0, None
    for r in rows(lei2):
        total += 1
        if header is None:
            header = list(r.keys())
        c = r["Entity.LegalAddress.Country"]
        if c not in by_country:
            continue
        by_country[c][r["Registration.RegistrationStatus"]] += 1
        ra[c][r["Entity.RegistrationAuthority.RegistrationAuthorityID"] or "(none)"] += 1
        if c == "US":
            juris[r["Entity.LegalJurisdiction"]] += 1
            us_leis.add(r["LEI"])
    print(f"lei2 rows={total}, columns={len(header)}")
    print("  columns (first 40):", header[:40])
    for c in COUNTRIES:
        n = sum(by_country[c].values())
        with_id = n - ra[c]["(none)"]
        print(f"  {c}: rows={n} status={dict(by_country[c])} with registration-authority id={with_id} ({with_id / max(n, 1):.0%})")
        print(f"     top authorities: {ra[c].most_common(8)}")
    print("  US top jurisdictions:", juris.most_common(10))
    classify_us_authorities(ra["US"])

    kinds, us_children = collections.Counter(), collections.Counter()
    rr_header = None
    for r in rows(rr):
        if rr_header is None:
            rr_header = list(r.keys())
        kind = r["Relationship.RelationshipType"]
        kinds[kind] += 1
        if r["Relationship.StartNode.NodeID"] in us_leis:
            us_children[kind] += 1
    print("rr columns (first 20):", rr_header[:20])
    print("  relationship types:", dict(kinds))
    print(f"  US child entities with a parent record: {dict(us_children)} of {len(us_leis)} US LEIs")


def main():
    api_counts()
    if "--golden" in sys.argv:
        golden()


if __name__ == "__main__":
    main()
