// Key terms in a note: words that name a concept on a map. The editor
// marks the first time each one appears.

export type TermHint = { term: string; title: string; summary: string; href: string; where: string };

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Whole-word, any-case matches in `text` of terms not already in `seen`
// (which it fills in, so a term is only marked once per note).
export function termMatches(text: string, terms: string[], seen: Set<number>): { from: number; to: number; index: number }[] {
  if (terms.length === 0) return [];
  const lower = terms.map((t) => t.toLowerCase());
  const alt = [...terms].sort((a, b) => b.length - a.length).map(escape).join("|");
  const re = new RegExp(`(?<![\\p{L}\\d_])(?:${alt})(?![\\p{L}\\d_])`, "giu");
  const out: { from: number; to: number; index: number }[] = [];
  for (const m of text.matchAll(re)) {
    const index = lower.indexOf(m[0].toLowerCase());
    if (index < 0 || seen.has(index)) continue;
    seen.add(index);
    out.push({ from: m.index, to: m.index + m[0].length, index });
  }
  return out;
}
