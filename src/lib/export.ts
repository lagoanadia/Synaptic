import { parseNoteBlocks, type InlineNode, type ListBlock, type ListItem, type NoteBlock } from "@/lib/text";

function inlineToMarkdown(nodes: InlineNode[]): string {
  return nodes
    .map((n) => {
      switch (n.type) {
        case "bold":
          return `**${n.value}**`;
        case "italic":
          return `*${n.value}*`;
        // Standard/GFM Markdown reads __text__ as BOLD, not underline —
        // passing our own __text__ through unchanged would silently
        // change what the exported file means. <u> is plain HTML, which
        // GitHub, Obsidian and VS Code's preview all render inline
        // inside Markdown.
        case "underline":
          return `<u>${n.value}</u>`;
        case "link":
          // Already standard Markdown syntax — our own [text](url) shortcut
          // and GFM's link syntax are the same thing, verbatim.
          return `[${n.text}](${n.url})`;
        case "text":
          return n.value;
      }
    })
    .join("");
}

// A nested item's children are indented two more spaces than their parent
// — not GFM's most rigorous nesting rule (which wants indent matched to
// the parent marker's own width), but tolerant enough for GitHub/Obsidian
// to render correctly, and simpler than tracking marker width per line.
function listItemsToMarkdown(
  items: ListItem[],
  markerFor: (index: number) => string,
  indent: string,
): string {
  return items
    .map((item, i) => {
      const line = `${indent}${markerFor(i)} ${inlineToMarkdown(item.inline)}`;
      const nested = item.children
        .map((child) => listBlockToMarkdown(child, `${indent}  `))
        .join("\n");
      return nested ? `${line}\n${nested}` : line;
    })
    .join("\n");
}

function listBlockToMarkdown(block: ListBlock, indent = ""): string {
  switch (block.type) {
    case "bulletList":
      return listItemsToMarkdown(block.items, () => "-", indent);
    case "numberedList":
      return listItemsToMarkdown(block.items, (i) => `${i + 1}.`, indent);
    case "letteredList":
      // No alphabetic list syntax in Markdown -- falls back to bullets,
      // same as the old flat case, now applied at any nesting depth too.
      return listItemsToMarkdown(block.items, () => "-", indent);
  }
}

// Re-serializes our own parsed blocks into standard/GFM Markdown, fixing
// the three places our shortcut syntax isn't quite standard Markdown:
// "!" callouts (not a Markdown thing) become "> " blockquotes, lettered
// lists (no alphabetic list syntax in Markdown) become bullets, and
// tables gain the "|---|---|" separator row GFM requires to render as an
// actual table instead of plain piped text.
function blockToMarkdown(block: NoteBlock): string {
  switch (block.type) {
    case "heading":
      return `${"#".repeat(block.level)} ${inlineToMarkdown(block.inline)}`;
    case "callout":
      return `> ${inlineToMarkdown(block.inline)}`;
    case "bulletList":
    case "numberedList":
    case "letteredList":
      return listBlockToMarkdown(block);
    case "table": {
      const headerRow = `| ${block.header.map(inlineToMarkdown).join(" | ")} |`;
      const separatorRow = `| ${block.header.map(() => "---").join(" | ")} |`;
      const bodyRows = block.rows.map(
        (row) => `| ${row.map(inlineToMarkdown).join(" | ")} |`,
      );
      return [headerRow, separatorRow, ...bodyRows].join("\n");
    }
    case "image":
      return `![image](${block.url})`;
    case "paragraph":
      return inlineToMarkdown(block.inline);
    // Our own `<`/`>` fences aren't Markdown, but GFM's fenced code block
    // (```) is the standard equivalent, so it maps over directly.
    case "codeBlock":
      return "```" + block.language + "\n" + block.code + "\n```";
  }
}

function contentToMarkdown(content: string): string {
  return parseNoteBlocks(content).map(blockToMarkdown).join("\n\n");
}

export type ExportNote = {
  content: string;
  createdAt: Date;
  tags: { name: string }[];
};

export type ExportDump = {
  content: string | null;
  createdAt: Date;
};

export type ExportPursuit = {
  title: string;
  notes: ExportNote[];
  dumps: ExportDump[];
};

// The single exported .md file's full structure: a title, then every
// organized note (newest first isn't required — callers pass whatever
// order they queried in), then every raw brain dump underneath.
export function buildPursuitMarkdown(pursuit: ExportPursuit): string {
  const sections: string[] = [`# ${pursuit.title}`];

  sections.push("## Organized notes");
  if (pursuit.notes.length === 0) {
    sections.push("_No organized notes yet._");
  } else {
    for (const note of pursuit.notes) {
      const tags = note.tags.map((t) => `\`${t.name}\``).join(" ");
      const heading = `### ${note.createdAt.toISOString().slice(0, 10)}${tags ? ` — ${tags}` : ""}`;
      sections.push(`${heading}\n\n${contentToMarkdown(note.content)}`);
    }
  }

  sections.push("## Brain dumps");
  if (pursuit.dumps.length === 0) {
    sections.push("_No brain dumps yet._");
  } else {
    for (const dump of pursuit.dumps) {
      const heading = `### ${dump.createdAt.toISOString().slice(0, 10)}`;
      sections.push(`${heading}\n\n${contentToMarkdown(dump.content ?? "")}`);
    }
  }

  return sections.join("\n\n---\n\n");
}
