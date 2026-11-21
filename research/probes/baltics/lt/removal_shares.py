"""Removal share per refresh period for the LT sources (the input to maxPurgeShare), measured from the API change feed.

Usage: python -I research/probes/baltics/lt/removal_shares.py
For each get.data.gov.lt model: reads the newest change-log entries (Spinta `/:changes/<cid>`), groups them by load day,
and prints, for the newest load days, inserts, patches and deletes, plus the model's row count, so
removal share = deletes / rows. Prints aggregates only.
"""
import json
import sys
import urllib.request
from collections import Counter

BASE = "https://get.data.gov.lt/"
UA = "finora-research/0.1 (+public repo)"
MODELS = [
    "datasets/gov/rc/jar/fa_dokumentu_nepateike/Nepateikes",
    "datasets/gov/rc/jar/fa_veluojantys/VeluojantisPateikti",
    "datasets/gov/rc/jar/dokumentai/Dokumentas",
    "datasets/gov/rc/jar/balanso_ataskaitos/BalansoAtaskaita",
    "datasets/gov/rc/jar/pelno_ataskaitos/PelnoAtaskaita",
    "datasets/gov/vmi/mm_registras/MokesciuMoketojas",
    "datasets/gov/vmi/ja_mokesciai/Moketojas",
    "datasets/gov/vmi/ja_nepriemokos/NepriemokosSuma",
    "datasets/gov/avnt/imoniu_bankrotas/BankrotoAtaskaitosDatos",
    "datasets/gov/lsd/cl/ja_asmenys/JuridinisAsmuo",
]
WINDOW = 120000
sys.stdout.reconfigure(encoding="utf-8")


def get(path: str):
    req = urllib.request.Request(BASE + path, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=600) as resp:
        return json.load(resp)


for model in MODELS:
    name = model.rsplit("/", 1)[-1]
    try:
        rows = get(model + "?count()")["_data"][0]["count()"]
        last = get(model + "/:changes/-1")["_data"][0]["_cid"]
        changes = get(f"{model}/:changes/{max(last - WINDOW, 0)}?limit({WINDOW + 1})")["_data"]
    except Exception as err:  # noqa: BLE001 - report and continue
        print(f"{name}: error {err}")
        continue
    by_day = Counter((c["_created"][:10], c["_op"]) for c in changes)
    days = sorted({d for d, _ in by_day}, reverse=True)[:3]
    for day in days:
        ins, pat, dele = by_day[(day, "insert")], by_day[(day, "patch")], by_day[(day, "delete")]
        print(f"{name}: {day} insert {ins} patch {pat} delete {dele} of {rows} rows "
              f"(removal {100 * dele / max(rows, 1):.2f}%)")
