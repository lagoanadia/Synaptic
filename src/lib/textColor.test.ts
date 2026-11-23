import { describe, expect, it } from "vitest";
import { docToText, textToDoc } from "./richText";
import { parseNoteBlocks } from "./text";

describe("text colour", () => {
  const page = "Hola {c1}rojo{/c} y {c4}**verde**{/c} fin";
  it("parses", () => {
    const b = parseNoteBlocks(page)[0];
    expect(b.type === "paragraph" && b.inline.filter((n) => n.type === "color")).toEqual([
      { type: "color", color: 1, value: "rojo" },
      { type: "color", color: 4, value: "verde", bold: true },
    ]);
  });
  it("survives the editor", () => {
    expect(docToText(textToDoc(page))).toBe(page);
  });
});
