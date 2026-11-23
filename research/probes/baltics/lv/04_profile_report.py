"""Print profile JSON files (from 03_profile_csv.py) as compact markdown tables.

Usage: python -I 04_profile_report.py <cache_dir> [<name-substring> ...] [--values]

Without --values, distinct-value lists are omitted (they can contain names in small files).
"""

import glob
import json
import os
import sys


def main():
    cache, *rest = sys.argv[1:]
    show_values = "--values" in rest
    filters = [a for a in rest if not a.startswith("--")]
    for path in sorted(glob.glob(os.path.join(cache, "profile", "*.json"))):
        name = os.path.basename(path)
        if filters and not any(f in name for f in filters):
            continue
        p = json.load(open(path, encoding="utf-8"))
        print(f"\n### {p['dataset']}/{p['file']}  rows={p['rows']}  MB={p['bytes'] / 1e6:.1f}  ragged={p['ragged_rows']}")
        print("| field | type | null % | range / values |")
        print("|---|---|---|---|")
        for c in p["columns"]:
            extra = f"{c.get('min')}..{c.get('max')}" if c["type"] == "date" else ""
            if show_values and "values" in c:
                extra += " " + ", ".join(c["values"])[:300]
            print(f"| {c['name']} | {c['type']} | {c['null_pct']} | {extra} |")


if __name__ == "__main__":
    main()
