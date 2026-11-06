"use client";

import { useEffect, useRef } from "react";
import { EditorView, basicSetup } from "codemirror";
import { keymap } from "@codemirror/view";
import { EditorState, Prec } from "@codemirror/state";
import { indentWithTab } from "@codemirror/commands";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { oneDarkTheme } from "@codemirror/theme-one-dark";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

// One Dark's chrome with a calmer palette: One Dark paints every variable
// red, so ordinary JS read as a wall of red.
const highlight = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.moduleKeyword, t.operatorKeyword], color: "#c792ea" },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: "#82aaff" },
  { tag: [t.definition(t.variableName), t.definition(t.function(t.variableName))], color: "#82aaff" },
  { tag: [t.variableName, t.propertyName], color: "#d7dae0" },
  { tag: [t.string, t.special(t.string), t.regexp], color: "#c3e88d" },
  { tag: [t.number, t.bool, t.null, t.atom], color: "#f78c6c" },
  { tag: [t.className, t.typeName], color: "#ffcb6b" },
  { tag: [t.comment, t.lineComment, t.blockComment], color: "#7f848e", fontStyle: "italic" },
  { tag: [t.operator, t.punctuation, t.bracket], color: "#89ddff" },
  { tag: t.self, color: "#ff5370" },
]);

// CodeMirror 6 in a thin React wrapper: line numbers, highlighting,
// brackets, Tab indents, Ctrl/Cmd+Enter runs.
export function CodeEditor({
  value,
  language,
  onChange,
  onRun,
}: {
  value: string;
  language: "javascript" | "python";
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
          language === "python" ? python() : javascript(),
          oneDarkTheme,
          syntaxHighlighting(highlight),
          EditorView.theme({ "&": { height: "100%", fontSize: "14px" }, ".cm-scroller": { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" } }),
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
