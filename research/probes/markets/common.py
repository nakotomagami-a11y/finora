"""Shared helpers for the market-data probes.

Every probe writes the raw response to research/.cache/markets/raw/ (gitignored) and returns a
summary that holds only shape and timing: HTTP status, latency, row counts, field names, first and
last observation dates and rate-limit headers. Summaries never carry prices, so they are safe to
quote in docs/research/markets.md. Raw responses must never be committed.
"""
import datetime as dt
import json
import os
import pathlib
import ssl
import sys
import time
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[2]
CACHE = ROOT / ".cache" / "markets"
RAW = CACHE / "raw"
UA = "finora-research-probe/0.1 (open-source; market data research)"
RATE_HEADERS = ("ratelimit", "rate-limit", "retry-after", "x-cg-", "x-api-", "cache-control", "age", "last-modified")


def now_utc():
    return dt.datetime.now(dt.UTC)


def env(name):
    value = os.environ.get(name, "").strip()
    return value or None


def lenient_tls():
    """Python 3.13+ rejects some valid exchange certificates under VERIFY_X509_STRICT; keep full chain checks."""
    ctx = ssl.create_default_context()
    ctx.verify_flags &= ~ssl.VERIFY_X509_STRICT
    return ctx


def get(probe_id, url, headers=None, data=None, timeout=30, strict_tls=True):
    """GET (or POST when data is given). Returns (status, body bytes, headers dict, seconds)."""
    req = urllib.request.Request(url, data=data, headers={"User-Agent": UA, "Accept": "*/*", **(headers or {})})
    started = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=None if strict_tls else lenient_tls()) as r:
            status, body, hdrs = r.status, r.read(), dict(r.headers)
    except urllib.error.HTTPError as e:
        status, body, hdrs = e.code, e.read(), dict(e.headers or {})
    except Exception as e:  # network errors are findings too
        return None, f"{type(e).__name__}: {e}".encode(), {}, time.perf_counter() - started
    seconds = time.perf_counter() - started
    RAW.mkdir(parents=True, exist_ok=True)
    (RAW / f"{probe_id}.bin").write_bytes(body)
    return status, body, hdrs, seconds


def rate_headers(hdrs):
    return {k: v for k, v in hdrs.items() if any(m in k.lower() for m in RATE_HEADERS)}


def iso_day(value):
    """Normalise epoch seconds/ms or date strings to YYYY-MM-DD."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        seconds = value / 1000 if value > 1e11 else value
        return dt.datetime.fromtimestamp(seconds, dt.UTC).date().isoformat()
    return str(value)[:10]


def age_hours(last, now=None):
    """Hours between an observation timestamp and now; None if unknown."""
    if last is None:
        return None
    now = now or now_utc()
    if isinstance(last, (int, float)):
        seconds = last / 1000 if last > 1e11 else last
        moment = dt.datetime.fromtimestamp(seconds, dt.UTC)
    else:
        text = str(last).replace("Z", "+00:00")
        moment = dt.datetime.fromisoformat(text if "T" in text or " " in text else text + "T00:00:00+00:00")
        if moment.tzinfo is None:
            moment = moment.replace(tzinfo=dt.UTC)
    return round((now - moment).total_seconds() / 3600, 1)


def summarise(probe_id, url_label, status, body, hdrs, seconds, shape=None, note=None):
    out = {
        "probe": probe_id,
        "endpoint": url_label,
        "status": status,
        "ms": round(seconds * 1000),
        "bytes": len(body or b""),
        "rate_headers": rate_headers(hdrs),
        "checked_at": now_utc().isoformat(timespec="seconds"),
    }
    if shape:
        out.update(shape)
    if note:
        out["note"] = note
    if status is None or status >= 400:
        out["error_snippet"] = (body or b"")[:200].decode("utf-8", "replace")
    return out


def run(probes, outfile):
    """Run (probe_id, fn) pairs; each fn returns a summary dict. Writes all summaries to the cache."""
    sys.stdout.reconfigure(encoding="utf-8")
    results = []
    for probe_id, fn in probes:
        try:
            result = fn(probe_id)
        except Exception as e:
            result = {"probe": probe_id, "status": "probe-error", "error": f"{type(e).__name__}: {e}"}
        results.append(result)
        flag = result.get("status")
        print(f"{probe_id:<28} {str(flag):<12} rows={result.get('rows', '-')!s:<8} "
              f"first={result.get('first', '-')} last={result.get('last', '-')} "
              f"age_h={result.get('age_hours', '-')} ms={result.get('ms', '-')}", flush=True)
        time.sleep(1.2)
    CACHE.mkdir(parents=True, exist_ok=True)
    (CACHE / outfile).write_text(json.dumps(results, indent=1), encoding="utf-8")
    return results


def as_json(body):
    return json.loads(body.decode("utf-8"))
