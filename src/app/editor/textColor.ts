import { Mark, mergeAttributes } from "@tiptap/core";
import { BOARD_COLORS } from "@/lib/whiteboard";

// Text in one of the whiteboard's colours (stored as {cN}text{/c}). Colour 0
// is the ink itself, so the picker offers 1-5 plus "default".
export const TEXT_COLORS = BOARD_COLORS.map((c, i) => ({ i, c })).slice(1);

export const TextColor = Mark.create({
  name: "textColor",
  addAttributes() {
    return {
      color: {
        default: 1,
        parseHTML: (el) => Number(el.getAttribute("data-color")) || 1,
        renderHTML: (attrs) => ({ "data-color": attrs.color, style: `color:${BOARD_COLORS[Number(attrs.color)] ?? "inherit"}` }),
      },
    };
  },
  parseHTML: () => [{ tag: "span[data-color]" }],
  renderHTML: ({ HTMLAttributes }) => ["span", mergeAttributes(HTMLAttributes), 0],
});
