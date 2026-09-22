// Notion-style auto-title: the first few words of the content, so a raw
// capture reads as a page title instead of a wall of text in a list.
export function autoTitle(content: string | null, maxWords = 8): string {
  if (!content || content.trim() === "") return "Untitled";
  const words = content.trim().split(/\s+/);
  const title = words.slice(0, maxWords).join(" ");
  return words.length > maxWords ? `${title}…` : title;
}

export type ContentSegment =
  | { type: "text"; value: string }
  | { type: "image"; url: string };

// Content is stored as plain text with inline `![image](url)` markers
// (inserted at the cursor when a picture is added) — this splits it back
// into ordered text/image segments so a page can render them interleaved
// instead of dumping all images after the text.
export function parseContent(content: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  const pattern = /!\[image\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: content.slice(lastIndex, match.index) });
    }
    segments.push({ type: "image", url: match[1] });
    lastIndex = pattern.lastIndex;
  }
  if (lastIndex < content.length) {
    segments.push({ type: "text", value: content.slice(lastIndex) });
  }
  return segments;
}
