"""Split the LT "overdue debt" share into its tax (VMI, CC BY 4.0) and social-insurance (Sodra, no licence) parts.

Reads, under research/.cache/baltics/lt/raw/ (downloaded by the other LT probes):
  rc/JAR_IREGISTRUOTI.csv                      daily register file (population: legal status code 0)
  ja_nepriemokos/NepriemokosSuma.csv           VMI arrears (overdue = pradelsta_nepriemoka > 0)
  sodra/Skolos/SKOLA.CSV                       Sodra daily debts (debt > 0)
Prints aggregate shares only.

Usage: python -I research/probes/baltics/lt/debt_split.py
"""

import csv
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_profiles import RAW, num, rows, sodra_rows  # noqa: E402


def main() -> None:
    active = {r["ja_kodas"] for r in rows("rc/JAR_IREGISTRUOTI.csv", delimiter="|") if r["stat_kodas"] == "0"}
    vmi = {r["ja_kodas"] for r in rows("ja_nepriemokos/NepriemokosSuma.csv") if (num(r["pradelsta_nepriemoka"]) or 0) > 0}
    sodra = {p[0] for p in sodra_rows("sodra/Skolos/SKOLA.CSV") if (num(p[2]) or 0) > 0}
    n = len(active)
    share = lambda s: f"{100 * len(s & active) / n:.1f}%"
    print(f"active companies (status 0): {n}")
    print(f"overdue tax arrears (VMI): {len(vmi & active)} = {share(vmi)}")
    print(f"social-insurance debt (Sodra): {len(sodra & active)} = {share(sodra)}")
    print(f"either: {len((vmi | sodra) & active)} = {share(vmi | sodra)}")
    print(f"both: {len(vmi & sodra & active)} = {share(vmi & sodra)}")


if __name__ == "__main__":
    csv.field_size_limit(1 << 24)
    main()
