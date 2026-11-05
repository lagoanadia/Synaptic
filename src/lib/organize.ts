import { parseJsonLoosely } from "@/lib/json";

export type OrganizeResult = { content: string; tags: string[] };

// AI text → note content + tags. Never throws; falls back to something renderable.
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
