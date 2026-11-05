// Control characters as highlight markers instead of HTML; see splitHighlighted.
const HL_START = "\u0001";
const HL_END = "\u0002";

// Passed as ts_headline()'s 4th argument (a single options string) in the
// raw search query — kept here, next to the sentinels it references, so
// the two can never drift out of sync.
export const HEADLINE_OPTIONS = `StartSel=${HL_START}, StopSel=${HL_END}, MaxFragments=2, MaxWords=25, MinWords=5`;

export type HighlightSegment = { text: string; highlighted: boolean };

// Search uses Postgres' 'simple' config (content mixes English and Spanish),
// which keeps function words. Dropping them keeps OR-ranking about real words.
const STOPWORDS = new Set([
  // English
  "a", "an", "and", "are", "as", "at", "be", "by", "can", "could", "did",
  "do", "does", "for", "from", "had", "has", "have", "he", "how", "i", "in",
  "is", "it", "its", "my", "of", "on", "our", "she", "should", "that", "the",
  "their", "these", "they", "this", "those", "to", "was", "we", "were",
  "what", "when", "where", "which", "who", "why", "will", "with", "would",
  "you", "your",
  // Spanish
  "al", "algo", "como", "con", "cual", "cuales", "cuando", "cómo", "cuál",
  "cuáles", "cuándo", "de", "del", "donde", "dónde", "el", "ella", "en",
  "es", "esa", "esas", "ese", "eso", "esos", "esta", "estas", "este",
  "esto", "estos", "está", "están", "estar", "ser", "la", "las", "le", "les",
  "lo", "los", "mi", "mis", "nos", "o", "para", "por", "porque", "qué",
  "que", "quien", "quienes", "quién", "quiénes", "se", "su", "sus", "tu",
  "tus", "un", "una", "unas", "unos", "y",
]);

// OR of the input's words (plainto_tsquery would AND them, and a natural
// question almost never matches every word). ts_rank still favors more
// overlap. Extracting words avoids escaping tsquery operators.
export function buildOrTsQuery(text: string): string | null {
  const words = text.match(/[\p{L}\p{N}]+/gu) ?? [];
  if (words.length === 0) return null;
  const lowered = words.map((w) => w.toLowerCase());
  const meaningful = lowered.filter((w) => !STOPWORDS.has(w));
  return (meaningful.length > 0 ? meaningful : lowered).join(" | ");
}

// Highlights come back as plain text split on sentinels, never as HTML:
// rendering ts_headline HTML would let a page's content inject markup (XSS).
export function splitHighlighted(headline: string): HighlightSegment[] {
  const segments: HighlightSegment[] = [];
  let rest = headline;

  while (rest.length > 0) {
    const start = rest.indexOf(HL_START);
    if (start === -1) {
      segments.push({ text: rest, highlighted: false });
      break;
    }
    if (start > 0) {
      segments.push({ text: rest.slice(0, start), highlighted: false });
    }
    const end = rest.indexOf(HL_END, start + 1);
    if (end === -1) {
      // No closing marker — shouldn't happen, but don't lose the text.
      segments.push({ text: rest.slice(start + 1), highlighted: false });
      break;
    }
    segments.push({ text: rest.slice(start + 1, end), highlighted: true });
    rest = rest.slice(end + 1);
  }

  return segments;
}
