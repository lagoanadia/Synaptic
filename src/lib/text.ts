const LEADING_HEADING = /^#{1,3}\s*(.+)$/;
const LEADING_MARKER = /^(?:!|-|\d+\.|[a-zA-Z]\.)\s+/;

// First few words of the content, or the opening `#` heading if there is one.
export function autoTitle(content: string | null, maxWords = 8): string {
  if (!content || content.trim() === "") return "Untitled";
  // Image markers have no spaces, so left in they'd become one giant "word".
  const withoutImages = content.replace(/!\[(?:image|pdf:[^\]\n]*)\]\([^)]*\)/g, " ").trim();
  if (withoutImages === "") return "Untitled";
  const trimmed = withoutImages;
  const firstLine = trimmed.split("\n")[0].trim();

  const heading = LEADING_HEADING.exec(firstLine);
  const source = heading ? heading[1] : trimmed.replace(LEADING_MARKER, "");

  const words = source.trim().split(/\s+/);
  const title = words.slice(0, maxWords).join(" ");
  return words.length > maxWords ? `${title}…` : title;
}

export type ContentSegment =
  | { type: "text"; value: string }
  | { type: "image"; url: string }
  | { type: "pdf"; url: string; title: string; cover: string };

// A PDF shown as a card: "![pdf:cover:Title](url)". The title can't hold
// "]" or a line break; the cover is a folder-cover key ("" = from the url).
export const pdfMarker = (url: string, title: string, cover: string) => `![pdf:${cover.replace(/[^\w-]/g, "")}:${title.replace(/[\]\n\r]/g, " ").trim()}](${url.replace(/\)/g, "%29")})`;

// Splits stored content into text, image and PDF-card segments, in order.
export function parseContent(content: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  const pattern = /!\[(image|pdf:([\w-]*):([^\]\n]*))\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: content.slice(lastIndex, match.index) });
    }
    if (match[1] === "image") segments.push({ type: "image", url: match[4] });
    else segments.push({ type: "pdf", url: match[4], title: match[3].trim(), cover: match[2] });
    lastIndex = pattern.lastIndex;
  }
  if (lastIndex < content.length) {
    segments.push({ type: "text", value: content.slice(lastIndex) });
  }
  return segments;
}

export type InlineNode =
  | { type: "text"; value: string }
  | { type: "bold"; value: string }
  | { type: "italic"; value: string }
  | { type: "underline"; value: string }
  | { type: "link"; text: string; url: string }
  // `onCreate`: a short bit of code inside a sentence.
  | { type: "code"; value: string };

// Only lists nest inside a list item (lettered under numbered, ○ under -).
export type ListItem = { inline: InlineNode[]; children: ListBlock[] };

export type ListBlock =
  | { type: "bulletList"; items: ListItem[] }
  | { type: "numberedList"; items: ListItem[]; start?: number }
  | { type: "letteredList"; items: ListItem[] };

export type NoteBlock =
  | { type: "heading"; level: 1 | 2 | 3; inline: InlineNode[] }
  | { type: "callout"; inline: InlineNode[] }
  | ListBlock
  | { type: "paragraph"; inline: InlineNode[] }
  | { type: "image"; url: string }
  | { type: "pdf"; url: string; title: string; cover: string }
  // No header row: `header` is empty and every row is in `rows`.
  | { type: "table"; header: InlineNode[][]; rows: InlineNode[][][] }
  | { type: "codeBlock"; code: string; language: string }
  // Side-by-side columns, each its own blocks (stored as ":::columns", ":::|"
  // between columns, ":::" at the end).
  | { type: "columns"; cols: NoteBlock[][] };

