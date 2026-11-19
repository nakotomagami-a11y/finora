"""Snapshot an Estonian bulk file as row-key -> content hash, and diff two snapshots.

A snapshot keeps no data, only keys and SHA-1 hashes, so a pull can be compared with the next
one after the raw files are replaced.

  snapshot <file> [<key column>]   writes <file>.<YYYY-MM-DD>.snap.tsv next to the cache stats
      JSON arrays: one row per top-level object, key = ariregistri_kood
      CSV: key = the given column(s), joined with "|" (comma-separated names); delimiter sniffed
  diff <old.snap.tsv> <new.snap.tsv>   prints added / removed / changed / unchanged counts
  entries-per-day <registrikaardid.json> [days]   register entries per entry date (change-volume proxy)

Usage: python -I research/probes/baltics/ee/diff_pulls.py snapshot <path> [key]
"""

import csv
import hashlib
import json
import sys
from collections import Counter
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from jsonstream import iter_objects  # noqa: E402

csv.field_size_limit(1 << 30)
SNAPS = Path(__file__).resolve().parents[4] / "research" / ".cache" / "baltics" / "ee" / "snapshots"


def h(text):
    return hashlib.sha1(text.encode("utf-8")).hexdigest()


def rows(path, key):
    if path.suffix == ".json":
        for obj in iter_objects(path):
            yield str(obj["ariregistri_kood"]), h(json.dumps(obj, sort_keys=True, ensure_ascii=False))
        return
    with open(path, encoding="utf-8-sig", newline="") as fh:
        sample = fh.read(4096)
        fh.seek(0)
        reader = csv.DictReader(fh, dialect=csv.Sniffer().sniff(sample, delimiters=",;"))
        cols = key.split(",")
        for r in reader:
            yield "|".join(r[c] for c in cols), h(json.dumps(r, sort_keys=True, ensure_ascii=False))


def snapshot(path, key=None):
    path = Path(path)
    SNAPS.mkdir(parents=True, exist_ok=True)
    out = SNAPS / f"{path.name}.{date.today().isoformat()}.snap.tsv"
    seen = Counter()
    with open(out, "w", encoding="utf-8") as fh:
        for k, digest in rows(path, key):
            seen[k] += 1
            fh.write(f"{k}#{seen[k]}\t{digest}\n")
    print(out.name, sum(seen.values()), "rows", sum(1 for v in seen.values() if v > 1), "duplicate keys")


def load(path):
    with open(path, encoding="utf-8") as fh:
        return dict(line.rstrip("\n").split("\t") for line in fh)


def diff(old, new):
    a, b = load(old), load(new)
    changed = sum(1 for k in a.keys() & b.keys() if a[k] != b[k])
    print(json.dumps({"old_rows": len(a), "new_rows": len(b), "added": len(b.keys() - a.keys()),
                      "removed": len(a.keys() - b.keys()), "changed": changed,
                      "unchanged": len(a.keys() & b.keys()) - changed}))


def entries_per_day(path, days=30):
    per_day = Counter()
    for obj in iter_objects(Path(path)):
        for card in obj.get("registrikaardid") or []:
            for entry in card.get("kanded") or []:
                d = entry.get("kpv") or ""
                if len(d) == 10:
                    per_day[f"{d[6:]}-{d[3:5]}-{d[:2]}"] += 1
    recent = sorted(per_day.items())[-int(days):]
    print(json.dumps({"days": dict(recent), "mean_per_day": round(sum(v for _, v in recent) / len(recent))}))


if __name__ == "__main__":
    cmd, *args = sys.argv[1:]
    {"snapshot": snapshot, "diff": diff, "entries-per-day": entries_per_day}[cmd](*args)
