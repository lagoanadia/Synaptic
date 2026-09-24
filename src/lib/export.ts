import { parseNoteBlocks, type InlineNode, type NoteBlock } from "@/lib/text";

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
        case "text":
          return n.value;
      }
    })
    .join("");
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
      return block.items.map((item) => `- ${inlineToMarkdown(item)}`).join("\n");
    case "numberedList":
      return block.items
        .map((item, i) => `${i + 1}. ${inlineToMarkdown(item)}`)
        .join("\n");
    case "letteredList":
      return block.items.map((item) => `- ${inlineToMarkdown(item)}`).join("\n");
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
