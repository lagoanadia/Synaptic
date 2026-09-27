// Sentinel control characters, not real HTML tags — see splitHighlighted
// below for why. They're vanishingly unlikely to appear in typed content,
// and even if one did, the worst case is a slightly wrong highlight, never
// broken markup or injected HTML.
const HL_START = "\u0001";
const HL_END = "\u0002";

// Passed as ts_headline()'s 4th argument (a single options string) in the
// raw search query — kept here, next to the sentinels it references, so
// the two can never drift out of sync.
export const HEADLINE_OPTIONS = `StartSel=${HL_START}, StopSel=${HL_END}, MaxFragments=2, MaxWords=25, MinWords=5`;

export type HighlightSegment = { text: string; highlighted: boolean };

// Both the stored searchVector and this query use the 'simple' text search
// config (see the add_search_vectors migration), never 'english' or
// 'spanish' — pursuit content mixes both languages, and either language's
// stemming/stopword rules would mangle the other's words. But 'simple'
// keeps EVERY token, including function words ("is", "a", "el", "qué"...),
// as a real lexeme. For a natural-language question that's a problem
// buildOrTsQuery's OR-matching makes worse, not better: a document that
// only shares "is"/"a"/"la" with the question ranks right alongside one
// that shares the actual topic word, so a vaguely-phrased question's
// results get drowned in noise unless you happen to reuse the exact
// content words from the note. Filtering this small stopword list out
// before building the query is what actually gets "best overlap" to mean
// overlap on meaningful words.
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

// Builds a Postgres to_tsquery string that matches ANY of the input's
// words (OR), not all of them like plainto_tsquery does (AND). That's
// fine for the search bar's short keyword queries, but a full natural-
// language question ("Ask your Pursuit") rarely has every single word
// land together in one dump — requiring a strict AND match would almost
// always return nothing. ts_rank still scores a document with MORE
// matching words higher, so OR + ranking behaves like "best overlap"
// instead of an all-or-nothing filter.
//
// Only word-like tokens are extracted (Postgres's tsquery syntax uses
// &, |, !, (), : as operators) — pulling those out instead of handing
// the raw question straight to to_tsquery sidesteps ever having to
// escape that syntax ourselves. Stopwords are then dropped so ranking
// reflects overlap on content words, not "is"/"a"/"la" noise — unless
// the input turns out to be nothing BUT stopwords, in which case we fall
// back to matching them anyway rather than returning no query at all.
export function buildOrTsQuery(text: string): string | null {
  const words = text.match(/[\p{L}\p{N}]+/gu) ?? [];
  if (words.length === 0) return null;
  const lowered = words.map((w) => w.toLowerCase());
  const meaningful = lowered.filter((w) => !STOPWORDS.has(w));
  return (meaningful.length > 0 ? meaningful : lowered).join(" | ");
}

// Postgres's ts_headline() marks matches by wrapping them in whatever
// StartSel/StopSel strings we give it — normally people use it to build
// HTML directly (StartSel="<mark>"). We don't: content is free-typed by
// pursuit members, so if we ever rendered that HTML with
// dangerouslySetInnerHTML, a dump containing something like "<img
// onerror=...>" would execute for anyone who searched and matched it
// (stored XSS). Using plain sentinel characters instead, then splitting on
// them here and rendering each piece as normal React text (escaped
// automatically) with real <mark> elements around the highlighted ones,
// gets the same visual result with no HTML ever passing through raw.
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
