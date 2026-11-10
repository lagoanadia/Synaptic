"use server";

import { getT } from "@/lib/i18n/server";

import { revalidatePath } from "next/cache";
import { cleanFolderBlock, type FolderBlock } from "@/lib/blocks";
import { after } from "next/server";
import { addNamedConcept, refreshUnitMap } from "@/lib/autoMap";
import { BILLING } from "@/lib/billingFlag";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { groq } from "@/lib/groq";
import type { ChatCompletionContentPartImage } from "groq-sdk/resources/chat/completions";
import { MemberRole, ProjectCardStatus } from "@/generated/prisma/client";
import { upsertContentSection } from "@/lib/sections";
import { splitTitle, withTitle } from "@/lib/text";
import { buildOrTsQuery } from "@/lib/search";
import { parseOrganizeResponse } from "@/lib/organize";
import { parseJsonLoosely } from "@/lib/json";
import { MAX_VISION_IMAGES } from "@/lib/visionLimits";
import { languageRule, TEXT_MODEL, VISION_MODEL, createJsonCompletion } from "@/lib/ai";
import { parseFlashcardsResponse } from "@/lib/flashcards";
import { computeNextReview, dueDateAfter } from "@/lib/sm2";
import { aiBudget, requirePursuitAccess } from "@/lib/access";
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

const requireAccess = requirePursuitAccess;

export type FormState = { error: string | null; success?: boolean; updatedAt?: string };

// Saving notes keeps that unit's concept map up to date, after the
// response (it calls the AI, so it mustn't slow the save down).
function mapLater(userId: string, pursuitId: string, unitIds: (string | null)[]) {
  for (const unitId of new Set(unitIds)) after(() => refreshUnitMap(userId, pursuitId, unitId).catch(() => {}));
}

