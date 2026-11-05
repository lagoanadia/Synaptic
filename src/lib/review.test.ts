import { describe, expect, it } from "vitest";
import { buildQuiz, conceptExcerpt, sample, shuffle, startOfWeek, type ReviewCard } from "./review";

// Deterministic "random" so tests don't flake.
function seeded(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const card = (id: string, answer: string): ReviewCard => ({
  id,
  pursuitId: "p1",
  pursuitTitle: "AD",
  question: `Q ${id}`,
  answer,
});

describe("shuffle / sample", () => {
  it("keeps every element exactly once", () => {
    const out = shuffle([1, 2, 3, 4, 5], seeded());
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5]);
  });
  it("does not mutate the input", () => {
    const input = [1, 2, 3];
    shuffle(input, seeded());
    expect(input).toEqual([1, 2, 3]);
  });
  it("sample never returns more than asked or available", () => {
    expect(sample([1, 2, 3], 2, seeded())).toHaveLength(2);
    expect(sample([1, 2], 5, seeded())).toHaveLength(2);
    expect(sample([1, 2], -1, seeded())).toHaveLength(0);
  });
});

describe("buildQuiz", () => {
  const cards = [card("a", "Alpha"), card("b", "Beta"), card("c", "Gamma"), card("d", "Delta")];

  it("puts the right answer at correctIndex", () => {
    for (const q of buildQuiz(cards, 4, seeded(7))) {
      const original = cards.find((c) => c.id === q.cardId)!;
      expect(q.options[q.correctIndex]).toBe(original.answer);
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options).size).toBe(4);
    }
  });

  it("respects count", () => {
    expect(buildQuiz(cards, 2, seeded())).toHaveLength(2);
  });

  it("skips questions without at least 2 distinct wrong options", () => {
    expect(buildQuiz([card("a", "Same"), card("b", "same "), card("c", "Other")], 5, seeded())).toEqual([]);
    expect(buildQuiz([card("a", "X"), card("b", "Y")], 5, seeded())).toEqual([]);
  });
});

describe("conceptExcerpt", () => {
  it("drops the heading line and markdown markers", () => {
    expect(conceptExcerpt("# Title\n- **one** point\n1. second")).toBe("one point second");
  });
  it("strips image markers", () => {
    expect(conceptExcerpt("Text ![image](https://x/y.png) more")).toBe("Text more");
  });
  it("cuts long text at a word boundary with an ellipsis", () => {
    const out = conceptExcerpt("word ".repeat(100), 30);
    expect(out.endsWith("…")).toBe(true);
    expect(out.length).toBeLessThanOrEqual(31);
  });
});

describe("startOfWeek", () => {
  it("returns Monday 00:00 of the same week", () => {
    const d = startOfWeek(new Date(2026, 10, 5, 15, 30)); // Thu 5 Nov 2026
    expect(d.getDay()).toBe(1);
    expect(d.getDate()).toBe(2);
    expect(d.getHours()).toBe(0);
  });
  it("treats Sunday as the end of the week, not the start", () => {
    expect(startOfWeek(new Date(2026, 10, 8)).getDate()).toBe(2);
  });
});
