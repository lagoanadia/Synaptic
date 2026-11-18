import { describe, expect, it } from "vitest";
import { docToText, textToDoc } from "./richText";
import { parseNoteBlocks } from "./text";

const page = "Antes\n\n:::columns\n![image](/api/boards/abcdefghij12#done)\n:::|\nAl lado **negrita**\n:::\n\nDespués";

describe("columns", () => {
  it("parses into side-by-side blocks", () => {
    const blocks = parseNoteBlocks(page);
    expect(blocks.map((b) => b.type)).toEqual(["paragraph", "columns", "paragraph"]);
    const cols = blocks[1].type === "columns" ? blocks[1].cols : [];
    expect(cols.map((c) => c.map((b) => b.type))).toEqual([["image"], ["paragraph"]]);
  });
  it("survives the editor and back", () => {
    expect(docToText(textToDoc(page))).toBe(page);
  });
  it("keeps an empty column", () => {
    const doc = textToDoc("x");
    doc.content = [{ type: "columns", content: [{ type: "column", content: [{ type: "paragraph", content: [{ type: "text", text: "a" }] }] }, { type: "column", content: [{ type: "paragraph" }] }] }];
    expect(parseNoteBlocks(docToText(doc))[0]).toMatchObject({ type: "columns" });
  });
});
