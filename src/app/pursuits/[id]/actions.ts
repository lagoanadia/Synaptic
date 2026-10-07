"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { groq } from "@/lib/groq";
import type {
  ChatCompletionContentPartImage,
  ChatCompletionCreateParamsNonStreaming,
} from "groq-sdk/resources/chat/completions";
import { PursuitStatus, MemberRole } from "@/generated/prisma/client";
import { upsertSection } from "@/lib/sections";
import { HEADLINE_OPTIONS, buildOrTsQuery } from "@/lib/search";
import { parseOrganizeResponse } from "@/lib/organize";
import { parseFlashcardsResponse } from "@/lib/flashcards";
import { computeNextReview, dueDateAfter } from "@/lib/sm2";
import {
  DAILY_ORGANIZE_LIMIT,
  getOrganizeUsageToday,
  hasUnlimitedAccess,
  incrementOrganizeUsage,
} from "@/lib/organizeLimit";
import { FREE_MONTHLY_FLASHCARD_LIMIT, getFlashcardsThisMonth } from "@/lib/flashcardLimit";
import {
  getValidAccessToken,
  listCourses,
  listCourseFiles,
  listCourseDeadlines,
  type ClassroomCourse,
  type ClassroomFile,
  type ClassroomDeadline,
} from "@/lib/googleClassroom";
import { diffLineAuthors, normalizeLineAuthors } from "@/lib/lineAuthors";

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

  const existingMember = await prisma.pursuitMember.findUnique({
    where: { pursuitId_userId: { pursuitId, userId: invitedUser.id } },
  });
  // Free plan caps sharing at 1 collaborator per pursuit — Pro/Team get
  // unlimited. Only checked for a genuinely NEW collaborator, so changing
  // an existing one's role never gets blocked by a cap they're already
  // inside of.
  if (!existingMember) {
    const owner = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } });
    if (owner.plan === "FREE") {
      const memberCount = await prisma.pursuitMember.count({ where: { pursuitId } });
      if (memberCount >= 1) {
        return {
          error:
            "Free plan pursuits can only be shared with 1 collaborator — upgrade to Pro for unlimited sharing.",
        };
      }
    }
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
      lineAuthorIds: text.split("\n").map(() => session.user.id),
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
  const { session } = await requireAccess(pursuitId);

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

  const oldLines = (dump.content ?? "").split("\n");
  const oldLineAuthorIds = normalizeLineAuthors(oldLines, dump.lineAuthorIds, dump.authorId);
  const lineAuthorIds = diffLineAuthors(oldLines, oldLineAuthorIds, text.split("\n"), session.user.id);

  // expectedUpdatedAt is a hidden field carrying the updatedAt this editor
  // loaded the page with — same optimistic-concurrency guard as
  // updateNote. A shared Pursuit's dump can just as easily be open in two
  // people's editors at once as an Organized note can.
  const expectedUpdatedAt = formData.get("expectedUpdatedAt");
  const result = await prisma.brainDump.updateMany({
    where: {
      id: dumpId,
      pursuitId,
      ...(typeof expectedUpdatedAt === "string" && expectedUpdatedAt
        ? { updatedAt: new Date(expectedUpdatedAt) }
        : {}),
    },
    // Rewriting a dump makes whatever note it was folded into stale, so it
    // goes back to processed:false — the same "needs organizing" state a
    // brand new dump starts in — and reappears in the Organize count.
    data: { content: text, images, processed: false, lineAuthorIds },
  });

  if (result.count === 0) {
    return {
      error:
        "This page was changed by someone else since you opened it — reload to see their version before saving over it.",
    };
  }

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
// meta-llama/llama-4-scout-17b-16e-instruct (the previous value here) was
// confirmed 404 model_not_found in Groq's own request logs on 2026-09-24
// — Groq had dropped it from the free tier. This replacement is a
// best-effort pick from web research, still NOT verified with a live
// call (console.groq.com/docs/models and the API itself are both
// unreachable from this dev sandbox's network) — if it 404s too, check
// that docs page directly (or the Playground's model list with an image
// attached) for whatever's current, and swap it in here again.
const VISION_MODEL = "qwen/qwen3.8-27b";
const MAX_VISION_IMAGES = 5;

