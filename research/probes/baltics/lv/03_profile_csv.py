"""Profile downloaded CSV files: delimiter, rows, and per-column type, null rate and date range.

Usage: python -I 03_profile_csv.py <cache_dir> [<dataset> ...]

Reads <cache_dir>/raw/<dataset>/*.csv (all datasets when none are given) and writes
<cache_dir>/profile/<dataset>__<file>.json. Only aggregates are written: no cell values except
date ranges and the distinct values of low-cardinality code columns (<= 30 values, <= 40 chars).
"""

import csv
import glob
import json
import os
import re
import sys

csv.field_size_limit(1 << 30)

DATE = re.compile(r"^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?.*)?$|^\d{2}\.\d{2}\.\d{4}$")
INT = re.compile(r"^-?\d+$")
DEC = re.compile(r"^-?\d+[.,]\d+$")
NULLS = {"", "null", "NULL", "None", "-"}


def sniff(path):
    with open(path, encoding="utf-8-sig", errors="replace") as f:
        head = f.readline()
    return max([";", ",", "\t", "|"], key=head.count)


def iso(v):
    if re.match(r"^\d{2}\.\d{2}\.\d{4}$", v):
        d, m, y = v.split(".")
        return f"{y}-{m}-{d}"
    return v[:10]


def profile(path):
    delim = sniff(path)
    with open(path, encoding="utf-8-sig", errors="replace", newline="") as f:
        reader = csv.reader(f, delimiter=delim)
        header = next(reader)
        n = len(header)
        filled = [0] * n
        kinds = [dict(int=0, dec=0, date=0, text=0) for _ in range(n)]
        dmin = [None] * n
        dmax = [None] * n
        maxlen = [0] * n
        distinct = [set() for _ in range(n)]
        rows = bad = 0
        for row in reader:
            rows += 1
            if len(row) != n:
                bad += 1
            for i, v in enumerate(row[:n]):
                v = v.strip()
                if v in NULLS:
                    continue
                filled[i] += 1
                maxlen[i] = max(maxlen[i], len(v))
                if DATE.match(v):
                    kinds[i]["date"] += 1
                    d = iso(v)
                    dmin[i] = d if dmin[i] is None or d < dmin[i] else dmin[i]
                    dmax[i] = d if dmax[i] is None or d > dmax[i] else dmax[i]
                elif INT.match(v):
                    kinds[i]["int"] += 1
                elif DEC.match(v):
                    kinds[i]["dec"] += 1
                else:
                    kinds[i]["text"] += 1
                if distinct[i] is not None:
                    distinct[i].add(v)
                    if len(distinct[i]) > 30:
                        distinct[i] = None
    cols = []
    for i, name in enumerate(header):
        k = max(kinds[i], key=kinds[i].get) if filled[i] else "empty"
        col = {
            "name": name,
            "type": k,
            "null_pct": round(100 * (1 - filled[i] / rows), 2) if rows else None,
            "max_len": maxlen[i],
        }
        if k == "date":
            col["min"], col["max"] = dmin[i], dmax[i]
        if distinct[i] is not None and filled[i] and maxlen[i] <= 40:
            col["values"] = sorted(distinct[i])
        cols.append(col)
    return {
        "file": os.path.basename(path),
        "bytes": os.path.getsize(path),
        "delimiter": delim,
        "rows": rows,
        "ragged_rows": bad,
        "columns": cols,
    }


def main():
    cache = sys.argv[1]
    datasets = sys.argv[2:] or [os.path.basename(d) for d in glob.glob(os.path.join(cache, "raw", "*")) if os.path.isdir(d)]
    out = os.path.join(cache, "profile")
    os.makedirs(out, exist_ok=True)
    for ds in datasets:
        for path in sorted(glob.glob(os.path.join(cache, "raw", ds, "*.csv"))):
            p = profile(path)
            p["dataset"] = ds
            name = f"{ds}__{os.path.splitext(p['file'])[0]}.json"
            with open(os.path.join(out, name), "w", encoding="utf-8") as f:
                json.dump(p, f, ensure_ascii=False, indent=1)
            print(f"{ds}/{p['file']}: {p['rows']} rows, {len(p['columns'])} cols, ragged {p['ragged_rows']}", flush=True)


if __name__ == "__main__":
    main()
