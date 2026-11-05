import type { JSONContent } from "@tiptap/core";
import { parseNoteBlocks, type InlineNode, type ListBlock, type NoteBlock } from "@/lib/text";

// Stored text format (lib/text.ts shortcuts) ⇄ the editor's document tree.
// Storage is unchanged; only editing is visual.

// ─── text → editor ─────────────────────────────────────────────────────

function inlineToNodes(inline: InlineNode[]): JSONContent[] {
  const out: JSONContent[] = [];
  for (const node of inline) {
    if (node.type === "link") {
      if (node.text) out.push({ type: "text", text: node.text, marks: [{ type: "link", attrs: { href: node.url } }] });
      continue;
    }
    const marks =
      node.type === "bold" ? [{ type: "bold" }] : node.type === "italic" ? [{ type: "italic" }] : node.type === "underline" ? [{ type: "underline" }] : undefined;
    // A line break inside a paragraph is a hard break in the editor.
    node.value.split("\n").forEach((part, i) => {
      if (i > 0) out.push({ type: "hardBreak" });
      if (part) out.push(marks ? { type: "text", text: part, marks } : { type: "text", text: part });
    });
  }
  return out;
}

const para = (inline: InlineNode[]): JSONContent => {
  const content = inlineToNodes(inline);
  return content.length ? { type: "paragraph", content } : { type: "paragraph" };
};

function listToNode(list: ListBlock): JSONContent {
  return {
    type: list.type === "bulletList" ? "bulletList" : "orderedList",
    ...(list.type === "letteredList" ? { attrs: { kind: "alpha" } } : {}),
    content: list.items.map((item) => ({
      type: "listItem",
      content: [para(item.inline), ...item.children.map(listToNode)],
    })),
  };
}

function blockToNode(b: NoteBlock): JSONContent {
  switch (b.type) {
    case "heading":
      return { type: "heading", attrs: { level: b.level }, content: inlineToNodes(b.inline) };
    case "callout":
      return { type: "blockquote", content: [para(b.inline)] };
    case "bulletList":
    case "numberedList":
    case "letteredList":
      return listToNode(b);
    case "image":
      return { type: "image", attrs: { src: b.url } };
    case "codeBlock":
      return {
        type: "codeBlock",
        attrs: { language: b.language || null },
        ...(b.code ? { content: [{ type: "text", text: b.code }] } : {}),
      };
    case "table": {
      const row = (cells: InlineNode[][], cellType: string): JSONContent => ({
        type: "tableRow",
        content: cells.map((c) => ({ type: cellType, content: [para(c)] })),
      });
      return {
        type: "table",
        content: [row(b.header, "tableHeader"), ...b.rows.map((r) => row(r, "tableCell"))],
      };
    }
    case "paragraph":
      return para(b.inline);
  }
}

export function textToDoc(text: string): JSONContent {
  const content = parseNoteBlocks(text ?? "").map(blockToNode);
  return { type: "doc", content: content.length ? content : [{ type: "paragraph" }] };
}

// ─── editor → text ─────────────────────────────────────────────────────

type Mark = { type: string; attrs?: Record<string, unknown> };

function inlineToText(nodes: JSONContent[] = []): string {
  return nodes
    .map((n) => {
      if (n.type === "hardBreak") return "\n";
      if (n.type !== "text" || !n.text) return "";
      const marks = (n.marks ?? []) as Mark[];
      const has = (t: string) => marks.some((m) => m.type === t);
      // The stored format can't nest marks, so the strongest one wins.
      const link = marks.find((m) => m.type === "link");
      if (link) return `[${n.text}](${String(link.attrs?.href ?? "")})`;
      if (has("bold")) return `**${n.text}**`;
      if (has("underline")) return `__${n.text}__`;
      if (has("italic")) return `*${n.text}*`;
      if (has("code")) return n.text;
      return n.text;
    })
    .join("");
}

// The first paragraph of a list item / cell / callout as one line of text.
const firstLine = (n: JSONContent) =>
  inlineToText((n.content ?? []).find((c) => c.type === "paragraph")?.content).replace(/\n/g, " ");

function listToText(list: JSONContent, indent: number): string {
  const alpha = list.type === "orderedList" && list.attrs?.kind === "alpha";
  return (list.content ?? [])
    .map((item, i) => {
      const marker =
        list.type === "bulletList" ? "-" : alpha ? `${String.fromCharCode(97 + (i % 26))}.` : `${i + 1}.`;
      const nested = (item.content ?? [])
        .filter((c) => c.type === "bulletList" || c.type === "orderedList")
        .map((c) => listToText(c, indent + 2));
      return [`${" ".repeat(indent)}${marker} ${firstLine(item)}`, ...nested].join("\n");
    })
    .join("\n");
}

function nodeToText(n: JSONContent): string {
  switch (n.type) {
    case "heading":
      return `${"#".repeat(Number(n.attrs?.level ?? 1))} ${inlineToText(n.content).replace(/\n/g, " ")}`;
    case "paragraph":
      return inlineToText(n.content);
    case "blockquote":
      return (n.content ?? [])
        .map((p) => inlineToText(p.content).replace(/\n/g, " "))
        .filter(Boolean)
        .map((line) => `! ${line}`)
        .join("\n");
    case "bulletList":
    case "orderedList":
      return listToText(n, 0);
    case "image":
      return n.attrs?.src ? `![image](${String(n.attrs.src)})` : "";
    case "codeBlock": {
      const code = (n.content ?? []).map((c) => c.text ?? "").join("");
      return `<${String(n.attrs?.language ?? "")}\n${code}\n>`;
    }
    case "table":
      return (n.content ?? [])
        .map((row) => `| ${(row.content ?? []).map((cell) => firstLine(cell).replace(/\|/g, "/")).join(" | ")} |`)
        .join("\n");
    case "horizontalRule":
      return "";
    default:
      return inlineToText(n.content);
  }
}

export function docToText(doc: JSONContent): string {
  return (doc.content ?? [])
    .map(nodeToText)
    .filter((block, i, all) => block !== "" || (i > 0 && all[i - 1] !== ""))
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
