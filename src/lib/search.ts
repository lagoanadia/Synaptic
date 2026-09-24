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
