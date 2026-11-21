"""Download the Estonian Tax and Customs Board (EMTA) company-level open data.

Source page: https://www.emta.ee/ariklient/amet-uudised-ja-kontakt/uudised-pressiinfo-statistika/statistika-ja-avaandmed
Licence: CC BY-SA 3.0, as listed for these datasets on the national portal andmed.eesti.ee.

Files (CSV links are taken from the page, so new share links are picked up):
  tasutud_maksud_kaesolev_aasta.csv     taxes paid, turnover, employees per quarter (current + previous year)
  tasutud_maksud_varasemad_aastad.csv   the same for older years
  maksuvolglaste_nimekiri.csv           legal persons with tax debt >= 100 EUR, refreshed daily

Writes research/.cache/baltics/ee/raw/emta/<file> plus <file>.hdr with the HTTP headers.
Usage: python -I research/probes/baltics/ee/fetch_emta.py
"""

import re
import time
import urllib.request
from pathlib import Path

PAGE = "https://www.emta.ee/ariklient/amet-uudised-ja-kontakt/uudised-pressiinfo-statistika/statistika-ja-avaandmed"
UA = "finora-research/0.1 (+public repo)"
WANT = ("tasutud_maksud_kaesolev_aasta.csv", "tasutud_maksud_varasemad_aastad.csv", "maksuvolglaste_nimekiri.csv")
OUT = Path(__file__).resolve().parents[4] / "research" / ".cache" / "baltics" / "ee" / "raw" / "emta"


def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=600)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    page = get(PAGE).read().decode("utf-8", "replace")
    for name in WANT:
        url = re.search(r'href="(https://ncfailid\.emta\.ee/[^"]+/download/' + re.escape(name) + ')"', page)[1]
        with get(url) as resp:
            (OUT / f"{name}.hdr").write_text(str(resp.headers))
            (OUT / name).write_bytes(resp.read())
        print(name, (OUT / name).stat().st_size)
        time.sleep(1)


if __name__ == "__main__":
    main()
