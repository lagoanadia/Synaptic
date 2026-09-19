"use server";

import { revalidatePath } from "next/cache";
import type Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { anthropic } from "@/lib/anthropic";

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

export async function addBrainDump(pursuitId: string, formData: FormData) {
  const { session } = await requireAccess(pursuitId);

  const content = formData.get("content");
  const imageUrl = formData.get("imageUrl");

  const text = typeof content === "string" ? content.trim() : "";
  const image = typeof imageUrl === "string" ? imageUrl.trim() : "";

  if (!text && !image) {
    throw new Error("Add some text or an image URL");
  }

  await prisma.brainDump.create({
    data: {
      pursuitId,
      authorId: session.user.id,
      content: text || null,
      images: image ? [image] : [],
    },
  });

  await prisma.pursuit.update({
    where: { id: pursuitId },
    data: { lastTouchedAt: new Date() },
  });

  revalidatePath(`/pursuits/${pursuitId}`);
}

export async function organizeDumps(pursuitId: string) {
  await requireAccess(pursuitId);

  const dumps = await prisma.brainDump.findMany({
    where: { pursuitId, processed: false },
    orderBy: { createdAt: "asc" },
  });

  if (dumps.length === 0) {
    throw new Error("No new dumps to organize");
  }

  const existingTags = await prisma.tag.findMany({
    where: { pursuitId },
    select: { name: true },
  });

  const content: Anthropic.MessageParam["content"] = [];
  for (const dump of dumps) {
    if (dump.content) {
      content.push({ type: "text", text: dump.content });
    }
    for (const url of dump.images) {
      content.push({ type: "image", source: { type: "url", url } });
    }
  }
  content.push({
    type: "text",
    text: `---\nExisting tags for this pursuit: ${
      existingTags.map((t) => t.name).join(", ") || "(none yet)"
    }\n\nSynthesize the material above into one organized, structured note. Then suggest 1-3 short lowercase tags — reuse an existing tag if one genuinely fits, otherwise propose a new short one. Respond with ONLY a JSON object, no other text: {"content": "...", "tags": ["...", "..."]}`,
  });

  const response = await anthropic.messages.create({
    model: "claude-opus-5",
    max_tokens: 4096,
    messages: [{ role: "user", content }],
  });

  const textBlock = response.content.find(
    (b): b is Anthropic.TextBlock => b.type === "text",
  );
  if (!textBlock) {
    throw new Error("AI did not return a usable response");
  }

  let parsed: { content: string; tags: string[] };
  try {
    parsed = JSON.parse(textBlock.text);
  } catch {
    // Fall back to treating the whole response as the note, no tags.
    parsed = { content: textBlock.text, tags: [] };
  }

  const tagRecords = await Promise.all(
    (parsed.tags ?? []).map((name) =>
      prisma.tag.upsert({
        where: { pursuitId_name: { pursuitId, name } },
        create: { pursuitId, name },
        update: {},
      }),
    ),
  );

  await prisma.note.create({
    data: {
      pursuitId,
      content: parsed.content,
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

export async function addPursuitTag(pursuitId: string, formData: FormData) {
  const { session } = await requireAccess(pursuitId);

  const name = formData.get("name");
  if (typeof name !== "string" || name.trim() === "") {
    throw new Error("Tag name is required");
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
}
