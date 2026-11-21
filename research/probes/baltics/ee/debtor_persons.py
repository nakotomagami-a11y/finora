"""Count natural persons (sole traders, FIE) versus legal persons in the EMTA tax-debtor list.

Reads, under research/.cache/baltics/ee/raw/ (downloaded by fetch_ariregister.py and fetch_emta.py):
  emta/maksuvolglaste_nimekiri.csv      EMTA tax debtors (CC BY-SA 3.0)
  ariregister/x/ettevotja_rekvisiidid__lihtandmed.csv  e-Business Register basic data (CC BY 4.0), for the legal form
Prints aggregate counts only: code shapes, legal forms of the listed codes, and whether the
file itself marks natural persons (a type column, an "FIE" name suffix).

Usage: python -I research/probes/baltics/ee/debtor_persons.py
"""

import collections
import csv
import re
import sys
from pathlib import Path

RAW = Path(__file__).resolve().parents[3] / ".cache" / "baltics" / "ee" / "raw"
FIE = "Füüsilisest isikust ettevõtja"


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    with open(RAW / "emta" / "maksuvolglaste_nimekiri.csv", encoding="utf-8-sig", newline="") as fh:
        debtors = list(csv.DictReader(fh, delimiter=";"))
    with open(RAW / "ariregister" / "x" / "ettevotja_rekvisiidid__lihtandmed.csv", encoding="utf-8-sig", newline="") as fh:
        form = {r["ariregistri_kood"]: r["ettevotja_oiguslik_vorm"] for r in csv.DictReader(fh, delimiter=";")}

    print(f"columns: {list(debtors[0].keys())}")
    print(f"rows: {len(debtors)}")
    shapes = collections.Counter(
        "8-digit registry code" if re.fullmatch(r"\d{8}", d["Registrikood"])
        else "11-digit personal code" if re.fullmatch(r"\d{11}", d["Registrikood"])
        else "other (foreign or non-numeric)"
        for d in debtors
    )
    print(f"code shapes: {dict(shapes)}")
    forms = collections.Counter(form.get(d["Registrikood"], "not in the register file") for d in debtors)
    print("legal forms of listed codes:")
    for f, n in forms.most_common():
        print(f"  {n:6d}  {f}")
    fie = [d for d in debtors if form.get(d["Registrikood"]) == FIE]
    suffix = sum(1 for d in fie if re.search(r"\bFIE\b", d["Nimi"]))
    print(f"sole traders (FIE): {len(fie)} = {100 * len(fie) / len(debtors):.1f}%; name carries 'FIE': {suffix}")
    debt = lambda rows: sum(float(r["Maksuvõlg"].replace(",", ".") or 0) for r in rows)
    print(f"debt held by FIE rows: {100 * debt(fie) / debt(debtors):.2f}% of the listed total")


if __name__ == "__main__":
    main()
