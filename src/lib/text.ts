// Notion-style auto-title: the first few words of the content, so a raw
// capture reads as a page title instead of a wall of text in a list.
export function autoTitle(content: string | null, maxWords = 8): string {
  if (!content || content.trim() === "") return "Untitled";
  const words = content.trim().split(/\s+/);
  const title = words.slice(0, maxWords).join(" ");
  return words.length > maxWords ? `${title}…` : title;
}
