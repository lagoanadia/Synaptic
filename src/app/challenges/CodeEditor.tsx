"use client";

import { useEffect, useRef } from "react";
import { EditorView, basicSetup } from "codemirror";
import { keymap } from "@codemirror/view";
import { EditorState, Prec } from "@codemirror/state";
import { indentWithTab } from "@codemirror/commands";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { oneDark } from "@codemirror/theme-one-dark";

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
          oneDark,
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
