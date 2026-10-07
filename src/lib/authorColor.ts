// Cycles collaborators through Synaptic's existing 6-color card palette
// (the same one PursuitsBoard uses for Pursuit cards) so each person
// writing in a shared Pursuit gets a consistent, distinct color — assigned
// by the order they joined (owner first), not randomly, so it stays
// stable across reloads and across pages.
export const AUTHOR_BG = [
  "bg-flame",
  "bg-crimson",
  "bg-cobalt",
  "bg-gold",
  "bg-rose",
  "bg-forest",
] as const;

export const AUTHOR_RING = [
  "ring-flame",
  "ring-crimson",
  "ring-cobalt",
  "ring-gold",
  "ring-rose",
  "ring-forest",
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
