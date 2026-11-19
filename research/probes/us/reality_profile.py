"""Build US reality-check profiles and print aggregate fill rates per report section.

Reads research/.cache/us/samples.json (from reality_sample.py), looks every sample up
in each source the app would use, and writes one profile per sample to
research/.cache/us/profiles/. Only aggregates are printed.

    FORMS345_DB=<path> python -I research/probes/us/reality_profile.py [--bulk]

--bulk also scans the large local files (SBA PPP, FJC civil IDB, SAM extracts, GLEIF
golden copy). Sources that need a key we don't have are recorded as "not checked".
"""
import collections
import csv
import io
import json
import os
import pathlib
import re
import sqlite3
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
import zipfile

UA = "Finora research (open-source; github.com/nakotomagami-a11y/finora)"
CACHE = pathlib.Path(__file__).resolve().parents[2] / ".cache" / "us"
PROFILES = CACHE / "profiles"
SUFFIXES = {
    "LLC", "L", "C", "INC", "INCORPORATED", "CORP", "CORPORATION", "CO", "COMPANY",
    "LTD", "LIMITED", "LP", "LLP", "PLLC", "PC", "THE", "HOLDINGS",
}
csv.field_size_limit(10**8)


def norm(name):
    words = re.sub(r"[^A-Z0-9 ]", " ", (name or "").upper().replace("&", " AND ")).split()
    while words and words[-1] in SUFFIXES:
        words.pop()
    while words and words[0] == "THE":
        words.pop(0)
    return " ".join(words)


def get_json(url, body=None):
    data = json.dumps(body).encode() if body is not None else None
    headers = {"User-Agent": UA, "Accept": "application/json"}
    if data:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return json.load(r)
    except urllib.error.HTTPError as err:
        return {"_error": err.code}


def soql(domain, dataset, where, select="*", limit=200):
    params = {"$where": where, "$limit": limit}
    if select != "*":
        params["$select"] = select
    rows = get_json(f"https://{domain}/resource/{dataset}.json?" + urllib.parse.urlencode(params))
    return rows if isinstance(rows, list) else []


def quote(s):
    return s.replace("'", "''")


def by_name(domain, dataset, col, name, select="*"):
    """Prefix query on the first two normalized words, then exact match on the normalized name."""
    target = norm(name)
    prefix = quote(" ".join(target.split()[:2]))
    rows = soql(domain, dataset, f"upper({col}) like '{prefix}%'", select, limit=1000)
    return [r for r in rows if norm(r.get(col)) == target]


REGISTRIES = {
    "NY": ("data.ny.gov", "n9v6-gdp6", "dos_id", "current_entity_name"),
    "CO": ("data.colorado.gov", "4ykn-tg5h", "entityid", "entityname"),
    "OR": ("data.oregon.gov", "tckn-sxa6", "registry_number", "business_name"),
    "CT": ("data.ct.gov", "n7gp-d28j", "accountnumber", "name"),
    "PA": ("data.pa.gov", "xvd7-5r2c", "filing_number", "business_name"),
}


def registry_hits(sample):
    """Home-state record by id, plus same-name records in every registry we can query."""
    hits = {}
    for state, (domain, ds, key, col) in REGISTRIES.items():
        if state == sample["state"]:
            rows = soql(domain, ds, f"{key} = '{quote(sample['id'])}'")
        else:
            rows = by_name(domain, ds, col, sample["name"])
        if rows:
            hits[state] = rows
    return hits


def people(sample, hits):
    found = collections.Counter()
    if "CT" in hits:
        ct_id = hits["CT"][0].get("id")
        if ct_id:
            found["CT principals"] = len(soql("data.ct.gov", "ka36-64k6", f"business_id = '{ct_id}'", "name__c"))
    if "OR" in hits:
        found["OR representatives"] = sum(
            1 for r in hits["OR"] if r.get("associated_name_type") in ("AUTHORIZED REPRESENTATIVE", "REGISTERED AGENT")
            and r.get("last_name")
        )
    if "NY" in hits:
        found["NY chairman"] = sum(1 for r in hits["NY"] if r.get("chairman_name"))
    if "CO" in hits:
        found["CO agent"] = sum(1 for r in hits["CO"] if r.get("agentlastname") or r.get("agentorganizationname"))
    if "PA" in hits:
        found["PA parties"] = sum(1 for r in hits["PA"] if r.get("last_name"))
    return {k: v for k, v in found.items() if v}


