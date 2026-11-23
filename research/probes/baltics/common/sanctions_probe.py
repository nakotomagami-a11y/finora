"""Measure the EU consolidated financial sanctions list and the UN Security Council consolidated list.

Sources (public download URLs, no key; the EU "token" is a fixed public value, not a credential):
  EU: https://webgate.ec.europa.eu/fsd/fsf/public/files/xmlFullSanctionsList_1_1/content?token=dG9rZW4tMjAxNw
  UN: https://scsanctions.un.org/resources/xml/en/consolidated.xml (redirects to a signed blob URL)
Reads the files saved in research/.cache/baltics/common/raw/{eu,un}/ (pass other paths as arguments:
  sanctions_probe.py [eu_xml] [un_xml]).

Measures, overall and for Baltic-linked entries (any address, citizenship, birth place, nationality or
identity document country in LT, LV or EE):
- entries by subject type (person / entity)
- share of entries carrying an official identifier a match can rely on (rule R8: a listing is shown as
  confirmed only on an official-ID match): registration or tax number, LEI, IMO number, passport or
  national ID, full date of birth.
Writes research/.cache/baltics/common/sanctions_stats.json. Aggregates only.
"""

import json
import re
import sys
import xml.etree.ElementTree as ET
from collections import Counter
from pathlib import Path

CACHE = Path(__file__).resolve().parents[4] / "research" / ".cache" / "baltics" / "common"
BALTIC = {"LT", "LV", "EE"}
BALTIC_NAMES = {"lithuania", "latvia", "estonia"}
NS = "{http://eu.europa.ec/fpi/fsd/export}"
LEI = re.compile(r"\b[0-9A-Z]{18}[0-9]{2}\b")
IMO = re.compile(r"\bIMO\b[^0-9]{0,20}\d{7}\b", re.I)
REG = re.compile(r"(registration|reg\.|registry|company|state|tax|INN|OGRN|KPP|TIN|VAT)[^.;]{0,25}(number|no\.?|#|:)", re.I)

ENTITY_ID_TYPES = {"regnumber", "taxid", "fiscalcode", "euvat", "tradelic", "id"}
PERSON_ID_TYPES = {"passport", "id", "ssn", "fiscalcode", "taxid", "residentperm", "nationcert", "birthcert"}


def pct(part, whole):
    return round(100 * part / whole, 1) if whole else None


def summarise(entries):
    """entries: dicts with kind, baltic, ids (set of id kinds)."""
    out = {}
    for scope, rows in (("all", entries), ("baltic_linked", [e for e in entries if e["baltic"]])):
        block = {}
        for kind in ("person", "entity"):
            group = [e for e in rows if e["kind"] == kind]
            n = len(group)
            counts = Counter(i for e in group for i in e["ids"])
            block[kind] = {"n": n, **{f"pct_{k}": pct(v, n) for k, v in sorted(counts.items())}}
            strong = {"regnumber", "lei", "imo"} if kind == "entity" else {"passport_or_national_id", "full_birthdate"}
            block[kind]["pct_any_official_id"] = pct(sum(bool(e["ids"] & strong) for e in group), n)
            block[kind]["pct_no_identifier_at_all"] = pct(sum(not e["ids"] for e in group), n)
        out[scope] = block
    return out


def parse_eu(path):
    root = ET.parse(path).getroot()
    entries, id_types = [], Counter()
    for se in root.iter(NS + "sanctionEntity"):
        code = se.find(NS + "subjectType").get("code")
        kind = "person" if code == "person" else "entity"
        countries, ids = set(), set()
        for tag in ("address", "citizenship", "birthdate", "identification"):
            for el in se.iter(NS + tag):
                countries.add(el.get("countryIso2Code", ""))
        for ident in se.iter(NS + "identification"):
            t = ident.get("identificationTypeCode", "")
            id_types[f"{kind}:{t}"] += 1
            number = ident.get("number", "")
            if LEI.search(number) and t in ENTITY_ID_TYPES | {"other"}:
                ids.add("lei")
            if t == "imo":
                ids.add("imo")
            if t == "swiftbic":
                ids.add("swift_bic")
            if kind == "entity" and t in ENTITY_ID_TYPES and number:
                ids.add("regnumber")
            if kind == "person" and t in PERSON_ID_TYPES and number:
                ids.add("passport_or_national_id")
        text = " ".join((el.text or "") for el in se.iter(NS + "remark"))
        text += " " + " ".join(i.get("number", "") + " " + i.get("identificationTypeDescription", "")
                               for i in se.iter(NS + "identification"))
        if IMO.search(text):
            ids.add("imo")
        for bd in se.iter(NS + "birthdate"):
            if bd.get("birthdate"):
                ids.add("full_birthdate")
            elif bd.get("year"):
                ids.add("birth_year_only")
        entries.append({"kind": kind, "baltic": bool(countries & BALTIC), "ids": ids})
    meta = {"generationDate": root.get("generationDate"), "entries": len(entries),
            "identification_types": dict(id_types.most_common(25))}
    return meta, entries


def text_of(el, path):
    return " ".join((x.text or "").strip() for x in el.iter() if x.tag in path)


def parse_un(path):
    root = ET.parse(path).getroot()
    entries, doc_types = [], Counter()
    for kind, tag in (("person", "INDIVIDUAL"), ("entity", "ENTITY")):
        for el in root.iter(tag):
            ids, countries = set(), set()
            for doc in el.iter("INDIVIDUAL_DOCUMENT"):
                t = (doc.findtext("TYPE_OF_DOCUMENT") or "").strip()
                if t:
                    doc_types[t] += 1
                if doc.findtext("NUMBER"):
                    ids.add("passport_or_national_id")
                countries.add((doc.findtext("ISSUING_COUNTRY") or doc.findtext("COUNTRY_OF_ISSUE") or "").lower())
            for dob in el.iter("INDIVIDUAL_DATE_OF_BIRTH"):
                if dob.findtext("DATE"):
                    ids.add("full_birthdate")
                elif dob.findtext("YEAR"):
                    ids.add("birth_year_only")
            for place in ("COUNTRY", "STATE_PROVINCE"):
                for x in el.iter(place):
                    countries.add((x.text or "").strip().lower())
            for nat in el.iter("NATIONALITY"):
                countries.update((v.text or "").strip().lower() for v in nat.iter("VALUE"))
            comments = " ".join((x.text or "") for x in el.iter() if x.tag in ("COMMENTS1", "NOTE"))
            if IMO.search(comments):
                ids.add("imo")
            if kind == "entity" and REG.search(comments):
                ids.add("regnumber")
            if LEI.search(comments):
                ids.add("lei")
            entries.append({"kind": kind, "baltic": bool(countries & BALTIC_NAMES), "ids": ids})
    meta = {"dateGenerated": root.get("dateGenerated"), "entries": len(entries),
            "document_types": dict(doc_types.most_common(10))}
    return meta, entries


def main():
    eu_path = Path(sys.argv[1]) if len(sys.argv) > 1 else CACHE / "raw" / "eu" / "eu_1_1.xml"
    un_path = Path(sys.argv[2]) if len(sys.argv) > 2 else CACHE / "raw" / "un" / "consolidated.xml"
    eu_meta, eu = parse_eu(eu_path)
    un_meta, un = parse_un(un_path)
    stats = {"eu": {**eu_meta, **summarise(eu)}, "un": {**un_meta, **summarise(un)}}
    (CACHE / "sanctions_stats.json").write_text(json.dumps(stats, indent=2), encoding="utf-8")
    print(json.dumps(stats, indent=1))


if __name__ == "__main__":
    main()
