import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { ReviewCard, ReviewConcept } from "@/lib/review";
import { autoTitle } from "@/lib/text";

// What a review view covers: everything, one Section (or "unsorted" /
// "shared"), one subject, or one unit inside a subject (a Pages board
// column; NO_UNIT is the "No unit" column).
export type ReviewScope =
  | { kind: "all" }
  | { kind: "section"; sectionId: string }
  | { kind: "pursuit"; pursuitId: string; unitId?: string };

export const UNSORTED = "unsorted";
export const SHARED = "shared";
export const NO_UNIT = "none";

// Narrows notes/cards to one unit when the scope has one.
function unitNoteWhere(scope: ReviewScope): Prisma.NoteWhereInput | null {
  if (scope.kind !== "pursuit" || !scope.unitId) return null;
  return { sectionId: scope.unitId === NO_UNIT ? null : scope.unitId };
}

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
      ...unitNoteWhere(scope),
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
      ...(unitNoteWhere(scope)
        ? scope.kind === "pursuit" && scope.unitId === NO_UNIT
          ? { OR: [{ noteId: null }, { note: unitNoteWhere(scope)! }] }
          : { note: unitNoteWhere(scope)! }
        : {}),
      ...(opts.dueOnly ? { dueDate: { lte: new Date() } } : {}),
    },
    orderBy: { dueDate: "asc" },
    take: opts.take ?? 500,
    select: {
      id: true,
      question: true,
      answer: true,
      distractors: true,
      hint: true,
      quizQuestion: true,
      quizAnswer: true,
      note: { select: { content: true } },
      pursuit: { select: { id: true, title: true } },
    },
  });
  return cards.map((c) => ({
    id: c.id,
    pursuitId: c.pursuit.id,
    pursuitTitle: c.pursuit.title,
    question: c.question,
    answer: c.answer,
    distractors: c.distractors,
    hint: c.hint,
    quizQuestion: c.quizQuestion,
    quizAnswer: c.quizAnswer,
    context: c.note ? autoTitle(c.note.content) : null,
  }));
}

// Internalize concepts in scope, rereads first.
export async function getLearnConcepts(userId: string, scope: ReviewScope): Promise<(ReviewConcept & { explanation: string })[]> {
  // Concept maps aren't filed under units.
  if (unitNoteWhere(scope)) return [];
  const rows = await prisma.concept.findMany({
    where: { map: { pursuit: pursuitWhere(userId, scope) } },
    take: 400,
    select: {
      id: true,
      title: true,
      summary: true,
      explanation: true,
      status: true,
      map: { select: { pursuit: { select: { id: true, title: true } } } },
    },
  });
  const rank: Record<string, number> = { REREAD: 0, SEEN: 1, NEW: 2, UNDERSTOOD: 3, MASTERED: 4 };
  return rows
    .map((r) => ({
      id: r.id,
      title: r.title,
      summary: r.summary,
      explanation: r.explanation,
      status: r.status,
      pursuitId: r.map.pursuit.id,
      pursuitTitle: r.map.pursuit.title,
    }))
    .sort((a, b) => rank[a.status] - rank[b.status]);
}
