"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { groq } from "@/lib/groq";
import type { ChatCompletionContentPartImage } from "groq-sdk/resources/chat/completions";
import { PursuitType, PursuitStatus, MemberRole } from "@/generated/prisma/client";
import { upsertSection } from "@/lib/sections";
import { HEADLINE_OPTIONS, buildOrTsQuery } from "@/lib/search";
import { parseOrganizeResponse } from "@/lib/organize";
import {
  DAILY_ORGANIZE_LIMIT,
  getOrganizeUsageToday,
  hasUnlimitedOrganize,
  incrementOrganizeUsage,
} from "@/lib/organizeLimit";

async function requireAccess(pursuitId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Not signed in");
  }
  const pursuit = await prisma.pursuit.findFirst({
    where: {
      id: pursuitId,
      OR: [
        { ownerId: session.user.id },
        { members: { some: { userId: session.user.id } } },
      ],
    },
  });
  if (!pursuit) {
    throw new Error("Pursuit not found or access denied");
  }
  return { session, pursuit };
}

export type FormState = { error: string | null; success?: boolean };

// These two take (pursuitId, prevState, formData) instead of just
// (pursuitId, formData) so they can be bound to a pursuitId and still fit
// useActionState's (state, formData) => state shape on the client — see
// TagForm.tsx / MemberForm.tsx. They return a friendly error instead of
// throwing, so expected validation failures (empty field, unknown email)
// show inline instead of crashing to the generic error page.
export async function addMember(
  pursuitId: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { session, pursuit } = await requireAccess(pursuitId);

  // Only the owner can invite collaborators — not just any existing member.
  if (pursuit.ownerId !== session.user.id) {
    return { error: "Only the owner can invite collaborators" };
  }

  const email = formData.get("email");
  if (typeof email !== "string" || email.trim() === "") {
    return { error: "Email is required" };
  }

  const role = formData.get("role");
  const memberRole: MemberRole = role === "VIEWER" ? "VIEWER" : "EDITOR";

  const invitedUser = await prisma.user.findUnique({
    where: { email: email.trim() },
  });
  if (!invitedUser) {
    return {
      error:
        "No Synaptic account found with that email — they need to sign in with GitHub at least once first",
    };
  }
  if (invitedUser.id === session.user.id) {
    return { error: "That's your own account — you already own this pursuit" };
  }

  await prisma.pursuitMember.upsert({
    where: { pursuitId_userId: { pursuitId, userId: invitedUser.id } },
    create: { pursuitId, userId: invitedUser.id, role: memberRole },
    update: { role: memberRole },
  });

  revalidatePath(`/pursuits/${pursuitId}`);
  return { error: null };
}

export async function leavePursuit(pursuitId: string) {
  const { session, pursuit } = await requireAccess(pursuitId);
  if (pursuit.ownerId === session.user.id) {
    throw new Error("Owners can't leave their own pursuit — delete it instead");
  }

  await prisma.pursuitMember.deleteMany({
    where: { pursuitId, userId: session.user.id },
  });

  revalidatePath("/pursuits");
}

export async function removeMember(pursuitId: string, memberId: string) {
  const { session, pursuit } = await requireAccess(pursuitId);
  if (pursuit.ownerId !== session.user.id) {
    throw new Error("Only the owner can remove collaborators");
  }

  await prisma.pursuitMember.deleteMany({
    where: { id: memberId, pursuitId },
  });

  revalidatePath(`/pursuits/${pursuitId}`);
}

export async function updateMemberRole(
  pursuitId: string,
  memberId: string,
  role: string,
) {
  const { session, pursuit } = await requireAccess(pursuitId);
  if (pursuit.ownerId !== session.user.id) {
    throw new Error("Only the owner can change a collaborator's role");
  }
  if (role !== "EDITOR" && role !== "VIEWER") {
    throw new Error("Invalid role");
  }

  await prisma.pursuitMember.updateMany({
    where: { id: memberId, pursuitId },
    data: { role },
  });

  revalidatePath(`/pursuits/${pursuitId}`);
}

