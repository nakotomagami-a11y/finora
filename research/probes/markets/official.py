"""Probe official (government and central-bank) market and debt sources.

python research/probes/markets/official.py

Optional environment: FRED_API_KEY (free FRED account), EIA_API_KEY (free EIA registration),
SEC_USER_AGENT ("Name contact" as SEC fair access requires). Probes that need a missing variable
record "skipped: no key" instead of failing.
"""
import datetime as dt
import json
import re
import urllib.parse

from common import age_hours, as_json, env, get, now_utc, run, summarise

FRED_GONE = {"WILL5000INDFC", "GOLDAMGBD228NLBM"}
TREASURY = "https://api.fiscaldata.treasury.gov/services/api/fiscal_service"

FRED_SERIES = [
    # US equities
    "SP500", "NASDAQCOM", "NASDAQ100", "DJIA", "WILL5000INDFC",
    # Asia
    "NIKKEI225",
    # crypto (exchange-sourced series on FRED)
    "CBBTCUSD", "CBETHUSD",
    # oil (EIA spot) and gold
    "DCOILWTICO", "DCOILBRENTEU", "GOLDAMGBD228NLBM",
    # US debt (quarterly) and equity market value (Financial Accounts, quarterly)
    "GFDEBTN", "BOGZ1LM893064105Q", "NCBEILQ027S",
    # M09 proposals: 10-year Treasury yield, unemployment rate
    "DGS10", "UNRATE",
    # FX (H.10, local currency per USD)
    "DEXJPUS", "DEXKOUS", "DEXHKUS", "DEXCHUS", "DEXINUS", "DEXTAUS",
]


def treasury_debt(probe_id):
    base = f"{TREASURY}/v2/accounting/od/debt_to_penny"
    fields = "record_date,tot_pub_debt_out_amt,debt_held_public_amt,intragov_hold_amt"
    status, body, hdrs, s = get(probe_id, f"{base}?sort=-record_date&page%5Bsize%5D=1&fields={fields}")
    latest = as_json(body)
    _, body_first, _, _ = get(probe_id + "_first", f"{base}?sort=record_date&page%5Bsize%5D=1&fields=record_date")
    first = as_json(body_first)["data"][0]["record_date"]
    last = latest["data"][0]["record_date"]
    return summarise(probe_id, "debt_to_penny", status, body, hdrs, s, {
        "rows": latest["meta"]["total-count"], "first": first, "last": last, "age_hours": age_hours(last),
        "fields": list(latest["data"][0].keys()),
    })


def treasury_fx(probe_id):
    url = f"{TREASURY}/v1/accounting/od/rates_of_exchange?sort=-record_date&page%5Bsize%5D=200"
    status, body, hdrs, s = get(probe_id, url)
    data = as_json(body)
    rows = data["data"]
    return summarise(probe_id, "rates_of_exchange", status, body, hdrs, s, {
        "rows": data["meta"]["total-count"], "last": rows[0]["record_date"],
        "age_hours": age_hours(rows[0]["record_date"]), "fields": list(rows[0].keys()),
        "currencies_in_latest_page": len({r["country_currency_desc"] for r in rows}),
    })


