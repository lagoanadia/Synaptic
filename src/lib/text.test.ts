import { describe, expect, it } from "vitest";
import { autoTitle, parseContent, parseNoteBlocks } from "./text";

describe("autoTitle", () => {
  it("returns 'Untitled' for empty or blank content", () => {
    expect(autoTitle(null)).toBe("Untitled");
    expect(autoTitle("")).toBe("Untitled");
    expect(autoTitle("   ")).toBe("Untitled");
  });

  it("uses a leading heading line as the title, minus the #", () => {
    expect(autoTitle("# Photosynthesis\n\nSome body text")).toBe("Photosynthesis");
  });

  it("picks up a heading even without a space after the #s", () => {
    expect(autoTitle("#02 Licencias y mercado\n\nmore text")).toBe(
      "02 Licencias y mercado",
    );
  });

  it("strips a leading list/callout marker for the non-heading fallback", () => {
    expect(autoTitle("- first bullet point here")).toBe("first bullet point here");
    expect(autoTitle("! a key takeaway")).toBe("a key takeaway");
    expect(autoTitle("1. first item")).toBe("first item");
  });

  it("truncates to maxWords with an ellipsis", () => {
    const content = "one two three four five six seven eight nine ten";
    expect(autoTitle(content, 4)).toBe("one two three four…");
  });

  it("doesn't add an ellipsis when content fits within maxWords", () => {
    expect(autoTitle("short title", 8)).toBe("short title");
  });
});

describe("parseContent", () => {
  it("splits interleaved text and image markers in order", () => {
    const content = "before ![image](url1) middle ![image](url2) after";
    expect(parseContent(content)).toEqual([
      { type: "text", value: "before " },
      { type: "image", url: "url1" },
      { type: "text", value: " middle " },
      { type: "image", url: "url2" },
      { type: "text", value: " after" },
    ]);
  });

  it("returns a single text segment when there are no images", () => {
    expect(parseContent("just text")).toEqual([{ type: "text", value: "just text" }]);
  });
});

describe("parseNoteBlocks", () => {
  it("parses headings at every level, space required or not", () => {
    const blocks = parseNoteBlocks("# H1\n## H2\n###H3");
    expect(blocks).toEqual([
      { type: "heading", level: 1, inline: [{ type: "text", value: "H1" }] },
      { type: "heading", level: 2, inline: [{ type: "text", value: "H2" }] },
      { type: "heading", level: 3, inline: [{ type: "text", value: "H3" }] },
    ]);
  });

  it("clamps a heading with more than 3 #s down to level 3", () => {
    const blocks = parseNoteBlocks("##### Too deep");
    expect(blocks).toEqual([
      { type: "heading", level: 3, inline: [{ type: "text", value: "Too deep" }] },
    ]);
  });

  it("parses a callout", () => {
    expect(parseNoteBlocks("! Remember this")).toEqual([
      { type: "callout", inline: [{ type: "text", value: "Remember this" }] },
    ]);
  });

  it("groups consecutive bullet lines into one list", () => {
    const blocks = parseNoteBlocks("- one\n- two\n- three");
    expect(blocks).toEqual([
      {
        type: "bulletList",
        items: [
          [{ type: "text", value: "one" }],
          [{ type: "text", value: "two" }],
          [{ type: "text", value: "three" }],
        ],
      },
    ]);
  });

  it("parses numbered and lettered lists separately", () => {
    const blocks = parseNoteBlocks("1. first\n2. second");
    expect(blocks).toEqual([
      {
        type: "numberedList",
        items: [[{ type: "text", value: "first" }], [{ type: "text", value: "second" }]],
      },
    ]);

    const lettered = parseNoteBlocks("a. first\nb. second");
    expect(lettered).toEqual([
      {
        type: "letteredList",
        items: [[{ type: "text", value: "first" }], [{ type: "text", value: "second" }]],
      },
    ]);
  });

  it("folds wrapped lines into one paragraph", () => {
    const blocks = parseNoteBlocks("line one\nline two continues");
    expect(blocks).toEqual([
      { type: "paragraph", inline: [{ type: "text", value: "line one line two continues" }] },
    ]);
  });

  it("parses bold, italic and underline inline styles", () => {
    const blocks = parseNoteBlocks("**bold** *italic* __underline__ plain");
    expect(blocks).toEqual([
      {
        type: "paragraph",
        inline: [
          { type: "bold", value: "bold" },
          { type: "text", value: " " },
          { type: "italic", value: "italic" },
          { type: "text", value: " " },
          { type: "underline", value: "underline" },
          { type: "text", value: " plain" },
        ],
      },
    ]);
  });

  it("parses a table with a header row and body rows", () => {
    const blocks = parseNoteBlocks("| A | B |\n| 1 | 2 |\n| 3 | 4 |");
    expect(blocks).toEqual([
      {
        type: "table",
        header: [[{ type: "text", value: "A" }], [{ type: "text", value: "B" }]],
        rows: [
          [[{ type: "text", value: "1" }], [{ type: "text", value: "2" }]],
          [[{ type: "text", value: "3" }], [{ type: "text", value: "4" }]],
        ],
      },
    ]);
  });

  it("doesn't fold a table into a preceding paragraph", () => {
    const blocks = parseNoteBlocks("some text\n| A | B |\n| 1 | 2 |");
    expect(blocks[0]).toEqual({
      type: "paragraph",
      inline: [{ type: "text", value: "some text" }],
    });
    expect(blocks[1].type).toBe("table");
  });

  it("renders an inline image marker as its own block", () => {
    const blocks = parseNoteBlocks("before\n![image](http://x/y.png)\nafter");
    expect(blocks).toEqual([
      { type: "paragraph", inline: [{ type: "text", value: "before" }] },
      { type: "image", url: "http://x/y.png" },
      { type: "paragraph", inline: [{ type: "text", value: "after" }] },
    ]);
  });
});