// Two-character markers and links are tried before `*`, so **bold** isn't read
// as two *italics*. Image markers were already removed by parseContent.
function parseInline(line: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  const pattern = /`([^`\n]+)`|\*\*(.+?)\*\*|__(.+?)__|\[(.+?)\]\((.+?)\)|\*(.+?)\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(line)) !== null) {
    if (match.index > lastIndex) {
      nodes.push({ type: "text", value: line.slice(lastIndex, match.index) });
    }
    if (match[1] !== undefined) {
      nodes.push({ type: "code", value: match[1] });
    } else if (match[2] !== undefined) {
      nodes.push({ type: "bold", value: match[2].trim() });
    } else if (match[3] !== undefined) {
      nodes.push({ type: "underline", value: match[3] });
    } else if (match[4] !== undefined) {
      nodes.push({ type: "link", text: match[4], url: match[5] });
    } else {
      nodes.push({ type: "italic", value: match[6] });
    }
    lastIndex = pattern.lastIndex;
  }
  if (lastIndex < line.length) {
    nodes.push({ type: "text", value: line.slice(lastIndex) });
  }
  return nodes;
}

// Any number of #s (level clamped to 3), space optional: "#02 Licencias" counts.
const HEADING = /^(#+)\s*(.*)$/;
// "! texto" or "!texto" — but not an image, "![…](…)".
const CALLOUT = /^!(?!\[)\s*(\S.*)$/;
// Indentation (spaces) sets nesting. ○ and ▪ are nested bullet markers.
const LIST_LINE = /^( *)(-|○|▪|\d+\.|[a-zA-Z]\.)\s+(.*)$/;
// A table row is typed as `| cell | cell | cell |` — leading and trailing
// pipes required, so a line that just happens to contain a "|" mid-sentence
// isn't mistaken for a table.
const TABLE_ROW = /^\|(.+)\|$/;
// A code block: `<` or `<lang` on its own line, verbatim lines, then `>` alone.
const CODE_FENCE_START = /^<\s*([a-zA-Z0-9+#.]*)\s*$/;
const CODE_FENCE_END = /^>\s*$/;

function splitTableRow(line: string): InlineNode[][] {
  const inner = TABLE_ROW.exec(line)![1];
  return inner.split("|").map((cell) => parseInline(cell.trim()));
}

type ListLineType = ListBlock["type"];

function parseListLine(
  line: string,
): { indent: number; type: ListLineType; text: string; num: number } | null {
  const m = LIST_LINE.exec(line);
  if (!m) return null;
  const marker = m[2];
  const type: ListLineType =
    marker === "-" || marker === "○" || marker === "▪"
      ? "bulletList"
      : /^\d+\.$/.test(marker)
        ? "numberedList"
        : "letteredList";
  return { indent: m[1].length, type, text: m[3], num: parseInt(marker, 10) || 1 };
}

// One contiguous run of list lines → a tree of lists. A deeper indent nests
// under the previous item; a shallower one returns to the caller.
function parseListBlocks(lines: string[], i: { pos: number }, minIndent: number): ListBlock[] {
  const blocks: ListBlock[] = [];

  while (i.pos < lines.length) {
    const parsed = parseListLine(lines[i.pos]);
    if (!parsed || parsed.indent < minIndent) break;

    // The actual depth of THIS run — everything sharing this line's exact
    // indent and marker type joins the same list; a deeper line starts a
    // nested list under whichever item came right before it.
    const { indent, type } = parsed;
    const items: ListItem[] = [];

    while (i.pos < lines.length) {
      const p = parseListLine(lines[i.pos]);
      if (!p || p.indent !== indent || p.type !== type) break;
      i.pos++;
      // An item's own extra lines (a description under it) are indented
      // further and aren't list lines.
      let text = p.text;
      while (i.pos < lines.length && !parseListLine(lines[i.pos]) && lines[i.pos].trim() && /^ */.exec(lines[i.pos])![0].length > indent) {
        text += `\n${lines[i.pos].trim()}`;
        i.pos++;
      }
      const children = parseListBlocks(lines, i, indent + 1);
      items.push({ inline: parseInline(text), children });
    }

    // A numbered list can carry on from an earlier one: "2." after a paragraph.
    blocks.push((type === "numberedList" && parsed.num !== 1 ? { type, items, start: parsed.num } : { type, items }) as ListBlock);
  }

  return blocks;
}

// Plain text → blocks, using the line-start shortcuts (#, !, -, 1., a., |, <).
function parseTextBlocks(text: string): NoteBlock[] {
  const blocks: NoteBlock[] = [];
  const lines = text.split("\n");
  let i = 0;

  while (i < lines.length) {
    const trimmed = lines[i].trim();

    if (trimmed === "") {
      i++;
      continue;
    }

    const heading = HEADING.exec(trimmed);
    if (heading) {
      blocks.push({
        type: "heading",
        level: Math.min(heading[1].length, 3) as 1 | 2 | 3,
        inline: parseInline(heading[2]),
      });
      i++;
      continue;
    }

    const callout = CALLOUT.exec(trimmed);
    if (callout) {
      blocks.push({ type: "callout", inline: parseInline(callout[1]) });
      i++;
      continue;
    }

    if (LIST_LINE.test(lines[i])) {
      const ref = { pos: i };
      blocks.push(...parseListBlocks(lines, ref, 0));
      i = ref.pos;
      continue;
    }

    if (TABLE_ROW.test(trimmed)) {
      const tableRows: InlineNode[][][] = [];
      let noHeader = false;
      while (i < lines.length && TABLE_ROW.test(lines[i].trim())) {
        // Markdown's "| --- | :---: |" separator is layout, not a row.
        // (Each cell is dashes; a row of empty cells is still a row.)
        // One BEFORE any row means the table has no header row.
        if (!/^\|(?:\s*:?-+:?\s*\|)+$/.test(lines[i].trim())) tableRows.push(splitTableRow(lines[i].trim()));
        else if (tableRows.length === 0) noHeader = true;
        i++;
      }
      const [header, ...rows] = tableRows;
      if (header) blocks.push(noHeader ? { type: "table", header: [], rows: tableRows } : { type: "table", header, rows });
      continue;
    }

    const codeFence = CODE_FENCE_START.exec(trimmed);
    if (codeFence) {
      const language = codeFence[1].toLowerCase();
      i++; // past the opening `<`
      const codeLines: string[] = [];
      while (i < lines.length && !CODE_FENCE_END.test(lines[i].trim())) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // past the closing `>`, if the block was closed
      blocks.push({ type: "codeBlock", code: codeLines.join("\n"), language });
      continue;
    }

    // Paragraph: following lines until a blank line or shortcut, joined with \n so
    // line breaks survive. LIST_LINE must test the raw line (same as the dispatch
    // above), or a tab-indented "- x" would never advance `i` and loop forever.
    const paraLines: string[] = [];
    while (i < lines.length) {
      const t = lines[i].trim();
      if (
        t === "" ||
        HEADING.test(t) ||
        CALLOUT.test(t) ||
        LIST_LINE.test(lines[i]) ||
        TABLE_ROW.test(t) ||
        CODE_FENCE_START.test(t)
      ) {
        break;
      }
      paraLines.push(lines[i]);
      i++;
    }
    blocks.push({ type: "paragraph", inline: parseInline(paraLines.join("\n")) });
  }

  return blocks;
}

// Full pipeline for rendering saved content: split out images first (they
// can land anywhere, images included), then run the markdown-shortcut
// parser over each surrounding run of plain text.
// Pasted or typed text often carries Windows line ends, tabs or
// non-breaking spaces as indentation, invisible characters, or "*", "•",
// "–" as bullets: all of it means the same list. Code blocks stay as written.
export function normalizeNoteText(text: string): string {
  let inCode = false;
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => {
      if (inCode) {
        if (line.trim() === ">") inCode = false;
        return line;
      }
      if (/^<[\w+#-]*\s*$/.test(line.trim()) && line.trim() !== "<") {
        inCode = true;
        return line;
      }
      if (line.trim() === "<") {
        inCode = true;
        return line;
      }
      const m = /^([\t \u00a0\u200b\u200c\u200d\ufeff]*)(.*)$/.exec(line)!;
      const indent = m[1].replace(/[\u200b\u200c\u200d\ufeff]/g, "").replace(/\u00a0/g, " ").replace(/\t/g, "  ");
      const rest = m[2].replace(/^[*•●▪◦–—]\s+(?=\S)/, "- ");
      return indent + rest;
    })
    .join("\n");
}

export const COLS_OPEN = ":::columns";
export const COLS_NEXT = ":::|";
export const COLS_CLOSE = ":::";

export function parseNoteBlocks(content: string): NoteBlock[] {
  // Columns first: the text around them and inside each one is parsed alone.
  const lines = (content ?? "").split("\n");
  const open = lines.findIndex((l) => l.trim() === COLS_OPEN);
  if (open >= 0) {
    const close = lines.findIndex((l, i) => i > open && l.trim() === COLS_CLOSE);
    const end = close < 0 ? lines.length : close;
    const cols: string[][] = [[]];
    for (const l of lines.slice(open + 1, end)) {
      if (l.trim() === COLS_NEXT) cols.push([]);
      else cols[cols.length - 1].push(l);
    }
    return [
      ...plainBlocks(lines.slice(0, open).join("\n")),
      { type: "columns", cols: cols.map((c) => parseNoteBlocks(c.join("\n"))) },
      ...parseNoteBlocks(lines.slice(end + 1).join("\n")),
    ];
  }
  return plainBlocks(content);
}

function plainBlocks(content: string): NoteBlock[] {
  const blocks: NoteBlock[] = [];
  content = normalizeNoteText(content);
  for (const segment of parseContent(content)) {
    if (segment.type === "image") {
      blocks.push({ type: "image", url: segment.url });
    } else if (segment.type === "pdf") {
      blocks.push({ type: "pdf", url: segment.url, title: segment.title, cover: segment.cover });
    } else {
      blocks.push(...parseTextBlocks(segment.value));
    }
  }
  return blocks;
}

// A map's name as a short label: "Mapa de conceptos de desarrollo de
// interfaces" -> "Desarrollo de interfaces", cut at a word near `max`.
export function shortMapTitle(title: string, max = 24): string {
  let t = title
    .replace(/^\s*mapa\s+(de\s+conceptos|conceptual)\s*(de(l)?|sobre|:|-)?\s*/i, "")
    .replace(/^(la|el|los|las)\s+/i, "")
    .trim();
  if (!t) return "General";
  t = t[0].toUpperCase() + t.slice(1);
  if (t.length <= max) return t;
  const cut = t.slice(0, max + 1).replace(/\s+\S*$/, "");
  return (cut.length >= max / 2 ? cut : t.slice(0, max)).replace(/[\s,:;.-]+$/, "") + "…";
}

// A page's title is its first line when that's a "# " heading.
export function splitTitle(content: string | null): { title: string | null; body: string } {
  const text = content ?? "";
  const m = /^\s*#[ \t]+(.+?)[ \t]*(?:\r?\n|$)/.exec(text);
  return m ? { title: m[1].trim(), body: text.slice(m[0].length).replace(/^\s*\n/, "") } : { title: null, body: text };
}

export function withTitle(title: string, body: string): string {
  const t = title.replace(/\s+/g, " ").trim();
  return t ? `# ${t}\n\n${body.replace(/^\s+/, "")}` : body;
}
