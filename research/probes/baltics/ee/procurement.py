"""Download and measure the Estonian public procurement register's contract award notices.

Source: https://riigihanked.riik.ee/rhr-web/#/open-data (CC BY-SA 3.0 per andmed.eesti.ee).
API (no key): GET https://riigihanked.riik.ee/rhr/api/public/v1/opendata/notice_award/<year>/month/<m>/xml
returns one XML file per month: eForms UBL ContractAwardNotice documents wrapped in <OPEN-DATA>.

For each month the script counts notices, winning tenderers, how many winners carry an
Estonian registry code (cac:PartyLegalEntity/cbc:CompanyID), and the share with a contract value.
Per-supplier aggregates (registry code -> awards, total value) go to SQLite table `award` in
research/.cache/baltics/ee/procurement.sqlite; the measurements go to stats/procurement.json.

Usage: python -I research/probes/baltics/ee/procurement.py 2025-11 2026-10
"""

import json
import re
import sqlite3
import sys
import time
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

UA = "finora-research/0.1 (+public repo)"
API = "https://riigihanked.riik.ee/rhr/api/public/v1/opendata/notice_award/{y}/month/{m}/xml"
EE = Path(__file__).resolve().parents[4] / "research" / ".cache" / "baltics" / "ee"
RAW = EE / "raw" / "rhr"
NS = {
    "cac": "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
    "cbc": "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
    "efac": "http://data.europa.eu/p27/eforms-ubl-extension-aggregate-components/1",
    "efbc": "http://data.europa.eu/p27/eforms-ubl-extension-basic-components/1",
}


def months(start, end):
    y, m = map(int, start.split("-"))
    ey, em = map(int, end.split("-"))
    while (y, m) <= (ey, em):
        yield y, m
        y, m = (y + 1, 1) if m == 12 else (y, m + 1)


def fetch(y, m):
    target = RAW / f"can_{y}_{m:02d}.xml"
    if not target.exists():
        req = urllib.request.Request(API.format(y=y, m=m), headers={"User-Agent": UA})
        target.write_bytes(urllib.request.urlopen(req, timeout=600).read())
        time.sleep(1)
    return target


def parse(path, db, totals):
    root = ET.parse(path).getroot()
    for notice in root:
        totals["notices"] += 1
        orgs = {}
        for org in notice.iter(f"{{{NS['efac']}}}Organization"):
            oid = org.findtext(".//cac:PartyIdentification/cbc:ID", namespaces=NS)
            code = org.findtext(".//cac:PartyLegalEntity/cbc:CompanyID", namespaces=NS)
            country = org.findtext(".//cac:PostalAddress/cac:Country/cbc:IdentificationCode", namespaces=NS)
            orgs[oid] = (code, country)
        tenderers = {}
        for tp in notice.iter(f"{{{NS['efac']}}}TenderingParty"):
            tid = tp.findtext("cbc:ID", namespaces=NS)
            tenderers[tid] = [t.findtext("cbc:ID", namespaces=NS) for t in tp.findall("efac:Tenderer", NS)]
        winning = {ref.findtext("cbc:ID", namespaces=NS)
                   for lr in notice.iter(f"{{{NS['efac']}}}LotResult")
                   if lr.findtext("cbc:TenderResultCode", namespaces=NS) == "selec-w"
                   for ref in lr.findall("efac:LotTender", NS)}
        for lt in notice.iter(f"{{{NS['efac']}}}LotTender"):
            if lt.find("efac:TenderingParty", NS) is None or lt.findtext("cbc:ID", namespaces=NS) not in winning:
                continue
            amount = lt.findtext("cac:LegalMonetaryTotal/cbc:PayableAmount", namespaces=NS)
            tpid = lt.findtext("efac:TenderingParty/cbc:ID", namespaces=NS)
            for oid in tenderers.get(tpid, []):
                code, country = orgs.get(oid, (None, None))
                totals["winner_rows"] += 1
                totals["with_code"] += bool(code)
                totals["with_amount"] += bool(amount)
                totals["ee_winners"] += country == "EST"
                if code and country == "EST" and re.fullmatch(r"\d{8}", code.strip()):
                    totals["ee_valid_code"] += 1
                    db.execute("INSERT INTO award VALUES (?,?,?)", (int(code.strip()), path.stem, float(amount) if amount else None))


def main():
    RAW.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(EE / "procurement.sqlite")
    db.execute("DROP TABLE IF EXISTS award")
    db.execute("CREATE TABLE award(code INTEGER, month TEXT, amount REAL)")
    totals = dict(notices=0, winner_rows=0, with_code=0, with_amount=0, ee_winners=0, ee_valid_code=0, bytes=0)
    for y, m in months(sys.argv[1], sys.argv[2]):
        path = fetch(y, m)
        totals["bytes"] += path.stat().st_size
        parse(path, db, totals)
        print(y, m, totals, file=sys.stderr)
    db.execute("CREATE INDEX award_code ON award(code)")
    db.commit()
    totals["distinct_ee_suppliers"] = db.execute("SELECT COUNT(DISTINCT code) FROM award").fetchone()[0]
    (EE / "stats").mkdir(exist_ok=True)
    (EE / "stats" / "procurement.json").write_text(json.dumps({"range": sys.argv[1:3], **totals}, indent=1))


if __name__ == "__main__":
    main()
