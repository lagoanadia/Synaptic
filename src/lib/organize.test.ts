import { describe, expect, it } from "vitest";
import { parseOrganizeResponse } from "./organize";

describe("parseOrganizeResponse", () => {
  it("parses a well-formed response", () => {
    const raw = '{"content": "# Heading\\n\\nSome text", "tags": ["biology", "cells"]}';
    expect(parseOrganizeResponse(raw)).toEqual({
      content: "# Heading\n\nSome text",
      tags: ["biology", "cells"],
    });
  });

  it("falls back to the raw text when the response isn't JSON at all", () => {
    const raw = "Sorry, I can't help with that right now.";
    expect(parseOrganizeResponse(raw)).toEqual({
      content: raw,
      tags: [],
    });
  });

  it("extracts the JSON when the model wraps it in prose", () => {
    const raw =
      'Here\'s the organized note:\n{"content": "Body text", "tags": ["x"]}\nHope that helps!';
    expect(parseOrganizeResponse(raw)).toEqual({
      content: "Body text",
      tags: ["x"],
    });
  });

  it("falls back to the raw text when the JSON has no content field", () => {
    const raw = '{"tags": ["a", "b"]}';
    expect(parseOrganizeResponse(raw)).toEqual({
      content: raw,
      tags: ["a", "b"],
    });
  });

  it("falls back to the raw text when content is an empty string", () => {
    const raw = '{"content": "   ", "tags": ["a"]}';
    expect(parseOrganizeResponse(raw)).toEqual({
      content: raw,
      tags: ["a"],
    });
  });

  it("defaults tags to an empty array when tags is missing", () => {
    const raw = '{"content": "Just the content"}';
    expect(parseOrganizeResponse(raw)).toEqual({
      content: "Just the content",
      tags: [],
    });
  });

  it("drops non-string entries and dedupes tags", () => {
    const raw = '{"content": "Text", "tags": ["a", "a", 5, null, "b", "  "]}';
    expect(parseOrganizeResponse(raw)).toEqual({
      content: "Text",
      tags: ["a", "b"],
    });
  });

  it("treats a JSON array (not an object) as unusable and falls back", () => {
    const raw = '["not", "an", "object"]';
    expect(parseOrganizeResponse(raw)).toEqual({
      content: raw,
      tags: [],
    });
  });
});
