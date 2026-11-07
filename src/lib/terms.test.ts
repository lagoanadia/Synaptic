import { describe, expect, it } from "vitest";
import { termMatches } from "./terms";

describe("termMatches", () => {
  it("marks each term once, whole words, any case", () => {
    const seen = new Set<number>();
    const text = "Una clase define objetos. Las clases y la Clase base.";
    expect(termMatches(text, ["clase", "objetos"], seen)).toEqual([
      { from: 4, to: 9, index: 0 },
      { from: 17, to: 24, index: 1 },
    ]);
    expect(termMatches("otra clase", ["clase", "objetos"], seen)).toEqual([]);
  });
  it("prefers the longer term and escapes symbols", () => {
    expect(termMatches("usa C++ y PreparedStatement", ["Prepared", "PreparedStatement", "C++"], new Set())).toEqual([
      { from: 4, to: 7, index: 2 },
      { from: 10, to: 27, index: 1 },
    ]);
  });
});
