"""Snapshot a pulled file as row-key -> row-hash, and diff two snapshots to count rows added, removed and changed.

Usage:
  python -I diff_pulls.py snapshot <file> <key column> [--fields a,b,c] [--delimiter X] [--encoding E]
                                   [--skip N] --out <snapshot.json.gz>
  python -I diff_pulls.py diff <old.json.gz> <new.json.gz>

Snapshots hold hashes only, so yesterday's pull can be compared with today's without keeping both files.
--fields limits the hash to the named columns, so two files with different layouts (for example the API
copy and the publisher's daily file) can be compared on the columns they share. --skip drops title lines
before the header (the Sodra daily files have one title line and a dashed line after the header).
"""
import csv
import gzip
import hashlib
import json
import sys

csv.field_size_limit(1 << 30)


def snapshot(path, key, fields, delimiter, encoding, skip, out):
    with open(path, encoding=encoding, newline="") as fh:
        for _ in range(skip):
            fh.readline()
        reader = csv.DictReader(fh, delimiter=delimiter)
        rows = {}
        for row in reader:
            k = (row.get(key) or "").strip()
            if not k or set(k) == {"-"}:
                continue
            values = [(row.get(f) or "").strip() for f in (fields or reader.fieldnames)]
            digest = hashlib.sha1("\x1f".join(values).encode()).hexdigest()[:16]
            rows[k] = digest if k not in rows else rows[k] + digest
    with gzip.open(out, "wt", encoding="utf-8") as fh:
        json.dump({"file": path.replace("\\", "/").split("/")[-1], "key": key, "rows": rows}, fh)
    print(f"{len(rows)} keys -> {out}")


def diff(old_path, new_path):
    with gzip.open(old_path, "rt", encoding="utf-8") as fh:
        old = json.load(fh)["rows"]
    with gzip.open(new_path, "rt", encoding="utf-8") as fh:
        new = json.load(fh)["rows"]
    added = len(new.keys() - old.keys())
    removed = len(old.keys() - new.keys())
    changed = sum(1 for k in new.keys() & old.keys() if new[k] != old[k])
    total = max(len(old), 1)
    print(json.dumps({"old": len(old), "new": len(new), "added": added, "removed": removed, "changed": changed,
                      "changed_pct_of_old": round(100 * (added + removed + changed) / total, 2)}))


if __name__ == "__main__":
    args = sys.argv[1:]
    if args[0] == "diff":
        diff(args[1], args[2])
    else:
        opts = {"--fields": "", "--delimiter": ",", "--encoding": "utf-8", "--skip": "0", "--out": ""}
        rest = []
        i = 1
        while i < len(args):
            if args[i] in opts:
                opts[args[i]] = args[i + 1]
                i += 2
            else:
                rest.append(args[i])
                i += 1
        fields = [f for f in opts["--fields"].split(",") if f]
        snapshot(rest[0], rest[1], fields, opts["--delimiter"], opts["--encoding"], int(opts["--skip"]), opts["--out"])
