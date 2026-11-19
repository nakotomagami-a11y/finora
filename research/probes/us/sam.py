"""Probe SAM.gov public extracts (entity registrations, exclusions) via the keyless web file service.

Usage: python -I research/probes/us/sam.py [--download]
Lists the newest public files; with --download fetches the newest public monthly entity file
and the newest exclusions file into research/.cache/us/sam/ and profiles them.
"""
import collections
import csv
import io
import json
import pathlib
import sys
import urllib.parse
import urllib.request
import zipfile

UA = "Finora research (open-source; github.com/nakotomagami-a11y/finora)"
LIST = "https://sam.gov/api/prod/fileextractservices/v1/api/listfiles?random=1&domain="
DOWNLOAD = "https://sam.gov/api/prod/fileextractservices/v1/api/download/"
OUT = pathlib.Path(__file__).resolve().parents[2] / ".cache" / "us" / "sam"


def get_json(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=60) as r:
        return json.load(r)


def list_files(domain):
    data = get_json(LIST + urllib.parse.quote(domain))
    return data["_embedded"]["customS3ObjectSummaryList"]


def download(key):
    target = OUT / key.split("/")[-1]
    if target.exists():
        return target
    OUT.mkdir(parents=True, exist_ok=True)
    url = DOWNLOAD + urllib.parse.quote(key) + "?privacy=Public"
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=600) as r:
        target.write_bytes(r.read())
    return target


def open_innermost(path):
    z = zipfile.ZipFile(path)
    name = z.namelist()[0]
    while name.upper().endswith(".ZIP"):
        z = zipfile.ZipFile(io.BytesIO(z.read(name)))
        name = z.namelist()[0]
    return name, z.open(name)


def profile_entities(path):
    name, f = open_innermost(path)
    rows, widths, filled = 0, collections.Counter(), collections.Counter()
    sample = None
    for line in io.TextIOWrapper(f, encoding="utf-8", errors="replace"):
        if line.startswith(("BOF", "EOF")):
            print("  marker:", line.strip()[:80])
            continue
        cols = line.rstrip("\r\n").split("|")
        rows += 1
        widths[len(cols)] += 1
        for i, c in enumerate(cols):
            if c.strip():
                filled[i] += 1
        if sample is None:
            sample = cols
    print(f"entity file {name}: rows={rows}, columns per row={widths.most_common(3)}")
    print("  fill rate by column index (1-based):")
    for i in range(len(sample)):
        print(f"   {i + 1}: {filled[i] / rows:.0%}", end="")
    print()
    print("  shape of row 1 (value lengths only):", [len(c) for c in sample])


def profile_exclusions(path):
    with zipfile.ZipFile(path) as z:
        name = z.namelist()[0]
        with z.open(name) as f:
            reader = csv.DictReader(io.TextIOWrapper(f, encoding="utf-8", errors="replace"))
            rows = list(reader)
    print(f"exclusions file {name}: rows={len(rows)}")
    print("  fields:", reader.fieldnames)
    for col in ("Classification", "Exclusion Type", "Excluding Agency", "Country"):
        if col in reader.fieldnames:
            print(f"  {col}:", collections.Counter(r[col] for r in rows).most_common(6))
    with_uei = sum(1 for r in rows if r.get("Unique Entity ID", "").strip())
    print(f"  rows with UEI: {with_uei}")


def main():
    entities = list_files("Entity Registration/Public V2")
    exclusions = list_files("Exclusions/Public V2")
    print("public entity files:", [(f["displayKey"], f["dateModified"]) for f in entities[:4]])
    print("public exclusion files:", [(f["displayKey"], f["dateModified"]) for f in exclusions[:3]])
    if "--download" not in sys.argv:
        return
    monthly = next(f for f in entities if "UTF-8_MONTHLY" in f["displayKey"])
    profile_entities(download(monthly["key"]))
    profile_exclusions(download(exclusions[0]["key"]))


if __name__ == "__main__":
    main()
