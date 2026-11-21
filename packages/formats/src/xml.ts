// Minimal helpers for flat, known XML (the OFAC enhanced export, XLSX parts): the blocks of a
// repeated element, the text of the first one, an attribute, and entity decoding. Element names
// match exactly, so `<name>` never matches `<names>`. Callers remove comments first
// (`withoutComments`), so a tag inside one is never matched.

export const withoutComments = (xml: string) => xml.replace(/<!--[\s\S]*?-->/g, "");

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

export function decodeXml(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e: string) => {
    if (e[0] !== "#") return ENTITIES[e.toLowerCase()] ?? "";
    const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : Number(e.slice(1));
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
  });
}

/** Every `<tag ...>inner</tag>` (or self-closed `<tag/>`) block, not nested in one of its own kind. */
export function elements(xml: string, tag: string): { attrs: string; inner: string }[] {
  const out: { attrs: string; inner: string }[] = [];
  // Attribute values may hold ">" when quoted.
  const re = new RegExp(`<${tag}(?=[\\s>/])((?:[^>"']|"[^"]*"|'[^']*')*?)(/?)>`, "g");
  const close = `</${tag}>`;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    if (m[2] === "/") {
      out.push({ attrs: m[1] ?? "", inner: "" });
      continue;
    }
    const end = xml.indexOf(close, re.lastIndex);
    if (end < 0) break;
    out.push({ attrs: m[1] ?? "", inner: xml.slice(re.lastIndex, end) });
    re.lastIndex = end + close.length;
  }
  return out;
}

export function text(xml: string, tag: string): string | null {
  const first = elements(xml, tag)[0];
  return first ? decodeXml(first.inner).trim() : null;
}

export function attr(attrs: string, name: string): string | null {
  const m = new RegExp(`\\b${name}="([^"]*)"`).exec(attrs);
  return m?.[1] !== undefined ? decodeXml(m[1]) : null;
}
