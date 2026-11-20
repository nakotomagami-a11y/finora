"""Size the FJC civil court index: organisation parties of cases filed in the last N years.

Applies the court-index party gate from docs/plan/loaders/us-courts.md (a legal-form
token in the party name; government parties dropped) and prints only counts.

    python -I research/probes/us/fjc_court_index.py <path to cv88on.zip> [years=10]
"""
import collections
import datetime
import io
import re
import subprocess
import sys

TOKENS = re.compile(
    r"\b(INC|INCORPORATED|LLC|L\.L\.C|CORP|CORPORATION|CO|COMPANY|LTD|LIMITED|LP|L\.P|LLP|PLLC|PC|P\.C|N\.A|BANK|TRUST COMPANY)\b\.?"
)
GOVERNMENT = re.compile(r"^(UNITED STATES|USA|U\.S\.|STATE OF|COMMONWEALTH OF|CITY OF|COUNTY OF)\b")
ROW_BYTES = 60  # court, docket, dates, codes and a normalised name, per the spec's estimate


def main():
    path, years = sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 10
    cutoff = datetime.date.today().year - years
    proc = subprocess.Popen(["unzip", "-p", path], stdout=subprocess.PIPE)
    lines = io.TextIOWrapper(proc.stdout, encoding="latin-1", newline="")
    header = lines.readline().rstrip("\r\n").split("\t")
    plt, dfn, fd = header.index("PLT"), header.index("DEF"), header.index("FILEDATE")
    cases = with_org = rows = 0
    drops = collections.Counter()
    by_year = collections.Counter()
    for line in lines:
        f = line.rstrip("\r\n").split("\t")
        if len(f) <= dfn:
            continue
        m = re.search(r"(\d{4})$", f[fd].strip())
        if not m or int(m.group(1)) < cutoff:
            continue
        cases += 1
        kept = 0
        for name in (f[plt].strip().upper(), f[dfn].strip().upper()):
            if not name:
                continue
            if GOVERNMENT.match(name):
                drops["government_party"] += 1
            elif TOKENS.search(name):
                kept += 1
            else:
                drops["no_form_token"] += 1
        if kept:
            with_org += 1
            rows += kept
            by_year[m.group(1)] += 1
    proc.wait()
    print(f"window: filed {cutoff} or later")
    print(f"cases={cases:,} cases_with_org_party={with_org:,} index_rows={rows:,}")
    print(f"estimated_bytes={rows * ROW_BYTES / 1e9:.3f} GB at {ROW_BYTES} B per row")
    print("drops:", dict(drops))
    print("cases with an org party by year:", sorted(by_year.items()))


if __name__ == "__main__":
    main()
