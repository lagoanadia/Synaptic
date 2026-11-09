import { parseNoteBlocks, type InlineNode, type ListBlock, type ListItem, type NoteBlock } from "@/lib/text";

function inlineToMarkdown(nodes: InlineNode[]): string {
  return nodes
    .map((n) => {
      switch (n.type) {
        case "bold":
          return `**${n.value}**`;
        case "italic":
          return `*${n.value}*`;
        // Markdown reads __text__ as bold, so underline exports as <u>.
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

// Nested items indent two spaces; GitHub and Obsidian render that fine.
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

// Our blocks → standard Markdown: callouts become quotes, lettered lists
// bullets, and tables get the |---| row.
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
      // Markdown needs a header row: a headerless table gets an empty one.
      const cols = block.header.length || block.rows[0]?.length || 0;
      const headerRow = `| ${block.header.length ? block.header.map(inlineToMarkdown).join(" | ") : Array(cols).fill(" ").join(" | ")} |`;
      const separatorRow = `| ${Array(cols).fill("---").join(" | ")} |`;
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

  sections.push("## Notas organizadas");
  if (pursuit.notes.length === 0) {
    sections.push("_Aún no hay notas organizadas._");
  } else {
    for (const note of pursuit.notes) {
      const tags = note.tags.map((t) => `\`${t.name}\``).join(" ");
      const heading = `### ${note.createdAt.toISOString().slice(0, 10)}${tags ? ` — ${tags}` : ""}`;
      sections.push(`${heading}\n\n${contentToMarkdown(note.content)}`);
    }
  }

  sections.push("## Notas en bruto");
  if (pursuit.dumps.length === 0) {
    sections.push("_Aún no hay notas en bruto._");
  } else {
    for (const dump of pursuit.dumps) {
      const heading = `### ${dump.createdAt.toISOString().slice(0, 10)}`;
      sections.push(`${heading}\n\n${contentToMarkdown(dump.content ?? "")}`);
    }
  }

  return sections.join("\n\n---\n\n");
}
