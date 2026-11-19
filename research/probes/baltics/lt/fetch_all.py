"""Download every Lithuanian file the LT research uses into research/.cache/baltics/lt/raw/ (about 1.7 GB).

Usage: python -I research/probes/baltics/lt/fetch_all.py
Re-running overwrites the files with today's versions. Run this first from a clean checkout; build_profiles.py,
round2.py and diff_pulls.py read what it writes.
"""
import io
import runpy
import sys
import time
import urllib.request
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))  # python -I does not put the script's folder on the path
from fetch_uapi import CACHE, UA, fetch  # noqa: E402

REGISTER_FILES = ["JAR_IREGISTRUOTI", "JAR_ISREGISTRUOTI", "JAR_VALDYMAS", "JAR_KAPITALAS", "JAR_NVO"]
SODRA_ZIPS = {
    "Apdraustuju_skaicius": "https://sodra.lt/Failai/Apdraustuju_skaicius.zip",
    "Skolos": "https://sodra.lt/Failai/Skolos.zip",
    "Vidurkiai": "https://sodra.lt/Failai/Vidurkiai.zip",
    "m2026": "https://atvira.sodra.lt/imones/downloads/2026/monthly-2026.csv.zip",
}
J = "datasets/gov/rc/jar/"
STATEMENT_QUERY = ('select(juridinis_asmuo,template_id,standard_id,line_type_id,line_name,reiksme,laikotarpis_nuo,'
                   'laikotarpis_iki,reg_date)&laikotarpis_iki>="2024-01-01"')
API_MODELS = [
    (J + "iregistruoti/JuridinisAsmuo", "", None),
    (J + "valdymo_organai/ValdymoOrganas", "", None),
    (J + "buveines/Buveine", "", None),
    (J + "ja_kapitalas/JuridinisAsmuoKapitalas", "", None),
    (J + "fa_dokumentu_nepateike/Nepateikes", "", None),
    (J + "fa_veluojantys/VeluojantisPateikti", "", None),
    (J + "dokumentai/Dokumentas", "", None),
    (J + "formos_statusai/Forma", "", None),
    (J + "formos_statusai/Statusas", "", None),
    (J + "kiti_atributai/Pareigos", "", None),
    (J + "kiti_atributai/IsregistravimoPriezastis", "", None),
    (J + "dokumentu_tipai_potipiai/DokumentoTipas", "", None),
    (J + "dokumentu_tipai_potipiai/DokumentoPotipis", "", None),
    (J + "pelno_ataskaitos/PelnoAtaskaita", STATEMENT_QUERY, "PelnoAtaskaita_2024plus"),
    (J + "balanso_ataskaitos/BalansoAtaskaita", STATEMENT_QUERY, "BalansoAtaskaita_2024plus"),
    ("datasets/gov/rc/jadis/dalyviai/Dalyvis", "", None),
    ("datasets/gov/vmi/mm_registras/MokesciuMoketojas", "", None),
    ("datasets/gov/vmi/ja_mokesciai/Moketojas", "", None),
    ("datasets/gov/vmi/ja_nepriemokos/NepriemokosSuma", "", None),
    ("datasets/gov/avnt/imoniu_bankrotas/BankrotoAtaskaitosDatos", "", None),
    ("datasets/gov/avnt/tyciniai_bankrotai/TycinisBankrotas", "", None),
    ("datasets/gov/finmin/sutartys/Contract", "", None),
    ("datasets/gov/vpt/new/Atn1TendererList", "", None),
]


def get(url: str) -> bytes:
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=1800) as resp:
        return resp.read()


def main() -> None:
    (CACHE / "rc").mkdir(parents=True, exist_ok=True)
    for name in REGISTER_FILES:
        body = get(f"https://www.registrucentras.lt/aduomenys/?byla={name}.csv")
        (CACHE / "rc" / f"{name}.csv").write_bytes(body)
        print(f"{name}.csv: {len(body)} bytes")
        time.sleep(2)
    for folder, url in SODRA_ZIPS.items():
        target = CACHE / "sodra" / folder
        target.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(io.BytesIO(get(url))) as archive:
            for member in archive.namelist():
                if "/" in member or "\\" in member or member.startswith("."):
                    raise ValueError(f"unexpected path in archive: {member}")
            archive.extractall(target)
        print(f"sodra/{folder}: {', '.join(p.name for p in target.iterdir())}")
    for model, query, out in API_MODELS:
        fetch(model, query, out)
        time.sleep(2)
    runpy.run_path(str(HERE / "fetch_gleif_lt.py"), run_name="__main__")


if __name__ == "__main__":
    main()
