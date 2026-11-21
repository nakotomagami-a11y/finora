"""Probe commercial stock, index, commodity and FX price APIs.

python research/probes/markets/prices_stocks.py

Each provider is called only where its free or demo access allows it. Providers that need an account
are probed with the key from the environment if set, otherwise unauthenticated so the response
records what the provider says (usually 401/403). Keys are read from the environment and never written
anywhere: the raw responses in research/.cache/ hold no request URLs.

Not probed here on purpose: an unofficial keyless chart endpoint and a CSV download site. Both were
called once on 2026-11-19 to record shape and latency (see docs/research/markets.md), then dropped:
the first's terms bar automated access, the second now sits behind a browser check.

Single-stock probes need PROBE_STOCK_SYMBOL (a US ticker, no default): the repo names no real company.
Demo keys only answer for each provider's own sample symbols; they are listed in the maintainer's
private notes. Without the variable those probes record "skipped".
"""
import urllib.parse

from common import age_hours, as_json, env, get, iso_day, run, summarise


def series_shape(times, fields=None, extra=None):
    days = [iso_day(t) for t in times if t is not None]
    shape = {"rows": len(days)}
    if days:
        first, last = min(days), max(days)
        shape.update(first=first, last=last)
    if fields:
        shape["fields"] = fields
    shape.update(extra or {})
    return shape


def alphavantage(function, symbol=None, outputsize="full"):
    def probe(probe_id):
        key = env("ALPHAVANTAGE_API_KEY") or "demo"
        q = {"function": function, "apikey": key, "datatype": "json"}
        if symbol:
            q.update(symbol=symbol, outputsize=outputsize)
        status, body, hdrs, s = get(probe_id, "https://www.alphavantage.co/query?" + urllib.parse.urlencode(q))
        data = as_json(body)
        series_key = next((k for k in data if "Time Series" in k), None)
        if series_key:
            times = list(data[series_key].keys())
            shape = series_shape(times, list(next(iter(data[series_key].values())).keys()))
        elif isinstance(data.get("data"), list):
            shape = series_shape([r["date"] for r in data["data"] if r.get("value") not in (None, ".")])
        else:
            shape = {"message": str(data)[:200]}
        shape["key"] = "own" if key != "demo" else "demo"
        if shape.get("last"):
            shape["age_hours"] = age_hours(shape["last"])
        return summarise(probe_id, f"{function} {symbol or ''}".strip(), status, body, hdrs, s, shape)
    return probe


def twelvedata(symbol):
    def probe(probe_id):
        key = env("TWELVEDATA_API_KEY") or "demo"
        q = {"symbol": symbol, "interval": "1day", "outputsize": 5000, "apikey": key}
        status, body, hdrs, s = get(probe_id, "https://api.twelvedata.com/time_series?" + urllib.parse.urlencode(q))
        data = as_json(body)
        if data.get("status") == "ok":
            shape = series_shape([v["datetime"] for v in data["values"]], list(data["values"][0].keys()))
            shape["age_hours"] = age_hours(shape["last"])
        else:
            shape = {"message": str(data.get("message"))[:200]}
        shape["key"] = "own" if key != "demo" else "demo"
        return summarise(probe_id, f"time_series {symbol}", status, body, hdrs, s, shape)
    return probe


def fmp(symbol):
    def probe(probe_id):
        key = env("FMP_API_KEY") or "demo"
        url = f"https://financialmodelingprep.com/stable/historical-price-eod/light?symbol={urllib.parse.quote(symbol)}&apikey={key}"
        status, body, hdrs, s = get(probe_id, url)
        data = as_json(body) if body[:1] in (b"[", b"{") else None
        if isinstance(data, list) and data:
            shape = series_shape([r["date"] for r in data], list(data[0].keys()))
            shape["age_hours"] = age_hours(shape["last"])
        else:
            shape = {"message": str(data)[:200] if data is not None else body[:160].decode("utf-8", "replace")}
        shape["key"] = "own" if key != "demo" else "demo"
        return summarise(probe_id, f"historical-price-eod {symbol}", status, body, hdrs, s, shape)
    return probe


