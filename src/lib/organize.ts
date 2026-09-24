import { parseJsonLoosely } from "@/lib/json";

export type OrganizeResult = { content: string; tags: string[] };

// Turns Groq's raw completion text into a note's content + tags. Never
// throws: broken JSON, a missing/empty "content" field, or a missing
// "tags" field all fall back to something renderable rather than
// crashing the Organize action for the whole pursuit.
export function parseOrganizeResponse(rawText: string): OrganizeResult {
  const parsed = parseJsonLoosely(rawText);
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
