"""Probe OFAC Sanctions List Service: SDN and consolidated (non-SDN) lists.

Usage: python -I research/probes/us/ofac.py
Downloads SDN.CSV, CONS_PRIM.CSV, SDN_ENHANCED.XML and CONS_ENHANCED.XML into research/.cache/us/ofac/
and profiles entity types, programs, identifier types and publish dates.
"""
import collections
import csv
import pathlib
import urllib.request
import xml.etree.ElementTree as ET

UA = "Finora research (open-source; github.com/nakotomagami-a11y/finora)"
BASE = "https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/"
OUT = pathlib.Path(__file__).resolve().parents[2] / ".cache" / "us" / "ofac"


def fetch(name):
    OUT.mkdir(parents=True, exist_ok=True)
    target = OUT / name
    with urllib.request.urlopen(urllib.request.Request(BASE + name, headers={"User-Agent": UA}), timeout=300) as r:
        target.write_bytes(r.read())
        print(f"{name}: {target.stat().st_size} bytes, last-modified {r.headers.get('Last-Modified')}")
    return target


def local(tag):
    return tag.rsplit("}", 1)[-1]


def profile_csv(path):
    with open(path, encoding="latin-1", newline="") as f:
        rows = list(csv.reader(f))
    rows = [r for r in rows if len(r) > 3]
    types = collections.Counter(r[2].strip() or "entity" for r in rows)
    programs = collections.Counter(p for r in rows for p in r[3].strip().split("] [") if p)
    print(f"  rows={len(rows)} types={dict(types)} top programs={programs.most_common(5)}")


def profile_enhanced(path):
    root = ET.parse(path).getroot()
    pub = next((el for el in root.iter() if local(el.tag) == "publicationInfo"), None)
    if pub is not None:
        print("  publicationInfo:", {local(c.tag): (c.text or "").strip() for c in pub})
    entities = [el for el in root.iter() if local(el.tag) == "entity"]
    types, id_types, countries = collections.Counter(), collections.Counter(), collections.Counter()
    for e in entities:
        for el in e.iter():
            name = local(el.tag)
            if name == "generalInfo":
                for c in el:
                    if local(c.tag) == "entityType":
                        types[(c.text or "").strip()] += 1
            elif name == "identityDocument":
                for c in el:
                    if local(c.tag) == "type":
                        id_types[(c.text or "").strip()] += 1
            elif name == "country" and el.text:
                countries[el.text.strip()] += 1
    print(f"  entities={len(entities)} types={dict(types)}")
    print("  top identity document types:", id_types.most_common(15))
    us = sum(v for k, v in countries.items() if k == "United States")
    baltics = {k: v for k, v in countries.items() if k in ("Lithuania", "Latvia", "Estonia")}
    print(f"  address/country mentions: United States={us} baltics={baltics}")
    first = entities[0] if entities else None
    if first is not None:
        print("  entity child elements:", sorted({local(c.tag) for c in first}))


def main():
    for name in ("SDN.CSV", "CONS_PRIM.CSV"):
        profile_csv(fetch(name))
    for name in ("SDN_ENHANCED.XML", "CONS_ENHANCED.XML"):
        profile_enhanced(fetch(name))


if __name__ == "__main__":
    main()
