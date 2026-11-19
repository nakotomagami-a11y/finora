"""Probe IRS exempt-organization data: EO BMF, the e-filed 990 index, Pub 78, revocations.

    python -I research/probes/us/irs990.py [index-year]
"""

import collections
import csv
import io
import pathlib
import sys
import urllib.request
import zipfile

UA = "Finora research (open-source; github.com/nakotomagami-a11y/finora)"
CACHE = pathlib.Path(__file__).resolve().parents[2] / ".cache" / "us" / "irs990"


def download(url, name):
    CACHE.mkdir(parents=True, exist_ok=True)
    dest = CACHE / name
    if not dest.exists():
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=300) as r, open(dest, "wb") as f:
            while chunk := r.read(1 << 20):
                f.write(chunk)
    return dest


def head(url):
    req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.headers.get("Content-Length"), r.headers.get("Last-Modified")


def bmf():
    rows, header = 0, None
    subsection = collections.Counter()
    filled = collections.Counter()
    max_ruling = ""
    for region in (1, 2, 3, 4):
        url = f"https://www.irs.gov/pub/irs-soi/eo{region}.csv"
        size, modified = head(url)
        print(f"eo{region}.csv bytes={size} last-modified={modified}")
        with open(download(url, f"eo{region}.csv"), encoding="latin-1", newline="") as f:
            reader = csv.DictReader(f)
            header = reader.fieldnames
            for r in reader:
                rows += 1
                subsection[r["SUBSECTION"]] += 1
                max_ruling = max(max_ruling, r["RULING"])
                for c in ("ICO", "ASSET_AMT", "INCOME_AMT", "REVENUE_AMT", "NTEE_CD", "TAX_PERIOD"):
                    if r[c].strip() and r[c].strip() != "0":
                        filled[c] += 1
    print(f"BMF columns={len(header)}: {', '.join(header)}")
    print(f"BMF rows={rows} max RULING (YYYYMM)={max_ruling}")
    print("BMF top subsections:", subsection.most_common(6))
    print("BMF fill:", {c: f"{n / rows:.1%}" for c, n in filled.items()})


def index(year):
    path = download(f"https://apps.irs.gov/pub/epostcard/990/xml/{year}/index_{year}.csv", f"index_{year}.csv")
    with open(path, encoding="latin-1", newline="") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    types = collections.Counter(r["RETURN_TYPE"] for r in rows)
    print(f"990 index {year}: columns={reader.fieldnames} rows={len(rows)}")
    print("return types:", types.most_common())
    batches = sorted({r.get("XML_BATCH_ID", "") for r in rows})
    print(f"batches={len(batches)} last={batches[-1] if batches else ''}")
    periods = collections.Counter(r["TAX_PERIOD"][:4] for r in rows)
    print("tax-period years:", sorted(periods.items())[-5:])


def zipped_list(url, name):
    with zipfile.ZipFile(download(url, name)) as z:
        info = z.infolist()[0]
        with z.open(info) as f:
            lines = io.TextIOWrapper(f, encoding="latin-1").read().splitlines()
    data = [line for line in lines if line.count("|") >= 3]
    print(f"{name}: member={info.filename} rows={len(data)} fields={len(data[0].split('|'))}")


def xml_sample(year, part, limit=500):
    name = f"{year}_TEOS_XML_{part}.zip"
    path = download(f"https://apps.irs.gov/pub/epostcard/990/xml/{year}/{name}", name)
    with zipfile.ZipFile(path) as z:
        members = [i for i in z.infolist() if i.filename.endswith(".xml")]
        print(f"{name}: xml files={len(members)}")
        seen = officers = revenue = schedule_r = 0
        for info in members:
            text = z.read(info).decode("utf-8", "replace")
            if "<ReturnTypeCd>990</ReturnTypeCd>" not in text:
                continue
            seen += 1
            officers += "<Form990PartVIISectionAGrp>" in text
            revenue += "<CYTotalRevenueAmt>" in text
            schedule_r += "<IRS990ScheduleR" in text
            if seen >= limit:
                break
    print(f"sampled full 990s={seen}: officer list (Part VII)={officers / seen:.0%} "
          f"total revenue={revenue / seen:.0%} schedule R (related orgs)={schedule_r / seen:.0%}")


if __name__ == "__main__":
    bmf()
    index(sys.argv[1] if len(sys.argv) > 1 else "2025")
    zipped_list("https://apps.irs.gov/pub/epostcard/data-download-pub78.zip", "pub78.zip")
    zipped_list("https://apps.irs.gov/pub/epostcard/data-download-revocation.zip", "revocation.zip")
    xml_sample("2025", "01A")
    for part in ("01A", "05B"):
        print(f"2025_TEOS_XML_{part}.zip bytes/modified:",
              head(f"https://apps.irs.gov/pub/epostcard/990/xml/2025/2025_TEOS_XML_{part}.zip"))
