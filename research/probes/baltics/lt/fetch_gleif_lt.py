"""Download every LEI record whose legal address is in Lithuania from the GLEIF API (CC0).

Writes research/.cache/baltics/lt/raw/gleif/lt_lei.csv with lei, registeredAs (the JAR code when the
registration authority is the Lithuanian register), registeredAt id, entity status and registration status.
"""
import csv
import json
import time
import urllib.request
from pathlib import Path

OUT = Path(__file__).resolve().parents[3] / ".cache" / "baltics" / "lt" / "raw" / "gleif" / "lt_lei.csv"
URL = ("https://api.gleif.org/api/v1/lei-records?filter%5Bentity.legalAddress.country%5D=LT"
       "&page%5Bsize%5D=200&page%5Bnumber%5D={}")
OUT.parent.mkdir(parents=True, exist_ok=True)
with open(OUT, "w", encoding="utf-8", newline="") as fh:
    out = csv.writer(fh)
    out.writerow(["lei", "registered_as", "registered_at", "entity_status", "registration_status"])
    page, last = 1, 1
    while page <= last:
        req = urllib.request.Request(URL.format(page), headers={"User-Agent": "finora-research/0.1 (+public repo)"})
        with urllib.request.urlopen(req, timeout=120) as resp:
            body = json.load(resp)
        last = body["meta"]["pagination"]["lastPage"]
        for rec in body["data"]:
            a = rec["attributes"]
            e = a["entity"]
            out.writerow([a["lei"], e.get("registeredAs") or "", (e.get("registeredAt") or {}).get("id") or "",
                          e.get("status") or "", a["registration"].get("status") or ""])
        page += 1
        time.sleep(0.6)
print(OUT.name, "pages", last)
