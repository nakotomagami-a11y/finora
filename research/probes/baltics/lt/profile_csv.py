"""Profile a downloaded CSV: per column, inferred type, null rate, distinct count (capped) and min/max.

Usage: python -I profile_csv.py <file.csv> [more.csv ...]
Prints a markdown table per file. Values themselves are not printed except min/max of
date and numeric columns, so the output is safe to paste into public notes.
"""
import csv
import re
import sys

sys.stdout.reconfigure(encoding="utf-8")
csv.field_size_limit(1 << 30)
DATE = re.compile(r"^\d{4}-\d{2}-\d{2}")
NUM = re.compile(r"^-?\d+(\.\d+)?$")
SKIP = {"_type", "_revision", "_base", "_page.next"}


def kind(value: str) -> str:
    if DATE.match(value):
        return "date"
    if NUM.match(value):
        return "number"
    return "text"


def profile(path: str) -> None:
    with open(path, encoding="utf-8-sig", newline="") as fh:
        first = fh.readline()
        delimiter = max("|;,", key=first.count)
        fh.seek(0)
        reader = csv.reader(fh, delimiter=delimiter)
        header = next(reader)
        n = 0
        nulls = [0] * len(header)
        kinds = [dict() for _ in header]
        distinct = [set() for _ in header]
        lo = [None] * len(header)
        hi = [None] * len(header)
        for row in reader:
            n += 1
            for i, value in enumerate(row[: len(header)]):
                if value == "":
                    nulls[i] += 1
                    continue
                k = kind(value)
                kinds[i][k] = kinds[i].get(k, 0) + 1
                if len(distinct[i]) < 100001:
                    distinct[i].add(value)
                if k in ("date", "number"):
                    v = value[:10] if k == "date" else float(value)
                    try:
                        lo[i] = v if lo[i] is None or v < lo[i] else lo[i]
                        hi[i] = v if hi[i] is None or v > hi[i] else hi[i]
                    except TypeError:
                        pass
    print(f"\n#### {path.replace(chr(92), '/').split('/raw/')[-1]} ({n} rows)\n")
    print("| Field | Type | Null % | Distinct | Min | Max |")
    print("|---|---|---|---|---|---|")
    for i, name in enumerate(header):
        if name in SKIP:
            continue
        k = max(kinds[i], key=kinds[i].get) if kinds[i] else "empty"
        d = len(distinct[i])
        d = ">100k" if d > 100000 else d
        show = k in ("date", "number") and not name.endswith(("kodas", "_id", "id"))
        mn, mx = (lo[i], hi[i]) if show else ("", "")
        print(f"| {name} | {k} | {100 * nulls[i] / max(n, 1):.1f} | {d} | {mn} | {mx} |")


for p in sys.argv[1:]:
    profile(p)
