/* Rich text as stored HTML — the format `RichDocField` reads and writes.

   Only a small, known set of tags survives (`sanitizeRichHtml`), so a paste
   from Word or Google Docs can't drag in its own fonts, colours or the empty
   paragraphs those editors use as spacing. `markdownToHtml` turns the
   Markdown the legal copy is authored in into that same HTML. */

const KEEP = new Set([
  "P", "BR", "H1", "H2", "H3", "STRONG", "B", "EM", "I", "U",
  "UL", "OL", "LI", "A", "SUP", "SUB", "PRE", "CODE", "IMG",
]);
/* Tags that become a paragraph: other editors' block wrappers. */
const AS_PARAGRAPH = new Set(["DIV", "SECTION", "ARTICLE", "H4", "H5", "H6", "BLOCKQUOTE"]);

function clean(node: Node, doc: Document): Node[] {
  if (node.nodeType === Node.TEXT_NODE) {
    // Non-breaking spaces are how pasted docs fake blank lines.
    return [doc.createTextNode((node.textContent ?? "").replace(/\u00a0/g, " "))];
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return [];
  const el = node as Element;
  const kids = Array.from(el.childNodes).flatMap((c) => clean(c, doc));
  const tag = el.tagName === "B" ? "STRONG" : el.tagName === "I" ? "EM" : el.tagName;
  if (!KEEP.has(tag) && !AS_PARAGRAPH.has(tag)) return kids; // unwrap (span, font…)
  const out = doc.createElement(AS_PARAGRAPH.has(tag) ? "p" : tag.toLowerCase());
  const href = tag === "A" ? el.getAttribute("href") : null;
  if (href && /^(https?:|mailto:|tel:)/i.test(href)) out.setAttribute("href", href);
  if (tag === "IMG") {
    const src = el.getAttribute("src") ?? "";
    if (!/^(https?:|data:image\/)/i.test(src)) return [];
    out.setAttribute("src", src);
    out.setAttribute("alt", el.getAttribute("alt") ?? "");
  }
  kids.forEach((k) => out.appendChild(k));
  return [out];
}

/** Keeps headings, paragraphs, lists, links, images and inline emphasis;
 *  drops every attribute but a link's href and an image's src/alt, and every
 *  empty block. */
export function sanitizeRichHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const body = doc.createElement("div");
  Array.from(doc.body.childNodes).flatMap((c) => clean(c, doc)).forEach((n) => body.appendChild(n));
  // An empty block is spacing, not content — the field's own rhythm spaces
  // the blocks. Innermost first, so a list emptied of items goes too.
  for (const el of Array.from(body.querySelectorAll("p, h1, h2, h3, li, ul, ol, pre")).reverse()) {
    if (!el.textContent?.trim() && !el.querySelector("img")) el.remove();
  }
  return body.innerHTML.trim();
}

/** The text a rich value reads as — for "is it empty?" checks. */
export function richTextContent(html: string): string {
  return new DOMParser().parseFromString(html, "text/html").body.textContent?.trim() ?? "";
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function inline(s: string): string {
  return escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*\n]+)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
}

/** `#`–`###` headings, paragraphs split by a blank line (single newlines are
 *  line breaks), `1.` numbered lists, `**bold**`, `*italic*` and `[text](url)`. */
export function markdownToHtml(md: string): string {
  return md
    .trim()
    .split(/\n{2,}/)
    .map((block) => {
      const lines = block.split("\n");
      const h = /^(#{1,3}) (.*)$/.exec(block);
      if (h && lines.length === 1) return `<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`;
      if (lines.every((l) => /^\d+\. /.test(l)))
        return `<ol>${lines.map((l) => `<li>${inline(l.replace(/^\d+\. /, ""))}</li>`).join("")}</ol>`;
      return `<p>${lines.map(inline).join("<br>")}</p>`;
    })
    .join("");
}
