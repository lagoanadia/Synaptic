import { Extension, type Editor } from "@tiptap/core";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

// Notion-style blocks: each top-level piece (paragraph, heading, table,
// code, callout) and each list item can be moved up/down or dragged.

// Where the block sits (its start position) given its DOM element.
export function blockAt(view: EditorView, target: HTMLElement): { pos: number; dom: HTMLElement; item: boolean } | null {
  const root = view.dom;
  if (!root.contains(target) || target === root) return null;
  const li = target.closest("li");
  const item = !!li && root.contains(li);
  let dom: HTMLElement | null = item ? li : target;
  if (!item) while (dom && dom.parentElement !== root) dom = dom.parentElement;
  if (!dom) return null;
  try {
    const inner = view.posAtDOM(dom, 0);
    const $p = view.state.doc.resolve(inner);
    if (item) {
      for (let d = $p.depth; d > 0; d--) if ($p.node(d).type.name === "listItem") return { pos: $p.before(d), dom, item };
      return null;
    }
    return { pos: $p.depth > 0 ? $p.before(1) : inner, dom, item };
  } catch {
    return null;
  }
}

// Swaps the block at `pos` with its neighbour; returns where it ends up.
export function moveBlock(editor: Editor, pos: number, dir: -1 | 1, select: "node" | number = "node"): number | null {
  const { state } = editor;
  const node = state.doc.nodeAt(pos);
  if (!node) return null;
  const $pos = state.doc.resolve(pos);
  const index = $pos.index();
  const end = pos + node.nodeSize;
  let tr = state.tr;
  let to: number;
  if (dir < 0) {
    if (index === 0) return null;
    to = pos - $pos.parent.child(index - 1).nodeSize;
    tr = tr.delete(pos, end).insert(to, node);
  } else {
    if (index >= $pos.parent.childCount - 1) return null;
    const next = $pos.parent.child(index + 1);
    tr = tr.insert(end + next.nodeSize, node).delete(pos, end);
    to = pos + next.nodeSize;
  }
  tr = tr.setSelection(select === "node" ? NodeSelection.create(tr.doc, to) : TextSelection.near(tr.doc.resolve(to + select)));
  editor.view.dispatch(tr.scrollIntoView());
  return to;
}

export function deleteBlock(editor: Editor, pos: number) {
  const node = editor.state.doc.nodeAt(pos);
  if (node) editor.view.dispatch(editor.state.tr.delete(pos, pos + node.nodeSize));
}

// Drag from the handle. ProseMirror draws the drop line (Dropcursor); the
// drop itself is done here, so the block lands between blocks and the
// original goes away (the default move leaves an empty table behind).
let dragged: number | null = null;

export function startDrag(view: EditorView, pos: number, dom: HTMLElement, e: DragEvent) {
  const sel = NodeSelection.create(view.state.doc, pos);
  view.dispatch(view.state.tr.setSelection(sel));
  view.dragging = { slice: sel.content(), move: true };
  dragged = pos;
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", dom.textContent ?? "");
    e.dataTransfer.setDragImage(dom, 0, 0);
  }
}

export function endDrag() {
  dragged = null;
}

// For editorProps.handleDrop: true when it was a block drag (handled).
export function dropBlock(view: EditorView, e: DragEvent): boolean {
  const from = dragged;
  dragged = null;
  if (from === null) return false;
  view.dragging = null;
  const { doc } = view.state;
  const node = doc.nodeAt(from);
  const at = view.posAtCoords({ left: e.clientX, top: e.clientY });
  if (!node || !at) return true;
  const $at = doc.resolve(at.pos);
  let d = 1;
  if (node.type.name === "listItem") {
    d = 0;
    for (let i = $at.depth; i > 0; i--)
      if ($at.node(i).type.name === "listItem") {
        d = i;
        break;
      }
    if (!d) return true;
  }
  let target = at.pos;
  if ($at.depth >= d && d > 0) {
    const start = $at.before(d);
    const dom = view.nodeDOM(start);
    const r = dom instanceof HTMLElement ? dom.getBoundingClientRect() : null;
    target = r && e.clientY > r.top + r.height / 2 ? $at.after(d) : start;
  }
  if (target >= from && target <= from + node.nodeSize) return true;
  let tr = view.state.tr.delete(from, from + node.nodeSize);
  const to = tr.mapping.map(target);
  tr = tr.insert(to, node);
  tr = tr.setSelection(NodeSelection.create(tr.doc, to));
  view.dispatch(tr);
  return true;
}

// Ctrl/⌘+Shift+↑/↓ moves the block (or list item) the cursor is in.
export const BlockMoves = Extension.create({
  name: "blockMoves",
  addKeyboardShortcuts() {
    const move = (dir: -1 | 1) => () => {
      const { $from } = this.editor.state.selection;
      let d = 1;
      for (let i = $from.depth; i > 0; i--)
        if ($from.node(i).type.name === "listItem") {
          d = i;
          break;
        }
      if ($from.depth < d || d < 1) return false;
      const pos = $from.before(d);
      return moveBlock(this.editor, pos, dir, $from.pos - pos) !== null;
    };
    return { "Mod-Shift-ArrowUp": move(-1), "Mod-Shift-ArrowDown": move(1) };
  },
});
