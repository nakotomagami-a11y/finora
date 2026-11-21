"""Measure SEC EDGAR sources: fields, fill rates, rows, freshness.

    SEC_USER_AGENT="<org> <contact email>" python -I research/probes/us/edgar_probe.py <probe> [args]

Probes: bulk, submissions N, companyfacts N, formd QUARTER, sched13 DATE..., items DATE..., def14a N, ex21 N

Only aggregates are printed. Entity-level output goes to research/.cache/us/edgar/.
"""
import collections
import csv
import io
import json
import random
import re
import sys
import zipfile

sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))
from edgar_http import CACHE, fetch, fetch_json, head

OUT = CACHE.parent
ARCHIVES = "https://www.sec.gov/Archives/edgar"
SEED = 20261119


def pct(n, d):
    return round(100.0 * n / d, 1) if d else None


def save(name, data):
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / f"{name}.json").write_text(json.dumps(data, indent=2, default=str))


def tickers():
    data = fetch_json("https://www.sec.gov/files/company_tickers_exchange.json")
    return [dict(zip(data["fields"], row)) for row in data["data"]]


def sample_ciks(n):
    rows = tickers()
    ciks = sorted({r["cik"] for r in rows})
    random.Random(SEED).shuffle(ciks)
    return ciks[:n], rows


def submissions(cik):
    return fetch_json(f"https://data.sec.gov/submissions/CIK{int(cik):010d}.json")


def recent_filings(sub):
    recent = sub["filings"]["recent"]
    keys = list(recent)
    return [dict(zip(keys, vals)) for vals in zip(*(recent[k] for k in keys))]


def filled(v):
    if v is None:
        return False
    if isinstance(v, str):
        return v.strip() not in ("", "0", "N/A")
    if isinstance(v, (list, dict)):
        return len(v) > 0
    return True


def probe_bulk():
    urls = {
        "company_tickers_exchange": "https://www.sec.gov/files/company_tickers_exchange.json",
        "submissions_zip": "https://www.sec.gov/Archives/edgar/daily-index/bulkdata/submissions.zip",
        "companyfacts_zip": "https://www.sec.gov/Archives/edgar/daily-index/xbrl/companyfacts.zip",
    }
    out = {}
    for name, url in urls.items():
        try:
            out[name] = head(url)
        except Exception as err:  # noqa: BLE001 - probe records any failure
            out[name] = {"error": str(err)}
    rows = tickers()
    out["tickers_rows"] = len(rows)
    out["tickers_ciks"] = len({r["cik"] for r in rows})
    out["tickers_by_exchange"] = collections.Counter(r["exchange"] or "none" for r in rows).most_common()
    return out


def probe_submissions(n):
    ciks, _ = sample_ciks(n)
    top = collections.Counter()
    addr = collections.Counter()
    forms = collections.Counter()
    eightk = eightk_items = item502 = 0
    latest = []
    got = 0
    for cik in ciks:
        sub = submissions(cik)
        if not sub:
            continue
        got += 1
        for k, v in sub.items():
            if k != "filings" and filled(v):
                top[k] += 1
        for kind in ("business", "mailing"):
            for k, v in (sub.get("addresses", {}).get(kind) or {}).items():
                if filled(v):
                    addr[f"{kind}.{k}"] += 1
        filings = recent_filings(sub)
        if filings:
            latest.append(max(f["filingDate"] for f in filings))
        seen = set()
        for f in filings:
            if f["form"] not in seen:
                forms[f["form"]] += 1
                seen.add(f["form"])
            if f["form"] == "8-K":
                eightk += 1
                if f.get("items"):
                    eightk_items += 1
                if "5.02" in (f.get("items") or ""):
                    item502 += 1
    return {
        "sample": n,
        "fetched": got,
        "field_fill_pct": {k: pct(v, got) for k, v in sorted(top.items())},
        "address_fill_pct": {k: pct(v, got) for k, v in sorted(addr.items())},
        "companies_with_form_pct": {k: pct(v, got) for k, v in forms.most_common(40)},
        "recent_8k": eightk,
        "recent_8k_with_items_pct": pct(eightk_items, eightk),
        "recent_8k_with_5_02_pct": pct(item502, eightk),
        "latest_filing_date_max": max(latest) if latest else None,
    }