export async function addBrainDump(
  pursuitId: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { session } = await requireAccess(pursuitId);

  const content = formData.get("content");
  const text = typeof content === "string" ? content.trim() : "";

  if (!text) {
    return { error: "Write something first" };
  }

  // Images were already uploaded (via uploadImage, as each one was picked)
  // and are embedded as `![image](url)` markers inside `text` itself — so
  // there's no separate file to handle here, just the finished content.
  const images = Array.from(text.matchAll(/!\[image\]\(([^)]+)\)/g)).map(
    (m) => m[1],
  );

  await prisma.brainDump.create({
    data: {
      pursuitId,
      authorId: session.user.id,
      content: text,
      images,
    },
  });

  await prisma.pursuit.update({
    where: { id: pursuitId },
    data: { lastTouchedAt: new Date() },
  });

  revalidatePath(`/pursuits/${pursuitId}`);
  // No redirect() here — combined with useActionState this crashed the
  // page (minified React error #441). Navigation happens client-side in
  // NewDumpForm once it sees `success: true`.
  return { error: null, success: true };
}

export async function updateBrainDump(
  pursuitId: string,
  dumpId: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAccess(pursuitId);

  const dump = await prisma.brainDump.findFirst({
    where: { id: dumpId, pursuitId },
  });
  if (!dump) {
    return { error: "Page not found" };
  }

  const content = formData.get("content");
  const text = typeof content === "string" ? content.trim() : "";
  if (!text) {
    return { error: "Write something first" };
  }

  const images = Array.from(text.matchAll(/!\[image\]\(([^)]+)\)/g)).map(
    (m) => m[1],
  );

  // Rewriting a dump makes whatever note it was folded into stale, so it
  // goes back to processed:false — the same "needs organizing" state a
  // brand new dump starts in — and reappears in the Organize count.
  await prisma.brainDump.update({
    where: { id: dumpId },
    data: { content: text, images, processed: false },
  });

  await prisma.pursuit.update({
    where: { id: pursuitId },
    data: { lastTouchedAt: new Date() },
  });

  revalidatePath(`/pursuits/${pursuitId}`);
  revalidatePath(`/pursuits/${pursuitId}/dump/${dumpId}`);
  return { error: null, success: true };
}

export async function deleteBrainDump(pursuitId: string, dumpId: string) {
  await requireAccess(pursuitId);
  await prisma.brainDump.deleteMany({ where: { id: dumpId, pursuitId } });
  revalidatePath(`/pursuits/${pursuitId}`);
}

// Finalizing skips the AI entirely — for a dump that's already written the
// way you want it, this just promotes it straight into a Note as-is,
// instead of asking Groq to rewrite something that doesn't need it.
export async function finalizeBrainDump(pursuitId: string, dumpId: string) {
  await requireAccess(pursuitId);

  const dump = await prisma.brainDump.findFirst({
    where: { id: dumpId, pursuitId, processed: false },
  });
  if (!dump) {
    throw new Error("Page not found or already organized");
  }

  await prisma.note.create({
    data: {
      pursuitId,
      content: dump.content ?? "",
      sourceDumps: { connect: { id: dump.id } },
    },
  });

  await prisma.brainDump.update({
    where: { id: dumpId },
    data: { processed: true },
  });

  await prisma.pursuit.update({
    where: { id: pursuitId },
    data: { lastTouchedAt: new Date() },
  });

  revalidatePath(`/pursuits/${pursuitId}`);
}

const TEXT_MODEL = "openai/gpt-oss-120b";
// Groq's docs (console.groq.com/docs/models) are the source of truth for
// which model this should be — that page and the API itself are both
// unreachable from this dev sandbox's network, so this couldn't be
// verified with a live test call before shipping. If Organize starts
// failing on dumps with images, check that page for the current
// vision-capable model name and swap it in here.
const VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";
const MAX_VISION_IMAGES = 5;

