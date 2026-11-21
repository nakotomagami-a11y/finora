"""Probe on-chain sources: bitcoin supply from block height, oracle price feeds over public RPC.

python research/probes/markets/onchain.py

Bitcoin's supply is a pure function of block height (50 BTC halving every 210,000 blocks), so any
node or explorer that returns the tip height gives circulating supply without a licence question.
Oracle feeds are read with eth_call(latestRoundData) against public Ethereum RPC endpoints.
"""
import json

from common import age_hours, as_json, get, run, summarise
from prices_stocks import keyed

RPCS = {
    "publicnode": "https://ethereum-rpc.publicnode.com",
    "llamarpc": "https://eth.llamarpc.com",
}
# Ethereum mainnet proxy addresses of oracle price feeds (8 decimals).
FEEDS = {
    "btc_usd": "0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c",
    "eth_usd": "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
    "xau_usd": "0x214eD9Da11D2fbe465a6fc601a91E62EbEc1a0D6",
}
LATEST_ROUND_DATA = "0xfeaf968c"
DESCRIPTION = "0x7284e416"


def btc_supply(height):
    supply, subsidy, h = 0, 50 * 10**8, height + 1
    while h > 0 and subsidy > 0:
        blocks = min(h, 210_000)
        supply += blocks * subsidy
        h -= blocks
        subsidy //= 2
    return supply / 10**8


def mempool_height(probe_id):
    status, body, hdrs, s = get(probe_id, "https://mempool.space/api/blocks/tip/height")
    height = int(body) if status == 200 else None
    _, tb, _, _ = get(probe_id + "_tip", "https://mempool.space/api/blocks/tip/hash")
    _, blk, _, _ = get(probe_id + "_block", f"https://mempool.space/api/block/{tb.decode().strip()}")
    ts = as_json(blk).get("timestamp") if blk[:1] == b"{" else None
    return summarise(probe_id, "blocks/tip/height", status, body, hdrs, s, {
        "height": height, "supply_from_height_btc": round(btc_supply(height)) if height else None,
        "age_hours": age_hours(ts),
    })


def btc_rpc_height(probe_id):
    """Best block header over the public RPC: height and block time (the as-of) in two calls."""
    def call(method, params, suffix):
        payload = json.dumps({"jsonrpc": "1.0", "id": 1, "method": method, "params": params}).encode()
        return get(probe_id + suffix, "https://bitcoin-rpc.publicnode.com", headers={"Content-Type": "application/json"}, data=payload)
    status, body, hdrs, s = call("getbestblockhash", [], "")
    best = as_json(body).get("result") if status == 200 else None
    _, hb, _, _ = call("getblockheader", [best], "_header") if best else (None, b"{}", None, None)
    header = as_json(hb).get("result") or {}
    height = header.get("height")
    return summarise(probe_id, "public bitcoin rpc best block header", status, body, hdrs, s, {
        "height": height, "header_keys": sorted(header.keys()) or None, "age_hours": age_hours(header.get("time")),
        "supply_from_height_btc": round(btc_supply(height)) if height else None,
    })


def blockchain_totalbc(probe_id):
    status, body, hdrs, s = get(probe_id, "https://blockchain.info/q/totalbc")
    value = int(body) / 10**8 if status == 200 and body.strip().isdigit() else None
    return summarise(probe_id, "q/totalbc", status, body, hdrs, s, {"supply_btc": round(value) if value else None})


def rpc_call(probe_id, rpc, to, data):
    payload = json.dumps({"jsonrpc": "2.0", "id": 1, "method": "eth_call", "params": [{"to": to, "data": data}, "latest"]}).encode()
    return get(probe_id, rpc, headers={"Content-Type": "application/json"}, data=payload)


def feed(rpc_name, feed_name):
    def probe(probe_id):
        rpc, address = RPCS[rpc_name], FEEDS[feed_name]
        status, body, hdrs, s = rpc_call(probe_id, rpc, address, LATEST_ROUND_DATA)
        result = as_json(body).get("result") if status == 200 else None
        if not result or len(result) < 2 + 64 * 5:
            return summarise(probe_id, f"{rpc_name} eth_call {feed_name}", status, body, hdrs, s, note=str(body[:160]))
        words = [int(result[2 + i * 64: 2 + (i + 1) * 64], 16) for i in range(5)]
        _, db, _, _ = rpc_call(probe_id + "_desc", rpc, address, DESCRIPTION)
        raw = as_json(db).get("result", "0x")[2:]
        desc = bytes.fromhex(raw[128:]).rstrip(b"\0").decode("utf-8", "replace") if len(raw) > 128 else None
        return summarise(probe_id, f"{rpc_name} eth_call {feed_name}", status, body, hdrs, s, {
            "description": desc, "round_id": words[0], "age_hours": age_hours(words[3]),
        })
    return probe


def ultrasound(probe_id):
    status, body, hdrs, s = get(probe_id, "https://ultrasound.money/api/v2/fees/supply-parts")
    data = as_json(body) if status == 200 and body[:1] == b"{" else {}
    return summarise(probe_id, "fees/supply-parts", status, body, hdrs, s, {"fields": sorted(data.keys()) or None})


PROBES = [
    ("mempool_tip_height", mempool_height),
    ("publicnode_btc_height", btc_rpc_height),
    ("blockchain_totalbc", blockchain_totalbc),
    *[(f"feed_{r}_{f}", feed(r, f)) for r in RPCS for f in FEEDS],
    ("ultrasound_supply", ultrasound),
    ("etherscan_ethsupply", keyed("v2 stats ethsupply2", "https://api.etherscan.io/v2/api?chainid=1&module=stats&action=ethsupply2", "ETHERSCAN_API_KEY", param="apikey")),
]

if __name__ == "__main__":
    run(PROBES, "onchain.json")
