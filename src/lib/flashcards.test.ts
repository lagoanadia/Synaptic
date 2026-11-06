import { describe, expect, it } from "vitest";
import { parseFlashcardsResponse } from "./flashcards";

describe("parseFlashcardsResponse", () => {
  it("parses a well-formed response", () => {
    const raw = '{"cards": [{"question": "What is RGB?", "answer": "An additive color model"}]}';
    expect(parseFlashcardsResponse(raw)).toEqual([
      { question: "What is RGB?", answer: "An additive color model", distractors: [] },
    ]);
  });

  it("returns an empty array when the response isn't JSON at all", () => {
    expect(parseFlashcardsResponse("Sorry, I can't do that.")).toEqual([]);
  });

  it("returns an empty array when 'cards' is missing", () => {
    expect(parseFlashcardsResponse('{"content": "no cards field here"}')).toEqual([]);
  });

  it("drops cards missing a question or answer", () => {
    const raw = JSON.stringify({
      cards: [
        { question: "Q1", answer: "A1", distractors: [] },
        { question: "Q2 with no answer" },
        { answer: "A3 with no question" },
        { question: "", answer: "", distractors: [] },
      ],
    });
    expect(parseFlashcardsResponse(raw)).toEqual([{ question: "Q1", answer: "A1", distractors: [] }]);
  });

  it("extracts JSON wrapped in prose", () => {
    const raw = 'Here are the cards:\n{"cards": [{"question": "Q", "answer": "A"}]}\nEnjoy!';
    expect(parseFlashcardsResponse(raw)).toEqual([{ question: "Q", answer: "A", distractors: [] }]);
  });

  it("keeps up to three wrong answers", () => {
    const raw = JSON.stringify({ cards: [{ question: "Q", answer: "A", wrong: ["x", " y ", "", 5, "z", "w"] }] });
    expect(parseFlashcardsResponse(raw)).toEqual([{ question: "Q", answer: "A", distractors: ["x", "y", "z"] }]);
  });
});