// (pursuitId, prevState, formData) to fit useActionState once bound. They return
// errors instead of throwing so validation shows inline.
export async function addMember(
  pursuitId: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const t = await getT();
  const { session, pursuit } = await requireAccess(pursuitId);

  // Only the owner can invite collaborators — not just any existing member.
  if (pursuit.ownerId !== session.user.id) {
    return { error: t("Solo la propietaria puede invitar") };
  }

  const email = formData.get("email");
  if (typeof email !== "string" || email.trim() === "") {
    return { error: t("Falta el email") };
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
    return { error: t("Es tu propia cuenta — ya eres la propietaria") };
  }

  const existingMember = await prisma.pursuitMember.findUnique({
    where: { pursuitId_userId: { pursuitId, userId: invitedUser.id } },
  });
  // Free plan: one collaborator per pursuit. Role changes are never blocked.
  if (!existingMember) {
    const owner = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } });
    if (owner.plan === "FREE") {
      const memberCount = await prisma.pursuitMember.count({ where: { pursuitId } });
      if (memberCount >= 1) {
        return {
          error:
            t("Solo puedes compartir esta asignatura con 1 persona{0}", { 0: BILLING ? t(". Hazte Pro para compartir sin límite.") : "." }),
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
  const t = await getT();
  const { session, pursuit } = await requireAccess(pursuitId);
  if (pursuit.ownerId === session.user.id) {
    throw new Error(t("No puedes salir de tu propia asignatura — elimínala"));
  }

  await prisma.pursuitMember.deleteMany({
    where: { pursuitId, userId: session.user.id },
  });

  revalidatePath("/pursuits");
}

export async function removeMember(pursuitId: string, memberId: string) {
  const t = await getT();
  const { session, pursuit } = await requireAccess(pursuitId);
  if (pursuit.ownerId !== session.user.id) {
    throw new Error(t("Solo la propietaria puede quitar personas"));
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
  const t = await getT();
  const { session, pursuit } = await requireAccess(pursuitId);
  if (pursuit.ownerId !== session.user.id) {
    throw new Error(t("Solo la propietaria puede cambiar el rol"));
  }
  if (role !== "EDITOR" && role !== "VIEWER") {
    throw new Error(t("Rol no válido"));
  }

  await prisma.pursuitMember.updateMany({
    where: { id: memberId, pursuitId },
    data: { role },
  });

  revalidatePath(`/pursuits/${pursuitId}`);
}

// Creates an empty section ready to drag pages/notes onto — reuses an
// existing one by name instead of making a duplicate if it somehow
// already exists (e.g. a second browser tab creating the same name).
export async function createContentSection(pursuitId: string, name: string) {
  await requireAccess(pursuitId);
  if (name.trim() === "") return;

  await upsertContentSection(pursuitId, name);
  revalidatePath(`/pursuits/${pursuitId}`);
}

// Deletes only this Pursuit's own section — any page/note in it falls
// back to sectionId: null automatically (ON DELETE SET NULL).
export async function deleteContentSection(pursuitId: string, sectionId: string) {
  await requireAccess(pursuitId);
  await prisma.pursuitContentSection.deleteMany({
    where: { id: sectionId, pursuitId },
  });
  revalidatePath(`/pursuits/${pursuitId}`);
}

export async function addBrainDump(
  pursuitId: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const t = await getT();
  const { session } = await requireAccess(pursuitId);

  const content = formData.get("content");
  const text = typeof content === "string" ? content.trim() : "";

  if (!text) {
    return { error: t("Escribe algo primero") };
  }

  // Images were already uploaded (via uploadImage, as each one was picked)
  // and are embedded as `![image](url)` markers inside `text` itself — so
  // there's no separate file to handle here, just the finished content.
  const images = Array.from(text.matchAll(/!\[image\]\(([^)]+)\)/g)).map(
    (m) => m[1],
  );

  const sectionId = formData.get("sectionId");
  const section =
    typeof sectionId === "string" && sectionId
      ? await prisma.pursuitContentSection.findFirst({ where: { id: sectionId, pursuitId }, select: { id: true } })
      : null;

  await prisma.brainDump.create({
    data: {
      pursuitId,
      authorId: session.user.id,
      content: text,
      images,
      lineAuthorIds: text.split("\n").map(() => session.user.id),
      sectionId: section?.id ?? null,
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
  mapLater(session.user.id, pursuitId, [section?.id ?? null]);
  return { error: null, success: true };
}

export async function updateBrainDump(
  pursuitId: string,
  dumpId: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const t = await getT();
  const { session } = await requireAccess(pursuitId);

  const dump = await prisma.brainDump.findFirst({
    where: { id: dumpId, pursuitId },
  });
  if (!dump) {
    return { error: t("Página no encontrada") };
  }

  const content = formData.get("content");
  const text = typeof content === "string" ? content.trim() : "";
  if (!text) {
    return { error: t("Escribe algo primero") };
  }

  const images = Array.from(text.matchAll(/!\[image\]\(([^)]+)\)/g)).map(
    (m) => m[1],
  );

  const oldLines = (dump.content ?? "").split("\n");
  const oldLineAuthorIds = normalizeLineAuthors(oldLines, dump.lineAuthorIds, dump.authorId);
  const lineAuthorIds = diffLineAuthors(oldLines, oldLineAuthorIds, text.split("\n"), session.user.id);

  // Optimistic concurrency: the version this editor loaded (see updateNote).
  const expectedUpdatedAt = formData.get("expectedUpdatedAt");
  const now = new Date();
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
    data: { content: text, images, processed: false, lineAuthorIds, updatedAt: now },
  });

  if (result.count === 0) {
    return {
      error:
        t("Alguien ha cambiado esta página desde que la abriste: recarga para ver su versión antes de guardar encima."),
    };
  }

  await prisma.pursuit.update({
    where: { id: pursuitId },
    data: { lastTouchedAt: new Date() },
  });

  revalidatePath(`/pursuits/${pursuitId}`);
  revalidatePath(`/pursuits/${pursuitId}/dump/${dumpId}`);
  mapLater(session.user.id, pursuitId, [dump.sectionId]);
  return { error: null, success: true, updatedAt: now.toISOString() };
}

export async function deleteBrainDump(pursuitId: string, dumpId: string) {
  await requireAccess(pursuitId);
  await prisma.brainDump.deleteMany({ where: { id: dumpId, pursuitId } });
  revalidatePath(`/pursuits/${pursuitId}`);
}

// Returns { error } instead of throwing: it's called from a button, not a form.
export async function organizeDumps(
  pursuitId: string,
  dumpIds?: string[],
): Promise<{ error: string | null }> {
  const t = await getT();
  const { session } = await requireAccess(pursuitId);
  const budget = await aiBudget(session.user.id, session.user.email);
  const limited = await budget.check();
  if (limited) return { error: limited };

  const dumps = await prisma.brainDump.findMany({
    where: {
      pursuitId,
      processed: false,
      ...(dumpIds && dumpIds.length > 0 ? { id: { in: dumpIds } } : {}),
    },
    orderBy: { createdAt: "asc" },
  });

  if (dumps.length === 0) {
    return { error: t("No hay notas nuevas que organizar") };
  }

  const existingTags = await prisma.tag.findMany({
    where: { pursuitId },
    select: { name: true },
  });

  // dump.content already has any images inlined as `![image](url)` markers
  // (that's how the composer saves them) — no need to also list them
  // separately in the prompt text, that would just duplicate the same URL.
  const rawMaterial = dumps.map((dump) => dump.content ?? "").join("\n---\n");

  // The vision model takes a few images per call; oldest first.
  const imageUrls = dumps.flatMap((dump) => dump.images).slice(0, MAX_VISION_IMAGES);
  const hasImages = imageUrls.length > 0;

  const prompt = `${rawMaterial}\n---\nExisting tags for this pursuit: ${
    existingTags.map((t) => t.name).join(", ") || "(none yet)"
  }${
    hasImages
      ? `\n\n${imageUrls.length} image(s) referenced above are attached below for you to actually look at — use what's in them, don't just guess from the surrounding text.`
      : ""
  }\n\nIn the material above, a line break the author typed on its own (not
just a long sentence that happens to wrap) usually marks a separate point,
fact, or step, even without a "-" or "1." in front of it — don't flatten
several such lines into one run-on paragraph. When in doubt, a short line
followed by another short line is almost always two separate points.

Synthesize the material above into one organized, structured note.

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

Write the note in the user's language. Keep code, technical terms and quotes as they
are. Exception: if the material is for learning a foreign language
(e.g. English class), keep its examples and vocabulary in that language.

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
      // Explicit cap: Groq's default cuts long notes off mid-JSON.
      max_completion_tokens: 16000,
    });
  } catch {
    if (hasImages) {
      // If the vision model fails (Groq retires models without warning), retry with
      // the text model; the image markers still say where pictures were.
      try {
        completion = await createJsonCompletion({
          model: TEXT_MODEL,
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          max_completion_tokens: 16000,
        });
      } catch {
        return {
          error: t("No se ha podido contactar con la IA. Inténtalo en unos minutos."),
        };
      }
    } else {
      // Groq down, its own rate limit, network blip, etc. — none of this
      // used up the user's daily quota (incrementOrganizeUsage runs
      // further down, only once we know a call actually succeeded).
      return {
        error: t("No se ha podido contactar con la IA. Inténtalo en unos minutos."),
      };
    }
  }

  const text = completion.choices[0]?.message?.content;
  if (!text) {
    return { error: t("La IA no ha devuelto una respuesta válida") };
  }

  await budget.charge();

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

  // Only when every dump going in agrees on the same section — a note
  // Organized from a mix of sections (or none) starts unsectioned rather
  // than guessing which one it "mostly" belongs to.
  const firstSectionId = dumps[0].sectionId;
  const sharedSectionId =
    firstSectionId !== null && dumps.every((d) => d.sectionId === firstSectionId)
      ? firstSectionId
      : null;

  await prisma.note.create({
    data: {
      pursuitId,
      content: noteContent,
      sectionId: sharedSectionId,
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
  mapLater(session.user.id, pursuitId, dumps.map((d) => d.sectionId));
  return { error: null };
}

// Optimistic concurrency: only updates if the note is still the version this
// editor loaded, so a stale save can't overwrite a newer one.
export async function updateNote(
  pursuitId: string,
  noteId: string,
  content: string,
  expectedUpdatedAt: string,
): Promise<{ error: string | null; conflict?: boolean; updatedAt?: string }> {
  const t = await getT();
  const { session } = await requireAccess(pursuitId);
  const userId = session.user.id;

  const text = content.trim();
  if (!text) {
    return { error: t("La nota no puede estar vacía") };
  }

  const now = new Date();
  const result = await prisma.note.updateMany({
    where: { id: noteId, pursuitId, updatedAt: new Date(expectedUpdatedAt) },
    data: { content: text, updatedAt: now },
  });

  if (result.count === 0) {
    const current = await prisma.note.findFirst({ where: { id: noteId, pursuitId } });
    if (!current) return { error: t("Esta nota ya no existe.") };
    return {
      error:
        t("Alguien ha cambiado esta nota desde que la abriste: recarga para ver su versión antes de guardar encima."),
      conflict: true,
    };
  }

  revalidatePath(`/pursuits/${pursuitId}`);
  const saved = await prisma.note.findFirst({ where: { id: noteId, pursuitId }, select: { sectionId: true } });
  mapLater(userId, pursuitId, [saved?.sectionId ?? null]);
  return { error: null, updatedAt: now.toISOString() };
}

export async function deleteNote(pursuitId: string, noteId: string) {
  await requireAccess(pursuitId);

  const note = await prisma.note.findFirst({
    where: { id: noteId, pursuitId },
    select: { sourceDumps: { select: { id: true } } },
  });

  await prisma.note.deleteMany({ where: { id: noteId, pursuitId } });

  // A page is "organized" only while some note still references it.
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

export async function isClassroomConnected(): Promise<boolean> {
  const session = await auth();
  if (!session?.user?.id) return false;
  const connection = await prisma.googleClassroomConnection.findUnique({
    where: { userId: session.user.id },
  });
  return !!connection;
}

// Per-subject opt-in. Turning it off only hides it; the connection and linked
// course stay.
export async function setClassroomEnabled(pursuitId: string, enabled: boolean) {
  await requireAccess(pursuitId);
  await prisma.pursuit.update({ where: { id: pursuitId }, data: { classroomEnabled: enabled } });
  revalidatePath(`/pursuits/${pursuitId}`);
}

export async function disconnectClassroom(pursuitId: string) {
  const t = await getT();
  const session = await auth();
  if (!session?.user?.id) throw new Error(t("No has iniciado sesión"));
  await prisma.googleClassroomConnection.deleteMany({ where: { userId: session.user.id } });
  revalidatePath(`/pursuits/${pursuitId}`);
}

export async function listClassroomCourses(): Promise<
  { error: string | null; courses?: ClassroomCourse[] }
> {
  const t = await getT();
  const session = await auth();
  if (!session?.user?.id) return { error: t("No has iniciado sesión") };

  const accessToken = await getValidAccessToken(session.user.id);
  if (!accessToken) return { error: t("No estás conectada a Google Classroom") };

  try {
    return { error: null, courses: await listCourses(accessToken) };
  } catch {
    return { error: t("No se ha podido conectar con Google Classroom. Prueba a reconectar.") };
  }
}

export async function listClassroomFiles(
  courseId: string,
): Promise<{ error: string | null; files?: ClassroomFile[] }> {
  const t = await getT();
  const session = await auth();
  if (!session?.user?.id) return { error: t("No has iniciado sesión") };

  const accessToken = await getValidAccessToken(session.user.id);
  if (!accessToken) return { error: t("No estás conectada a Google Classroom") };

  try {
    return { error: null, files: await listCourseFiles(accessToken, courseId) };
  } catch {
    return { error: t("No se han podido cargar los archivos de ese curso.") };
  }
}

// Remembers the course for this subject; the name is cached for display.
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

// Runs on every page load, not on a click, so every failure (access included)
// becomes an empty result instead of an error page.
export async function listPursuitDeadlines(
  pursuitId: string,
): Promise<{ error: string | null; deadlines?: ClassroomDeadline[] }> {
  const t = await getT();
  try {
    const { session, pursuit } = await requireAccess(pursuitId);
    if (!pursuit.classroomCourseId) return { error: null, deadlines: [] };

    const accessToken = await getValidAccessToken(session.user.id);
    if (!accessToken) return { error: t("No estás conectada a Google Classroom") };

    return {
      error: null,
      deadlines: await listCourseDeadlines(accessToken, pursuit.classroomCourseId),
    };
  } catch {
    return { error: t("No se han podido cargar las entregas de ese curso.") };
  }
}

// Stored as a link to the Drive file, not a copy.
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
  const t = await getT();
  const { session } = await requireAccess(pursuitId);

  const name = formData.get("name");
  if (typeof name !== "string" || name.trim() === "") {
    return { error: t("Falta el nombre de la etiqueta") };
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
  const t = await getT();
  await requireAccess(pursuitId);

  const trimmed = title.trim();
  if (!trimmed) {
    throw new Error(t("El título no puede estar vacío"));
  }

  await prisma.pursuit.update({
    where: { id: pursuitId },
    data: { title: trimmed },
  });

  revalidatePath(`/pursuits/${pursuitId}`);
  revalidatePath("/pursuits");
}

// Empty saves as null.
export async function updateStatusNote(pursuitId: string, note: string) {
  await requireAccess(pursuitId);

  await prisma.pursuit.update({
    where: { id: pursuitId },
    data: { statusNote: note.trim() === "" ? null : note },
  });

  revalidatePath(`/pursuits/${pursuitId}`);
}

const ASK_CONTEXT_LIMIT = 6;

// "Ask your subject": retrieval with full-text search (shared words) instead of
// embeddings (shared meaning). Enough at personal scale; switch when searches
// clearly miss.
export async function askPursuit(
  pursuitId: string,
  question: string,
): Promise<{ error: string | null; answer?: string }> {
  const t = await getT();
  const { session } = await requireAccess(pursuitId);
  const q = question.trim();
  if (!q) return { error: t("Escribe una pregunta primero") };

  const budget = await aiBudget(session.user.id, session.user.email);
  const limited = await budget.check();
  if (limited) return { error: limited };

  const tsQuery = buildOrTsQuery(q);
  if (!tsQuery) return { error: t("Escribe una pregunta primero") };

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
      messages: [{ role: "system", content: await languageRule() }, { role: "user", content: prompt }],
    });
  } catch {
    return {
      error: t("No se ha podido contactar con la IA. Inténtalo en unos minutos."),
    };
  }

  const answer = completion.choices[0]?.message?.content;
  if (!answer) {
    return { error: t("La IA no ha devuelto una respuesta válida") };
  }

  await budget.charge();

  return { error: null, answer };
}

const WHISPER_MODEL = "whisper-large-v3-turbo";

// Voice notes: the browser already uploaded the audio; Groq gets the URL.
export async function transcribeAudio(
  pursuitId: string,
  audioUrl: string,
): Promise<{ error: string | null; text?: string }> {
  const t = await getT();
  const { session } = await requireAccess(pursuitId);
  const budget = await aiBudget(session.user.id, session.user.email);
  const limited = await budget.check();
  if (limited) return { error: limited };

  let transcription;
  try {
    transcription = await groq.audio.transcriptions.create({
      model: WHISPER_MODEL,
      url: audioUrl,
    });
  } catch {
    return {
      error: t("No se ha podido contactar con la IA. Inténtalo en unos minutos."),
    };
  }

  if (!transcription.text.trim()) {
    return { error: t("No he oído nada en esa grabación") };
  }

  await budget.charge();

  return { error: null, text: transcription.text };
}

// Generates flashcards from one organized note. Shares the daily AI
// quota like every other Groq-calling action here.
export async function generateFlashcards(
  pursuitId: string,
  noteId: string,
): Promise<{ error: string | null; count?: number }> {
  const t = await getT();
  const { session } = await requireAccess(pursuitId);
  const budget = await aiBudget(session.user.id, session.user.email);
  const limited = await budget.check();
  if (limited) return { error: limited };

  // Monthly flashcard cap for free accounts, counted on owned pursuits.
  if (!budget.unlimited) {
    const generatedThisMonth = await getFlashcardsThisMonth(session.user.id);
    if (generatedThisMonth >= FREE_MONTHLY_FLASHCARD_LIMIT) {
      return {
        error: t("Has llegado al límite del plan gratis: {0} tarjetas este mes.{1}", { 0: FREE_MONTHLY_FLASHCARD_LIMIT, 1: BILLING ? t(" Hazte Pro para tenerlas ilimitadas.") : "" }),
      };
    }
  }

  const note = await prisma.note.findFirst({ where: { id: noteId, pursuitId } });
  if (!note) {
    return { error: t("Nota no encontrada") };
  }

  const prompt = `${note.content}\n\n---\n\nGenerate 5-10 flashcards (question + answer pairs) that test recall of the key facts and concepts in the note above. Each question should be short and specific — no "explain everything about X" questions. Each answer should be short too — a fact, a definition, a term — not a paragraph. Write them in the same language as the note. A question must make sense on its own, months later, without the note in front of you — name the topic in it. For each card also write 3 plausible WRONG answers for multiple choice: same type, about as long as the answer (±20%) and with the same level of detail, so the right one never stands out as the longest; never partially correct. Respond with ONLY a JSON object, no other text: {"cards": [{"question": "...", "answer": "...", "wrong": ["...", "...", "..."], "hint": "one short nudge that doesn't give the answer away"}, ...]}`;

  let completion;
  try {
    completion = await createJsonCompletion({
      model: TEXT_MODEL,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });
  } catch {
    return {
      error: t("No se ha podido contactar con la IA. Inténtalo en unos minutos."),
    };
  }

  const text = completion.choices[0]?.message?.content;
  if (!text) {
    return { error: t("La IA no ha devuelto una respuesta válida") };
  }

  const cards = parseFlashcardsResponse(text);
  if (cards.length === 0) {
    return { error: t("No he podido crear tarjetas de esta nota") };
  }

  await prisma.flashcard.createMany({
    data: cards.map((c) => ({
      pursuitId,
      noteId,
      question: c.question,
      answer: c.answer,
      distractors: c.distractors,
      hint: c.hint,
    })),
  });

  await budget.charge();

  revalidatePath(`/pursuits/${pursuitId}`);
  return { error: null, count: cards.length };
}

// One card from a passage you selected in the editor ("Crear tarjeta").
export async function cardFromSelection(
  pursuitId: string,
  passage: string,
  noteId: string | null,
): Promise<{ error: string | null; question?: string }> {
  const t = await getT();
  const { session } = await requireAccess(pursuitId);
  const text = passage.trim().slice(0, 2000);
  if (!text) return { error: t("Selecciona un trozo de texto") };
  const budget = await aiBudget(session.user.id, session.user.email);
  const limited = await budget.check();
  if (limited) return { error: limited };
  if (!budget.unlimited && (await getFlashcardsThisMonth(session.user.id)) >= FREE_MONTHLY_FLASHCARD_LIMIT) {
    return { error: t("Has llegado al límite del plan gratis: {0} tarjetas este mes.", { 0: FREE_MONTHLY_FLASHCARD_LIMIT }) };
  }

  const prompt = `${text}\n\n---\n\nWrite exactly ONE flashcard that tests the key idea of the passage above. Short, specific question that makes sense on its own months later (name the topic); short answer (a fact, a term, a definition). Same language as the passage. Also 3 plausible WRONG answers of the same type, about as long as the answer (±20%) and as detailed, so the right one never stands out as the longest. Respond with ONLY a JSON object: {"cards": [{"question": "...", "answer": "...", "wrong": ["...", "...", "..."], "hint": "a short nudge that doesn't give the answer away"}]}`;
  let completion;
  try {
    completion = await createJsonCompletion({
      model: TEXT_MODEL,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });
  } catch {
    return { error: t("No se ha podido contactar con la IA. Inténtalo en unos minutos.") };
  }
  const card = parseFlashcardsResponse(completion.choices[0]?.message?.content ?? "")[0];
  if (!card) return { error: t("No he podido crear la tarjeta") };

  const ownNote = noteId ? await prisma.note.findFirst({ where: { id: noteId, pursuitId }, select: { id: true } }) : null;
  await prisma.flashcard.create({
    data: { pursuitId, noteId: ownNote?.id ?? null, question: card.question, answer: card.answer, distractors: card.distractors, hint: card.hint },
  });
  await budget.charge();
  revalidatePath(`/pursuits/${pursuitId}`);
  return { error: null, question: card.question };
}

// Applies one SM-2 review (see lib/sm2.ts) and reschedules the card.
// quality is a 0-5 self-rating of how well the card was recalled just
// now, same scale as SuperMemo/Anki use.
export async function reviewFlashcard(
  pursuitId: string,
  flashcardId: string,
  quality: number,
) {
  const t = await getT();
  await requireAccess(pursuitId);

  const card = await prisma.flashcard.findFirst({
    where: { id: flashcardId, pursuitId },
  });
  if (!card) {
    throw new Error(t("Tarjeta no encontrada"));
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
      reviewedAt: new Date(),
    },
  });

  revalidatePath(`/pursuits/${pursuitId}`);
}

export async function deleteFlashcard(pursuitId: string, flashcardId: string) {
  await requireAccess(pursuitId);
  await prisma.flashcard.deleteMany({ where: { id: flashcardId, pursuitId } });
  revalidatePath(`/pursuits/${pursuitId}`);
}

// ── Projects (a per-Pursuit Kanban board for a single deliverable) ─────────

export async function createProject(pursuitId: string, title: string, dueDate: string | null) {
  const t = await getT();
  await requireAccess(pursuitId);
  if (title.trim() === "") {
    throw new Error(t("Falta el título"));
  }
  const project = await prisma.project.create({
    data: {
      pursuitId,
      title: title.trim(),
      dueDate: dueDate ? new Date(dueDate) : null,
    },
  });
  revalidatePath(`/pursuits/${pursuitId}`);
  return project.id;
}

export async function deleteProject(pursuitId: string, projectId: string) {
  await requireAccess(pursuitId);
  // ProjectCard has ON DELETE CASCADE on projectId, so its cards go with it.
  await prisma.project.deleteMany({ where: { id: projectId, pursuitId } });
  revalidatePath(`/pursuits/${pursuitId}`);
}

export async function updateProjectDueDate(
  pursuitId: string,
  projectId: string,
  dueDate: string | null,
) {
  await requireAccess(pursuitId);
  await prisma.project.updateMany({
    where: { id: projectId, pursuitId },
    data: { dueDate: dueDate ? new Date(dueDate) : null },
  });
  revalidatePath(`/pursuits/${pursuitId}/projects/${projectId}`);
}

export async function createProjectCard(
  pursuitId: string,
  projectId: string,
  status: ProjectCardStatus,
  title: string,
) {
  await requireAccess(pursuitId);
  if (title.trim() === "") return;

  // Appended past the current highest order in this column, same idea as
  // BrainDump/Note.sectionOrder — a fresh card always lands at the bottom
  // of its column instead of jumbling existing ones.
  const top = await prisma.projectCard.findFirst({
    where: { projectId, status },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  await prisma.projectCard.create({
    data: {
      projectId,
      status,
      title: title.trim(),
      order: (top?.order ?? -1) + 1,
    },
  });
  revalidatePath(`/pursuits/${pursuitId}/projects/${projectId}`);
}

export async function updateProjectCard(
  pursuitId: string,
  projectId: string,
  cardId: string,
  data: { title?: string; description?: string | null },
) {
  await requireAccess(pursuitId);
  await prisma.projectCard.updateMany({
    where: { id: cardId, projectId, project: { pursuitId } },
    data: {
      ...(data.title !== undefined ? { title: data.title.trim() } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
    },
  });
  revalidatePath(`/pursuits/${pursuitId}/projects/${projectId}`);
}

export async function deleteProjectCard(pursuitId: string, projectId: string, cardId: string) {
  await requireAccess(pursuitId);
  await prisma.projectCard.deleteMany({ where: { id: cardId, projectId, project: { pursuitId } } });
  revalidatePath(`/pursuits/${pursuitId}/projects/${projectId}`);
}

// Whole ordered id list for one column, written in one UPDATE (see
// reorderDumpSection).
export async function reorderProjectCards(
  pursuitId: string,
  projectId: string,
  status: ProjectCardStatus,
  orderedCardIds: string[],
) {
  await requireAccess(pursuitId);
  if (orderedCardIds.length === 0) return;
  await prisma.$executeRaw`
    UPDATE "ProjectCard" AS c
    SET "status" = ${status}::"ProjectCardStatus", "order" = (data.ord - 1)
    FROM unnest(${orderedCardIds}::text[]) WITH ORDINALITY AS data(id, ord)
    WHERE c.id = data.id AND c."projectId" = ${projectId}
  `;
  revalidatePath(`/pursuits/${pursuitId}/projects/${projectId}`);
}

// Starter Kanban cards from an assignment's pages.
type ProposedCard = { title: string; description?: string };

// Two calls driven by the browser: readAssignmentPages (one vision call, at
// most MAX_VISION_IMAGES pages) per chunk, then saveProposedCards once. One
// server call looping over every page timed out on long PDFs.
export async function readAssignmentPages(
  pursuitId: string,
  imageUrls: string[],
  firstPage: number,
  totalPages: number,
): Promise<{ error: string | null; cards: ProposedCard[] }> {
  const t = await getT();
  const { session } = await requireAccess(pursuitId);
  const budget = await aiBudget(session.user.id, session.user.email);
  const limited = await budget.check();
  if (limited) return { error: limited, cards: [] };

  if (imageUrls.length === 0) return { error: t("No hay páginas que leer"), cards: [] };
  if (imageUrls.length > MAX_VISION_IMAGES) {
    return { error: `At most ${MAX_VISION_IMAGES} pages per call`, cards: [] };
  }

  const lastPage = firstPage + imageUrls.length - 1;
  const pageRange =
    totalPages > imageUrls.length
      ? ` (pages ${firstPage}-${lastPage} of ${totalPages} — other pages are sent in separate calls, propose cards for ONLY what's visible here)`
      : "";
  const prompt = `The attached image(s) are pages from an assignment description ("enunciado")${pageRange}. Read them and break the assignment down into a short list of concrete to-do cards — one per distinct task/activity/section/deliverable it asks for. Each card's title should be short (a few words); the description can restate that specific task in a bit more detail.

Respond with ONLY a JSON object, no other text: {"cards": [{"title": "...", "description": "..."}, ...]}. Write in the same language as the assignment. Never invent tasks the assignment doesn't actually ask for — an empty {"cards": []} is fine if this page has none.`;

  try {
    const completion = await createJsonCompletion({
      model: VISION_MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            ...imageUrls.map(
              (url): ChatCompletionContentPartImage => ({
                type: "image_url",
                image_url: { url },
              }),
            ),
          ],
        },
      ],
      response_format: { type: "json_object" },
      // Was 4000 — too tight for a page with several tasks: Groq's
      // json_object mode throws json_validate_failed when
      // max_completion_tokens cuts the response off mid-string.
      max_completion_tokens: 8000,
    });
    const text = completion.choices[0]?.message?.content;
    if (!text) return { error: t("La IA ha respondido vacío"), cards: [] };

    const parsed = parseJsonLoosely(text);
    const rawCards =
      parsed && typeof parsed === "object" && Array.isArray((parsed as { cards?: unknown }).cards)
        ? (parsed as { cards: unknown[] }).cards
        : [];
    const cards = rawCards.filter(
      (c): c is ProposedCard =>
        !!c && typeof c === "object" && typeof (c as { title?: unknown }).title === "string",
    );
    return { error: null, cards };
  } catch (err) {
    // Returned, not thrown — the client keeps reading the remaining
    // chunks so one bad page doesn't throw away every other page's cards.
    console.error(`readAssignmentPages: pages ${firstPage}-${lastPage} failed`, err);
    return { error: t("No se ha podido contactar con la IA. Inténtalo en unos minutos."), cards: [] };
  }
}