// Returns { error } instead of throwing — DumpControls calls this from a
// plain onClick/startTransition, not a <form>, so an uncaught throw here
// would bubble up to Next's generic error boundary (the same crash we've
// hit before from other bugs) instead of showing a message next to the
// button.
export async function organizeDumps(
  pursuitId: string,
  dumpIds?: string[],
): Promise<{ error: string | null }> {
  const { session } = await requireAccess(pursuitId);
  const unlimited = hasUnlimitedOrganize(session.user.email);

  if (!unlimited) {
    const usedToday = await getOrganizeUsageToday(session.user.id);
    if (usedToday >= DAILY_ORGANIZE_LIMIT) {
      return {
        error: `Has alcanzado el límite de ${DAILY_ORGANIZE_LIMIT} organizaciones con IA por hoy. Prueba de nuevo mañana.`,
      };
    }
  }

  const dumps = await prisma.brainDump.findMany({
    where: {
      pursuitId,
      processed: false,
      ...(dumpIds && dumpIds.length > 0 ? { id: { in: dumpIds } } : {}),
    },
    orderBy: { createdAt: "asc" },
  });

  if (dumps.length === 0) {
    return { error: "No new dumps to organize" };
  }

  const existingTags = await prisma.tag.findMany({
    where: { pursuitId },
    select: { name: true },
  });

  // dump.content already has any images inlined as `![image](url)` markers
  // (that's how the composer saves them) — no need to also list them
  // separately in the prompt text, that would just duplicate the same URL.
  const rawMaterial = dumps.map((dump) => dump.content ?? "").join("\n---\n");

  // Groq caps these vision models at 5 images per request — taking them in
  // the same chronological order as the dumps themselves (oldest first)
  // rather than, say, the largest ones, since there's no way to know which
  // pictures matter most without asking the model in the first place.
  const imageUrls = dumps.flatMap((dump) => dump.images).slice(0, MAX_VISION_IMAGES);
  const hasImages = imageUrls.length > 0;

  const prompt = `${rawMaterial}\n---\nExisting tags for this pursuit: ${
    existingTags.map((t) => t.name).join(", ") || "(none yet)"
  }${
    hasImages
      ? `\n\n${imageUrls.length} image(s) referenced above are attached below for you to actually look at — use what's in them, don't just guess from the surrounding text.`
      : ""
  }\n\nSynthesize the material above into one organized, structured note.

Format the note's content using ONLY this exact set of shortcuts — nothing
else, since the app only knows how to render these (anything else, like
####, or code fences, would show up as literal stray characters instead of
formatting):
- "# " at the start of a line for a heading (also "## " and "### " for
  smaller headings — never more than three #s)
- "! " at the start of a line for a callout / key takeaway
- "- " at the start of a line for a bullet list
- "1. " (etc.) at the start of a line for a numbered list
- "a. " (etc.) at the start of a line for a lettered list
- "**text**" for bold — no other inline styling
- "| cell | cell | cell |" for a table row — the first row is the header;
  every row needs the same number of cells, and consecutive rows with no
  blank line between them form one table. Only use this for genuinely
  tabular data (comparisons, options with several attributes each) — don't
  force a table where a bullet list reads better.
- "![image](url)" to keep a referenced image, exactly as it appears in the
  material above, verbatim and on its own line — never describe the image
  in words and never write its bare url as plain text
Plain paragraphs need no marker. Keep it to one blank line between blocks.

Then suggest 1-3 short lowercase tags — reuse an existing tag if one
genuinely fits, otherwise propose a new short one. Respond with ONLY a
JSON object, no other text: {"content": "...", "tags": ["...", "..."]}`;

  let completion;
  try {
    completion = await groq.chat.completions.create({
      // Confirmed live in the Groq console as of this writing — the earlier
      // "llama-3.3-70b-versatile" guess had been deprecated/renamed on
      // Groq's side, which is what caused the 404 in production. Only
      // switches to the (pricier, slower) vision model when a selected
      // dump actually has an image — plain-text dumps keep using the
      // regular text model, unchanged.
      model: hasImages ? VISION_MODEL : TEXT_MODEL,
      messages: [
        {
          role: "user",
          content: hasImages
            ? [
                { type: "text", text: prompt },
                ...imageUrls.map(
                  (url): ChatCompletionContentPartImage => ({
                    type: "image_url",
                    image_url: { url },
                  }),
                ),
              ]
            : prompt,
        },
      ],
      response_format: { type: "json_object" },
    });
  } catch {
    // Groq down, its own rate limit, network blip, etc. — none of this
    // used up the user's daily quota (incrementOrganizeUsage runs further
    // down, only once we know the call actually succeeded).
    return {
      error: "No se pudo conectar con la IA ahora mismo. Inténtalo de nuevo en unos minutos.",
    };
  }

  const text = completion.choices[0]?.message?.content;
  if (!text) {
    return { error: "AI did not return a usable response" };
  }

  if (!unlimited) {
    await incrementOrganizeUsage(session.user.id);
  }

  // Extracted to lib/organize.ts as a pure function — see its tests for
  // the broken-response cases this handles (invalid JSON, missing
  // fields, prose wrapped around the JSON).
  const { content: noteContent, tags: tagNames } = parseOrganizeResponse(text);

  // Sequential, not Promise.all: two concurrent upserts on the same
  // (pursuitId, name) unique key can race each other in Postgres.
  const tagRecords = [];
  for (const name of tagNames) {
    tagRecords.push(
      await prisma.tag.upsert({
        where: { pursuitId_name: { pursuitId, name } },
        create: { pursuitId, name },
        update: {},
      }),
    );
  }

  await prisma.note.create({
    data: {
      pursuitId,
      content: noteContent,
      sourceDumps: { connect: dumps.map((d) => ({ id: d.id })) },
      tags: { connect: tagRecords.map((t) => ({ id: t.id })) },
    },
  });

  await prisma.brainDump.updateMany({
    where: { id: { in: dumps.map((d) => d.id) } },
    data: { processed: true },
  });

  await prisma.pursuit.update({
    where: { id: pursuitId },
    data: { lastTouchedAt: new Date() },
  });

  revalidatePath(`/pursuits/${pursuitId}`);
  return { error: null };
}

