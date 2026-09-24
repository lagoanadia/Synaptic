export type OrganizeResult = { content: string; tags: string[] };

// Groq's response_format: "json_object" is supposed to guarantee pure
// JSON, but models occasionally still wrap it in prose anyway ("Here's
// the organized note:\n{...}\nHope that helps!") — a plain JSON.parse
// would throw on that. Falling back to slicing out the outermost {...}
// recovers the JSON in that case instead of discarding the whole response.
function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      return null;
    }
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

// Turns Groq's raw completion text into a note's content + tags. Never
// throws: broken JSON, a missing/empty "content" field, or a missing
// "tags" field all fall back to something renderable rather than
// crashing the Organize action for the whole pursuit.
export function parseOrganizeResponse(rawText: string): OrganizeResult {
  const parsed = tryParseJson(rawText);
  const obj =
    parsed !== null && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : {};

  const content =
    typeof obj.content === "string" && obj.content.trim() !== ""
      ? obj.content
      : rawText;

  const tags = Array.isArray(obj.tags)
    ? Array.from(
        new Set(
          obj.tags.filter(
            (t): t is string => typeof t === "string" && t.trim() !== "",
          ),
        ),
      )
    : [];

  return { content, tags };
}