def fred_csv(series):
    def probe(probe_id):
        status, body, hdrs, s = get(probe_id, f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={series}")
        if status != 200:
            return summarise(probe_id, f"fredgraph.csv {series}", status, body, hdrs, s)
        lines = body.decode("utf-8").strip().splitlines()[1:]
        values = [l.split(",") for l in lines if "," in l and l.split(",")[1] not in ("", ".")]
        first, last = (values[0][0], values[-1][0]) if values else (None, None)
        return summarise(probe_id, f"fredgraph.csv {series}", status, body, hdrs, s, {
            "rows": len(values), "first": first, "last": last, "age_hours": age_hours(last),
        })
    return probe


def fred_page(series):
    """The series page states per-series copyright; FRED's API terms defer to it."""
    def probe(probe_id):
        status, body, hdrs, s = get(probe_id, f"https://fred.stlouisfed.org/series/{series}")
        html = body.decode("utf-8", "replace")
        classes = sorted(set(re.findall(r"copyright-(public-domain|citation-required|pre-approval)", html)))
        return summarise(probe_id, f"series page {series}", status, body, hdrs, s, {"copyright_class": classes})
    return probe


def fred_api(probe_id):
    key = env("FRED_API_KEY")
    if not key:
        return {"probe": probe_id, "status": "skipped: no FRED_API_KEY"}
    url = f"https://api.stlouisfed.org/fred/series?series_id=SP500&api_key={key}&file_type=json"
    status, body, hdrs, s = get(probe_id, url)
    meta = as_json(body)["seriess"][0]
    return summarise(probe_id, "fred/series SP500", status, body, hdrs, s, {
        "notes_head": meta.get("notes", "")[:300], "last_updated": meta.get("last_updated"),
    })


def eia_api(probe_id):
    key = env("EIA_API_KEY")
    url = "https://api.eia.gov/v2/petroleum/pri/spt/data/?frequency=daily&data[0]=value&sort[0][column]=period&sort[0][direction]=desc&length=4"
    if not key:
        status, body, hdrs, s = get(probe_id, url)
        return summarise(probe_id, "eia v2 spot (no key)", status, body, hdrs, s, note="key required?")
    status, body, hdrs, s = get(probe_id, url + f"&api_key={key}")
    rows = as_json(body)["response"]["data"]
    return summarise(probe_id, "eia v2 spot", status, body, hdrs, s, {
        "last": rows[0]["period"], "age_hours": age_hours(rows[0]["period"]), "fields": list(rows[0].keys()),
    })


def eia_xls(series):
    def probe(probe_id):
        status, body, hdrs, s = get(probe_id, f"https://www.eia.gov/dnav/pet/hist_xls/{series}d.xls")
        return summarise(probe_id, f"hist_xls {series} (no key)", status, body, hdrs, s, {
            "last_modified": hdrs.get("Last-Modified"), "content_type": hdrs.get("Content-Type"),
        })
    return probe


def worldbank_pinksheet(probe_id):
    page = "https://www.worldbank.org/en/research/commodity-markets"
    status, body, hdrs, s = get(probe_id, page)
    links = sorted(set(re.findall(r'https://[^"\']+CMO-Historical-Data-Monthly\.xlsx', body.decode("utf-8", "replace"))))
    out = summarise(probe_id, "commodity-markets page", status, body, hdrs, s, {"xlsx_links": links[:3]})
    if links:
        st2, b2, h2, s2 = get(probe_id + "_xlsx", links[0])
        out.update(xlsx_status=st2, xlsx_bytes=len(b2), xlsx_last_modified=h2.get("Last-Modified"))
    return out


def twse(probe_id):
    status, body, hdrs, s = get(probe_id, "https://openapi.twse.com.tw/v1/exchangeReport/MI_INDEX", strict_tls=False)
    rows = as_json(body) if status == 200 else []
    return summarise(probe_id, "twse MI_INDEX", status, body, hdrs, s, {
        "rows": len(rows), "fields": list(rows[0].keys()) if rows else None,
        "last": rows[0].get("日期") if rows else None,
    })


def twse_taiex_month(probe_id):
    """TAIEX daily OHLC; the OpenAPI returns the current month only (dates in ROC calendar, year - 1911)."""
    status, body, hdrs, s = get(probe_id, "https://openapi.twse.com.tw/v1/indicesReport/MI_5MINS_HIST", strict_tls=False)
    rows = as_json(body) if status == 200 else []
    return summarise(probe_id, "twse MI_5MINS_HIST", status, body, hdrs, s, {
        "rows": len(rows), "fields": list(rows[0].keys()) if rows else None,
        "first": rows[0]["Date"] if rows else None, "last": rows[-1]["Date"] if rows else None,
    })


def twse_swagger(probe_id):
    status, body, hdrs, s = get(probe_id, "https://openapi.twse.com.tw/v1/swagger.json", strict_tls=False)
    paths = as_json(body).get("paths", {}) if status == 200 else {}
    cap = [p for p, v in paths.items() if "市值" in json_text(v)]
    return summarise(probe_id, "twse swagger", status, body, hdrs, s, {"endpoints": len(paths), "market_value_endpoints": cap[:10]})


def json_text(value):
    return json.dumps(value, ensure_ascii=False)


def krx(probe_id):
    yesterday = (now_utc() - dt.timedelta(days=1)).strftime("%Y%m%d")
    status, body, hdrs, s = get(probe_id, f"https://data-dbg.krx.co.kr/svc/apis/idx/kospi_dd_trd?basDd={yesterday}")
    return summarise(probe_id, "krx open api kospi_dd_trd (no key)", status, body, hdrs, s)


def ecb_fx(probe_id):
    url = "https://data-api.ecb.europa.eu/service/data/EXR/D.USD+JPY+KRW+HKD+CNY+INR+TWD.EUR.SP00.A?lastNObservations=3&format=csvdata"
    status, body, hdrs, s = get(probe_id, url)
    lines = body.decode("utf-8", "replace").strip().splitlines()
    header = lines[0].split(",") if lines else []
    idx = header.index("TIME_PERIOD") if "TIME_PERIOD" in header else None
    last = max(l.split(",")[idx] for l in lines[1:]) if idx is not None and len(lines) > 1 else None
    currencies = {l.split(",")[header.index("CURRENCY")] for l in lines[1:]} if "CURRENCY" in header else set()
    return summarise(probe_id, "ecb EXR daily", status, body, hdrs, s, {
        "rows": len(lines) - 1, "last": last, "age_hours": age_hours(last), "currencies": sorted(currencies),
    })


def sec_frames(probe_id):
    ua = env("SEC_USER_AGENT")
    if not ua:
        return {"probe": probe_id, "status": "skipped: no SEC_USER_AGENT"}
    url = "https://data.sec.gov/api/xbrl/frames/dei/EntityCommonStockSharesOutstanding/shares/CY2026Q2I.json"
    status, body, hdrs, s = get(probe_id, url, headers={"User-Agent": ua})
    data = as_json(body)
    return summarise(probe_id, "xbrl frames shares outstanding", status, body, hdrs, s, {
        "rows": len(data.get("data", [])), "fields": list(data["data"][0].keys()) if data.get("data") else None,
    })


def firds_shares(mic):
    """ESMA FIRDS reference data: shares (CFI ES*) admitted on a venue and not terminated.

    FIRDS keeps every version of a record; only latest_received_flag=1 is current. Superseded versions
    carry valid_to_date and would double-count a listing."""
    def probe(probe_id):
        q = urllib.parse.urlencode([("q", "*:*"), ("fq", f"mic:{mic}"), ("fq", "gnr_cfi_code:ES*"), ("fq", "type_s:parent"),
                                    ("fq", "-mrkt_trdng_trmination_date:*"), ("fq", "latest_received_flag:1"),
                                    ("rows", "500"), ("wt", "json")])
        status, body, hdrs, s = get(probe_id, f"https://registers.esma.europa.eu/solr/esma_registers_firds/select?{q}")
        resp = as_json(body)["response"]
        docs = resp["docs"]
        return summarise(probe_id, f"firds shares on {mic}", status, body, hdrs, s, {
            "rows": resp["numFound"], "with_lei": sum(1 for d in docs if d.get("lei")),
            "with_isin": sum(1 for d in docs if d.get("isin")), "distinct_isin": len({d.get("isin") for d in docs}),
        })
    return probe


PROBES = [
    ("treasury_debt_to_penny", treasury_debt),
    ("treasury_rates_of_exchange", treasury_fx),
    *[(f"fred_csv_{s}", fred_csv(s)) for s in FRED_SERIES],
    *[(f"fred_page_{s}", fred_page(s)) for s in FRED_SERIES if s not in FRED_GONE],
    ("fred_api_series", fred_api),
    ("eia_api_spot", eia_api),
    ("eia_xls_wti", eia_xls("RWTC")),
    ("eia_xls_brent", eia_xls("RBRTE")),
    ("worldbank_pinksheet", worldbank_pinksheet),
    ("twse_mi_index", twse),
    ("twse_taiex_month", twse_taiex_month),
    ("twse_swagger", twse_swagger),
    ("krx_open_api", krx),
    ("ecb_fx", ecb_fx),
    ("sec_frames_shares", sec_frames),
    *[(f"firds_shares_{m}", firds_shares(m)) for m in ("XRIS", "XTAL", "XLIT", "FNLV", "FNEE", "FNLT")],
]

if __name__ == "__main__":
    run(PROBES, "official.json")
