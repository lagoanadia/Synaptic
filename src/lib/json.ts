// Shared by anything that parses a Groq JSON response (Organize,
// flashcard generation, …). response_format: "json_object" is supposed
// to guarantee pure JSON, but models occasionally wrap it in prose
// anyway ("Here's the result:\n{...}\nHope that helps!") — a plain
// JSON.parse would throw on that. Falling back to slicing out the
// outermost {...} recovers the JSON in that case instead of discarding
// the whole response. Returns null (never throws) if nothing parseable
// is found.
export function parseJsonLoosely(text: string): unknown {
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
