"use client";

import { useEffect, useRef } from "react";
import { EditorView, basicSetup } from "codemirror";
import { keymap } from "@codemirror/view";
import { EditorState, Prec } from "@codemirror/state";
import { indentWithTab } from "@codemirror/commands";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import type { Language } from "@/lib/challenge";

// Light, like the rest of the app (One Light's palette, calmer).
const highlight = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.moduleKeyword, t.operatorKeyword], color: "#a626a4" },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: "#4078f2" },
  { tag: [t.definition(t.variableName), t.definition(t.function(t.variableName))], color: "#4078f2" },
  { tag: [t.variableName, t.propertyName], color: "#37352f" },
  { tag: [t.string, t.special(t.string), t.regexp], color: "#50a14f" },
  { tag: [t.number, t.bool, t.null, t.atom], color: "#986801" },
  { tag: [t.className, t.typeName], color: "#0184bc" },
  { tag: [t.comment, t.lineComment, t.blockComment], color: "#a0a1a7", fontStyle: "italic" },
  { tag: [t.operator, t.punctuation, t.bracket], color: "#6f6e69" },
  { tag: t.self, color: "#e45649" },
]);

const lightTheme = EditorView.theme({
  "&": { height: "100%", fontSize: "14px", backgroundColor: "#fbfbfa", color: "#37352f" },
  ".cm-scroller": { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", lineHeight: "1.7" },
  ".cm-content": { padding: "14px 0", caretColor: "#37352f" },
  ".cm-gutters": { backgroundColor: "#fbfbfa", border: "none", color: "#c7c5c0" },
  ".cm-activeLine, .cm-activeLineGutter": { backgroundColor: "rgba(55,53,47,.04)" },
  "&.cm-focused": { outline: "none" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": { backgroundColor: "#d3e5fb" },
  ".cm-matchingBracket": { backgroundColor: "#e6efe9", outline: "none" },
});

// CodeMirror 6 in a thin React wrapper: line numbers, highlighting,
// brackets, Tab indents, Ctrl/Cmd+Enter runs.
export function CodeEditor({
  value,
  language,
  onChange,
  onRun,
}: {
  value: string;
  language: Language;
  onChange: (code: string) => void;
  onRun: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const handlers = useRef({ onChange, onRun });
  useEffect(() => {
    handlers.current = { onChange, onRun };
  });

  useEffect(() => {
    if (!host.current) return;
    view.current = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          basicSetup,
          keymap.of([indentWithTab]),
          Prec.highest(
            keymap.of([{ key: "Mod-Enter", run: () => (handlers.current.onRun(), true) }]),
          ),
          language === "python" ? python() : javascript({ typescript: language === "typescript" || language === "react", jsx: language === "react" }),
          lightTheme,
          syntaxHighlighting(highlight),
          // Long lines wrap instead of running off the right edge.
          EditorView.lineWrapping,
          EditorView.updateListener.of((u) => {
            if (u.docChanged) handlers.current.onChange(u.state.doc.toString());
          }),
        ],
      }),
    });
    return () => view.current?.destroy();
    // The editor owns the text after mount; `value` is only the start.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  // External resets (the Reset button) replace the whole document.
  useEffect(() => {
    const v = view.current;
    if (v && v.state.doc.toString() !== value) {
      v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } });
    }
  }, [value]);

  return <div ref={host} className="h-full overflow-hidden" />;
}