def history(sample, hits):
    found = {}
    if "NY" in hits:
        found["NY status history"] = len(soql("data.ny.gov", "3gg2-jgnp", f"corpid_num = '{hits['NY'][0]['dos_id']}'", "status"))
    if "CO" in hits:
        found["CO transactions"] = len(soql("data.colorado.gov", "casm-dbbj", f"entityid = '{hits['CO'][0]['entityid']}'", "historydes"))
    if "CT" in hits:
        found["CT filings"] = len(soql("data.ct.gov", "ah3s-bes7", f"account = '{hits['CT'][0]['accountnumber']}'", "type"))
    return {k: v for k, v in found.items() if v}


def ucc(sample):
    found = {
        "CO UCC debtor": len(by_name("data.colorado.gov", "8upq-58vz", "organizationname", sample["name"])),
        "CT UCC debtor": len(by_name("data.ct.gov", "xfev-8smz", "debtor_nm_bus", sample["name"])),
    }
    return {k: v for k, v in found.items() if v}


def fmcsa(sample):
    if sample["segment"] == "freight broker":
        rows = soql("data.transportation.gov", "az4n-8mr2", f"dot_number = '{sample['id']}'")
    else:
        rows = by_name("data.transportation.gov", "az4n-8mr2", "legal_name", sample["name"])
    return {
        "census": len(rows),
        "officer": sum(1 for r in rows if r.get("company_officer_1")),
        "drivers": sum(1 for r in rows if r.get("total_drivers")),
    } if rows else {}


def licences(sample):
    found = {
        "OR CCB": len(by_name("data.oregon.gov", "g77e-6bhs", "full_name", sample["name"])),
        "WA L&I": len(by_name("data.wa.gov", "m8qx-ubtq", "businessname", sample["name"])),
    }
    return {k: v for k, v in found.items() if v}


def usaspending(sample):
    res = get_json("https://api.usaspending.gov/api/v2/recipient/", {"keyword": sample["name"], "limit": 10})
    target = norm(sample["name"])
    matches = [r for r in res.get("results", []) if norm(r.get("name")) == target]
    return {"recipients": len(matches), "amount": sum(r.get("amount") or 0 for r in matches)} if matches else {}


def gleif(sample):
    params = {"filter[entity.legalName]": sample["name"], "page[size]": 10}
    res = get_json("https://api.gleif.org/api/v1/lei-records?" + urllib.parse.urlencode(params))
    data = res.get("data", []) if isinstance(res, dict) else []
    us = [d for d in data if d["attributes"]["entity"]["legalAddress"].get("country") == "US"]
    return {"lei": len(us), "status": [d["attributes"]["registration"]["status"] for d in us]} if us else {}


def forms345(sample):
    if sample["segment"] != "public company" or not os.environ.get("FORMS345_DB"):
        return {}
    con = sqlite3.connect(f"file:{os.environ['FORMS345_DB']}?mode=ro", uri=True)
    cik = sample["id"]
    insiders = con.execute(
        "select count(distinct o.owner_cik) from hist_filings f join hist_owners o using (accession)"
        " where f.issuer_cik = ? and f.filing_date >= '2025-11-01'", (cik,)
    ).fetchone()[0]
    officers = con.execute(
        "select count(distinct o.owner_cik) from hist_filings f join hist_owners o using (accession)"
        " where f.issuer_cik = ? and f.filing_date >= '2025-11-01' and o.relationship like '%Officer%'", (cik,)
    ).fetchone()[0]
    tenpct = con.execute(
        "select count(distinct o.owner_cik) from hist_filings f join hist_owners o using (accession)"
        " where f.issuer_cik = ? and o.relationship like '%TenPercent%'", (cik,)
    ).fetchone()[0]
    trades = con.execute(
        "select count(*) from hist_filings f join hist_tx t using (accession)"
        " where f.issuer_cik = ? and f.filing_date >= '2025-11-01'", (cik,)
    ).fetchone()[0]
    return {"insiders_12m": insiders, "officers_12m": officers, "ten_pct_owners_ever": tenpct, "trades_12m": trades}


# --- bulk passes: one scan per file for all samples -------------------------------------------


