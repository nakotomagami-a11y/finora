"""Measure GLEIF LEI coverage for Lithuania, Latvia and Estonia (US counted for reference).

Reads the GLEIF golden copy CSVs (LEI-CDF level 1, relationship records, reporting exceptions)
downloaded from https://goldencopy.gleif.org/api/v2/golden-copies/publishes/latest into
research/.cache/baltics/common/raw/gleif/.

Writes:
- research/.cache/baltics/common/gleif_baltic.csv   one row per Baltic LEI (entity-level, cache only)
- research/.cache/baltics/common/gleif_stats.json   aggregate counts and fill rates only
"""

import csv
import io
import json
import re
import sys
import zipfile
from collections import Counter, defaultdict
from pathlib import Path

CACHE = Path(__file__).resolve().parents[4] / "research" / ".cache" / "baltics" / "common"
RAW = CACHE / "raw" / "gleif"
BALTIC = ("LT", "LV", "EE")
# National register code formats: LT 9 digits, LV 11 digits, EE 8 digits.
CODE_FORMAT = {"LT": re.compile(r"^\d{9}$"), "LV": re.compile(r"^\d{11}$"), "EE": re.compile(r"^\d{8}$")}

csv.field_size_limit(sys.maxsize)


def open_zip_csv(pattern):
    path = next(RAW.glob(pattern))
    archive = zipfile.ZipFile(path)
    return path.name, csv.DictReader(io.TextIOWrapper(archive.open(archive.namelist()[0]), encoding="utf-8"))


def pct(part, whole):
    return round(100 * part / whole, 1) if whole else None


def main():
    name, rows = open_zip_csv("*lei2-golden-copy.csv.zip")
    per = defaultdict(Counter)
    ra_ids = defaultdict(Counter)
    legal_forms = defaultdict(Counter)
    baltic = {}
    out_cols = ["LEI", "country", "ra_id", "ra_entity_id", "entity_status", "registration_status",
                "legal_form", "category", "creation_date", "last_update", "legal_name"]
    with open(CACHE / "gleif_baltic.csv", "w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerow(out_cols)
        for row in rows:
            country = row["Entity.LegalAddress.Country"]
            if country == "US":
                per["US"]["total"] += 1
                per["US"]["issued"] += row["Registration.RegistrationStatus"] == "ISSUED"
                continue
            if country not in BALTIC and row["Entity.LegalJurisdiction"] not in BALTIC:
                continue
            country = country if country in BALTIC else row["Entity.LegalJurisdiction"]
            c = per[country]
            c["total"] += 1
            reg_status = row["Registration.RegistrationStatus"]
            c[f"reg_{reg_status}"] += 1
            c[f"entity_{row['Entity.EntityStatus']}"] += 1
            ra = row["Entity.RegistrationAuthority.RegistrationAuthorityID"]
            ra_ids[country][ra] += 1
            code = row["Entity.RegistrationAuthority.RegistrationAuthorityEntityID"].strip()
            c["has_ra_entity_id"] += bool(code)
            c["ra_entity_id_national_format"] += bool(CODE_FORMAT[country].match(code))
            c["jurisdiction_matches"] += row["Entity.LegalJurisdiction"] == country
            c["has_creation_date"] += bool(row["Entity.EntityCreationDate"])
            c["fully_corroborated"] += row["Registration.ValidationSources"] == "FULLY_CORROBORATED"
            c["category_" + (row["Entity.EntityCategory"] or "blank")] += 1
            legal_forms[country][row["Entity.LegalForm.EntityLegalFormCode"]] += 1
            baltic[row["LEI"]] = country
            writer.writerow([row["LEI"], country, ra, code, row["Entity.EntityStatus"], reg_status,
                             row["Entity.LegalForm.EntityLegalFormCode"], row["Entity.EntityCategory"],
                             row["Entity.EntityCreationDate"], row["Registration.LastUpdateDate"],
                             row["Entity.LegalName"]])

    _, rels = open_zip_csv("*rr-golden-copy.csv.zip")
    rel = defaultdict(Counter)
    has_parent = defaultdict(set)
    child_of = defaultdict(set)
    for row in rels:
        start, end = row["Relationship.StartNode.NodeID"], row["Relationship.EndNode.NodeID"]
        kind = row["Relationship.RelationshipType"]
        if start in baltic:
            rel[baltic[start]][f"child:{kind}:{row['Relationship.RelationshipStatus']}"] += 1
            if row["Relationship.RelationshipStatus"] == "ACTIVE" and kind == "IS_DIRECTLY_CONSOLIDATED_BY":
                has_parent[baltic[start]].add(start)
        if end in baltic:
            rel[baltic[end]][f"parent_of:{kind}"] += 1
            child_of[baltic[end]].add(end)

    _, repex = open_zip_csv("*repex-golden-copy.csv.zip")
    exceptions = defaultdict(Counter)
    for row in repex:
        if row["LEI"] in baltic:
            exceptions[baltic[row["LEI"]]][f"{row['Exception.Category']}:{row['Exception.Reason.1']}"] += 1

    stats = {"golden_copy_file": name, "countries": {}}
    for country in BALTIC:
        c = per[country]
        total = c["total"]
        issued = c["reg_ISSUED"]
        stats["countries"][country] = {
            "lei_total": total,
            "lei_issued": issued,
            "lei_lapsed": c["reg_LAPSED"],
            "lei_retired_or_other": total - issued - c["reg_LAPSED"],
            "entity_active": c["entity_ACTIVE"],
            "pct_with_register_code": pct(c["has_ra_entity_id"], total),
            "pct_register_code_in_national_format": pct(c["ra_entity_id_national_format"], total),
            "pct_fully_corroborated": pct(c["fully_corroborated"], total),
            "registration_authorities": dict(ra_ids[country].most_common(8)),
            "legal_forms_top": dict(legal_forms[country].most_common(6)),
            "categories": {k[9:]: v for k, v in c.items() if k.startswith("category_")},
            "pct_with_direct_parent_lei": pct(len(has_parent[country]), total),
            "leis_that_are_parents": len(child_of[country]),
            "relationship_counts": dict(rel[country]),
            "reporting_exceptions": dict(exceptions[country].most_common(10)),
        }
    stats["US_reference"] = dict(per["US"])
    (CACHE / "gleif_stats.json").write_text(json.dumps(stats, indent=2), encoding="utf-8")
    print(json.dumps(stats, indent=2))


if __name__ == "__main__":
    main()
