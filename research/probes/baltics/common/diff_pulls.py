"""Count rows added, removed and changed between two pulls of a cross-border source.

Usage: diff_pulls.py <eu|un|kohesio> <older file> <newer file>
  eu       EU consolidated sanctions XML 1.1, keyed by sanctionEntity logicalId
  un       UN consolidated list XML, keyed by DATAID (VERSIONNUM changes count as changed)
  kohesio  Kohesio projects CSV, keyed by Operation_Unique_Identifier
GLEIF needs no diff: it publishes LastDay / LastWeek / LastMonth delta files.
Prints counts only.
"""

import csv
import hashlib
import json
import sys
import xml.etree.ElementTree as ET

NS = "{http://eu.europa.ec/fpi/fsd/export}"
csv.field_size_limit(sys.maxsize)


def digest(text):
    return hashlib.sha1(text.encode("utf-8")).hexdigest()


def eu_rows(path):
    root = ET.parse(path).getroot()
    return {se.get("logicalId"): digest(ET.tostring(se, encoding="unicode")) for se in root.iter(NS + "sanctionEntity")}


def un_rows(path):
    root = ET.parse(path).getroot()
    out = {}
    for tag in ("INDIVIDUAL", "ENTITY"):
        for el in root.iter(tag):
            out[el.findtext("DATAID")] = digest(ET.tostring(el, encoding="unicode"))
    return out


def kohesio_rows(path):
    with open(path, newline="", encoding="utf-8-sig") as fh:
        return {row["Operation_Unique_Identifier"]: digest(json.dumps(row, sort_keys=True)) for row in csv.DictReader(fh)}


def main():
    kind, old_path, new_path = sys.argv[1:4]
    load = {"eu": eu_rows, "un": un_rows, "kohesio": kohesio_rows}[kind]
    old, new = load(old_path), load(new_path)
    changed = sum(1 for key in old.keys() & new.keys() if old[key] != new[key])
    print(json.dumps({"old_rows": len(old), "new_rows": len(new), "added": len(new.keys() - old.keys()),
                      "removed": len(old.keys() - new.keys()), "changed": changed}))


if __name__ == "__main__":
    main()
