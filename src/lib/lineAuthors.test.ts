import { describe, expect, it } from "vitest";
import { diffLineAuthors, normalizeLineAuthors } from "./lineAuthors";

describe("diffLineAuthors", () => {
  it("keeps the same author when nothing changed", () => {
    const result = diffLineAuthors(["a", "b", "c"], ["u1", "u1", "u1"], ["a", "b", "c"], "u2");
    expect(result).toEqual(["u1", "u1", "u1"]);
  });

  it("attributes a newly appended line to the editor, keeps the rest", () => {
    const result = diffLineAuthors(["a", "b"], ["u1", "u1"], ["a", "b", "c"], "u2");
    expect(result).toEqual(["u1", "u1", "u2"]);
  });

  it("attributes an edited line to the editor, keeps the untouched ones", () => {
    const result = diffLineAuthors(
      ["a", "b", "c"],
      ["u1", "u1", "u1"],
      ["a", "b EDITED", "c"],
      "u2",
    );
    expect(result).toEqual(["u1", "u2", "u1"]);
  });

  it("drops a deleted line without shifting the remaining authors", () => {
    const result = diffLineAuthors(
      ["a", "b", "c"],
      ["u1", "u2", "u1"],
      ["a", "c"],
      "u2",
    );
    expect(result).toEqual(["u1", "u1"]);
  });

  it("attributes every line to the editor when content is brand new", () => {
    const result = diffLineAuthors([], [], ["a", "b"], "u1");
    expect(result).toEqual(["u1", "u1"]);
  });

  it("handles a line inserted in the middle without disturbing lines around it", () => {
    const result = diffLineAuthors(
      ["a", "c"],
      ["u1", "u1"],
      ["a", "b", "c"],
      "u2",
    );
    expect(result).toEqual(["u1", "u2", "u1"]);
  });
});

describe("normalizeLineAuthors", () => {
  it("passes through a lineAuthorIds array that already matches", () => {
    expect(normalizeLineAuthors(["a", "b"], ["u1", "u2"], "u3")).toEqual(["u1", "u2"]);
  });

  it("falls back to the dump's original author when lengths don't match", () => {
    expect(normalizeLineAuthors(["a", "b", "c"], [], "u1")).toEqual(["u1", "u1", "u1"]);
    expect(normalizeLineAuthors(["a", "b"], ["u1"], "u2")).toEqual(["u2", "u2"]);
  });
});
