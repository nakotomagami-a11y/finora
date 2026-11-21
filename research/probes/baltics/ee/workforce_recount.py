"""Recount S07 (workforce) for Estonia: is the 26.9% fill "has staff" or "missing data"?

Council session 1 asked whether the tax board's quarterly file lists every taxpayer, so that an
empty employee count means "0 employees reported" rather than "not published".

Reads, under research/.cache/baltics/ee/raw/ (downloaded by fetch_ariregister.py and fetch_emta.py):
  ariregister/x/ettevotja_rekvisiidid__lihtandmed.csv   register basic data (population and legal form)
  emta/tasutud_maksud_kaesolev_aasta.csv                 taxes paid, turnover, employees per quarter
Population: active (status R) private and public limited companies, partnerships and cooperatives,
the same population as the reality check. Prints aggregate counts only.

Usage: python -I research/probes/baltics/ee/workforce_recount.py
"""

import collections
import csv
import sys
from pathlib import Path

RAW = Path(__file__).resolve().parents[3] / ".cache" / "baltics" / "ee" / "raw"
FORMS = {"Osaühing", "Aktsiaselts", "Usaldusühing", "Täisühing", "Tulundusühistu"}


def amount(value: str) -> float | None:
    value = (value or "").strip().replace(",", ".")
    return float(value) if value else None


def pct(n: int, d: int) -> str:
    return f"{n} ({100 * n / d:.1f}%)" if d else "0"


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    with open(RAW / "ariregister" / "x" / "ettevotja_rekvisiidid__lihtandmed.csv", encoding="utf-8-sig", newline="") as fh:
        population = {
            r["ariregistri_kood"]
            for r in csv.DictReader(fh, delimiter=";")
            if r["ettevotja_staatus"] == "R" and r["ettevotja_oiguslik_vorm"] in FORMS
        }
    with open(RAW / "emta" / "tasutud_maksud_kaesolev_aasta.csv", encoding="utf-8-sig", newline="") as fh:
        rows = [r for r in csv.DictReader(fh) if r["Registrikood"] in population]

    year = max(r["Aasta"] for r in rows)
    quarters = ["I", "II", "III", "IV"]
    latest = max(
        (q for q in quarters if any(amount(r[f"Töötajate arv {q} kv"]) is not None for r in rows if r["Aasta"] == year)),
        key=quarters.index,
    )
    cur = {r["Registrikood"]: r for r in rows if r["Aasta"] == year}
    n = len(population)
    print(f"population (active, business forms): {n}")
    print(f"as of: {collections.Counter(r['Andmete seis'] for r in rows).most_common(1)[0][0]}; latest quarter with counts: {year} {latest}")
    print(f"with any row for {year}: {pct(len(cur), n)}")
    print(f"not in the file for {year}: {pct(n - len(cur), n)}")

    col = lambda name: f"{name} {latest} kv"
    emp = collections.Counter()
    blank_with_labour = blank_with_turnover = blank_with_any = 0
    for r in cur.values():
        e = amount(r[col("Töötajate arv")])
        labour, turnover, state = (amount(r[col(k)]) for k in ("Tööjõumaksud", "Käive", "Riiklikud maksud"))
        if e is None:
            emp["blank"] += 1
            blank_with_labour += (labour or 0) > 0
            blank_with_turnover += (turnover or 0) > 0
            blank_with_any += any((v or 0) > 0 for v in (labour, turnover, state))
        else:
            emp["zero" if e == 0 else "positive"] += 1
    print(f"{year} {latest}, rows in the file: employees > 0 {pct(emp['positive'], n)}; "
          f"employees = 0 {pct(emp['zero'], n)}; employees blank {pct(emp['blank'], n)}")
    print(f"blank-employee rows with labour taxes > 0: {pct(blank_with_labour, emp['blank'])}")
    print(f"blank-employee rows with turnover > 0: {pct(blank_with_turnover, emp['blank'])}")
    print(f"blank-employee rows with any amount > 0: {pct(blank_with_any, emp['blank'])}")


if __name__ == "__main__":
    main()