export async function saveProposedCards(
  pursuitId: string,
  projectId: string,
  proposed: ProposedCard[],
): Promise<{ error: string | null; count?: number }> {
  const t = await getT();
  const { session } = await requireAccess(pursuitId);
  const budget = await aiBudget(session.user.id, session.user.email);

  // requireAccess only proves access to the PURSUIT — make sure this
  // project actually belongs to it, or anyone could write cards into
  // another pursuit's board by passing its projectId.
  const project = await prisma.project.findFirst({
    where: { id: projectId, pursuitId },
    select: { id: true },
  });
  if (!project) return { error: t("Proyecto no encontrado") };

  // The cards come back from the browser, so they're re-validated here
  // rather than trusted as-is.
  const valid = proposed.filter(
    (c) => !!c && typeof c.title === "string" && c.title.trim() !== "",
  );

  // A thorough multi-page read can legitimately propose more cards than
  // a single short assignment — capped generously, but still bounded so
  // one odd document can't flood the board.
  const cards = valid.slice(0, 40);

  await budget.charge();

  if (cards.length === 0) {
    return { error: t("No he encontrado tareas ahí — prueba con una página más clara o añade tarjetas a mano") };
  }

  const top = await prisma.projectCard.findFirst({
    where: { projectId, status: "TODO" },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  let nextOrder = (top?.order ?? -1) + 1;

  await prisma.projectCard.createMany({
    data: cards.map((c) => ({
      projectId,
      status: "TODO" as const,
      title: c.title.trim().slice(0, 200),
      description: typeof c.description === "string" ? c.description.slice(0, 2000) : null,
      order: nextOrder++,
    })),
  });

  revalidatePath(`/pursuits/${pursuitId}/projects/${projectId}`);
  return { error: null, count: cards.length };
}

// A .pptx (read to text in the browser) → a page in the current section,
// then Organize, so the summary appears with the original kept behind it.
export async function importSlides(
  pursuitId: string,
  sectionId: string | null,
  text: string,
): Promise<{ error: string | null }> {
  const t = await getT();
  const { session } = await requireAccess(pursuitId);
  const content = text.trim().slice(0, 60000);
  if (content.length < 20) return { error: t("No he encontrado texto en esas diapositivas") };
  const section = sectionId
    ? await prisma.pursuitContentSection.findFirst({ where: { id: sectionId, pursuitId }, select: { id: true } })
    : null;
  const dump = await prisma.brainDump.create({
    data: {
      pursuitId,
      authorId: session.user.id,
      content,
      lineAuthorIds: content.split("\n").map(() => session.user.id),
      sectionId: section?.id ?? null,
    },
  });
  await prisma.pursuit.update({ where: { id: pursuitId }, data: { lastTouchedAt: new Date() } });
  const organized = await organizeDumps(pursuitId, [dump.id]);
  revalidatePath(`/pursuits/${pursuitId}`);
  // The page exists either way; an Organize failure just means no summary yet.
  return { error: organized.error ? t("Diapositivas importadas, pero el resumen ha fallado: {0}", { 0: organized.error }) : null };
}

// A deck uploaded from the slide panel is also kept in this subject's
// Files, so it's one click away next time.
export async function saveSlideDeck(pursuitId: string, name: string, url: string, size: number, dumpId?: string) {
  await requireAccess(pursuitId);
  if (!/^https:\/\/[\w.-]+\.public\.blob\.vercel-storage\.com\//.test(url)) return null;
  const dump = dumpId ? await prisma.brainDump.findFirst({ where: { id: dumpId, pursuitId }, select: { id: true } }) : null;
  const a = await prisma.attachment.create({
    data: { pursuitId, dumpId: dump?.id ?? null, name: name.trim().slice(0, 200) || "Slides", url, size: Math.max(0, Math.round(size)) },
  });
  revalidatePath(`/pursuits/${pursuitId}`);
  return a.id;
}

// ─── Pages board ───────────────────────────────────────────────────────

// Moves a page (its raw dump and the note organized from it, together)
// to the end of a unit, or out of every unit with sectionId null.
export async function movePage(
  pursuitId: string,
  page: { dumpId: string | null; noteId: string | null },
  sectionId: string | null,
) {
  await requireAccess(pursuitId);
  const section = sectionId
    ? await prisma.pursuitContentSection.findFirst({ where: { id: sectionId, pursuitId }, select: { id: true } })
    : null;
  const target = section?.id ?? null;
  const last = await prisma.brainDump.aggregate({ where: { pursuitId, sectionId: target }, _max: { sectionOrder: true } });
  const order = (last._max.sectionOrder ?? -1) + 1;
  await prisma.$transaction([
    ...(page.dumpId
      ? [prisma.brainDump.updateMany({ where: { id: page.dumpId, pursuitId }, data: { sectionId: target, sectionOrder: order } })]
      : []),
    ...(page.noteId
      ? [prisma.note.updateMany({ where: { id: page.noteId, pursuitId }, data: { sectionId: target, sectionOrder: order } })]
      : []),
  ]);
  revalidatePath(`/pursuits/${pursuitId}`);
}

export async function setUnitClassroom(pursuitId: string, sectionId: string, unit: string | null) {
  await requireAccess(pursuitId);
  const clean = unit && /^UD\d{1,2}$/.test(unit) ? unit : null;
  await prisma.pursuitContentSection.updateMany({ where: { id: sectionId, pursuitId }, data: { classroomUnit: clean } });
  revalidatePath(`/pursuits/${pursuitId}`);
}

export async function renameUnit(pursuitId: string, sectionId: string, name: string): Promise<{ error: string | null }> {
  const t = await getT();
  await requireAccess(pursuitId);
  const clean = name.trim().slice(0, 60);
  if (!clean) return { error: t("Ponle un nombre") };
  const taken = await prisma.pursuitContentSection.findFirst({
    where: { pursuitId, name: clean, id: { not: sectionId } },
    select: { id: true },
  });
  if (taken) return { error: t("Ya hay una unidad llamada \"{0}\"", { 0: clean }) };
  await prisma.pursuitContentSection.updateMany({ where: { id: sectionId, pursuitId }, data: { name: clean } });
  revalidatePath(`/pursuits/${pursuitId}`);
  return { error: null };
}

// ─── Folder layout ─────────────────────────────────────────────────────


export async function saveFolderBlocks(pursuitId: string, blocks: Partial<FolderBlock>[]) {
  await requireAccess(pursuitId);
  const clean = blocks
    .map(cleanFolderBlock)
    .filter((b): b is FolderBlock => b !== null)
    .slice(0, 20);
  await prisma.pursuit.update({ where: { id: pursuitId }, data: { blocks: clean } });
  revalidatePath(`/pursuits/${pursuitId}`);
}

// What this folder's groups are called ("Unidad", "Tema"…). Grouping for
// the first time also creates the first group.
export async function setGroupLabel(pursuitId: string, label: string): Promise<{ error: string | null }> {
  const t = await getT();
  await requireAccess(pursuitId);
  const clean = label.trim().slice(0, 24);
  if (!clean) return { error: t("Ponle un nombre") };
  await prisma.pursuit.update({ where: { id: pursuitId }, data: { groupLabel: clean } });
  const groups = await prisma.pursuitContentSection.count({ where: { pursuitId } });
  if (groups === 0) await prisma.pursuitContentSection.create({ data: { pursuitId, name: `${clean} 1`, order: 0 } });
  revalidatePath(`/pursuits/${pursuitId}`);
  return { error: null };
}

export async function setFolderCover(pursuitId: string, cover: string) {
  await requireAccess(pursuitId);
  const { FOLDER_COVERS } = await import("@/lib/covers");
  if (!(cover in FOLDER_COVERS)) return;
  await prisma.pursuit.update({ where: { id: pursuitId }, data: { cover } });
  revalidatePath(`/pursuits/${pursuitId}`);
  revalidatePath("/pursuits");
}

// Selected text in a page -> a concept in that unit's map.
export async function addToMap(
  pursuitId: string,
  page: { dumpId: string | null; noteId: string | null },
  text: string,
): Promise<{ error: string | null; href?: string }> {
  const { session } = await requireAccess(pursuitId);
  const row = page.noteId
    ? await prisma.note.findFirst({ where: { id: page.noteId, pursuitId }, select: { sectionId: true } })
    : page.dumpId
      ? await prisma.brainDump.findFirst({ where: { id: page.dumpId, pursuitId }, select: { sectionId: true } })
      : null;
  const r = await addNamedConcept(session.user.id, pursuitId, { unitId: row?.sectionId ?? null }, text);
  return r.error === null ? { error: null, href: `/pursuits/${pursuitId}/learn/${r.mapId}?c=${r.conceptId}` } : { error: r.error };
}

// Right-click → rename on the board: the title is the first "# " line of
// both versions of the page.
export async function renamePage(pursuitId: string, page: { dumpId: string | null; noteId: string | null }, title: string): Promise<{ error: string | null }> {
  const t = await getT();
  await requireAccess(pursuitId);
  const clean = title.replace(/\s+/g, " ").trim().slice(0, 140);
  if (!clean) return { error: t("Escribe un título") };
  const [dump, note] = await Promise.all([
    page.dumpId ? prisma.brainDump.findFirst({ where: { id: page.dumpId, pursuitId }, select: { id: true, content: true } }) : null,
    page.noteId ? prisma.note.findFirst({ where: { id: page.noteId, pursuitId }, select: { id: true, content: true } }) : null,
  ]);
  if (!dump && !note) return { error: t("Página no encontrada") };
  await Promise.all([
    dump && prisma.brainDump.update({ where: { id: dump.id }, data: { content: withTitle(clean, splitTitle(dump.content).body) } }),
    note && prisma.note.update({ where: { id: note.id }, data: { content: withTitle(clean, splitTitle(note.content).body) } }),
  ]);
  revalidatePath(`/pursuits/${pursuitId}`);
  return { error: null };
}

// A slide (or the part of it you selected) → clean note text: only what
// it teaches, no header, footer, logo, school, course or slide number.
// The image is a JPEG data URL cropped in the browser.
export async function transcribeSlide(pursuitId: string, image: string): Promise<{ error: string | null; text?: string }> {
  const t = await getT();
  const { userId, session } = await requireAccess(pursuitId);
  const email = session.user?.email;
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(image) || image.length > 6_000_000) return { error: t("Imagen no válida") };
  const budget = await aiBudget(userId, email);
  const limited = await budget.check();
  if (limited) return { error: limited };
  let content = "";
  try {
    const completion = await createJsonCompletion({
      model: VISION_MODEL,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Transcribe this slide (or slide fragment) into a student's notes, smartly.
SKIP everything that isn't content: headers and footers, logos, school/teacher/course/subject names, dates, slide numbers, copyright, "índice"/navigation, decorative text.
KEEP the real content, faithfully and in its original language: titles, explanations, lists, tables, code, formulas. Describe a diagram or picture in one short line only if it carries meaning.
Write it in this plain-text note format:
- "# Title" / "## Subtitle" for headings (only if the fragment has one)
- "- item" for bullets (indent 2 spaces per level), "1. item" for numbered lists
- **bold** where the slide emphasises
- tables as "| a | b |" lines, one per row (first row = header)
- code as a block: a line "<java" (or the language), the code verbatim, then a line ">"
Respond with ONLY JSON: {"text": "..."}`,
            },
            { type: "image_url", image_url: { url: image } },
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 4000,
    });
    const raw = completion.choices[0]?.message?.content ?? "";
    const parsed = parseJsonLoosely(raw) as { text?: unknown } | null;
    content = typeof parsed?.text === "string" ? parsed.text.trim() : "";
  } catch {
    return { error: t("No se ha podido contactar con la IA ahora mismo") };
  }
  if (!content) return { error: t("No he encontrado contenido en esa parte") };
  await budget.charge();
  return { error: null, text: content.slice(0, 20000) };
}