def scan_csv_lines(lines, header, columns, targets):
    """Yield (target, row) for rows whose normalized column value is a target name."""
    idx = [header.index(c) for c in columns]
    for row in csv.reader(lines):
        for i in idx:
            if i < len(row):
                n = norm(row[i])
                if n in targets:
                    yield n, row


def bulk_ppp(samples):
    base = "https://data.sba.gov/sites/default/files/distribution/SBA-OCA-2022-07-001/"
    files = ["public_150k_plus_240930.csv"] + [f"public_up_to_150k_{i}_240930.csv" for i in range(1, 13)]
    targets = {norm(s["name"]): s for s in samples}
    hits = collections.defaultdict(list)
    for name in files:
        local = CACHE / "ppp" / name
        if local.exists():
            fh = open(local, encoding="utf-8", errors="replace", newline="")
        else:
            resp = urllib.request.urlopen(urllib.request.Request(base + name, headers={"User-Agent": UA}), timeout=600)
            fh = io.TextIOWrapper(resp, encoding="utf-8", errors="replace", newline="")
        with fh:
            reader = csv.reader(fh)
            header = next(reader)
            b, st, jobs, amt = (header.index(c) for c in ("BorrowerName", "BorrowerState", "JobsReported", "CurrentApprovalAmount"))
            for row in reader:
                if len(row) > jobs:
                    n = norm(row[b])
                    if n in targets:
                        hits[n].append({"state": row[st], "jobs": row[jobs], "amount": row[amt]})
        print(f"  ppp scanned {name}", file=sys.stderr)
    return hits


def bulk_fjc_civil(samples):
    path = CACHE / "fjc_idb" / "cv88on.zip"
    targets = {norm(s["name"]) for s in samples}
    hits = collections.defaultdict(list)
    proc = subprocess.Popen(["unzip", "-p", str(path)], stdout=subprocess.PIPE)
    lines = io.TextIOWrapper(proc.stdout, encoding="latin-1", newline="")
    header = lines.readline().rstrip("\r\n").split("\t")
    p, d, f = header.index("PLT"), header.index("DEF"), header.index("FILEDATE")
    for line in lines:
        row = line.rstrip("\r\n").split("\t")
        if len(row) <= d:
            continue
        for role, i in (("plaintiff", p), ("defendant", d)):
            n = norm(row[i])
            if n in targets:
                hits[n].append({"role": role, "filed": row[f]})
    proc.wait()
    return hits


def bulk_sam(samples):
    targets = {norm(s["name"]) for s in samples}
    out = {"entity": collections.defaultdict(int), "exclusion": collections.defaultdict(int)}
    for kind, pattern in (("entity", "SAM_PUBLIC_UTF-8_MONTHLY_*.ZIP"), ("exclusion", "SAM_Exclusions_Public_Extract_*.ZIP")):
        files = sorted((CACHE / "sam").glob(pattern))
        if not files:
            continue
        zf = zipfile.ZipFile(files[-1])
        member = zf.namelist()[0]
        raw = zf.open(member)
        if member.lower().endswith(".zip"):
            zf = zipfile.ZipFile(io.BytesIO(raw.read()))
            raw = zf.open(zf.namelist()[0])
        for line in io.TextIOWrapper(raw, encoding="utf-8", errors="replace"):
            for field in re.split(r"[|,]", line):
                n = norm(field.strip('"'))
                if n in targets:
                    out[kind][n] += 1
                    break
    return out


def bulk_gleif(samples):
    files = sorted((CACHE / "gleif").glob("*-lei2-golden-copy.csv.zip"))
    targets = {norm(s["name"]) for s in samples}
    hits = collections.defaultdict(list)
    if not files:
        return hits
    zf = zipfile.ZipFile(files[-1])
    with zf.open(zf.namelist()[0]) as raw:
        reader = csv.reader(io.TextIOWrapper(raw, encoding="utf-8", errors="replace", newline=""))
        header = next(reader)
        name_i, country_i, status_i = header.index("Entity.LegalName"), header.index("Entity.LegalAddress.Country"), header.index("Registration.RegistrationStatus")
        for row in reader:
            if row[country_i] == "US":
                n = norm(row[name_i])
                if n in targets:
                    hits[n].append(row[status_i])
    return hits


# --- assemble -------------------------------------------------------------------------------

