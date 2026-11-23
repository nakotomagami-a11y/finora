"""Probe the FJC Integrated Database (IDB) tab-delimited bulk files.

Downloads a cumulative IDB text file into research/.cache/us/fjc_idb/ and reports
columns, row count, date range, and how often party-name fields are filled.

    python -I research/probes/us/fjc_idb.py civil
    python -I research/probes/us/fjc_idb.py bankruptcy
"""

import collections
import csv
import io
import pathlib
import re
import subprocess
import sys
import urllib.request
import zipfile

UA = "Finora research (open-source; github.com/nakotomagami-a11y/finora)"
BASE = "https://www.fjc.gov/sites/default/files/idb/textfiles/"
SETS = {
    "civil": ("cv88on.zip", "FILEDATE", ["PLT", "DEF"]),
    "criminal": ("cr96on.zip", "FILEDATE", []),
    "appeals": ("ap08on_0.zip", "FILEDATE", []),
    "bankruptcy": ("cpbank18on.zip", "FILEDATE", []),
}
CACHE = pathlib.Path(__file__).resolve().parents[2] / ".cache" / "us" / "fjc_idb"
ORG = re.compile(r"\b(INC|LLC|L\.L\.C|CORP|CORPORATION|CO|COMPANY|LTD|LP|LLP|BANK|N\.A)\b\.?", re.I)


def download(name):
    CACHE.mkdir(parents=True, exist_ok=True)
    dest = CACHE / name
    if not dest.exists():
        req = urllib.request.Request(BASE + name, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=120) as r, open(dest, "wb") as f:
            while chunk := r.read(1 << 20):
                f.write(chunk)
    return dest


def iso(value):
    m = re.match(r"(\d{1,2})/(\d{1,2})/(\d{4})$", (value or "").strip())
    if m:
        return f"{m.group(3)}-{int(m.group(1)):02d}-{int(m.group(2)):02d}"
    m = re.match(r"(\d{4}-\d{2}-\d{2})", (value or "").strip())
    return m.group(1) if m else ""


def main(which):
    fname, date_col, name_cols = SETS[which]
    path = download(fname)
    with zipfile.ZipFile(path) as z:
        member = max(z.infolist(), key=lambda i: i.file_size)
        print(f"file={fname} bytes={path.stat().st_size} member={member.filename} unzipped={member.file_size}")
        # Some IDB zips use Deflate64, which zipfile cannot read; Info-ZIP's unzip can.
        if member.compress_type == 9:
            proc = subprocess.Popen(["unzip", "-p", str(path), member.filename], stdout=subprocess.PIPE)
            raw = proc.stdout
        else:
            raw = z.open(member)
        with raw:
            text = io.TextIOWrapper(raw, encoding="latin-1", newline="")
            reader = csv.reader(text, delimiter="\t")
            header = next(reader)
            print(f"columns={len(header)}: {', '.join(header)}")
            idx = {h: i for i, h in enumerate(header)}
            rows = 0
            years = collections.Counter()
            filled = collections.Counter()
            orgs = collections.Counter()
            max_date = ""
            for row in reader:
                rows += 1
                if date_col in idx and len(row) > idx[date_col]:
                    d = iso(row[idx[date_col]])
                    years[d[:4]] += 1
                    max_date = max(max_date, d)
                for c in name_cols:
                    v = row[idx[c]].strip() if c in idx and len(row) > idx[c] else ""
                    if v and v != "-8":
                        filled[c] += 1
                        if ORG.search(v):
                            orgs[c] += 1
    print(f"rows={rows}")
    print(f"max_filedate={max_date or 'n/a'}")
    recent = sorted((y, n) for y, n in years.items() if y)[-8:]
    print("rows by filing year (last 8):", ", ".join(f"{y}:{n}" for y, n in recent))
    for c in name_cols:
        print(f"{c}: filled={filled[c] / rows:.1%} looks_like_org={orgs[c] / rows:.1%}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "civil")
