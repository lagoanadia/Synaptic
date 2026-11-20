import { Extension, type Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";

// Tab / Shift+Tab while writing, like a code editor or Word:
// - in a code block: 4 spaces in (or out) on every line the selection
//   touches, and Enter keeps the line's indentation;
// - in a list: one level deeper / shallower;
// - in a table: next / previous cell (the table's own keys);
// - anywhere else: the paragraph's indent, one level per Tab.
// Tab never leaves the editor.

const TAB = "    ";
export const MAX_INDENT = 8;

// Positions where each line touched by the selection starts, in a code block.
function codeLineStarts(editor: Editor) {
  const { state } = editor;
  const { $from, from, to } = state.selection;
  const start = $from.start();
  const text = $from.parent.textContent;
  const starts: number[] = [];
  let pos = 0;
  for (const line of text.split("\n")) {
    const a = start + pos;
    const b = a + line.length;
    if (b >= from && a <= to) starts.push(a);
    pos += line.length + 1;
  }
  return starts;
}

function indentParagraphs(editor: Editor, d: 1 | -1) {
  const { state } = editor;
  const { from, to } = state.selection;
  const tr = state.tr;
  let changed = false;
  state.doc.nodesBetween(from, to, (node, pos) => {
    if (node.type.name !== "paragraph") return;
    const cur = Number(node.attrs.indent) || 0;
    const next = Math.max(0, Math.min(MAX_INDENT, cur + d));
    if (next !== cur) {
      tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent: next });
      changed = true;
    }
  });
  if (changed) editor.view.dispatch(tr);
  return true;
}

const inside = (editor: Editor, name: string) => {
  const { $from } = editor.state.selection;
  for (let d = $from.depth; d > 0; d--) if ($from.node(d).type.name === name) return true;
  return false;
};

export const Indentation = Extension.create({
  name: "indentation",
  // Before the list and code-block keys, so this decides.
  priority: 1000,

  addGlobalAttributes() {
    return [
      {
        types: ["paragraph"],
        attributes: {
          indent: {
            default: 0,
            parseHTML: (el) => Number(el.getAttribute("data-indent")) || 0,
            renderHTML: (attrs) => (attrs.indent ? { "data-indent": attrs.indent, style: `margin-left: ${attrs.indent * 1.75}em` } : {}),
          },
        },
      },
    ];
  },

  addKeyboardShortcuts() {
    const tab = (d: 1 | -1) => () => {
      const editor = this.editor;
      const { state } = editor;
      const { $from, empty } = state.selection;
      if ($from.parent.type.name === "codeBlock") {
        if (d === 1 && empty) return editor.commands.insertContent(TAB);
        const tr = state.tr;
        // Back to front, so earlier positions stay right.
        for (const at of codeLineStarts(editor).reverse()) {
          if (d === 1) tr.insertText(TAB, at);
          else {
            const lead = /^ {0,4}/.exec(state.doc.textBetween(at, Math.min(at + 4, $from.end())))?.[0].length ?? 0;
            if (lead) tr.delete(at, at + lead);
          }
        }
        editor.view.dispatch(tr);
        return true;
      }
      if (inside(editor, "table")) return false;
      if (inside(editor, "listItem")) {
        if (d === 1) editor.commands.sinkListItem("listItem");
        else editor.commands.liftListItem("listItem");
        return true;
      }
      return indentParagraphs(editor, d);
    };
    return {
      Tab: tab(1),
      "Shift-Tab": tab(-1),
      // A new line in code starts where the one above did.
      Enter: () => {
        const { state } = this.editor;
        const { $from, empty } = state.selection;
        if (!empty || $from.parent.type.name !== "codeBlock") return false;
        const before = $from.parent.textContent.slice(0, $from.parentOffset);
        const lead = /^[ \t]*/.exec(before.slice(before.lastIndexOf("\n") + 1))?.[0] ?? "";
        if (!lead) return false;
        const tr = state.tr.insertText(`\n${lead}`);
        this.editor.view.dispatch(tr.setSelection(TextSelection.create(tr.doc, $from.pos + 1 + lead.length)).scrollIntoView());
        return true;
      },
      // Backspace at the very start of an indented paragraph: one level out.
      Backspace: () => {
        const { $from, empty } = this.editor.state.selection;
        if (!empty || $from.parentOffset !== 0 || $from.parent.type.name !== "paragraph" || !$from.parent.attrs.indent) return false;
        return indentParagraphs(this.editor, -1);
      },
    };
  },
});