SECTIONS = {
    "S01": "Identity",
    "S02": "Status and history",
    "S03": "People",
    "S04": "Owners",
    "S05": "Group",
    "S06": "Financials",
    "S07": "Workforce",
    "S09": "Insolvency, pledges",
    "S10": "Courts",
    "S11": "Sanctions, exclusions",
    "S12": "Public money",
    "S13": "Filings and events",
    "S14": "Securities",
}


def sections(p):
    f345 = p.get("forms345", {})
    return {
        "S01": bool(p["registry"]) or bool(p.get("gleif")) or bool(p.get("sam_entity")),
        "S02": bool(p["history"]) or bool(p["registry"]),
        "S03": bool(p["people"]) or bool(p.get("fmcsa", {}).get("officer")) or bool(f345.get("officers_12m")),
        "S04": bool(f345.get("ten_pct_owners_ever")),
        "S05": False,
        "S06": False,
        "S07": bool(p.get("ppp")) or bool(p.get("fmcsa", {}).get("drivers")),
        "S09": bool(p["ucc"]),
        "S10": bool(p.get("fjc_civil")),
        "S11": bool(p.get("sam_exclusion")),
        "S12": bool(p.get("usaspending")) or bool(p.get("ppp")),
        "S13": bool(p["history"]),
        "S14": bool(f345.get("trades_12m")) or bool(f345.get("insiders_12m")),
    }


def main():
    bulk = "--bulk" in sys.argv
    samples = json.loads((CACHE / "samples.json").read_text())
    PROFILES.mkdir(parents=True, exist_ok=True)
    profiles = []
    for i, s in enumerate(samples):
        path = PROFILES / f"{i:02d}.json"
        if path.exists():
            p = json.loads(path.read_text())
        else:
            reg = registry_hits(s)
            p = {
                "segment": s["segment"],
                "home": s["state"],
                "registry": {k: len(v) for k, v in reg.items()},
                "people": people(s, reg),
                "history": history(s, reg),
                "ucc": ucc(s),
                "fmcsa": fmcsa(s),
                "licences": licences(s),
                "usaspending": usaspending(s),
                "gleif": gleif(s),
                "forms345": forms345(s),
            }
        profiles.append(p)
        path.write_text(json.dumps(p, indent=2))
        print(f"  profiled {i + 1}/{len(samples)}", file=sys.stderr)

    if bulk:
        keyed = {norm(s["name"]): p for s, p in zip(samples, profiles)}
        for n, rows in bulk_ppp(samples).items():
            keyed[n]["ppp"] = rows
        for n, rows in bulk_fjc_civil(samples).items():
            keyed[n]["fjc_civil"] = len(rows)
        sam = bulk_sam(samples)
        for n, c in sam["entity"].items():
            keyed[n]["sam_entity"] = c
        for n, c in sam["exclusion"].items():
            keyed[n]["sam_exclusion"] = c
        for s, p in zip(samples, profiles):
            p["checked"] = ["ppp", "fjc_civil", "sam_entity", "sam_exclusion"]
        for i, p in enumerate(profiles):
            (PROFILES / f"{i:02d}.json").write_text(json.dumps(p, indent=2))

    groups = {"public": [p for p in profiles if p["segment"] == "public company"],
              "private": [p for p in profiles if p["segment"] != "public company"]}
    print("| Section | Country | Segment | Sample size | Filled | Fill rate |")
    print("|---|---|---|---|---|---|")
    for sid, label in SECTIONS.items():
        for g, ps in groups.items():
            filled = sum(1 for p in ps if sections(p)[sid])
            print(f"| {sid} {label} | US | {g} | {len(ps)} | {filled} | {round(100 * filled / len(ps))}% |")
    source_hits = collections.Counter()
    for p in profiles:
        for key in ("registry", "people", "history", "ucc", "fmcsa", "licences", "usaspending", "gleif", "ppp", "fjc_civil", "sam_entity", "sam_exclusion"):
            if p.get(key):
                source_hits[(p["segment"] == "public company", key)] += 1
    print("\nsamples with a hit, by source (public, private):")
    for key in ("registry", "people", "history", "ucc", "fmcsa", "licences", "usaspending", "gleif", "ppp", "fjc_civil", "sam_entity", "sam_exclusion"):
        print(f"  {key:14} {source_hits[(True, key)]}/5  {source_hits[(False, key)]}/5")
    states = collections.Counter(st for p in profiles for st in p["registry"])
    print("registry states hit:", dict(states))


if __name__ == "__main__":
    main()