export async function mergeNotes(pursuitId: string, noteIds: string[]) {
  await requireAccess(pursuitId);

  if (noteIds.length < 2) {
    throw new Error("Select at least two notes to merge");
  }

  const notes = await prisma.note.findMany({
    where: { id: { in: noteIds }, pursuitId },
    include: { tags: true, sourceDumps: true },
  });

  if (notes.length !== noteIds.length) {
    throw new Error("One or more notes not found");
  }

  const mergedContent = notes.map((n) => n.content).join("\n\n");
  const tagIds = Array.from(
    new Set(notes.flatMap((n) => n.tags.map((t) => t.id))),
  );
  const dumpIds = Array.from(
    new Set(notes.flatMap((n) => n.sourceDumps.map((d) => d.id))),
  );

  await prisma.note.create({
    data: {
      pursuitId,
      content: mergedContent,
      tags: { connect: tagIds.map((id) => ({ id })) },
      sourceDumps: { connect: dumpIds.map((id) => ({ id })) },
    },
  });

  await prisma.note.deleteMany({ where: { id: { in: noteIds } } });

  revalidatePath(`/pursuits/${pursuitId}`);
}

export async function updateNote(
  pursuitId: string,
  noteId: string,
  content: string,
) {
  await requireAccess(pursuitId);

  const text = content.trim();
  if (!text) {
    throw new Error("Note can't be empty");
  }

  await prisma.note.updateMany({
    where: { id: noteId, pursuitId },
    data: { content: text },
  });

  revalidatePath(`/pursuits/${pursuitId}`);
}

export async function deleteNote(pursuitId: string, noteId: string) {
  await requireAccess(pursuitId);

  const note = await prisma.note.findFirst({
    where: { id: noteId, pursuitId },
    select: { sourceDumps: { select: { id: true } } },
  });

  await prisma.note.deleteMany({ where: { id: noteId, pursuitId } });

  // A dump only counts as "organized" while some note still references it
  // — deleting its one note left it processed:true forever with nothing
  // pointing to it, so it could never be picked up by Organize again.
  // (A dump could in principle still be referenced by another note, so
  // check rather than assume.)
  for (const dump of note?.sourceDumps ?? []) {
    const stillReferenced = await prisma.note.findFirst({
      where: { sourceDumps: { some: { id: dump.id } } },
    });
    if (!stillReferenced) {
      await prisma.brainDump.update({
        where: { id: dump.id },
        data: { processed: false },
      });
    }
  }

  revalidatePath(`/pursuits/${pursuitId}`);
}

export async function addAttachment(pursuitId: string, formData: FormData) {
  await requireAccess(pursuitId);

  const name = formData.get("name");
  const url = formData.get("url");

  if (typeof name !== "string" || name.trim() === "") {
    throw new Error("Name is required");
  }
  if (typeof url !== "string" || url.trim() === "") {
    throw new Error("URL is required");
  }

  await prisma.attachment.create({
    data: { pursuitId, name: name.trim(), url: url.trim(), size: 0 },
  });

  revalidatePath(`/pursuits/${pursuitId}`);
}

