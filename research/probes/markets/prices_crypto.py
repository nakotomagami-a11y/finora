"""Probe crypto aggregators and exchange public market-data APIs.

python research/probes/markets/prices_crypto.py
"""
from common import age_hours, as_json, env, get, iso_day, run, summarise
from prices_stocks import keyed, series_shape


def json_probe(label, url, extract, headers=None):
    """extract(data) -> dict with times (list) and optional extra fields."""
    def probe(probe_id):
        status, body, hdrs, s = get(probe_id, url, headers=headers)
        if status != 200:
            return summarise(probe_id, label, status, body, hdrs, s)
        out = extract(as_json(body))
        times = out.pop("times", None)
        shape = series_shape(times, out.pop("fields", None), out) if times is not None else out
        if shape.get("last"):
            shape.setdefault("age_hours", age_hours(shape["last"]))
        return summarise(probe_id, label, status, body, hdrs, s, shape)
    return probe


def cg_headers():
    key = env("COINGECKO_DEMO_API_KEY")
    return {"x-cg-demo-api-key": key} if key else None


def cg_global(d):
    g = d["data"]
    return {"fields": sorted(g.keys()), "age_hours": age_hours(g["updated_at"]), "coins": g.get("active_cryptocurrencies")}


def cg_chart(d):
    return {"times": [p[0] for p in d["prices"]], "fields": sorted(d.keys())}


def paprika_global(d):
    return {"fields": sorted(d.keys()), "age_hours": age_hours(d.get("last_updated"))}


def paprika_hist(d):
    if isinstance(d, dict):
        return {"message": str(d)[:200]}
    return {"times": [r["timestamp"] for r in d], "fields": sorted(d[0].keys()) if d else None}


def coincap(d):
    return {"times": [r["time"] for r in d.get("data", [])]}


def cryptocompare(d):
    rows = d.get("Data", {}).get("Data", []) if isinstance(d.get("Data"), dict) else []
    return {"times": [r["time"] for r in rows if r.get("close")], "message": d.get("Message", "")[:160]}


def llama_current(d):
    coin = d["coins"].get("coingecko:bitcoin", {})
    return {"fields": sorted(coin.keys()), "age_hours": age_hours(coin.get("timestamp"))}


def llama_chart(d):
    pts = d["coins"].get("coingecko:bitcoin", {}).get("prices", [])
    return {"times": [p["timestamp"] for p in pts]}


def coinbase(d):
    return {"times": [c[0] for c in d], "fields": ["time", "low", "high", "open", "close", "volume"]}


def kraken(d):
    rows = next((v for k, v in d.get("result", {}).items() if k != "last"), [])
    return {"times": [r[0] for r in rows], "errors": d.get("error")}


def binance(d):
    return {"times": [r[0] for r in d]}


def bitstamp(d):
    rows = d.get("data", {}).get("ohlc", [])
    return {"times": [int(r["timestamp"]) for r in rows]}


CG = "https://api.coingecko.com/api/v3"

PROBES = [
    ("coingecko_global", json_probe("global", f"{CG}/global", cg_global, cg_headers())),
    ("coingecko_btc_max", json_probe("market_chart btc days=max", f"{CG}/coins/bitcoin/market_chart?vs_currency=usd&days=max", cg_chart, cg_headers())),
    ("coingecko_btc_365", json_probe("market_chart btc days=365", f"{CG}/coins/bitcoin/market_chart?vs_currency=usd&days=365", cg_chart, cg_headers())),
    ("coingecko_global_chart", json_probe("global market_cap_chart", f"{CG}/global/market_cap_chart?days=365", lambda d: {"times": [p[0] for p in d.get("market_cap_chart", {}).get("market_cap", [])]}, cg_headers())),
    ("coinpaprika_global", json_probe("global", "https://api.coinpaprika.com/v1/global", paprika_global)),
    ("coinpaprika_btc_hist", json_probe("tickers historical btc 1d", "https://api.coinpaprika.com/v1/tickers/btc-bitcoin/historical?start=2025-01-01&interval=1d", paprika_hist)),
    ("coincap_v2", json_probe("v2 history", "https://api.coincap.io/v2/assets/bitcoin/history?interval=d1", coincap)),
    ("coincap_v3", keyed("v3 assets", "https://rest.coincap.io/v3/assets/bitcoin", "COINCAP_API_KEY", param="apiKey")),
    ("coinmarketcap_global", keyed("global-metrics latest", "https://pro-api.coinmarketcap.com/v1/global-metrics/quotes/latest", "COINMARKETCAP_API_KEY", header="X-CMC_PRO_API_KEY")),
    ("cryptocompare_histoday", json_probe("histoday btc limit=2000", "https://min-api.cryptocompare.com/data/v2/histoday?fsym=BTC&tsym=USD&limit=2000", cryptocompare)),
    ("defillama_current", json_probe("prices current btc", "https://coins.llama.fi/prices/current/coingecko:bitcoin", llama_current)),
    ("defillama_chart", json_probe("chart btc 1d x 500", "https://coins.llama.fi/chart/coingecko:bitcoin?start=1700000000&span=500&period=1d", llama_chart)),
    ("coinbase_candles", json_probe("exchange candles btc-usd 1d", "https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=86400", coinbase)),
    ("kraken_ohlc", json_probe("public OHLC xbtusd 1d", "https://api.kraken.com/0/public/OHLC?pair=XBTUSD&interval=1440", kraken)),
    ("binance_klines", json_probe("klines btcusdt 1d x1000", "https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=1000", binance)),
    ("bitstamp_ohlc", json_probe("ohlc btcusd 1d x1000", "https://www.bitstamp.net/api/v2/ohlc/btcusd/?step=86400&limit=1000", bitstamp)),
]

if __name__ == "__main__":
    run(PROBES, "prices_crypto.json")