// Groq's own JSON mode occasionally rejects its own generation with a
// "json_validate_failed" error -- a one-off sampling hiccup, not an
// outage, that a second attempt with the exact same prompt very often
// just doesn't repeat. One retry here saves a manual "click Organize
// again" for what's usually transient, before this falls through to the
// model-swap/error-message handling below.
async function createJsonCompletion(params: ChatCompletionCreateParamsNonStreaming) {
  try {
    return await groq.chat.completions.create(params);
  } catch {
    return await groq.chat.completions.create(params);
  }
}

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
  const unlimited = await hasUnlimitedAccess(session.user.id, session.user.email);

  if (!unlimited) {
    const usedToday = await getOrganizeUsageToday(session.user.id);
    if (usedToday >= DAILY_ORGANIZE_LIMIT) {
      return {
        error: `You've hit the limit of ${DAILY_ORGANIZE_LIMIT} AI organizes for today. Try again tomorrow.`,
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
else, since the app only knows how to render these (anything not listed
here, like #### or standard \`\`\` code fences, would show up as literal
stray characters instead of formatting):
- "# " at the start of a line for a heading (also "## " and "### " for
  smaller headings — never more than three #s)
- "! " at the start of a line for a callout / key takeaway
- "- " at the start of a line for a bullet list
- "1. " (etc.) at the start of a line for a numbered list — a numbered
  list is ONE list: number its items 1, 2, 3, 4... in order and keep
  going up for every item that belongs to it, even if each one also has
  its own explanation/answer underneath (see nesting below). Never
  restart at "1." for each item — a blank line between items (or
  anything that isn't itself a nested sub-item right under the item
  above) splits it into a separate list, and that separate list visually
  restarts its own count at 1, however it's numbered in this text.
- "a. " (etc.) at the start of a line for a lettered list — also used,
  indented two spaces under a numbered item, to attach that item's own
  follow-up (an answer, a sub-point) WITHOUT a blank line before it, so
  it stays nested inside that same numbered item instead of breaking the
  numbered list in two. For Q&A-style material specifically, write each
  question as a numbered item and its answer as that item's own nested
  lettered sub-item, not as a separate paragraph below it.
- "**text**" for bold — no other inline styling
- "| cell | cell | cell |" for a table row — the first row is the header;
  every row needs the same number of cells, and consecutive rows with no
  blank line between them form one table. Only use this for genuinely
  tabular data (comparisons, options with several attributes each) — don't
  force a table where a bullet list reads better.
- A line with just "<" (optionally followed directly by a language name,
  e.g. "<python" or "<sql" — leave it bare if the material doesn't say),
  then the code verbatim on its own lines, then a line with just ">" to
  close it — this is the ONLY way to preserve a code snippet from the
  material above; never use \`\`\` for this, and never reformat/prettify the
  code inside, keep it exactly as written.
- "![image](url)" to keep a referenced image, EXACTLY as it appears in the
  material above, verbatim and on its own line. This is mandatory whenever
  the material contains one — never skip it, never describe the image in
  words instead, and never write its bare url as plain text.
Plain paragraphs need no marker. Keep it to one blank line between blocks.

Write the note in the same language as the material above (if it's
mixed, use whichever language dominates) — never translate it, even
though these instructions are in English.

Your response is itself JSON, so a literal double-quote character
anywhere in the note's content has to be escaped perfectly to stay
valid — if the material above already has double quotes around a word
or phrase (a quoted answer, a title, a quote), use single quotes ' '
instead when reproducing it, rather than risk an unescaped " breaking
the response.

Then suggest 1-3 short lowercase tags — reuse an existing tag if one
genuinely fits, otherwise propose a new short one. Respond with ONLY a
JSON object, no other text: {"content": "...", "tags": ["...", "..."]}`;

  let completion;
  try {
    completion = await createJsonCompletion({
      model: VISION_MODEL,
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
    if (hasImages) {
      // The vision model itself is the thing most likely to break here —
      // Groq can rename/retire it at any point (as just happened), and
      // this dev sandbox has no way to verify it live before shipping.
      // Rather than fail Organize entirely over that, fall back to the
      // text model on the same prompt (still describing where each image
      // sits via the "![image](url)" markers already in the text) — the
      // note comes out without the model actually having looked at the
      // pictures this once, but Organize still works.
      try {
        completion = await createJsonCompletion({
          model: TEXT_MODEL,
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
        });
      } catch {
        return {
          error: "Couldn't reach the AI right now. Try again in a few minutes.",
        };
      }
    } else {
      // Groq down, its own rate limit, network blip, etc. — none of this
      // used up the user's daily quota (incrementOrganizeUsage runs
      // further down, only once we know a call actually succeeded).
      return {
        error: "Couldn't reach the AI right now. Try again in a few minutes.",
      };
    }
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

// expectedUpdatedAt is the updatedAt the editor last loaded — an
// optimistic-concurrency check. Two people (or two tabs) can open the same
// note; without this, whoever calls Save second just silently overwrites
// the first save with whatever stale content their editor still had open.
// The updateMany's where clause only matches if the row is still exactly
// as this editor last saw it, so a stale save touches 0 rows instead of
// clobbering someone else's newer one.
export async function updateNote(
  pursuitId: string,
  noteId: string,
  content: string,
  expectedUpdatedAt: string,
): Promise<{ error: string | null; conflict?: boolean }> {
  await requireAccess(pursuitId);

  const text = content.trim();
  if (!text) {
    return { error: "Note can't be empty" };
  }

  const result = await prisma.note.updateMany({
    where: { id: noteId, pursuitId, updatedAt: new Date(expectedUpdatedAt) },
    data: { content: text },
  });

  if (result.count === 0) {
    const current = await prisma.note.findFirst({ where: { id: noteId, pursuitId } });
    if (!current) return { error: "This note no longer exists." };
    return {
      error:
        "This note was changed by someone else since you opened it — reload to see their version before saving over it.",
      conflict: true,
    };
  }

  revalidatePath(`/pursuits/${pursuitId}`);
  return { error: null };
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

export async function removeAttachment(pursuitId: string, attachmentId: string) {
  await requireAccess(pursuitId);
  // deleteMany, not delete, scoped to pursuitId so this can't be used to
  // delete an attachment belonging to a different pursuit by guessing an id.
  await prisma.attachment.deleteMany({ where: { id: attachmentId, pursuitId } });
  revalidatePath(`/pursuits/${pursuitId}`);
}

export async function isClassroomConnected(): Promise<boolean> {
  const session = await auth();
  if (!session?.user?.id) return false;
  const connection = await prisma.googleClassroomConnection.findUnique({
    where: { userId: session.user.id },
  });
  return !!connection;
}

// Per-Pursuit opt-in — off by default so a Book/Project/whatever Pursuit
// never shows the Classroom box, only one you deliberately turn it on
// for. Turning it off again does NOT disconnect the account-wide Google
// Classroom connection or forget the linked course — it just hides the
// section, so turning it back on later picks up right where it left off.
export async function setClassroomEnabled(pursuitId: string, enabled: boolean) {
  await requireAccess(pursuitId);
  await prisma.pursuit.update({ where: { id: pursuitId }, data: { classroomEnabled: enabled } });
  revalidatePath(`/pursuits/${pursuitId}`);
}

export async function disconnectClassroom(pursuitId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not signed in");
  await prisma.googleClassroomConnection.deleteMany({ where: { userId: session.user.id } });
  revalidatePath(`/pursuits/${pursuitId}`);
}

export async function listClassroomCourses(): Promise<
  { error: string | null; courses?: ClassroomCourse[] }
> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not signed in" };

  const accessToken = await getValidAccessToken(session.user.id);
  if (!accessToken) return { error: "Not connected to Google Classroom" };

  try {
    return { error: null, courses: await listCourses(accessToken) };
  } catch {
    return { error: "Couldn't reach Google Classroom. Try reconnecting." };
  }
}

export async function listClassroomFiles(
  courseId: string,
): Promise<{ error: string | null; files?: ClassroomFile[] }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not signed in" };

  const accessToken = await getValidAccessToken(session.user.id);
  if (!accessToken) return { error: "Not connected to Google Classroom" };

  try {
    return { error: null, files: await listCourseFiles(accessToken, courseId) };
  } catch {
    return { error: "Couldn't load files for that course." };
  }
}

// Remembers which course this Pursuit is about, so the upcoming-deadlines
// widget (and reopening the Files tab later) doesn't need the course
// re-picked every visit. courseName is denormalized here purely for
// display before/without a fresh Classroom API round trip.
export async function setClassroomCourse(
  pursuitId: string,
  courseId: string,
  courseName: string,
) {
  await requireAccess(pursuitId);
  await prisma.pursuit.update({
    where: { id: pursuitId },
    data: { classroomCourseId: courseId, classroomCourseName: courseName },
  });
  revalidatePath(`/pursuits/${pursuitId}`);
}

// Unlike every other Classroom action here, this one fires on its own on
// every page load (see UpcomingDeadlines' effect) rather than from a
// user's click — so it's wrapped in one try/catch around everything,
// requireAccess included. A click-triggered action can afford to let an
// unexpected throw crash to the error boundary since the user can just
// retry; a passive background fetch can't, since there's nothing for
// them to retry.
export async function listPursuitDeadlines(
  pursuitId: string,
): Promise<{ error: string | null; deadlines?: ClassroomDeadline[] }> {
  try {
    const { session, pursuit } = await requireAccess(pursuitId);
    if (!pursuit.classroomCourseId) return { error: null, deadlines: [] };

    const accessToken = await getValidAccessToken(session.user.id);
    if (!accessToken) return { error: "Not connected to Google Classroom" };

    return {
      error: null,
      deadlines: await listCourseDeadlines(accessToken, pursuit.classroomCourseId),
    };
  } catch {
    return { error: "Couldn't load deadlines for that course." };
  }
}

// Imports a Classroom file the same way a manually-pasted link would be —
// as a plain Attachment pointing at its Drive URL, not a downloaded copy.
// Opening it later relies on the viewer's own Google session having
// access, same as clicking the file inside Classroom itself would.
export async function importClassroomFile(pursuitId: string, name: string, url: string) {
  await requireAccess(pursuitId);
  await prisma.attachment.create({
    data: { pursuitId, name, url, size: 0 },
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

export async function renamePursuit(pursuitId: string, title: string) {
  await requireAccess(pursuitId);

  const trimmed = title.trim();
  if (!trimmed) {
    throw new Error("Title can't be empty");
  }

  await prisma.pursuit.update({
    where: { id: pursuitId },
    data: { title: trimmed },
  });

  revalidatePath(`/pursuits/${pursuitId}`);
  revalidatePath("/pursuits");
}

export async function updatePursuitMeta(pursuitId: string, formData: FormData) {
  const { session } = await requireAccess(pursuitId);

  const type = formData.get("type");
  const status = formData.get("status");
  const sectionName = formData.get("section");

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
      type: typeof type === "string" && type.trim() !== "" ? type.trim() : null,
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
  const unlimited = await hasUnlimitedAccess(session.user.id, session.user.email);

  const q = question.trim();
  if (!q) return { error: "Write a question first" };

  if (!unlimited) {
    const usedToday = await getOrganizeUsageToday(session.user.id);
    if (usedToday >= DAILY_ORGANIZE_LIMIT) {
      return {
        error: `You've hit the limit of ${DAILY_ORGANIZE_LIMIT} AI uses for today (Organize and Ask share the same limit). Try again tomorrow.`,
      };
    }
  }

  const tsQuery = buildOrTsQuery(q);
  if (!tsQuery) return { error: "Write a question first" };

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

  const prompt = `Context from this pursuit's brain dumps and organized notes (this may be written in a different language than the question below — that's normal, ignore it for the purpose of picking a reply language):\n\n${context}\n\n---\n\nQuestion: ${q}\n\nAnswer using ONLY the context above — never use outside knowledge, even if you know the answer. If the context doesn't contain the answer, say plainly that this pursuit's notes don't cover it. IMPORTANT: reply in the same language as the Question above, never the language of the context — even if every word of the context is in a different language, translate the substance and answer in the Question's language. Plain prose (no markdown formatting), and keep it short.`;

  let completion;
  try {
    completion = await groq.chat.completions.create({
      model: TEXT_MODEL,
      messages: [{ role: "user", content: prompt }],
    });
  } catch {
    return {
      error: "Couldn't reach the AI right now. Try again in a few minutes.",
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

const WHISPER_MODEL = "whisper-large-v3-turbo";

// Voice notes: the composer already uploaded the recording to Blob
// storage (same client-side upload as images, for the same reason —
// Server Actions cap request bodies at 1MB, easily blown past by
// audio). This only has to hand Groq the URL, not the bytes themselves.
// Shares the same daily AI quota as Organize/Ask — transcription is
// another Groq call this app is trying to keep bounded per user per day.
export async function transcribeAudio(
  pursuitId: string,
  audioUrl: string,
): Promise<{ error: string | null; text?: string }> {
  const { session } = await requireAccess(pursuitId);
  const unlimited = await hasUnlimitedAccess(session.user.id, session.user.email);

  if (!unlimited) {
    const usedToday = await getOrganizeUsageToday(session.user.id);
    if (usedToday >= DAILY_ORGANIZE_LIMIT) {
      return {
        error: `You've hit the limit of ${DAILY_ORGANIZE_LIMIT} AI uses for today (Organize, Ask and voice notes share the same limit). Try again tomorrow.`,
      };
    }
  }

  let transcription;
  try {
    transcription = await groq.audio.transcriptions.create({
      model: WHISPER_MODEL,
      url: audioUrl,
    });
  } catch {
    return {
      error: "Couldn't reach the AI right now. Try again in a few minutes.",
    };
  }

  if (!transcription.text.trim()) {
    return { error: "Didn't catch any speech in that recording" };
  }

  if (!unlimited) {
    await incrementOrganizeUsage(session.user.id);
  }

  return { error: null, text: transcription.text };
}

// Generates flashcards from one organized note. Shares the daily AI
// quota like every other Groq-calling action here.
export async function generateFlashcards(
  pursuitId: string,
  noteId: string,
): Promise<{ error: string | null; count?: number }> {
  const { session } = await requireAccess(pursuitId);
  const unlimited = await hasUnlimitedAccess(session.user.id, session.user.email);

  if (!unlimited) {
    const usedToday = await getOrganizeUsageToday(session.user.id);
    if (usedToday >= DAILY_ORGANIZE_LIMIT) {
      return {
        error: `You've hit the limit of ${DAILY_ORGANIZE_LIMIT} AI uses for today. Try again tomorrow.`,
      };
    }
  }

  // Counted across pursuits the caller owns, same soft-cap spirit as
  // OrganizeUsage above — generating into a pursuit someone else shared
  // with you counts against their cap in this simplified version, not a
  // gap worth its own "who generated this card" column yet.
  if (!unlimited) {
    const generatedThisMonth = await getFlashcardsThisMonth(session.user.id);
    if (generatedThisMonth >= FREE_MONTHLY_FLASHCARD_LIMIT) {
      return {
        error: `You've hit the Free plan's limit of ${FREE_MONTHLY_FLASHCARD_LIMIT} flashcards this month. Upgrade to Pro for unlimited flashcards.`,
      };
    }
  }

  const note = await prisma.note.findFirst({ where: { id: noteId, pursuitId } });
  if (!note) {
    return { error: "Note not found" };
  }

  const prompt = `${note.content}\n\n---\n\nGenerate 5-10 flashcards (question + answer pairs) that test recall of the key facts and concepts in the note above. Each question should be short and specific — no "explain everything about X" questions. Each answer should be short too — a fact, a definition, a term — not a paragraph. Write them in the same language as the note. Respond with ONLY a JSON object, no other text: {"cards": [{"question": "...", "answer": "..."}, ...]}`;

  let completion;
  try {
    completion = await createJsonCompletion({
      model: TEXT_MODEL,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });
  } catch {
    return {
      error: "Couldn't reach the AI right now. Try again in a few minutes.",
    };
  }

  const text = completion.choices[0]?.message?.content;
  if (!text) {
    return { error: "AI did not return a usable response" };
  }

  const cards = parseFlashcardsResponse(text);
  if (cards.length === 0) {
    return { error: "Couldn't generate flashcards from this note" };
  }

  await prisma.flashcard.createMany({
    data: cards.map((c) => ({
      pursuitId,
      noteId,
      question: c.question,
      answer: c.answer,
    })),
  });

  if (!unlimited) {
    await incrementOrganizeUsage(session.user.id);
  }

  revalidatePath(`/pursuits/${pursuitId}`);
  return { error: null, count: cards.length };
}

// Applies one SM-2 review (see lib/sm2.ts) and reschedules the card.
// quality is a 0-5 self-rating of how well the card was recalled just
// now, same scale as SuperMemo/Anki use.
export async function reviewFlashcard(
  pursuitId: string,
  flashcardId: string,
  quality: number,
) {
  await requireAccess(pursuitId);

  const card = await prisma.flashcard.findFirst({
    where: { id: flashcardId, pursuitId },
  });
  if (!card) {
    throw new Error("Flashcard not found");
  }

  const next = computeNextReview(
    { interval: card.interval, easeFactor: card.easeFactor, repetitions: card.repetitions },
    quality,
  );

  await prisma.flashcard.update({
    where: { id: flashcardId },
    data: {
      interval: next.interval,
      easeFactor: next.easeFactor,
      repetitions: next.repetitions,
      dueDate: dueDateAfter(next.interval),
    },
  });

  revalidatePath(`/pursuits/${pursuitId}`);
}

export async function deleteFlashcard(pursuitId: string, flashcardId: string) {
  await requireAccess(pursuitId);
  await prisma.flashcard.deleteMany({ where: { id: flashcardId, pursuitId } });
  revalidatePath(`/pursuits/${pursuitId}`);
}