def eodhd(symbol):
    def probe(probe_id):
        key = env("EODHD_API_KEY") or "demo"
        url = f"https://eodhd.com/api/eod/{urllib.parse.quote(symbol)}?api_token={key}&fmt=json"
        status, body, hdrs, s = get(probe_id, url)
        data = as_json(body) if body[:1] in (b"[", b"{") else None
        if isinstance(data, list) and data:
            shape = series_shape([r["date"] for r in data], list(data[0].keys()))
            shape["age_hours"] = age_hours(shape["last"])
        else:
            shape = {"message": (str(data) if data is not None else body.decode("utf-8", "replace"))[:200]}
        shape["key"] = "own" if key != "demo" else "demo"
        return summarise(probe_id, f"eod {symbol}", status, body, hdrs, s, shape)
    return probe


def with_symbol(make):
    """Build the probe at run time from PROBE_STOCK_SYMBOL; skip when it is not set."""
    def probe(probe_id):
        symbol = env("PROBE_STOCK_SYMBOL")
        if not symbol:
            return {"probe": probe_id, "status": "skipped: no PROBE_STOCK_SYMBOL"}
        return make(symbol)(probe_id)
    return probe


def keyed(label, url, env_name, param=None, header=None):
    """Providers with no demo access: call with the user's key if present, else record the refusal.
    A "{symbol}" in the URL is filled from PROBE_STOCK_SYMBOL."""
    def probe(probe_id):
        key = env(env_name)
        if "{symbol}" in url:
            symbol = env("PROBE_STOCK_SYMBOL")
            if not symbol:
                return {"probe": probe_id, "status": "skipped: no PROBE_STOCK_SYMBOL"}
        full, headers = url.replace("{symbol}", urllib.parse.quote(symbol)) if "{symbol}" in url else url, {}
        if key and param:
            full += ("&" if "?" in url else "?") + f"{param}={key}"
        if key and header:
            headers[header] = key
        status, body, hdrs, s = get(probe_id, full, headers=headers)
        return summarise(probe_id, label, status, body, hdrs, s, {"key": "own" if key else "none"})
    return probe


PROBES = [
    ("alphavantage_daily_demo", with_symbol(lambda sym: alphavantage("TIME_SERIES_DAILY", sym))),
    ("alphavantage_index_spx", alphavantage("TIME_SERIES_DAILY", "SPX", "compact")),
    ("alphavantage_wti", alphavantage("WTI")),
    ("twelvedata_stock_demo", with_symbol(twelvedata)),
    ("twelvedata_spx", twelvedata("SPX")),
    ("fmp_stock_demo", with_symbol(fmp)),
    ("fmp_gspc", fmp("^GSPC")),
    ("eodhd_stock_demo", with_symbol(lambda sym: eodhd(sym if "." in sym else f"{sym}.US"))),
    ("eodhd_gspc", eodhd("GSPC.INDX")),
    ("finnhub_quote", keyed("quote", "https://finnhub.io/api/v1/quote?symbol={symbol}", "FINNHUB_API_KEY", param="token")),
    ("polygon_aggs", keyed("aggs prev", "https://api.polygon.io/v2/aggs/ticker/{symbol}/prev", "POLYGON_API_KEY", param="apiKey")),
    ("tiingo_daily", keyed("daily prices", "https://api.tiingo.com/tiingo/daily/{symbol}/prices", "TIINGO_API_KEY", param="token")),
    ("marketstack_eod", keyed("eod latest", "https://api.marketstack.com/v2/eod/latest?symbols={symbol}", "MARKETSTACK_API_KEY", param="access_key")),
    ("nasdaqdatalink", keyed("datatable", "https://data.nasdaq.com/api/v3/datatables/QDL/BCHAIN.json?code=MKPRU", "NASDAQ_DATA_LINK_API_KEY", param="api_key")),
    ("alpaca_bars", keyed("stock bars", "https://data.alpaca.markets/v2/stocks/bars?symbols={symbol}&timeframe=1Day", "ALPACA_API_KEY", header="APCA-API-KEY-ID")),
]

if __name__ == "__main__":
    run(PROBES, "prices_stocks.json")
