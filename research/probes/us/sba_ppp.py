"""Probe SBA Paycheck Protection Program FOIA loan-level data.

Usage: python -I research/probes/us/sba_ppp.py [--all]
Streams public_150k_plus (and with --all every public_up_to_150k part) without keeping the large parts,
counts rows, fill rates per field and loans by state. Keeps the 150k_plus file in research/.cache/us/ppp/.
"""
import collections
import csv
import io
import pathlib
import sys
import urllib.request

UA = "Finora research (open-source; github.com/nakotomagami-a11y/finora)"
BASE = "https://data.sba.gov/sites/default/files/distribution/SBA-OCA-2022-07-001/"
SNAPSHOT = "240930"
OUT = pathlib.Path(__file__).resolve().parents[2] / ".cache" / "us" / "ppp"


def stream(name, keep):
    req = urllib.request.Request(BASE + name, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=600) as r:
        print(f"{name}: {r.headers.get('Content-Length')} bytes, last-modified {r.headers.get('Last-Modified')}")
        if keep:
            OUT.mkdir(parents=True, exist_ok=True)
            (OUT / name).write_bytes(r.read())
            text = io.TextIOWrapper(open(OUT / name, "rb"), encoding="utf-8", errors="replace", newline="")
        else:
            text = io.TextIOWrapper(r, encoding="utf-8", errors="replace", newline="")
        yield from csv.DictReader(text)


def main():
    names = [f"public_150k_plus_{SNAPSHOT}.csv"]
    if "--all" in sys.argv:
        names += [f"public_up_to_150k_{i}_{SNAPSHOT}.csv" for i in range(1, 13)]
    total, filled, states, statuses, header = 0, collections.Counter(), collections.Counter(), collections.Counter(), None
    for name in names:
        n = 0
        for row in stream(name, keep=name.startswith("public_150k_plus")):
            if header is None:
                header = list(row.keys())
            n += 1
            for k, v in row.items():
                if v and v.strip():
                    filled[k] += 1
            states[row.get("BorrowerState", "")] += 1
            statuses[row.get("LoanStatus", "")] += 1
        print(f"  rows={n}")
        total += n
    print(f"total rows={total}; columns={len(header)}")
    for k in header:
        print(f"  {k}: {filled[k] / total:.0%}")
    print("loan status:", statuses.most_common(5))
    print("top states:", states.most_common(10))


if __name__ == "__main__":
    main()
