"""Measure Ametlikud Teadaanded (Estonian official gazette of notices) as an insolvency source.

Licence: CC BY-SA 4.0 per andmed.eesti.ee. Access: URI scheme, no key
  https://www.ametlikudteadaanded.ee/ee/{publisher|-}/{type}/{subtype|-}/{year}/{month}/xml
documented at https://www.ametlikudteadaanded.ee/avalik/uriotsing. Notices addressed to natural
persons and archived notices are excluded from the open data by law.

For each subtype and month given, downloads the XML and counts notices, affected-party types,
and how many carry an 8-digit registry code. Registry codes -> research/.cache/baltics/ee/notices.sqlite.

Usage: python -I research/probes/baltics/ee/official_notices.py 2026-05 2026-10
"""

import json
import sqlite3
import sys
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from collections import Counter
from pathlib import Path

UA = "finora-research/0.1 (+public repo)"
BASE = "https://www.ametlikudteadaanded.ee/ee/-/{type}/{sub}/{y}/{m}/xml"
EE = Path(__file__).resolve().parents[4] / "research" / ".cache" / "baltics" / "ee"
RAW = EE / "raw" / "at"
SUBTYPES = [
    ("pankrotimenetlus", "pankroti-valjakuulutamine"),
    ("pankrotimenetlus", "raugemise-tottu-pankrotiavalduse-menetluse-lopetamine"),
    ("pankrotimenetlus", "pankrotimenetluse-lopetamine"),
]


def months(start, end):
    y, m = map(int, start.split("-"))
    ey, em = map(int, end.split("-"))
    while (y, m) <= (ey, em):
        yield y, m
        y, m = (y + 1, 1) if m == 12 else (y, m + 1)


def main():
    RAW.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(EE / "notices.sqlite")
    db.execute("DROP TABLE IF EXISTS notice")
    db.execute("CREATE TABLE notice(code INTEGER, type TEXT, sub TEXT, published TEXT)")
    stats = {}
    for typ, sub in SUBTYPES:
        c = Counter()
        for y, m in months(sys.argv[1], sys.argv[2]):
            path = RAW / f"{sub}_{y}_{m:02d}.xml"
            if not path.exists():
                url = BASE.format(type=typ, sub=urllib.parse.quote(sub), y=y, m=m)
                try:
                    path.write_bytes(urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=300).read())
                except Exception as exc:  # a subtype that does not exist under this type returns an error page
                    c["errors"] += 1
                    print(sub, y, m, exc, file=sys.stderr)
                    continue
                time.sleep(1)
            c["bytes"] += path.stat().st_size
            try:
                root = ET.parse(path).getroot()
            except ET.ParseError:
                c["unparsable"] += 1
                continue
            for n in root:
                c["notices"] += 1
                for p in n.findall("puudutatud_isik"):
                    kind = p.findtext("liik/kood") or "?"
                    code = (p.findtext("kood") or "").strip()
                    c[f"party_{kind}"] += 1
                    if len(code) == 8 and code.isdigit():
                        c["with_reg_code"] += 1
                        db.execute("INSERT INTO notice VALUES (?,?,?,?)", (int(code), typ, sub, n.findtext("avaldamise_kpv")))
        stats[f"{typ}/{sub}"] = dict(c)
        print(sub, dict(c), file=sys.stderr)
    db.execute("CREATE INDEX notice_code ON notice(code)")
    db.commit()
    (EE / "stats").mkdir(exist_ok=True)
    (EE / "stats" / "official_notices.json").write_text(json.dumps({"range": sys.argv[1:3], **stats}, indent=1))


if __name__ == "__main__":
    main()