export async function addPursuitTag(
  pursuitId: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { session } = await requireAccess(pursuitId);

  const name = formData.get("name");
  if (typeof name !== "string" || name.trim() === "") {
    return { error: "Tag name is required" };
  }

  const tag = await prisma.pursuitTag.upsert({
    where: { userId_name: { userId: session.user.id, name: name.trim() } },
    create: { userId: session.user.id, name: name.trim() },
    update: {},
  });

  await prisma.pursuit.update({
    where: { id: pursuitId },
    data: { pursuitTags: { connect: { id: tag.id } } },
  });

  revalidatePath(`/pursuits/${pursuitId}`);
  return { error: null };
}

export async function removePursuitTag(pursuitId: string, tagId: string) {
  await requireAccess(pursuitId);

  // Only disconnects the tag from this pursuit — PursuitTag is scoped to
  // the user and may be attached to other pursuits, so the tag itself
  // isn't deleted.
  await prisma.pursuit.update({
    where: { id: pursuitId },
    data: { pursuitTags: { disconnect: { id: tagId } } },
  });

  revalidatePath(`/pursuits/${pursuitId}`);
}

export async function updatePursuitMeta(pursuitId: string, formData: FormData) {
  const { session } = await requireAccess(pursuitId);

  const type = formData.get("type");
  const customType = formData.get("customType");
  const status = formData.get("status");
  const sectionName = formData.get("section");

  if (typeof type !== "string" || !(type in PursuitType)) {
    throw new Error("Invalid pursuit type");
  }
  if (
    type === "OTHER" &&
    (typeof customType !== "string" || customType.trim() === "")
  ) {
    throw new Error("Custom type name is required");
  }
  if (typeof status !== "string" || !(status in PursuitStatus)) {
    throw new Error("Invalid status");
  }

  // Sections are free-typed and stored per user, same as PursuitTag — no
  // fixed preset list, reuse an existing one by name or create it here. An
  // empty value clears the pursuit's section instead of leaving it as-is.
  let sectionId: string | null = null;
  if (typeof sectionName === "string" && sectionName.trim() !== "") {
    const section = await upsertSection(session.user.id, sectionName);
    sectionId = section.id;
  }

  await prisma.pursuit.update({
    where: { id: pursuitId },
    data: {
      type: type as PursuitType,
      customType:
        type === "OTHER" && typeof customType === "string"
          ? customType.trim()
          : null,
      status: status as PursuitStatus,
      sectionId,
    },
  });

  revalidatePath(`/pursuits/${pursuitId}`);
  revalidatePath("/pursuits");
}

export type SearchHit = { id: string; createdAt: string; snippet: string };
export type SearchResults = { dumps: SearchHit[]; notes: SearchHit[] };

// Full-text search across this pursuit's brain dumps and organized notes.
// requireAccess() is the same owner-or-member check every other action
// here uses — a search action is still an action, and search results
// would otherwise leak content from pursuits you don't have access to.
export async function searchPursuit(
  pursuitId: string,
  query: string,
): Promise<SearchResults> {
  await requireAccess(pursuitId);

  const q = query.trim();
  if (!q) return { dumps: [], notes: [] };

  // $queryRaw's tagged template parameterizes every ${...} value (q,
  // pursuitId, the options string) the same way Prisma's normal query
  // builder does — this is not string concatenation, so it's not
  // SQL-injectable despite being raw SQL text.
  const dumps = await prisma.$queryRaw<
    { id: string; createdAt: Date; snippet: string }[]
  >`
    SELECT id, "createdAt",
      ts_headline('simple', coalesce(content, ''), plainto_tsquery('simple', ${q}), ${HEADLINE_OPTIONS}) AS snippet
    FROM "BrainDump"
    WHERE "pursuitId" = ${pursuitId}
      AND "searchVector" @@ plainto_tsquery('simple', ${q})
    ORDER BY ts_rank("searchVector", plainto_tsquery('simple', ${q})) DESC
    LIMIT 15
  `;

  const notes = await prisma.$queryRaw<
    { id: string; createdAt: Date; snippet: string }[]
  >`
    SELECT id, "createdAt",
      ts_headline('simple', content, plainto_tsquery('simple', ${q}), ${HEADLINE_OPTIONS}) AS snippet
    FROM "Note"
    WHERE "pursuitId" = ${pursuitId}
      AND "searchVector" @@ plainto_tsquery('simple', ${q})
    ORDER BY ts_rank("searchVector", plainto_tsquery('simple', ${q})) DESC
    LIMIT 15
  `;

  return {
    dumps: dumps.map((d) => ({
      id: d.id,
      createdAt: d.createdAt.toISOString(),
      snippet: d.snippet,
    })),
    notes: notes.map((n) => ({
      id: n.id,
      createdAt: n.createdAt.toISOString(),
      snippet: n.snippet,
    })),
  };
}

