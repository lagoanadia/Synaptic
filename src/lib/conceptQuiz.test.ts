import { describe, expect, it } from "vitest";
import { gapOk, isCorrect, normalize, shuffleQuiz, parseQuiz, quizVerdict, shuffledOrder } from "./conceptQuiz";

describe("parseQuiz", () => {
  it("keeps valid questions of every kind and drops broken ones", () => {
    const qs = parseQuiz([
      { kind: "choice", prompt: "¿Qué área decide el aspecto?", options: ["Técnica", "Artística"], answer: 1, why: "x" },
      { kind: "choice", prompt: "bad", options: ["a"], answer: 0 },
      { kind: "truefalse", prompt: "Producción valida la viabilidad", answer: true },
      { kind: "truefalse", prompt: "bad", answer: "yes" },
      { kind: "blank", prompt: "La pregunta de Técnica es ¿Qué ___?", accepted: ["construye"] },
      { kind: "blank", prompt: "no gap", accepted: ["x"] },
      { kind: "blank", prompt: "uno ___ y otro ___", accepted: ["solo uno"] },
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
  it("grades every gap of a blank", () => {
    const [nested] = parseQuiz([{ kind: "blank", prompt: "Libre pone el acento en la ___ y open source en el ___.", accepted: [["libertad"], ["código abierto", "codigo"]] }]);
    expect(isCorrect(nested, ["Libertad", "codigo abierto"])).toBe(true);
    expect(isCorrect(nested, ["libertad", "precio"])).toBe(false);
    const [flat] = parseQuiz([{ kind: "blank", prompt: "a ___ b ___", accepted: ["libertad", "código abierto"] }]);
    expect(flat.kind === "blank" && flat.gaps).toEqual([["libertad"], ["código abierto"]]);
    const [joined] = parseQuiz([{ kind: "blank", prompt: "a ___ b ___", accepted: ["libertad y código abierto"] }]);
    expect(isCorrect(joined, ["libertad", "código abierto"])).toBe(true);
  });
  it("takes the key word of a longer answer", () => {
    expect(gapOk(["sala del restaurante"], "restaurante")).toBe(true);
    expect(gapOk(["despensa"], "la despensa")).toBe(true);
    expect(gapOk(["sala del restaurante"], "cocina")).toBe(false);
    expect(gapOk(["base de datos"], "de")).toBe(false);
  });
  it("needs every pair right in a match", () => {
    const [m] = parseQuiz([{ kind: "match", prompt: "Une", pairs: [{ left: "A", right: "1" }, { left: "B", right: "2" }, { left: "C", right: "3" }] }]);
    expect(isCorrect(m, { 0: 0, 1: 1, 2: 2 })).toBe(true);
    expect(isCorrect(m, { 0: 1, 1: 0, 2: 2 })).toBe(false);
  });
  it("shuffles options and keeps the right one right", () => {
    const [q] = parseQuiz([{ kind: "choice", prompt: "¿?", options: ["bien", "mal 1", "mal 2", "mal 3"], answer: 0 }]);
    const seen = new Set<number>();
    for (let n = 0; n < 40; n++) {
      const [s] = shuffleQuiz([q]);
      if (s.kind !== "choice") throw new Error();
      expect(s.options[s.answer]).toBe("bien");
      seen.add(s.answer);
    }
    expect(seen.size).toBeGreaterThan(1);
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