KEY_CONCEPTS = {
    "revenue": [
        ("us-gaap", "Revenues"),
        ("us-gaap", "RevenueFromContractWithCustomerExcludingAssessedTax"),
        ("us-gaap", "SalesRevenueNet"),
        ("ifrs-full", "Revenue"),
    ],
    "net_income": [("us-gaap", "NetIncomeLoss"), ("ifrs-full", "ProfitLoss")],
    "assets": [("us-gaap", "Assets"), ("ifrs-full", "Assets")],
    "liabilities": [("us-gaap", "Liabilities"), ("ifrs-full", "Liabilities")],
    "equity": [("us-gaap", "StockholdersEquity"), ("ifrs-full", "Equity")],
    "cash": [
        ("us-gaap", "CashAndCashEquivalentsAtCarryingValue"),
        ("ifrs-full", "CashAndCashEquivalents"),
    ],
    "operating_cash_flow": [
        ("us-gaap", "NetCashProvidedByUsedInOperatingActivities"),
        ("ifrs-full", "CashFlowsFromUsedInOperatingActivities"),
    ],
    "shares_outstanding": [("dei", "EntityCommonStockSharesOutstanding")],
    "public_float": [("dei", "EntityPublicFloat")],
    "employees": [("dei", "EntityNumberOfEmployees")],
}


