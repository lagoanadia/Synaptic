// A stable color per pursuit, derived from its id.
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
