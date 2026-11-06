import { describe, expect, it } from "vitest";
import { isCorrect, normalize, parseQuiz, quizVerdict, shuffledOrder } from "./conceptQuiz";

describe("parseQuiz", () => {
  it("keeps valid questions of every kind and drops broken ones", () => {
    const qs = parseQuiz([
      { kind: "choice", prompt: "¿Qué área decide el aspecto?", options: ["Técnica", "Artística"], answer: 1, why: "x" },
      { kind: "choice", prompt: "bad", options: ["a"], answer: 0 },
      { kind: "truefalse", prompt: "Producción valida la viabilidad", answer: true },
      { kind: "truefalse", prompt: "bad", answer: "yes" },
      { kind: "blank", prompt: "La pregunta de Técnica es ¿Qué ___?", accepted: ["construye"] },
      { kind: "blank", prompt: "no gap", accepted: ["x"] },
      { kind: "match", prompt: "Une", pairs: [{ left: "A", right: "1" }, { left: "B", right: "2" }, { left: "C", right: "3" }] },
      { kind: "match", prompt: "too few", pairs: [{ left: "A", right: "1" }] },
    ]);
    expect(qs.map((q) => q.kind)).toEqual(["choice", "truefalse", "blank", "match"]);
  });
});

describe("grading", () => {
  it("is forgiving with typed answers", () => {
    expect(normalize("  ¡La Producción! ")).toBe("produccion");
    const [blank] = parseQuiz([{ kind: "blank", prompt: "¿Qué ___?", accepted: ["construye"] }]);
    expect(isCorrect(blank, "Construye")).toBe(true);
    expect(isCorrect(blank, "diseña")).toBe(false);
  });
  it("needs every pair right in a match", () => {
    const [m] = parseQuiz([{ kind: "match", prompt: "Une", pairs: [{ left: "A", right: "1" }, { left: "B", right: "2" }, { left: "C", right: "3" }] }]);
    expect(isCorrect(m, { 0: 0, 1: 1, 2: 2 })).toBe(true);
    expect(isCorrect(m, { 0: 1, 1: 0, 2: 2 })).toBe(false);
  });
  it("turns a score into a verdict", () => {
    expect(quizVerdict(5, 6)).toBe("got_it");
    expect(quizVerdict(3, 6)).toBe("partly");
    expect(quizVerdict(1, 6)).toBe("not_yet");
  });
  it("shuffles stably and never in solved order", () => {
    expect(shuffledOrder(4, "q1")).toEqual(shuffledOrder(4, "q1"));
    expect(shuffledOrder(4, "q1").sort()).toEqual([0, 1, 2, 3]);
    for (const seed of ["a", "b", "c", "d", "e"]) expect(shuffledOrder(3, seed)).not.toEqual([0, 1, 2]);
  });
});
