"""Snapshot and diff two pulls of the Latvian CSV files by content (ETags change on every daily regeneration).

Usage:
  python -I diff_pulls.py snapshot <raw_dir> <snapshot.json.gz>
  python -I diff_pulls.py diff <old_snapshot.json.gz> <new_snapshot.json.gz>

A snapshot stores, per CSV file: bytes, rows, parse seconds, the row-key columns, and a short hash of every row
keyed by its row key. No cell values are stored. The diff prints rows added, removed and changed per file.
"""

import csv
import glob
import gzip
import hashlib
import json
import os
import sys
import time

csv.field_size_limit(1 << 30)

KEYS = {
    "register.csv": ["regcode"],
    "pdb_samaksato_nodoklu_kopsummas_cet.csv": ["Registracijas_kods", "Taksacijas_gads_ceturksnis"],
    "pdb_nm_komersantu_samaksato_nodoklu_kopsumas_odata.csv": ["Registracijas_kods", "Taksacijas_gads"],
    "pdb_pvnmaksataji_odata.csv": ["Numurs", "Registrets"],
    "reitings_uznemumi.csv": ["Registracijas_kods"],
    "pdb_saimndarbibaaptureta_odata.csv": ["Registracijas_kods", "Lemuma_datums"],
    "legal_entity_duration.csv": ["legal_entity_registration_number"],
    "register_name_history.csv": ["regcode", "date_to"],
    "es_fondu_projektu_saraksts.csv": ["ProjektaNumurs"],
}
GENERIC = ["id", "proceeding_id", "statement_id"]


def snapshot(raw_dir, out):
    files = {}
    for path in sorted(glob.glob(os.path.join(raw_dir, "*", "*.csv"))):
        name = os.path.basename(path)
        start = time.perf_counter()
        with open(path, encoding="utf-8-sig", errors="replace", newline="") as f:
            head = f.readline()
            delim = max([";", ",", "\t"], key=head.count)
            f.seek(0)
            reader = csv.reader(f, delimiter=delim)
            header = [h.lstrip("﻿") for h in next(reader)]
            key_cols = KEYS.get(name) or [k for k in GENERIC if k in header][:1]
            idx = [header.index(k) for k in key_cols if k in header]
            rows, dupes = {}, 0
            for row in reader:
                digest = hashlib.blake2b("\x1f".join(row).encode(), digest_size=8).hexdigest()
                key = "\x1f".join(row[i] for i in idx) if idx else digest
                if key in rows:
                    dupes += 1
                    key = f"{key}#{dupes}"
                rows[key] = digest
        files[os.path.relpath(path, raw_dir).replace(os.sep, "/")] = {
            "bytes": os.path.getsize(path),
            "rows": len(rows),
            "parse_s": round(time.perf_counter() - start, 2),
            "key": key_cols or ["<row hash>"],
            "duplicate_keys": dupes,
            "hashes": rows,
        }
        print(f"{name}: {len(rows)} rows, {files[os.path.relpath(path, raw_dir).replace(os.sep, '/')]['parse_s']} s", flush=True)
    with gzip.open(out, "wt", encoding="utf-8") as f:
        json.dump({"taken": time.strftime("%Y-%m-%dT%H:%M:%S"), "files": files}, f)


def diff(old_path, new_path):
    old = json.load(gzip.open(old_path, "rt", encoding="utf-8"))["files"]
    new = json.load(gzip.open(new_path, "rt", encoding="utf-8"))["files"]
    print("| file | rows old | rows new | added | removed | changed | bytes new |")
    print("|---|---|---|---|---|---|---|")
    for name in sorted(set(old) | set(new)):
        a, b = old.get(name, {}).get("hashes", {}), new.get(name, {}).get("hashes", {})
        added = len(b.keys() - a.keys())
        removed = len(a.keys() - b.keys())
        changed = sum(1 for k in a.keys() & b.keys() if a[k] != b[k])
        print(f"| {name} | {len(a)} | {len(b)} | {added} | {removed} | {changed} | {new.get(name, {}).get('bytes', '-')} |")


if __name__ == "__main__":
    cmd, *args = sys.argv[1:]
    {"snapshot": snapshot, "diff": diff}[cmd](*args)
