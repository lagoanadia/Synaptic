import { describe, expect, it } from "vitest";
import { buildOrTsQuery, splitHighlighted } from "./search";

describe("buildOrTsQuery", () => {
  it("joins words with OR", () => {
    expect(buildOrTsQuery("fotosintesis plantas luz")).toBe(
      "fotosintesis | plantas | luz",
    );
  });

  it("lowercases words", () => {
    expect(buildOrTsQuery("Fotosintesis PLANTAS")).toBe("fotosintesis | plantas");
  });

  it("strips punctuation and tsquery operator characters", () => {
    expect(buildOrTsQuery("¿cómo funciona? (la luz) & el agua!")).toBe(
      "cómo | funciona | la | luz | el | agua",
    );
  });

  it("returns null for empty or punctuation-only input", () => {
    expect(buildOrTsQuery("")).toBeNull();
    expect(buildOrTsQuery("   ")).toBeNull();
    expect(buildOrTsQuery("???")).toBeNull();
  });
});

describe("splitHighlighted", () => {
  it("returns a single non-highlighted segment when there are no markers", () => {
    expect(splitHighlighted("plain text")).toEqual([
      { text: "plain text", highlighted: false },
    ]);
  });

  it("splits marked text into highlighted and non-highlighted segments", () => {
    const marked = `before \u0001match\u0002 after`;
    expect(splitHighlighted(marked)).toEqual([
      { text: "before ", highlighted: false },
      { text: "match", highlighted: true },
      { text: " after", highlighted: false },
    ]);
  });
});