const ASK_CONTEXT_LIMIT = 6;

// "Ask your Pursuit" — retrieval-augmented generation, starting from the
// simplest possible retrieval step: full-text search (lib/search.ts's
// buildOrTsQuery) instead of embeddings/pgvector. It finds pursuit content
// that shares WORDS with the question, ranked by how many/how well they
// match (ts_rank) — good enough for a personal pursuit's dump/note volume,
// and it's infrastructure this app already has from Phase 1. Embeddings
// would find content that shares MEANING even with zero shared words
// (e.g. asking "how do plants make energy" would still surface a dump
// that only ever says "photosynthesis"), at the cost of an embeddings API
// call per dump/note and a pgvector column to maintain — worth it once
// full-text search demonstrably misses relevant content for how you
// actually phrase questions, not before.
export async function askPursuit(
  pursuitId: string,
  question: string,
): Promise<{ error: string | null; answer?: string }> {
  const { session } = await requireAccess(pursuitId);
  const unlimited = hasUnlimitedOrganize(session.user.email);

  const q = question.trim();
  if (!q) return { error: "Escribe una pregunta primero" };

  if (!unlimited) {
    const usedToday = await getOrganizeUsageToday(session.user.id);
    if (usedToday >= DAILY_ORGANIZE_LIMIT) {
      return {
        error: `Has alcanzado el límite de ${DAILY_ORGANIZE_LIMIT} usos de IA por hoy (Organize + Ask comparten el mismo límite). Prueba de nuevo mañana.`,
      };
    }
  }

  const tsQuery = buildOrTsQuery(q);
  if (!tsQuery) return { error: "Escribe una pregunta primero" };

  const [dumpMatches, noteMatches] = await Promise.all([
    prisma.$queryRaw<{ content: string | null; rank: number }[]>`
      SELECT content, ts_rank("searchVector", to_tsquery('simple', ${tsQuery})) AS rank
      FROM "BrainDump"
      WHERE "pursuitId" = ${pursuitId}
        AND "searchVector" @@ to_tsquery('simple', ${tsQuery})
      ORDER BY rank DESC
      LIMIT ${ASK_CONTEXT_LIMIT}
    `,
    prisma.$queryRaw<{ content: string; rank: number }[]>`
      SELECT content, ts_rank("searchVector", to_tsquery('simple', ${tsQuery})) AS rank
      FROM "Note"
      WHERE "pursuitId" = ${pursuitId}
        AND "searchVector" @@ to_tsquery('simple', ${tsQuery})
      ORDER BY rank DESC
      LIMIT ${ASK_CONTEXT_LIMIT}
    `,
  ]);

  const contextPieces = [...dumpMatches, ...noteMatches]
    .sort((a, b) => b.rank - a.rank)
    .slice(0, ASK_CONTEXT_LIMIT)
    .map((m) => m.content ?? "")
    .filter((c) => c.trim() !== "");

  const context =
    contextPieces.length > 0
      ? contextPieces.map((c, i) => `[${i + 1}]\n${c}`).join("\n\n")
      : "(No matching content found in this pursuit.)";

  const prompt = `Context from this pursuit's brain dumps and organized notes:\n\n${context}\n\n---\n\nQuestion: ${q}\n\nAnswer using ONLY the context above — never use outside knowledge, even if you know the answer. If the context doesn't contain the answer, say plainly that this pursuit's notes don't cover it. Answer in the same language as the question, in plain prose (no markdown formatting), and keep it short.`;

  let completion;
  try {
    completion = await groq.chat.completions.create({
      model: TEXT_MODEL,
      messages: [{ role: "user", content: prompt }],
    });
  } catch {
    return {
      error: "No se pudo conectar con la IA ahora mismo. Inténtalo de nuevo en unos minutos.",
    };
  }

  const answer = completion.choices[0]?.message?.content;
  if (!answer) {
    return { error: "AI did not return a usable response" };
  }

  if (!unlimited) {
    await incrementOrganizeUsage(session.user.id);
  }

  return { error: null, answer };
}
