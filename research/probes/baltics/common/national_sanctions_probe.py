"""Probe the Latvian FIU frozen-assets list of sanctioned subjects (data.gov.lv, CC0).

Downloads the subjects table (XLSX) into research/.cache/baltics/common/raw/national_sanctions/ and prints
aggregate counts only: rows, header names, and how many rows carry an identifier (registration number,
personal code or birth date). The LT and EE national lists are HTML pages without a download and are
recorded by hand in the area doc.

Usage: python -I research/probes/baltics/common/national_sanctions_probe.py
"""

import json
import re
import sys
import urllib.request
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[4]
OUT = ROOT / "research" / ".cache" / "baltics" / "common" / "raw" / "national_sanctions"
PACKAGE = "https://data.gov.lv/dati/api/3/action/package_show?id=sankciju-subjektu-lidzekli-un-saimnieciskie-resursi-kas-iesaldeti-latvija"
UA = {"User-Agent": "finora-research/0.1 (+public repo)"}
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


def fetch(url: str) -> bytes:
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
        return r.read()


def sheet_rows(path: Path) -> list[list[str]]:
    with zipfile.ZipFile(path) as z:
        shared = []
        if "xl/sharedStrings.xml" in z.namelist():
            for si in ET.fromstring(z.read("xl/sharedStrings.xml")).findall("m:si", NS):
                shared.append("".join(t.text or "" for t in si.iter(f"{{{NS['m']}}}t")))
        sheet = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))
    rows = []
    for row in sheet.iter(f"{{{NS['m']}}}row"):
        cells = {}
        for c in row.findall("m:c", NS):
            col = re.match(r"[A-Z]+", c.get("r")).group()
            v = c.find("m:v", NS)
            text = "".join(t.text or "" for t in c.iter(f"{{{NS['m']}}}t")) if c.get("t") == "inlineStr" else (v.text if v is not None else "")
            if c.get("t") == "s" and text:
                text = shared[int(text)]
            cells[col] = (text or "").strip()
        width = max((sum((ord(ch) - 64) * 26**i for i, ch in enumerate(reversed(k))) for k in cells), default=0)
        rows.append([cells.get(_col(i), "") for i in range(1, width + 1)])
    return rows


def _col(n: int) -> str:
    s = ""
    while n:
        n, r = divmod(n - 1, 26)
        s = chr(65 + r) + s
    return s


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    OUT.mkdir(parents=True, exist_ok=True)
    meta = json.loads(fetch(PACKAGE))["result"]
    res = next(r for r in meta["resources"] if "sankciju_subjekti" in r["url"])
    path = OUT / "lv_sankciju_subjekti.xlsx"
    path.write_bytes(fetch(res["url"]))
    rows = [r for r in sheet_rows(path) if any(r)]
    header_idx = next(i for i, r in enumerate(rows) if sum(1 for c in r if c) >= 3)
    header, data = rows[header_idx], rows[header_idx + 1 :]
    id_col = next((i for i, h in enumerate(header) if re.search(r"kods|dzim|reģ|reg", h, re.I)), None)
    with_id = sum(1 for r in data if id_col is not None and id_col < len(r) and r[id_col] not in ("", "N/a", "n/a", "-"))
    print(json.dumps({
        "licence": meta.get("license_id"),
        "resource_last_modified": res.get("last_modified"),
        "bytes": path.stat().st_size,
        "header": header,
        "rows": len(data),
        "rows_with_identifier": with_id,
    }, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    sys.exit(main())
