import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveApiKey } from "@/lib/apiKeys";
import { requireApiAccess } from "@/lib/mcpAccess";
import { autoTitle } from "@/lib/text";
import { HEADLINE_OPTIONS } from "@/lib/search";
import { computeNextReview, dueDateAfter } from "@/lib/sm2";

function text(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

// userId is stashed on AuthInfo.extra by verifyToken below, then read back
// out of ctx.http?.authInfo here — see src/lib/apiKeys.ts for how the
// bearer token itself maps to a user.
function userIdFrom(ctx: { http?: { authInfo?: { extra?: Record<string, unknown> } } }): string {
  const userId = ctx.http?.authInfo?.extra?.userId;
  if (typeof userId !== "string") {
    throw new Error("Not authenticated");
  }
  return userId;
}

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "list_pursuits",
      {
        title: "List Pursuits",
        description: "List every Pursuit you own or are a member of.",
        inputSchema: z.object({}),
      },
      async (_args, ctx) => {
        const userId = userIdFrom(ctx);
        const pursuits = await prisma.pursuit.findMany({
          where: { OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
          orderBy: { lastTouchedAt: "desc" },
          select: { id: true, title: true, type: true, status: true, ownerId: true },
        });
        return text(
          pursuits.map((p) => ({ ...p, isOwner: p.ownerId === userId, ownerId: undefined })),
        );
      },
    );

    server.registerTool(
      "create_pursuit",
      {
        title: "Create Pursuit",
        description: "Create a new Pursuit (a project/subject/book to track).",
        inputSchema: z.object({
          title: z.string().min(1),
          type: z.string().optional(),
        }),
      },
      async ({ title, type }, ctx) => {
        const userId = userIdFrom(ctx);
        const pursuit = await prisma.pursuit.create({
          data: { title, type: type ?? null, ownerId: userId },
        });
        return text({ id: pursuit.id, title: pursuit.title });
      },
    );

    server.registerTool(
      "get_pursuit",
      {
        title: "Get Pursuit",
        description:
          "Get a Pursuit's Brain Dump pages, Organized notes, and due-flashcard count.",
        inputSchema: z.object({ pursuitId: z.string() }),
      },
      async ({ pursuitId }, ctx) => {
        const userId = userIdFrom(ctx);
        const pursuit = await requireApiAccess(userId, pursuitId);

        const [dumps, notes, dueCount] = await Promise.all([
          prisma.brainDump.findMany({
            where: { pursuitId },
            orderBy: { createdAt: "desc" },
            select: { id: true, content: true, processed: true, createdAt: true },
          }),
          prisma.note.findMany({
            where: { pursuitId },
            orderBy: { createdAt: "desc" },
            include: { tags: { select: { name: true } } },
          }),
          prisma.flashcard.count({ where: { pursuitId, dueDate: { lte: new Date() } } }),
        ]);

        return text({
          id: pursuit.id,
          title: pursuit.title,
          status: pursuit.status,
          type: pursuit.type,
          dueFlashcards: dueCount,
          brainDumps: dumps.map((d) => ({
            id: d.id,
            title: autoTitle(d.content, 12),
            processed: d.processed,
            createdAt: d.createdAt.toISOString(),
          })),
          notes: notes.map((n) => ({
            id: n.id,
            title: autoTitle(n.content, 12),
            tags: n.tags.map((t) => t.name),
          })),
        });
      },
    );

    server.registerTool(
      "get_brain_dump",
      {
        title: "Get Brain Dump",
        description: "Get the full content of one Brain Dump page.",
        inputSchema: z.object({ dumpId: z.string() }),
      },
      async ({ dumpId }, ctx) => {
        const userId = userIdFrom(ctx);
        const dump = await prisma.brainDump.findUnique({ where: { id: dumpId } });
        if (!dump) throw new Error("Page not found");
        await requireApiAccess(userId, dump.pursuitId);
        return text({ id: dump.id, content: dump.content, processed: dump.processed });
      },
    );

    server.registerTool(
      "get_note",
      {
        title: "Get Note",
        description: "Get the full content of one Organized note.",
        inputSchema: z.object({ noteId: z.string() }),
      },
      async ({ noteId }, ctx) => {
        const userId = userIdFrom(ctx);
        const note = await prisma.note.findUnique({
          where: { id: noteId },
          include: { tags: { select: { name: true } } },
        });
        if (!note) throw new Error("Note not found");
        await requireApiAccess(userId, note.pursuitId);
        return text({ id: note.id, content: note.content, tags: note.tags.map((t) => t.name) });
      },
    );

    server.registerTool(
      "search_pursuit",
      {
        title: "Search Pursuit",
        description: "Full-text search a Pursuit's Brain Dump pages and Organized notes.",
        inputSchema: z.object({ pursuitId: z.string(), query: z.string().min(1) }),
      },
      async ({ pursuitId, query }, ctx) => {
        const userId = userIdFrom(ctx);
        await requireApiAccess(userId, pursuitId);

        const [dumps, notes] = await Promise.all([
          prisma.$queryRaw<{ id: string; snippet: string }[]>`
            SELECT id,
              ts_headline('simple', coalesce(content, ''), plainto_tsquery('simple', ${query}), ${HEADLINE_OPTIONS}) AS snippet
            FROM "BrainDump"
            WHERE "pursuitId" = ${pursuitId}
              AND "searchVector" @@ plainto_tsquery('simple', ${query})
            ORDER BY ts_rank("searchVector", plainto_tsquery('simple', ${query})) DESC
            LIMIT 10
          `,
          prisma.$queryRaw<{ id: string; snippet: string }[]>`
            SELECT id,
              ts_headline('simple', content, plainto_tsquery('simple', ${query}), ${HEADLINE_OPTIONS}) AS snippet
            FROM "Note"
            WHERE "pursuitId" = ${pursuitId}
              AND "searchVector" @@ plainto_tsquery('simple', ${query})
            ORDER BY ts_rank("searchVector", plainto_tsquery('simple', ${query})) DESC
            LIMIT 10
          `,
        ]);

        return text({ dumps, notes });
      },
    );

    server.registerTool(
      "create_brain_dump",
      {
        title: "Create Brain Dump Page",
        description: "Add a new Brain Dump page (raw capture) to a Pursuit.",
        inputSchema: z.object({ pursuitId: z.string(), content: z.string().min(1) }),
      },
      async ({ pursuitId, content }, ctx) => {
        const userId = userIdFrom(ctx);
        await requireApiAccess(userId, pursuitId);

        const images = Array.from(content.matchAll(/!\[image\]\(([^)]+)\)/g)).map((m) => m[1]);
        const dump = await prisma.brainDump.create({
          data: { pursuitId, authorId: userId, content, images },
        });
        await prisma.pursuit.update({ where: { id: pursuitId }, data: { lastTouchedAt: new Date() } });
        return text({ id: dump.id });
      },
    );

    server.registerTool(
      "update_brain_dump",
      {
        title: "Update Brain Dump Page",
        description:
          "Overwrite an existing Brain Dump page's content. Marks it unprocessed again, same as editing it in the app.",
        inputSchema: z.object({ dumpId: z.string(), content: z.string().min(1) }),
      },
      async ({ dumpId, content }, ctx) => {
        const userId = userIdFrom(ctx);
        const dump = await prisma.brainDump.findUnique({ where: { id: dumpId } });
        if (!dump) throw new Error("Page not found");
        await requireApiAccess(userId, dump.pursuitId);

        const images = Array.from(content.matchAll(/!\[image\]\(([^)]+)\)/g)).map((m) => m[1]);
        await prisma.brainDump.update({
          where: { id: dumpId },
          data: { content, images, processed: false },
        });
        return text({ ok: true });
      },
    );

    server.registerTool(
      "list_due_flashcards",
      {
        title: "List Due Flashcards",
        description: "List flashcards due for review right now in a Pursuit.",
        inputSchema: z.object({ pursuitId: z.string() }),
      },
      async ({ pursuitId }, ctx) => {
        const userId = userIdFrom(ctx);
        await requireApiAccess(userId, pursuitId);
        const cards = await prisma.flashcard.findMany({
          where: { pursuitId, dueDate: { lte: new Date() } },
          orderBy: { dueDate: "asc" },
          select: { id: true, question: true, answer: true },
        });
        return text(cards);
      },
    );

    server.registerTool(
      "review_flashcard",
      {
        title: "Review Flashcard",
        description:
          "Submit a spaced-repetition review for a flashcard. quality is 0-5 (0-2 = forgotten, 3-5 = recalled, higher = easier).",
        inputSchema: z.object({
          flashcardId: z.string(),
          quality: z.number().int().min(0).max(5),
        }),
      },
      async ({ flashcardId, quality }, ctx) => {
        const userId = userIdFrom(ctx);
        const card = await prisma.flashcard.findUnique({ where: { id: flashcardId } });
        if (!card) throw new Error("Flashcard not found");
        await requireApiAccess(userId, card.pursuitId);

        const next = computeNextReview(
          { interval: card.interval, easeFactor: card.easeFactor, repetitions: card.repetitions },
          quality,
        );
        const updated = await prisma.flashcard.update({
          where: { id: flashcardId },
          data: { ...next, dueDate: dueDateAfter(next.interval) },
        });
        return text({ nextDueDate: updated.dueDate.toISOString(), interval: updated.interval });
      },
    );
  },
  { serverInfo: { name: "synaptic", version: "1.0.0" } },
);

const authHandler = withMcpAuth(
  handler,
  async (_req, bearerToken) => {
    const resolved = await resolveApiKey(bearerToken ?? null);
    if (!resolved) return undefined;
    return {
      token: bearerToken ?? "",
      clientId: resolved.userId,
      scopes: ["pursuits:read", "pursuits:write"],
      extra: { userId: resolved.userId },
    };
  },
  { required: true },
);

export { authHandler as GET, authHandler as POST };
