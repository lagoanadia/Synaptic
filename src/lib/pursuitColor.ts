// A pursuit's own identity color for its detail page, where there's no
// row/index context to assign a color by position the way
// PursuitsBoard's CARD_BG cycle does (src/app/pursuits/PursuitsBoard.tsx)
// — that positional system is untouched by this. Instead, this derives a
// color deterministically from the pursuit's own id, so the same pursuit
// always gets the same dot color on every visit. Reuses the same 6 solid
// hues as CARD_BG (minus its 4 gradient combinations, which don't apply
// to a single small dot) so both systems read as one palette.
const DOT_COLORS = [
  "bg-flame",
  "bg-crimson",
  "bg-cobalt",
  "bg-gold",
  "bg-rose",
  "bg-forest",
];

export function pursuitDotColor(pursuitId: string): string {
  let hash = 0;
  for (let i = 0; i < pursuitId.length; i++) {
    hash = (hash * 31 + pursuitId.charCodeAt(i)) >>> 0;
  }
  return DOT_COLORS[hash % DOT_COLORS.length];
}
