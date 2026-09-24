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
  | { type: "underline"; value: string };

export type NoteBlock =
  | { type: "heading"; level: 1 | 2 | 3; inline: InlineNode[] }
  | { type: "callout"; inline: InlineNode[] }
  | { type: "bulletList"; items: InlineNode[][] }
  | { type: "numberedList"; items: InlineNode[][] }
  | { type: "letteredList"; items: InlineNode[][] }
  | { type: "paragraph"; inline: InlineNode[] }
  | { type: "image"; url: string }
  | { type: "table"; header: InlineNode[][]; rows: InlineNode[][][] };

// `**bold**`, `__underline__`, `*italic*` — matches what Ctrl/Cmd+B, +U
// and +I wrap a selection in inside the composer (NewDumpForm). The
// alternation tries the two-character markers before the single-character
// one, so `**bold**` is never misread as two stray `*italic*` runs.
function parseInline(line: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  const pattern = /\*\*(.+?)\*\*|__(.+?)__|\*(.+?)\*/g;
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
    } else {
      nodes.push({ type: "italic", value: match[3] });
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
const BULLET = /^-\s+(.*)$/;
const NUMBERED = /^\d+\.\s+(.*)$/;
const LETTERED = /^[a-z]\.\s+(.*)$/i;
// A table row is typed as `| cell | cell | cell |` — leading and trailing
// pipes required, so a line that just happens to contain a "|" mid-sentence
// isn't mistaken for a table.
const TABLE_ROW = /^\|(.+)\|$/;

function splitTableRow(line: string): InlineNode[][] {
  const inner = TABLE_ROW.exec(line)![1];
  return inner.split("|").map((cell) => parseInline(cell.trim()));
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

    const list = (pattern: RegExp, type: "bulletList" | "numberedList" | "letteredList") => {
      const items: InlineNode[][] = [];
      while (i < lines.length) {
        const m = pattern.exec(lines[i].trim());
        if (!m) break;
        items.push(parseInline(m[1]));
        i++;
      }
      blocks.push({ type, items });
    };

    if (BULLET.test(trimmed)) {
      list(BULLET, "bulletList");
      continue;
    }
    if (NUMBERED.test(trimmed)) {
      list(NUMBERED, "numberedList");
      continue;
    }
    if (LETTERED.test(trimmed)) {
      list(LETTERED, "letteredList");
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

    // A plain paragraph: fold in every following line up to the next blank
    // line or shortcut, so a wrapped sentence stays one paragraph block.
    const paraLines: string[] = [];
    while (i < lines.length) {
      const t = lines[i].trim();
      if (
        t === "" ||
        HEADING.test(t) ||
        CALLOUT.test(t) ||
        BULLET.test(t) ||
        NUMBERED.test(t) ||
        LETTERED.test(t) ||
        TABLE_ROW.test(t)
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
