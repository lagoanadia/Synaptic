// JSON from an AI reply. JSON mode still sometimes adds prose around it, so
// fall back to the outermost {...}. Null if nothing parses.
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
