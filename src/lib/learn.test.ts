import { describe, expect, it } from "vitest";
import { answerStandsOut, answer, currentQuestion, isCloseEnough, isFinished, qualityFor, startLearn, type LearnItem } from "./learn";

function seeded(seed = 1) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}
const item = (id: string, ans = `answer ${id}`, distractors = ["w1", "w2", "w3"]): LearnItem => ({
  id, kind: "card", pursuitId: "p", pursuitTitle: "AD", context: null, prompt: `Q ${id}`, answer: ans, distractors,
});

describe("isCloseEnough", () => {
  it("ignores case, accents and punctuation", () => {
    expect(isCloseEnough("  Acceso ALEATORIO!", "acceso aleatorio")).toBe(true);
    expect(isCloseEnough("normalizacion", "Normalización")).toBe(true);
  });
  it("forgives small typos but not different words", () => {
    expect(isCloseEnough("polimorfsmo", "polimorfismo")).toBe(true);
    expect(isCloseEnough("herencia", "polimorfismo")).toBe(false);
    expect(isCloseEnough("", "x")).toBe(false);
  });
});

describe("learn session", () => {
  it("asks multiple choice / true-false first, then written", () => {
    let s = startLearn([item("a")], 7, seeded(3));
    expect(["choice", "truefalse"]).toContain(currentQuestion(s, seeded(3))!.type);
    s = answer(s, true, seeded());
    expect(currentQuestion(s, seeded())!.type).toBe("written");
    s = answer(s, true, seeded());
    expect(isFinished(s)).toBe(true);
  });

  it("brings missed items back and counts misses", () => {
    let s = startLearn([item("a"), item("b")], 2, seeded(2));
    const first = s.round[0];
    s = answer(s, false, seeded());
    expect(s.misses[first]).toBe(1);
    s = answer(s, true, seeded()); // the other one
    expect(s.round).toContain(first);
    expect(isFinished(s)).toBe(false);
  });

  it("self-checks long answers and skips choice without distractors", () => {
    const s = startLearn([item("a", "a fairly long answer with many words in it", [])], 7, seeded());
    expect(currentQuestion(s, seeded())!.type).toBe("selfcheck");
    expect(isFinished(answer(s, true, seeded()))).toBe(true);
  });

  it("choice options include the answer exactly once", () => {
    const s = startLearn([item("a")], 7, () => 0.9);
    const q = currentQuestion(s, () => 0.9)!;
    expect(q.type).toBe("choice");
    expect(q.options!.filter((o) => o === "answer a")).toHaveLength(1);
  });

  it("maps misses to SM-2 quality", () => {
    expect([qualityFor(0), qualityFor(1), qualityFor(3)]).toEqual([4, 3, 1]);
  });
});

describe("answerStandsOut", () => {
  it("flags a right answer much longer than every wrong one", () => {
    expect(answerStandsOut("list() solo accede al nivel actual, walk() recorre todo el árbol consumiendo más recursos", ["walk() solo muestra directorios", "walk() es más rápido", "list() es recursivo"])).toBe(true);
    expect(answerStandsOut("Producción", ["Redacción", "Técnica", "Artística"])).toBe(false);
    expect(answerStandsOut("abc", [])).toBe(false);
  });
});