def probe_companyfacts(n):
    ciks, _ = sample_ciks(n)
    got = 0
    taxonomies = collections.Counter()
    concepts = []
    key_hits = collections.Counter()
    key_recent = collections.Counter()
    last_fy = collections.Counter()
    for cik in ciks:
        facts = fetch_json(f"https://data.sec.gov/api/xbrl/companyfacts/CIK{int(cik):010d}.json")
        if not facts:
            continue
        got += 1
        f = facts.get("facts", {})
        for tax in f:
            taxonomies[tax] += 1
        concepts.append(sum(len(v) for v in f.values()))
        fys = [
            u.get("fy")
            for tax in f.values()
            for c in tax.values()
            for units in c["units"].values()
            for u in units
            if u.get("fy")
        ]
        if fys:
            last_fy[max(fys)] += 1
        for key, options in KEY_CONCEPTS.items():
            hit = [f[t][c] for t, c in options if c in f.get(t, {})]
            if hit:
                key_hits[key] += 1
                ends = [u["end"] for c in hit for units in c["units"].values() for u in units]
                if ends and max(ends) >= "2025-01-01":
                    key_recent[key] += 1
    concepts.sort()
    return {
        "sample": n,
        "with_companyfacts": got,
        "with_companyfacts_pct": pct(got, n),
        "taxonomy_pct": {k: pct(v, got) for k, v in taxonomies.items()},
        "concepts_median": concepts[len(concepts) // 2] if concepts else None,
        "key_concept_pct": {k: pct(key_hits[k], got) for k in KEY_CONCEPTS},
        "key_concept_since_2025_pct": {k: pct(key_recent[k], got) for k in KEY_CONCEPTS},
        "latest_fy": sorted(last_fy.items()),
    }


def read_tsv(zf, name):
    member = next(m for m in zf.namelist() if m.upper().endswith(name))
    with zf.open(member) as fh:
        return list(csv.DictReader(io.TextIOWrapper(fh, "utf-8", errors="replace"), delimiter="\t"))


def probe_formd(quarter):
    url = f"https://www.sec.gov/files/structureddata/data/form-d-data-sets/{quarter}_d.zip"
    status, body = fetch(url)
    if status != 200:
        return {"url": url, "status": status}
    zf = zipfile.ZipFile(io.BytesIO(body))
    sub = read_tsv(zf, "FORMDSUBMISSION.TSV")
    iss = read_tsv(zf, "ISSUERS.TSV")
    rel = read_tsv(zf, "RELATEDPERSONS.TSV")
    off = read_tsv(zf, "OFFERING.TSV")
    rel_by_acc = collections.Counter(r["ACCESSIONNUMBER"] for r in rel)
    roles = collections.Counter()
    for r in rel:
        for col in ("RELATIONSHIP_1", "RELATIONSHIP_2", "RELATIONSHIP_3"):
            if r.get(col):
                roles[r[col]] += 1
    counts = sorted(rel_by_acc.values())

    def fill(rows):
        return {k: pct(sum(1 for r in rows if (r.get(k) or "").strip()), len(rows)) for k in rows[0]}

    return {
        "url": url,
        "zip_bytes": len(body),
        "files": zf.namelist(),
        "submissions": len(sub),
        "by_form": collections.Counter(s["SUBMISSIONTYPE"] for s in sub).most_common(),
        "filing_date_range": [min(s["FILING_DATE"] for s in sub), max(s["FILING_DATE"] for s in sub)],
        "issuers": len(iss),
        "distinct_issuer_ciks": len({i["CIK"] for i in iss}),
        "issuer_fill_pct": fill(iss),
        "entity_type": collections.Counter(i["ENTITYTYPE"] for i in iss).most_common(),
        "issuer_state_top": collections.Counter(i["STATEORCOUNTRY"] for i in iss).most_common(15),
        "related_persons": len(rel),
        "related_fill_pct": fill(rel),
        "related_roles": roles.most_common(),
        "related_per_filing_median": counts[len(counts) // 2] if counts else 0,
        "offering_fill_pct": fill(off),
        "industry_top": collections.Counter(o["INDUSTRYGROUPTYPE"] for o in off).most_common(15),
        "revenue_range": collections.Counter(o.get("REVENUERANGE", "") for o in off).most_common(),
    }


def daily_index(date):
    y, m = date[:4], int(date[5:7])
    q = (m - 1) // 3 + 1
    url = f"{ARCHIVES}/daily-index/{y}/QTR{q}/form.{date.replace('-', '')}.idx"
    status, body = fetch(url)
    if status != 200:
        return []
    lines = body.decode("latin-1").splitlines()
    start = next(i for i, l in enumerate(lines) if l.startswith("---")) + 1
    rows = []
    for line in lines[start:]:
        m_ = re.match(r"^(.+?)\s{2,}(.+?)\s{2,}(\d+)\s{2,}(\d{8})\s{2,}(\S+)\s*$", line)
        if m_:
            form, company, cik, filed, path = m_.groups()
            rows.append({"form": form.strip(), "cik": cik, "filed": filed, "path": path})
    return rows


def folder(cik, accession):
    return f"{ARCHIVES}/data/{int(cik)}/{accession.replace('-', '')}"


def accession_of(path):
    return path.rsplit("/", 1)[-1].removesuffix(".txt")


def xml_paths(node, prefix=""):
    tag = node.tag.split("}")[-1]
    here = f"{prefix}/{tag}"
    yield here, (node.text or "").strip()
    for child in node:
        yield from xml_paths(child, here)


def probe_sched13(dates, per_form=25):
    import xml.etree.ElementTree as ET

    rows = [r for d in dates for r in daily_index(d)]
    forms = collections.Counter(r["form"] for r in rows if "13D" in r["form"] or "13G" in r["form"])
    picked = collections.defaultdict(list)
    for r in rows:
        if r["form"] in ("SCHEDULE 13D", "SCHEDULE 13G", "SCHEDULE 13D/A", "SCHEDULE 13G/A"):
            if len(picked[r["form"]]) < per_form and r not in picked[r["form"]]:
                picked[r["form"]].append(r)
    out = {"dates": dates, "forms_in_index": forms.most_common()}
    for form, items in picked.items():
        seen_paths = collections.Counter()
        parsed = 0
        for r in items:
            acc = accession_of(r["path"])
            idx = fetch_json(f"{folder(r['cik'], acc)}/index.json")
            if not idx:
                continue
            xmls = [i["name"] for i in idx["directory"]["item"] if i["name"].endswith(".xml")]
            if not xmls:
                continue
            status, body = fetch(f"{folder(r['cik'], acc)}/{xmls[0]}")
            try:
                root = ET.fromstring(body)
            except ET.ParseError:
                continue
            parsed += 1
            for p, text in set(xml_paths(root)):
                if text:
                    seen_paths[p] += 1
        out[form] = {
            "sampled": len(items),
            "xml_parsed": parsed,
            "path_fill_pct": {p: pct(c, parsed) for p, c in sorted(seen_paths.items()) if pct(c, parsed) >= 20},
        }
    return out


ITEM_502_WORDS = {
    "resign": r"\bresign",
    "retire": r"\bretire",
    "appoint": r"\bappoint",
    "elect": r"\belect",
    "terminat": r"\bterminat",
    "compensat": r"\bcompensat",
}


def html_text(body):
    text = re.sub(r"(?is)<(script|style).*?</\1>", " ", body.decode("utf-8", "replace"))
    text = re.sub(r"(?s)<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", re.sub(r"&#160;|&nbsp;", " ", text))


def probe_items(dates, limit=60):
    rows = [r for d in dates for r in daily_index(d) if r["form"] in ("8-K", "8-K/A")]
    random.Random(SEED).shuffle(rows)
    by_cik = {}
    checked = with_items = has502 = text_confirms = 0
    words = collections.Counter()
    items_seen = collections.Counter()
    for r in rows[:limit]:
        acc = accession_of(r["path"])
        sub = by_cik.get(r["cik"]) or submissions(r["cik"])
        by_cik[r["cik"]] = sub
        if not sub:
            continue
        match = next((f for f in recent_filings(sub) if f["accessionNumber"] == acc), None)
        if not match:
            continue
        checked += 1
        items = [i for i in (match.get("items") or "").split(",") if i]
        if items:
            with_items += 1
        items_seen.update(items)
        if "5.02" in items:
            has502 += 1
            status, body = fetch(f"{folder(r['cik'], acc)}/{match['primaryDocument']}")
            text = html_text(body).lower() if status == 200 else ""
            if "5.02" in text:
                text_confirms += 1
            for w, rx in ITEM_502_WORDS.items():
                if re.search(rx, text):
                    words[w] += 1
    return {
        "dates": dates,
        "8k_in_index": len(rows),
        "checked_in_submissions": checked,
        "with_items_pct": pct(with_items, checked),
        "items": items_seen.most_common(),
        "with_5_02": has502,
        "5_02_text_confirms_pct": pct(text_confirms, has502),
        "5_02_keyword_pct": {w: pct(c, has502) for w, c in words.items()},
    }


def filing_index_rows(cik, acc):
    status, body = fetch(f"{folder(cik, acc)}/{acc}-index.htm")
    if status != 200:
        return []
    html = body.decode("utf-8", "replace")
    out = []
    for tr in re.findall(r"(?is)<tr.*?</tr>", html):
        cells = [re.sub(r"(?s)<[^>]+>", "", c).strip() for c in re.findall(r"(?is)<td.*?</td>", tr)]
        href = re.search(r'href="([^"]+)"', tr)
        if len(cells) >= 4 and href:
            out.append({"description": cells[1], "type": cells[3], "href": href.group(1)})
    return out


def probe_def14a(n):
    ciks, _ = sample_ciks(n)
    proxies = with_ecd = peo_name = 0
    for cik in ciks:
        sub = submissions(cik)
        if not sub:
            continue
        hits = [f for f in recent_filings(sub) if f["form"] == "DEF 14A" and f["filingDate"] >= "2025-06-01"]
        if not hits:
            continue
        proxies += 1
        f = hits[0]
        status, body = fetch(f"{folder(cik, f['accessionNumber'])}/{f['primaryDocument']}")
        if status != 200:
            continue
        if b"ecd:" in body:
            with_ecd += 1
        if b"ecd:PeoName" in body:
            peo_name += 1
    return {
        "sample": n,
        "with_def14a_since_2025_06": proxies,
        "def14a_pct_of_sample": pct(proxies, n),
        "inline_ecd_tags_pct": pct(with_ecd, proxies),
        "ecd_PeoName_pct": pct(peo_name, proxies),
    }


def probe_ex21(n):
    ciks, _ = sample_ciks(n)
    tenk = with_ex21 = 0
    lines = []
    for cik in ciks:
        sub = submissions(cik)
        if not sub:
            continue
        hits = [f for f in recent_filings(sub) if f["form"] in ("10-K", "10-K405") and f["filingDate"] >= "2025-01-01"]
        if not hits:
            continue
        tenk += 1
        rows = filing_index_rows(cik, hits[0]["accessionNumber"])
        ex = [r for r in rows if r["type"].upper().startswith("EX-21")]
        if not ex:
            continue
        with_ex21 += 1
        status, body = fetch("https://www.sec.gov" + ex[0]["href"])
        if status == 200:
            html = body.decode("utf-8", "replace")
            rows_ = len(re.findall(r"(?i)<tr", html))
            paras = len(re.findall(r"(?i)<p[ >]", html))
            lines.append(max(rows_, paras))
    lines.sort()
    return {
        "sample": n,
        "with_10k_since_2025": tenk,
        "with_ex21_pct": pct(with_ex21, tenk),
        "ex21_rows_median": lines[len(lines) // 2] if lines else None,
        "ex21_rows_p90": lines[int(len(lines) * 0.9)] if lines else None,
    }


PROBES = {
    "bulk": lambda a: probe_bulk(),
    "submissions": lambda a: probe_submissions(int(a[0])),
    "companyfacts": lambda a: probe_companyfacts(int(a[0])),
    "formd": lambda a: probe_formd(a[0]),
    "sched13": lambda a: probe_sched13(a),
    "items": lambda a: probe_items(a),
    "def14a": lambda a: probe_def14a(int(a[0])),
    "ex21": lambda a: probe_ex21(int(a[0])),
}


def main():
    if len(sys.argv) < 2 or sys.argv[1] not in PROBES:
        sys.exit(__doc__)
    name, args = sys.argv[1], sys.argv[2:]
    result = PROBES[name](args)
    save(f"probe-{name}", result)
    json.dump(result, sys.stdout, indent=2, default=str)
    print()


if __name__ == "__main__":
    main()
