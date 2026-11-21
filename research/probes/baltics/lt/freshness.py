"""Measure freshness of every model under the given get.data.gov.lt namespaces.

Usage: python -I freshness.py <out.tsv> <namespace> [<namespace> ...]   e.g. datasets/gov/rc/jar
For each model: HTTP Last-Modified, and the timestamp of the newest change-log entry (/:changes/-1),
which is when the publisher last loaded data. Age in days is measured against today (UTC).
"""
import json
import sys
import time
import urllib.request
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

BASE = "https://get.data.gov.lt/"
UA = "finora-research/0.1 (+public repo)"


def get(path: str):
    req = urllib.request.Request(BASE + path, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        return resp.headers.get("Last-Modified", ""), json.load(resp)


def models(ns: str) -> list[str]:
    found = []
    try:
        items = get(ns + "/:ns")[1]["_data"]
    except Exception as err:  # noqa: BLE001 - some namespaces answer 500; record them
        return [ns + f" (namespace error {err})"]
    for item in items:
        name = item["name"]
        found.extend(models(name[: -len("/:ns")]) if name.endswith("/:ns") else [name])
        time.sleep(0.5)
    return found


now = datetime.now(timezone.utc)
with open(sys.argv[1], "w", encoding="utf-8") as out:
    out.write("model\tlast_modified\tlast_change\tage_days\n")
    for ns in sys.argv[2:]:
        for model in models(ns):
            try:
                if "namespace error" in model:
                    raise RuntimeError("namespace listing failed")
                modified, body = get(model + "/:changes/-1")
                change = body["_data"][0]["_created"] if body.get("_data") else ""
            except Exception as err:  # noqa: BLE001 - record and continue
                modified, change = "", f"error {err}"
            ref = change if change and not change.startswith("error") else ""
            age = ""
            if ref:
                age = (now - datetime.fromisoformat(ref).replace(tzinfo=timezone.utc)).days
            elif modified:
                age = (now - parsedate_to_datetime(modified)).days
            out.write(f"{model}\t{modified}\t{change}\t{age}\n")
            time.sleep(0.5)
print("done")
