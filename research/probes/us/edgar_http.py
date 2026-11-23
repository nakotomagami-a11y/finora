"""Polite, cached HTTP for SEC EDGAR probes.

SEC asks for a User-Agent with a contact and at most 10 requests per second.
The contact is read from SEC_USER_AGENT and never stored in the repo.
"""
import gzip
import hashlib
import json
import os
import pathlib
import sys
import time
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[3]
CACHE = ROOT / "research" / ".cache" / "us" / "edgar" / "http"
MIN_INTERVAL = 0.2
_last = [0.0]


def user_agent():
    ua = os.environ.get("SEC_USER_AGENT", "").strip()
    if "@" not in ua:
        sys.exit("set SEC_USER_AGENT to '<org or name> <contact email>'")
    return ua


def _cache_path(url):
    return CACHE / hashlib.sha256(url.encode()).hexdigest()[:32]


def fetch(url, *, cache=True, retries=3):
    """Return (status, bytes). 404s are cached as empty bodies."""
    path = _cache_path(url)
    if cache and path.exists():
        meta = json.loads(path.with_suffix(".json").read_text())
        return meta["status"], path.read_bytes()
    for attempt in range(retries):
        wait = MIN_INTERVAL - (time.monotonic() - _last[0])
        if wait > 0:
            time.sleep(wait)
        _last[0] = time.monotonic()
        req = urllib.request.Request(
            url, headers={"User-Agent": user_agent(), "Accept-Encoding": "gzip, deflate"}
        )
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                body, status = resp.read(), resp.status
                if resp.headers.get("Content-Encoding") == "gzip":
                    body = gzip.decompress(body)
        except urllib.error.HTTPError as err:
            if err.code in (429, 503) and attempt < retries - 1:
                time.sleep(5 * (attempt + 1))
                continue
            body, status = b"", err.code
        break
    if cache and status in (200, 404):
        CACHE.mkdir(parents=True, exist_ok=True)
        path.write_bytes(body)
        path.with_suffix(".json").write_text(json.dumps({"url": url, "status": status}))
    return status, body


def fetch_json(url, **kw):
    status, body = fetch(url, **kw)
    return json.loads(body) if status == 200 and body else None


def head(url):
    req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": user_agent()})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return {
            "status": resp.status,
            "bytes": int(resp.headers.get("Content-Length") or 0),
            "last_modified": resp.headers.get("Last-Modified"),
        }
