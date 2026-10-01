const LEADING_HEADING = /^#{1,3}\s*(.+)$/;
const LEADING_MARKER = /^(?:!|-|\d+\.|[a-zA-Z]\.)\s+/;

// Notion-style auto-title: the first few words of the content, so a raw
// capture reads as a page title instead of a wall of text in a list. If the
// content opens with a `#` heading, that line names the whole note — use it
// as-is (minus the `#`) instead of letting the title bleed into whatever
// paragraph follows on the next line.
export function autoTitle(content: string | null, maxWords = 8): string {
  if (!content || content.trim() === "") return "Untitled";
  const trimmed = content.trim();
  const firstLine = trimmed.split("\n")[0].trim();

  const heading = LEADING_HEADING.exec(firstLine);
  const source = heading ? heading[1] : trimmed.replace(LEADING_MARKER, "");

  const words = source.trim().split(/\s+/);
  const title = words.slice(0, maxWords).join(" ");
  return words.length > maxWords ? `${title}…` : title;
}

export type ContentSegment =
  | { type: "text"; value: string }
  | { type: "image"; url: string };

// Content is stored as plain text with inline `![image](url)` markers
// (inserted at the cursor when a picture is added) — this splits it back
// into ordered text/image segments so a page can render them interleaved
// instead of dumping all images after the text.
export function parseContent(content: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  const pattern = /!\[image\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: content.slice(lastIndex, match.index) });
    }
    segments.push({ type: "image", url: match[1] });
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
  | { type: "link"; text: string; url: string };

// A list item can carry its own nested list(s) — a numbered item Tab'd in
// the composer becomes a lettered sub-item, a bullet Tab'd becomes a
// hollow-circle one, same idea as any outliner's sub-points. Only lists
// nest inside a list item, never a heading/table/etc., which is what
// ListBlock (rather than the wider NoteBlock) enforces here.
export type ListItem = { inline: InlineNode[]; children: ListBlock[] };

export type ListBlock =
  | { type: "bulletList"; items: ListItem[] }
  | { type: "numberedList"; items: ListItem[] }
  | { type: "letteredList"; items: ListItem[] };

export type NoteBlock =
  | { type: "heading"; level: 1 | 2 | 3; inline: InlineNode[] }
  | { type: "callout"; inline: InlineNode[] }
  | ListBlock
  | { type: "paragraph"; inline: InlineNode[] }
  | { type: "image"; url: string }
  | { type: "table"; header: InlineNode[][]; rows: InlineNode[][][] }
  | { type: "codeBlock"; code: string; language: string };

// `**bold**`, `__underline__`, `[text](url)`, `*italic*` — matches what
// Ctrl/Cmd+B, +U and +I wrap a selection in, plus the "Insert link" button,
// inside the composer (NewDumpForm). The alternation tries the two-character
// markers (and the link, which always starts with `[`) before the
// single-character one, so `**bold**` is never misread as two stray
// `*italic*` runs. A link never collides with `![image](url)` — that
// pattern is stripped out earlier, by parseContent, before this ever runs.
function parseInline(line: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  const pattern = /\*\*(.+?)\*\*|__(.+?)__|\[(.+?)\]\((.+?)\)|\*(.+?)\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(line)) !== null) {
    if (match.index > lastIndex) {
      nodes.push({ type: "text", value: line.slice(lastIndex, match.index) });
    }
    if (match[1] !== undefined) {
      nodes.push({ type: "bold", value: match[1] });
    } else if (match[2] !== undefined) {
      nodes.push({ type: "underline", value: match[2] });
    } else if (match[3] !== undefined) {
      nodes.push({ type: "link", text: match[3], url: match[4] });
    } else {
      nodes.push({ type: "italic", value: match[5] });
    }
    lastIndex = pattern.lastIndex;
  }
  if (lastIndex < line.length) {
    nodes.push({ type: "text", value: line.slice(lastIndex) });
  }
  return nodes;
}

