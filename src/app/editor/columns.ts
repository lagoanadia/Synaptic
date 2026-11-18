import { Node, mergeAttributes, type Editor } from "@tiptap/core";
import { Fragment } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";

// Side-by-side columns (2-4), each one free to hold any blocks: text,
// images, whiteboards… Made from a block's menu: the block stays in the
// first column and empty ones appear next to it.
export const Column = Node.create({
  name: "column",
  content: "block+",
  isolating: true,
  parseHTML: () => [{ tag: "div[data-column]" }],
  renderHTML: ({ HTMLAttributes }) => ["div", mergeAttributes(HTMLAttributes, { "data-column": "", class: "editor-column" }), 0],
});

export const Columns = Node.create({
  name: "columns",
  group: "block",
  content: "column{2,4}",
  isolating: true,
  defining: true,
  parseHTML: () => [{ tag: "div[data-columns]" }],
  renderHTML: ({ node, HTMLAttributes }) => ["div", mergeAttributes(HTMLAttributes, { "data-columns": "", class: "editor-columns", style: `--cols:${node.childCount}` }), 0],
});

// The block at `pos` into n columns (it stays in the first). Already
// columns: change how many (extra ones' content joins the last kept one).
export function setColumns(editor: Editor, pos: number, n: number) {
  const { state } = editor;
  const node = state.doc.nodeAt(pos);
  if (!node) return;
  const { schema } = state;
  const empty = () => schema.nodes.column.create(null, schema.nodes.paragraph.create());
  let cols;
  if (node.type.name === "columns") {
    const kids: ReturnType<typeof empty>[] = [];
    node.forEach((c) => kids.push(c));
    if (kids.length > n) {
      const extra = kids.slice(n - 1).flatMap((c) => {
        const out: ReturnType<typeof empty>[] = [];
        c.forEach((b) => out.push(b));
        return out;
      });
      kids.splice(n - 1, kids.length, schema.nodes.column.create(null, Fragment.fromArray(extra)));
    }
    while (kids.length < n) kids.push(empty());
    cols = kids;
  } else {
    cols = [schema.nodes.column.create(null, node), ...Array.from({ length: n - 1 }, empty)];
  }
  const tr = state.tr.replaceWith(pos, pos + node.nodeSize, schema.nodes.columns.create(null, cols));
  // Cursor in the first new (empty) column, ready to write.
  let target = pos + 1;
  const made = tr.doc.nodeAt(pos);
  if (made) {
    let offset = pos + 1;
    made.forEach((c, _o, i) => {
      if (i < (node.type.name === "columns" ? node.childCount : 1)) offset += c.nodeSize;
    });
    target = Math.min(offset + 2, tr.doc.content.size);
  }
  tr.setSelection(TextSelection.near(tr.doc.resolve(target)));
  editor.view.dispatch(tr.scrollIntoView());
  editor.view.focus();
}

// Columns back to one after another.
export function unsetColumns(editor: Editor, pos: number) {
  const { state } = editor;
  const node = state.doc.nodeAt(pos);
  if (!node || node.type.name !== "columns") return;
  const blocks: ReturnType<typeof state.schema.nodes.paragraph.create>[] = [];
  node.forEach((c) => c.forEach((b) => blocks.push(b)));
  editor.view.dispatch(state.tr.replaceWith(pos, pos + node.nodeSize, Fragment.fromArray(blocks)));
}

// "Convertir en": the text block at `pos` as another kind.
export type BlockKind = "text" | "h1" | "h2" | "h3" | "bullet" | "numbered" | "callout" | "code";
export function convertBlock(editor: Editor, pos: number, kind: BlockKind) {
  const node = editor.state.doc.nodeAt(pos);
  if (!node) return;
  // Inside the block (lists: inside the first item's text).
  let inner = pos + 1;
  while (editor.state.doc.resolve(inner).parent.isTextblock === false && inner < pos + node.nodeSize - 1) inner++;
  let c = editor.chain().focus().setTextSelection(inner);
  // Out of a list or callout first, so the result is just the new kind.
  if (editor.state.doc.resolve(inner).node(2)?.type.name === "listItem" || node.type.name === "bulletList" || node.type.name === "orderedList") c = c.liftListItem("listItem");
  if (node.type.name === "blockquote") c = c.lift("blockquote");
  if (kind === "text") c.setParagraph().run();
  else if (kind === "h1" || kind === "h2" || kind === "h3") c.setHeading({ level: Number(kind[1]) as 1 | 2 | 3 }).run();
  else if (kind === "bullet") c.setParagraph().toggleBulletList().run();
  else if (kind === "numbered") c.setParagraph().toggleOrderedList().run();
  else if (kind === "callout") c.setParagraph().wrapIn("blockquote").run();
  else c.setCodeBlock().run();
}
