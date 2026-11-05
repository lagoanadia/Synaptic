import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { ReviewCard } from "@/lib/review";
import { autoTitle } from "@/lib/text";

// Which part of your stuff a review/home view looks at: everything, one
// Section (or the two virtual ones: "unsorted" = your pursuits with no
// section, "shared" = pursuits other people shared with you), or a single
// Pursuit.
export type ReviewScope =
  | { kind: "all" }
  | { kind: "section"; sectionId: string }
  | { kind: "pursuit"; pursuitId: string };

export const UNSORTED = "unsorted";
export const SHARED = "shared";

export function accessiblePursuits(userId: string): Prisma.PursuitWhereInput {
  return { OR: [{ ownerId: userId }, { members: { some: { userId } } }] };
}

// The Prisma filter for "pursuits in this scope that this user can see".
// Access is ALWAYS part of it — a sectionId or pursuitId from the URL is
// never trusted on its own.
export function pursuitWhere(userId: string, scope: ReviewScope): Prisma.PursuitWhereInput {
  const access = accessiblePursuits(userId);
  if (scope.kind === "pursuit") return { AND: [access, { id: scope.pursuitId }] };
  if (scope.kind === "section") {
    if (scope.sectionId === SHARED) return { AND: [access, { ownerId: { not: userId } }] };
    if (scope.sectionId === UNSORTED) return { ownerId: userId, sectionId: null };
    return { ownerId: userId, sectionId: scope.sectionId };
  }
  return access;
}

export type Concept = {
  id: string;
  pursuitId: string;
  pursuitTitle: string;
  title: string;
  content: string;
  createdAt: Date;
};

// Concepts (Organized notes) in scope. `take` caps the query; callers that
// want a random handful sample from this.
export async function getConcepts(
  userId: string,
  scope: ReviewScope,
  opts: { since?: Date; take?: number } = {},
): Promise<Concept[]> {
  const notes = await prisma.note.findMany({
    where: {
      pursuit: pursuitWhere(userId, scope),
      ...(opts.since ? { createdAt: { gte: opts.since } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: opts.take ?? 300,
    select: {
      id: true,
      content: true,
      createdAt: true,
      pursuit: { select: { id: true, title: true } },
    },
  });
  return notes.map((n) => ({
    id: n.id,
    pursuitId: n.pursuit.id,
    pursuitTitle: n.pursuit.title,
    title: autoTitle(n.content),
    content: n.content,
    createdAt: n.createdAt,
  }));
}

export async function getCards(
  userId: string,
  scope: ReviewScope,
  opts: { dueOnly?: boolean; take?: number } = {},
): Promise<ReviewCard[]> {
  const cards = await prisma.flashcard.findMany({
    where: {
      pursuit: pursuitWhere(userId, scope),
      ...(opts.dueOnly ? { dueDate: { lte: new Date() } } : {}),
    },
    orderBy: { dueDate: "asc" },
    take: opts.take ?? 500,
    select: {
      id: true,
      question: true,
      answer: true,
      pursuit: { select: { id: true, title: true } },
    },
  });
  return cards.map((c) => ({
    id: c.id,
    pursuitId: c.pursuit.id,
    pursuitTitle: c.pursuit.title,
    question: c.question,
    answer: c.answer,
  }));
}