// Matches any run of #s, not just 1-3 — the AI is told to stay within
// that range, but a heading with more (or a line someone typed by hand)
// still becomes a heading instead of leaking literal "####" text; the
// level is clamped to 3 wherever it's used below.
// The space after the #s is optional — "#02 Licencias" and "#Title" both
// count as headings, not just "# Title", since typing straight into the
// next word (no space) is a very easy habit to fall into and shouldn't
// silently produce a literal "#02 Licencias" paragraph instead.
const HEADING = /^(#+)\s*(.*)$/;
const CALLOUT = /^!\s+(.*)$/;
// A list line, its leading indentation captured separately from the
// marker — indentation (spaces only, not tabs) is what nests it, see
// parseListBlocks below. ○/▪ are the composer's Tab-nested bullet markers
// (- → ○ → ▪, see NewDumpForm's handleListIndent) — they're still the
// same "bulletList" block type as a plain "-", just visually distinct at
// a glance.
const LIST_LINE = /^( *)(-|○|▪|\d+\.|[a-zA-Z]\.)\s+(.*)$/;
// A table row is typed as `| cell | cell | cell |` — leading and trailing
// pipes required, so a line that just happens to contain a "|" mid-sentence
// isn't mistaken for a table.
const TABLE_ROW = /^\|(.+)\|$/;
// A code block opens with `<` alone (optionally followed by a language
// name, e.g. `<js` or `<python` — same idea as a fenced ```js block in
// standard Markdown) on its own line, then any number of lines verbatim
// (no inline **bold**/list parsing inside — it's code, not prose), until a
// `>` alone on its own line closes it.
const CODE_FENCE_START = /^<\s*([a-zA-Z0-9+#.]*)\s*$/;
const CODE_FENCE_END = /^>\s*$/;

function splitTableRow(line: string): InlineNode[][] {
  const inner = TABLE_ROW.exec(line)![1];
  return inner.split("|").map((cell) => parseInline(cell.trim()));
}

type ListLineType = ListBlock["type"];

function parseListLine(
  line: string,
): { indent: number; type: ListLineType; text: string } | null {
  const m = LIST_LINE.exec(line);
  if (!m) return null;
  const marker = m[2];
  const type: ListLineType =
    marker === "-" || marker === "○" || marker === "▪"
      ? "bulletList"
      : /^\d+\.$/.test(marker)
        ? "numberedList"
        : "letteredList";
  return { indent: m[1].length, type, text: m[3] };
}

// Parses a contiguous run of list lines (bullet/numbered/lettered, at any
// depth) starting at lines[i.pos] into a tree of ListBlocks. A line
// indented further than the one before it nests as a sub-list of that
// item (one nested ListBlock per indent jump); a line indented less than
// `minIndent` hands control back to the caller — its own parent level.
// Mirrors how Tab/Shift+Tab in the composer (NewDumpForm) indent/outdent a
// list line by adding/removing two spaces before its marker.
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
      const children = parseListBlocks(lines, i, indent + 1);
      items.push({ inline: parseInline(p.text), children });
    }

    blocks.push({ type, items } as ListBlock);
  }

  return blocks;
}

// Splits a plain-text run into paragraph/heading/callout/list blocks using
// a small set of Notion-style shortcuts: `#`/`##`/`###` for headings, `!`
// for a callout, `-` for a bullet list, `1.` for a numbered list, and `a.`
// for a lettered one — typed as literal characters at the start of a line,
// same idea as the `![image](url)` markers this builds on top of.
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
      while (i < lines.length && TABLE_ROW.test(lines[i].trim())) {
        tableRows.push(splitTableRow(lines[i].trim()));
        i++;
      }
      const [header, ...rows] = tableRows;
      blocks.push({ type: "table", header, rows });
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

    // A plain paragraph: fold in every following line up to the next blank
    // line or shortcut, so a wrapped sentence stays one paragraph block.
    // Checking LIST_LINE against the RAW line (not trimmed) here matters —
    // it has to agree exactly with the dispatch check above it, or a line
    // that LOOKS like a list marker once trimmed (e.g. a tab, not spaces,
    // before it) can break out of this loop on its very first iteration
    // without ever advancing `i`, freezing the whole parse in an infinite
    // loop instead of just treating it as an ordinary paragraph line.
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
    blocks.push({ type: "paragraph", inline: parseInline(paraLines.join(" ")) });
  }

  return blocks;
}

// Full pipeline for rendering saved content: split out images first (they
// can land anywhere, images included), then run the markdown-shortcut
// parser over each surrounding run of plain text.
export function parseNoteBlocks(content: string): NoteBlock[] {
  const blocks: NoteBlock[] = [];
  for (const segment of parseContent(content)) {
    if (segment.type === "image") {
      blocks.push({ type: "image", url: segment.url });
    } else {
      blocks.push(...parseTextBlocks(segment.value));
    }
  }
  return blocks;
}
