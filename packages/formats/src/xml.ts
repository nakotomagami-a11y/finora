// Minimal helpers for flat, known XML (the OFAC enhanced export, XLSX parts): the blocks of a
// repeated element, the text of the first one, an attribute, and entity decoding. Element names
// match exactly, so `<name>` never matches `<names>`. Callers remove comments first
// (`withoutComments`), so a tag inside one is never matched. Every scan is linear: `indexOf` and
// single passes, never a backtracking pattern over untrusted text (S06 security review, SEC-2).

export class XmlError extends Error {
  override name = "xml_malformed";
  readonly code = "xml_malformed";
}

/** The text with every `<!-- ... -->` removed; a comment that never closes throws (a cut file). */
export function withoutComments(xml: string): string {
  let at = xml.indexOf("<!--");
  if (at < 0) return xml;
  const parts: string[] = [];
  let from = 0;
  while (at >= 0) {
    const end = xml.indexOf("-->", at + 4);
    if (end < 0) throw new XmlError("unterminated comment");
    parts.push(xml.slice(from, at));
    from = end + 3;
    at = xml.indexOf("<!--", from);
  }
  parts.push(xml.slice(from));
  return parts.join("");
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

export function decodeXml(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e: string) => {
    if (e[0] !== "#") return ENTITIES[e.toLowerCase()] ?? "";
    const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : Number(e.slice(1));
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
  });
}

const NAME_END = new Set([" ", "\t", "\n", "\r", ">", "/"]);

/** The index of the `>` that ends the tag opened before `from`, honouring quoted values; -1 when none. */
function tagEnd(xml: string, from: number): number {
  let quote: string | null = null;
  for (let i = from; i < xml.length; i++) {
    const ch = xml[i]!;
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === ">") return i;
  }
  return -1;
}

/** Every `<tag ...>inner</tag>` (or self-closed `<tag/>`) block, not nested in one of its own kind. */
export function elements(xml: string, tag: string): { attrs: string; inner: string }[] {
  const out: { attrs: string; inner: string }[] = [];
  const open = `<${tag}`;
  const close = `</${tag}>`;
  let at = xml.indexOf(open);
  while (at >= 0) {
    const nameEnd = at + open.length;
    if (!NAME_END.has(xml[nameEnd] ?? "")) {
      at = xml.indexOf(open, nameEnd);
      continue;
    }
    const gt = tagEnd(xml, nameEnd);
    if (gt < 0) break;
    const selfClosed = xml[gt - 1] === "/";
    const attrs = xml.slice(nameEnd, selfClosed ? gt - 1 : gt);
    if (selfClosed) {
      out.push({ attrs, inner: "" });
      at = xml.indexOf(open, gt + 1);
      continue;
    }
    const end = xml.indexOf(close, gt + 1);
    if (end < 0) break;
    out.push({ attrs, inner: xml.slice(gt + 1, end) });
    at = xml.indexOf(open, end + close.length);
  }
  return out;
}

export function text(xml: string, tag: string): string | null {
  const first = elements(xml, tag)[0];
  return first ? decodeXml(first.inner).trim() : null;
}

export function attr(attrs: string, name: string): string | null {
  const m = new RegExp(`(?:^|\\s)${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}="([^"]*)"`).exec(attrs);
  return m?.[1] !== undefined ? decodeXml(m[1]) : null;
}
