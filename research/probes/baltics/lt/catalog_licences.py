"""Read licence, stated update cadence and distributions from data.gov.lt dataset pages.

Usage: python -I catalog_licences.py <out.tsv> [--top N] <search term> [<search term> ...]
The catalogue answers HTTP 429 quickly, so requests are spaced 20 s apart with backoff.
For each dataset found by the searches it records: id, title, publisher, licence, update cadence,
last metadata update, and the distribution URLs (to spot direct publisher files).
"""
import html
import re
import sys
import time
import urllib.parse
import urllib.request

sys.stdout.reconfigure(encoding="utf-8")

UA = "finora-research/0.1 (+public repo)"
BASE = "https://data.gov.lt"


def get(url: str) -> str:
    for wait in (0, 60, 180, 400):
        time.sleep(wait or 20)
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=60) as resp:
                return resp.read().decode("utf-8", "replace")
        except urllib.error.HTTPError as err:
            if err.code != 429:
                raise
    raise RuntimeError("still rate limited: " + url)


def lines(page: str) -> list[str]:
    page = re.sub(r"<script.*?</script>|<style.*?</style>", "", page, flags=re.S)
    return [s.strip() for s in html.unescape(re.sub(r"<[^>]+>", "\n", page)).split("\n") if s.strip()]


def after(items: list[str], label: str) -> str:
    return items[items.index(label) + 1] if label in items else ""


out_path, terms = sys.argv[1], sys.argv[2:]
top = 1000
if terms[:1] == ["--top"]:
    top, terms = int(terms[1]), terms[2:]
seen: set[str] = set()
with open(out_path, "a", encoding="utf-8") as out:
    for term in terms:
        found = re.findall(r'href="/datasets/(\d+)/"', get(f"{BASE}/datasets/?q={urllib.parse.quote(term)}"))
        for ds in list(dict.fromkeys(found))[:top]:
            if ds in seen:
                continue
            seen.add(ds)
            page = get(f"{BASE}/datasets/{ds}/")
            items = lines(page)
            title = items[0].split("|", 1)[-1].strip() if items else ""
            dists = sorted(set(re.findall(r'https?://(?!data\.gov\.lt|creativecommons)[^"\s<>]+', page)) & set(
                u for u in re.findall(r'href="(https?://[^"]+)"', page)))
            row = [term, ds, title, after(items, "Duomenų skelbėjas:"), after(items, "Licencija"),
                   after(items, "Atnaujinama"), after(items, "Paskutinio metaduomenų atnaujinimo data"),
                   " ".join(u for u in dists if "registrucentras" in u or "sodra" in u or "Failai" in u)]
            out.write("\t".join(row) + "\n")
            out.flush()
            print(ds, "|", title[:70], "|", row[4], "|", row[5])
