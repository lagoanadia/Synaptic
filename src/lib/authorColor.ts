// Cycles collaborators through a 6-color identity palette — assigned by
// the order they joined (owner first), not randomly, so it stays stable
// across reloads and across pages. Deliberately NOT the card palette
// PursuitsBoard uses for Pursuits: those 6 anchors are always paired
// with a text label, and running them through the `dataviz` skill's
// colorblind-safe categorical validator showed two of them (flame vs
// crimson) sit far below the "tell them apart by color alone" floor —
// fine for a labeled card, not fine for identity. This set is the
// skill's own validated reference categorical palette instead (passes
// every check: worst adjacent pair ΔE 9.1 CVD / 19.6 normal vision).
export const AUTHOR_BG = [
  "bg-ocean",
  "bg-tangerine",
  "bg-mint",
  "bg-amber",
  "bg-orchid",
  "bg-moss",
] as const;

export const AUTHOR_RING = [
  "ring-ocean",
  "ring-tangerine",
  "ring-mint",
  "ring-amber",
  "ring-orchid",
  "ring-moss",
] as const;

// For the editor's per-line "who wrote this" mark: a solid underline in
// the same validated hue, not a tinted background. A background has to
// be diluted to keep dark text readable on top of it, and dilution
// compresses every hue toward the near-white page color — by the time
// it's pale enough to not fight the text, two different colors blend
// into the same pale wash (confirmed with the validator: even at 30-40%
// opacity, these collapse well below the distinguishability floor). An
// underline sits below the text instead of behind it, so it can stay at
// full, validated saturation without touching legibility.
export const AUTHOR_UNDERLINE = [
  "decoration-ocean",
  "decoration-tangerine",
  "decoration-mint",
  "decoration-amber",
  "decoration-orchid",
  "decoration-moss",
] as const;

export type Collaborator = { id: string; name: string | null; email: string; image: string | null };

// Owner first, then members in join order, deduped by id (an owner who's
// somehow also listed as a member only gets one color).
export function collaboratorOrder(
  owner: Collaborator,
  members: Collaborator[],
): Collaborator[] {
  const rest = members.filter((m) => m.id !== owner.id);
  return [owner, ...rest];
}

export function colorIndexById(collaborators: Collaborator[]): Map<string, number> {
  return new Map(collaborators.map((c, i) => [c.id, i]));
}
