import { describe, expect, it } from "vitest";
import { docToText, textToDoc } from "./richText";

const roundTrip = (s: string) => docToText(textToDoc(s));

describe("rich text <-> stored text", () => {
  it("keeps headings, inline marks and links", () => {
    const s = "# Title\n\nSome **bold**, *italic*, __under__ and a [link](https://x.dev).";
    expect(roundTrip(s)).toBe(s);
  });

  it("keeps nested and lettered lists", () => {
    const s = "1. First\n  a. sub one\n  b. sub two\n2. Second\n\n- bullet\n  - nested";
    expect(roundTrip(s)).toBe(s);
  });

  it("keeps callouts, tables, code and images", () => {
    const s = [
      "! Remember this",
      "| A | B |\n| 1 | 2 |",
      "<js\nconst x = 1;\nconsole.log(x);\n>",
      "![image](https://blob/x.png)",
    ].join("\n\n");
    expect(roundTrip(s)).toBe(s);
  });

  it("keeps line breaks inside a paragraph", () => {
    expect(roundTrip("line one\nline two")).toBe("line one\nline two");
  });

  it("is stable: converting twice changes nothing", () => {
    const s = "## Sub\n\n- a\n- **b**\n\n| x | y |\n| 1 | 2 |";
    expect(roundTrip(roundTrip(s))).toBe(roundTrip(s));
  });

  it("builds a real table node", () => {
    const doc = textToDoc("| A | B |\n| 1 | 2 |");
    expect(doc.content?.[0].type).toBe("table");
    expect(doc.content?.[0].content?.[0].content?.[0].type).toBe("tableHeader");
  });

  it("gives an empty doc a paragraph to type into", () => {
    expect(textToDoc("")).toEqual({ type: "doc", content: [{ type: "paragraph" }] });
  });
});

describe("tables without a header and list extras", () => {
  const round = (t: string) => docToText(textToDoc(t));

  it("keeps a table without a header row", () => {
    const text = "| --- | --- |\n| a | b |\n| c | d |";
    const doc = textToDoc(text);
    expect(doc.content?.[0].content?.[0].content?.[0].type).toBe("tableCell");
    expect(round(text)).toBe(text);
  });

  it("keeps a normal table's header", () => {
    expect(round("| h1 | h2 |\n| a | b |")).toBe("| h1 | h2 |\n| a | b |");
  });

  it("keeps a description under a list item", () => {
    const text = "1. Sencillez: nada que instalar\n   Un fichero y la biblioteca estándar.\n2. Configuración";
    expect(round(text)).toBe(text);
    const item = textToDoc(text).content?.[0].content?.[0];
    expect(item?.content?.[0].content?.some((n) => n.type === "hardBreak")).toBe(true);
  });

  it("carries numbering on after a paragraph", () => {
    const text = "1. Uno\n\nUna explicación.\n\n2. Dos\n3. Tres";
    expect(textToDoc(text).content?.[2].attrs?.start).toBe(2);
    expect(round(text)).toBe(text);
  });
});
