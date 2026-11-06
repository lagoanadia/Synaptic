import { describe, expect, it } from "vitest";
import { buildOrTsQuery, buildPrefixTsQuery, markWords, splitHighlighted } from "./search";

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
      "funciona | luz | agua",
    );
  });

  it("returns null for empty or punctuation-only input", () => {
    expect(buildOrTsQuery("")).toBeNull();
    expect(buildOrTsQuery("   ")).toBeNull();
    expect(buildOrTsQuery("???")).toBeNull();
  });

  it("drops stopwords so ranking isn't drowned out by them", () => {
    expect(buildOrTsQuery("what is a stack")).toBe("stack");
    expect(buildOrTsQuery("¿cómo funciona la fotosíntesis?")).toBe(
      "funciona | fotosíntesis",
    );
  });

  it("falls back to matching stopwords if that's all there is", () => {
    expect(buildOrTsQuery("what is it")).toBe("what | is | it");
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

describe("buildPrefixTsQuery", () => {
  it("ANDs words as prefixes, without stopwords", () => {
    expect(buildPrefixTsQuery("la viab")).toBe("viab:*");
    expect(buildPrefixTsQuery("áreas desarrollo")).toBe("áreas:* & desarrollo:*");
  });
  it("drops tsquery syntax", () => {
    expect(buildPrefixTsQuery("a & !b | (c)")).toBe("b:* & c:*");
    expect(buildPrefixTsQuery("  ")).toBeNull();
  });
});

describe("markWords", () => {
  it("highlights each word, case-insensitively", () => {
    expect(splitHighlighted(markWords("¿Es viable el plan?", "VIABLE"))).toEqual([
      { text: "¿Es ", highlighted: false },
      { text: "viable", highlighted: true },
      { text: " el plan?", highlighted: false },
    ]);
  });
  it("leaves regex characters alone", () => {
    expect(markWords("a+b", "+")).toBe("a+b");
  });
});
