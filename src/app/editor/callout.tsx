"use client";

import Blockquote from "@tiptap/extension-blockquote";
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { useRef, useState } from "react";
import { useT } from "@/app/LangProvider";
import { Popover } from "@/app/ui/Popover";
import { CALLOUT_COLORS, type CalloutColor } from "@/lib/text";

export const CALLOUT_EMOJIS = ["💡", "📌", "⚠️", "✅", "❓", "📝", "🔥", "⭐"];
const COLOR_NAME: Record<CalloutColor, string> = { yellow: "Amarillo", blue: "Azul", green: "Verde", red: "Rojo", gray: "Gris" };

// A callout: an emoji on the left and a soft colour behind, no border; tap
// the emoji to pick another one and the colour. Stored as "!blue 📌 texto";
// an old "! texto" shows as 💡 on yellow and stays as it was.
function CalloutView({ node, updateAttributes, editor }: NodeViewProps) {
  const t = useT();
  const emoji = String(node.attrs.emoji || "💡");
  const color = (node.attrs.color || "yellow") as CalloutColor;
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  return (
    <NodeViewWrapper className={`callout callout-${color}`}>
      <button
        ref={button}
        type="button"
        contentEditable={false}
        disabled={!editor.isEditable}
        onClick={() => setOpen((o) => !o)}
        title={t("Cambiar icono y color")}
        aria-label={t("Cambiar icono y color")}
        className="callout-emoji"
      >
        {emoji}
      </button>
      <NodeViewContent className="min-w-0 flex-1" />
      <Popover anchor={button} open={open} onClose={() => setOpen(false)} label={t("Cambiar icono y color")}>
        <div className="flex w-[232px] flex-col gap-2.5 p-2.5" contentEditable={false}>
          <div className="grid grid-cols-8 gap-0.5">
            {CALLOUT_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                aria-pressed={e === emoji}
                onClick={() => updateAttributes({ emoji: e })}
                className={`grid size-7 place-items-center rounded-md text-base hover:bg-hover ${e === emoji ? "bg-chip" : ""}`}
              >
                {e}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5">
            {CALLOUT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                title={t(COLOR_NAME[c])}
                aria-label={t(COLOR_NAME[c])}
                aria-pressed={c === color}
                onClick={() => updateAttributes({ color: c })}
                className={`callout-${c} size-6 rounded-md ${c === color ? "ring-2 ring-accent ring-offset-1 ring-offset-white" : "ring-1 ring-black/5"}`}
              />
            ))}
          </div>
        </div>
      </Popover>
    </NodeViewWrapper>
  );
}

export const Callout = Blockquote.extend({
  addAttributes() {
    return {
      emoji: { default: null, parseHTML: (el) => el.getAttribute("data-emoji"), renderHTML: (a) => (a.emoji ? { "data-emoji": a.emoji } : {}) },
      color: { default: null, parseHTML: (el) => el.getAttribute("data-color"), renderHTML: (a) => (a.color ? { "data-color": a.color } : {}) },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(CalloutView);
  },
});
