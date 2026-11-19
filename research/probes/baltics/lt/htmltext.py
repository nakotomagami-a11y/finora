"""Print the visible text of a saved HTML page (for reading licence and dataset pages)."""
import html
import re
import sys

sys.stdout.reconfigure(encoding="utf-8")
text = open(sys.argv[1], encoding="utf-8", errors="replace").read()
text = re.sub(r"<script.*?</script>|<style.*?</style>", "", text, flags=re.S)
text = html.unescape(re.sub(r"<[^>]+>", "\n", text))
lines = [line.strip() for line in text.split("\n") if line.strip()]
start = int(sys.argv[2]) if len(sys.argv) > 2 else 0
print("\n".join(lines[start : start + 250]))
