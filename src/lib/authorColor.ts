// Collaborator identity colors, by join order. A separate, colorblind-safe
// palette: the card colors aren't distinguishable by color alone.
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
