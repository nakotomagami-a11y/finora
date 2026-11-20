"""Record the shape of each Crash monitor source for the loader spec and the fixture generator.

python research/probes/markets/shapes.py

Per source: bytes of one full pull, the header row or JSON keys, the as-of field, and whether history
reaches the peak start date. No values are kept in the summary.
"""
import io
import re
import time
import zipfile

from common import as_json, get, iso_day, run, summarise

PEAK_START = "2025-01-01"
PEAK_START_EPOCH = 1735689600


def treasury_full(probe_id):
    url = ("https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/debt_to_penny"
           "?sort=-record_date&page%5Bsize%5D=10000")
    status, body, hdrs, s = get(probe_id, url)
    data = as_json(body)
    return summarise(probe_id, "debt_to_penny, one page of 10,000", status, body, hdrs, s, {
        "rows": len(data["data"]), "keys": list(data.keys()), "meta_keys": list(data["meta"].keys()),
        "row_keys": list(data["data"][0].keys()),
    })


def fred_csv(series):
    def probe(probe_id):
        status, body, hdrs, s = get(probe_id, f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={series}")
        lines = body.decode("utf-8").splitlines()
        missing = sum(1 for l in lines[1:] if l.endswith(",") or l.endswith(",."))
        return summarise(probe_id, f"fredgraph.csv {series}", status, body, hdrs, s, {
            "header": lines[0], "rows": len(lines) - 1, "missing_value_rows": missing,
            "date_format": "YYYY-MM-DD" if re.match(r"\d{4}-\d{2}-\d{2},", lines[1]) else lines[1][:12],
        })
    return probe


def ecb(probe_id):
    url = "https://data-api.ecb.europa.eu/service/data/EXR/D.USD+JPY+TWD.EUR.SP00.A?startPeriod=2025-01-01&format=csvdata"
    status, body, hdrs, s = get(probe_id, url)
    lines = body.decode("utf-8").splitlines()
    header = lines[0].split(",")
    cur = header.index("CURRENCY")
    per = {c: sum(1 for l in lines[1:] if l.split(",")[cur] == c) for c in ("USD", "JPY", "TWD")}
    return summarise(probe_id, "ecb EXR since 2025-01-01", status, body, hdrs, s, {"header": header, "rows_per_currency": per})


def twse(path):
    def probe(probe_id):
        status, body, hdrs, s = get(probe_id, f"https://openapi.twse.com.tw/v1/{path}", strict_tls=False)
        rows = as_json(body)
        return summarise(probe_id, path, status, body, hdrs, s, {
            "rows": len(rows), "keys": list(rows[0].keys()) if rows else None,
            "date_example_shape": re.sub(r"\d", "9", rows[0].get("Date") or rows[0].get("日期") or "") if rows else None,
        })
    return probe


def worldbank(probe_id):
    status, body, hdrs, s = get(probe_id, "https://www.worldbank.org/en/research/commodity-markets")
    link = re.search(r'https://[^"\']+CMO-Historical-Data-Monthly\.xlsx', body.decode("utf-8", "replace")).group(0)
    st, xb, h2, s2 = get(probe_id + "_xlsx", link)
    z = zipfile.ZipFile(io.BytesIO(xb))
    workbook = z.read("xl/workbook.xml").decode("utf-8")
    sheets = re.findall(r'<sheet [^>]*name="([^"]+)"', workbook)
    shared = re.findall(r"<t[^>]*>([^<]*)</t>", z.read("xl/sharedStrings.xml").decode("utf-8"))
    gold = [t for t in shared if re.search(r"\bgold\b", t, re.I)]
    oil = [t for t in shared if re.search(r"crude oil", t, re.I)]
    months = sorted(t for t in shared if re.fullmatch(r"\d{4}M\d{2}", t))
    sheet_xml = {n: n for n in z.namelist() if n.startswith("xl/worksheets/")}
    month_cells = 0
    for name in sheet_xml:
        month_cells = max(month_cells, len(re.findall(r"<v>(\d{4}M\d{2})</v>", z.read(name).decode("utf-8", "replace"))))
    return summarise(probe_id, "pink sheet monthly xlsx", st, xb, h2, s2, {
        "sheets": sheets, "gold_labels": gold[:3], "crude_labels": oil[:4],
        "month_labels_first_last": [months[0], months[-1]] if months else None,
        "month_label_format": "YYYYMmm" if months else "inline numbers or dates (see raw)",
    })


def x4_paging(pair):
    def probe(probe_id):
        url = f"https://www.bitstamp.net/api/v2/ohlc/{pair}/?step=86400&limit=1000&start={PEAK_START_EPOCH}"
        status, body, hdrs, s = get(probe_id, url)
        rows = as_json(body)["data"]["ohlc"]
        days = [iso_day(int(r["timestamp"])) for r in rows]
        return summarise(probe_id, f"ohlc {pair} from {PEAK_START}", status, body, hdrs, s, {
            "rows": len(rows), "first": min(days), "last": max(days), "keys": list(rows[0].keys()),
            "reaches_peak_start": min(days) <= PEAK_START,
        })
    return probe


def crypto_global(probe_id):
    status, body, hdrs, s = get(probe_id, "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ethereum")
    rows = as_json(body)
    return summarise(probe_id, "coins/markets btc,eth", status, body, hdrs, s, {"keys": sorted(rows[0].keys())})


def paprika_global(probe_id):
    status, body, hdrs, s = get(probe_id, "https://api.coinpaprika.com/v1/global")
    return summarise(probe_id, "global", status, body, hdrs, s, {"keys": sorted(as_json(body).keys())})


PROBES = [
    ("shape_treasury_full", treasury_full),
    *[(f"shape_fred_{x}", fred_csv(x)) for x in ("DCOILBRENTEU", "NIKKEI225", "BOGZ1LM893064105Q", "DEXTAUS")],
    ("shape_ecb", ecb),
    ("shape_twse_mi_index", twse("exchangeReport/MI_INDEX")),
    ("shape_twse_taiex_month", twse("indicesReport/MI_5MINS_HIST")),
    ("shape_worldbank", worldbank),
    ("shape_x4_btc", x4_paging("btcusd")),
    ("shape_x4_eth", x4_paging("ethusd")),
    ("shape_c1_markets", crypto_global),
    ("shape_c3_global", paprika_global),
]

if __name__ == "__main__":
    run(PROBES, "shapes.json")
