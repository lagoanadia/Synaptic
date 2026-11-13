import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as PmNode } from "@tiptap/pm/model";
import { Prism } from "prism-react-renderer";

// Colours for code blocks while you write (keywords, strings, numbers,
// comments, functions…), by the block's language; no language → generic
// C-like colouring, which suits most class snippets.
type Tok = string | { type: string; content: Tok | Tok[]; alias?: string | string[] };
const L = Prism.languages as Record<string, unknown>;
if (!L.java)
  L.java = Prism.languages.extend("clike", {
    keyword: /\b(?:abstract|boolean|break|byte|case|catch|char|class|continue|default|do|double|else|enum|extends|final|finally|float|for|if|implements|import|instanceof|int|interface|long|new|null|package|private|protected|public|return|short|static|super|switch|this|throw|throws|try|var|void|while|true|false)\b/,
    "class-name": /\b[A-Z]\w*\b/,
  });
const LANG: Record<string, string> = { js: "javascript", javascript: "javascript", ts: "typescript", typescript: "typescript", python: "python", py: "python", java: "java", sql: "sql", jsx: "jsx", tsx: "tsx", json: "json", css: "css", html: "markup" };

function decorate(doc: PmNode): DecorationSet {
  const out: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name !== "codeBlock") return;
    const lang = LANG[(node.attrs.language as string | null) ?? ""] ?? "clike";
    const grammar = Prism.languages[lang] ?? Prism.languages.clike;
    let at = pos + 1;
    const walk = (toks: Tok | Tok[], type: string | null) => {
      for (const tok of Array.isArray(toks) ? toks : [toks]) {
        if (typeof tok === "string") {
          if (type) out.push(Decoration.inline(at, at + tok.length, { class: `tok-${type}` }));
          at += tok.length;
        } else walk(tok.content, tok.type);
      }
    };
    walk(Prism.tokenize(node.textContent, grammar) as Tok[], null);
    return false;
  });
  return DecorationSet.create(doc, out);
}

const key = new PluginKey<DecorationSet>("codeHighlight");

export const CodeHighlight = Extension.create({
  name: "codeHighlight",
  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key,
        state: {
          init: (_, { doc }) => decorate(doc),
          apply: (tr, old) => (tr.docChanged ? decorate(tr.doc) : old),
        },
        props: { decorations: (state) => key.getState(state) },
      }),
    ];
  },
});
