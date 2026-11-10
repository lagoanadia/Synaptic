"use server";

import { revalidatePath } from "next/cache";
import { templateBlocks } from "@/lib/blocks";
import { cleanHomeBlocks } from "@/lib/blocks";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { upsertSection } from "@/lib/sections";

export async function createPursuit(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("No has iniciado sesión");
  }

  const title = formData.get("title");
  const type = formData.get("type");
  const sectionName = formData.get("section");
  const template = formData.get("template");

  if (typeof title !== "string" || title.trim() === "") {
    throw new Error("Falta el título");
  }

  // Sections are free-typed and stored per user, same as PursuitTag — no
  // fixed preset list, reuse an existing one by name or create it here.
  let sectionId: string | null = null;
  if (typeof sectionName === "string" && sectionName.trim() !== "") {
    const section = await upsertSection(session.user.id, sectionName);
    sectionId = section.id;
  }

  await prisma.pursuit.create({
    data: {
      title: title.trim(),
      type: typeof type === "string" && type.trim() !== "" ? type.trim() : null,
      ownerId: session.user.id,
      sectionId,
      // A folder template (En blanco / Proyecto / Plan) sets its blocks.
      ...(template === "blank" || template === "project" || template === "plan" ? { blocks: templateBlocks(template) } : {}),
    },
  });

  revalidatePath("/pursuits", "layout");
}

export async function deleteSection(sectionId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("No has iniciado sesión");
  }

  // Only this user's section; its subjects become unsectioned (ON DELETE SET NULL).
  await prisma.section.deleteMany({
    where: { id: sectionId, userId: session.user.id },
  });

  revalidatePath("/pursuits", "layout");
  // Called from the section's own page, which no longer exists after this.
  redirect("/pursuits");
}

export async function deletePursuit(pursuitId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("No has iniciado sesión");
  }

  const pursuit = await prisma.pursuit.findUnique({
    where: { id: pursuitId },
  });
  if (!pursuit) {
    throw new Error("Asignatura no encontrada");
  }
  if (pursuit.ownerId !== session.user.id) {
    throw new Error("Solo la propietaria puede eliminar esta asignatura");
  }

  // Children first: the foreign keys to Pursuit don't cascade.
  await prisma.$transaction([
    prisma.flashcard.deleteMany({ where: { pursuitId } }),
    prisma.note.deleteMany({ where: { pursuitId } }),
    prisma.brainDump.deleteMany({ where: { pursuitId } }),
    // Has a plain (no-cascade) FK to Pursuit too — left out of this list,
    // any pursuit with a U1/U2-style content section failed to delete.
    prisma.pursuitContentSection.deleteMany({ where: { pursuitId } }),
    prisma.tag.deleteMany({ where: { pursuitId } }),
    prisma.attachment.deleteMany({ where: { pursuitId } }),
    prisma.pursuitMember.deleteMany({ where: { pursuitId } }),
    // ProjectCard cascades from Project, so deleting Project is enough.
    prisma.project.deleteMany({ where: { pursuitId } }),
    prisma.pursuit.delete({ where: { id: pursuitId } }),
  ]);

  revalidatePath("/pursuits", "layout");
  // Called from the folder's own page: back to its notebook.
  redirect(pursuit.sectionId ? `/pursuits/s/${pursuit.sectionId}` : "/pursuits");
}

// The new order of the user's sections, from dragging tiles on the home
// screen. Ids that aren't this user's are ignored.
export async function reorderSections(orderedIds: string[]) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No has iniciado sesión");
  const mine = await prisma.section.findMany({ where: { userId: session.user.id }, select: { id: true } });
  const owned = new Set(mine.map((s) => s.id));
  const ids = orderedIds.filter((id) => owned.has(id));
  await prisma.$transaction(ids.map((id, order) => prisma.section.update({ where: { id }, data: { order } })));
  revalidatePath("/pursuits", "layout");
}

export type PushSubscriptionInput = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

// One row per browser push endpoint, not per user — upsert on endpoint so
// re-subscribing (e.g. after clearing site data) doesn't create a
// duplicate row for the same browser.
export async function subscribeToPush(subscription: PushSubscriptionInput) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No has iniciado sesión");

  await prisma.pushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    create: {
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userId: session.user.id,
    },
    update: {
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userId: session.user.id,
    },
  });
}

export async function unsubscribeFromPush(endpoint: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No has iniciado sesión");
  // deleteMany, not delete, scoped to userId so this can't be used to
  // drop another user's subscription by passing their endpoint.
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: session.user.id } });
}

// The round "+" on the home screen. Returns { error } instead of throwing
// so the inline input can show a message in place.
// template: "study" (subjects with flashcards, maps, review) or "projects"
// (projects with tasks and a calendar). Changeable later in ⚙.
export async function createSection(name: string, template: "study" | "projects" | "general" = "study"): Promise<{ error: string | null; id?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "No has iniciado sesión" };
  }
  const trimmed = name.trim();
  if (trimmed === "") return { error: "Ponle un nombre" };
  if (trimmed.length > 40) return { error: "Máximo 40 caracteres" };

  const section = await upsertSection(session.user.id, trimmed, template === "study", template);
  revalidatePath("/pursuits", "layout");
  return { error: null, id: section.id };
}

// The home page's blocks (lib/blocks.ts), as arranged in edit mode.
export async function saveHomeBlocks(blocks: { id: string; type: string; sectionId: string | null; pursuitId?: string | null }[]) {
  const session = await auth();
  if (!session?.user?.id) return;
  const [sections, pursuits] = await Promise.all([
    prisma.section.findMany({ where: { userId: session.user.id }, select: { id: true } }),
    prisma.pursuit.findMany({ where: { OR: [{ ownerId: session.user.id }, { members: { some: { userId: session.user.id } } }] }, select: { id: true } }),
  ]);
  const clean = cleanHomeBlocks(blocks, new Set(sections.map((s) => s.id)), new Set(pursuits.map((p) => p.id)));
  await prisma.user.update({ where: { id: session.user.id }, data: { homeBlocks: clean } });
  revalidatePath("/pursuits");
}

// Notebook settings: study tools on/off and its cover.
export async function setNotebook(sectionId: string, data: { study?: boolean; kind?: "study" | "projects" | "general"; cover?: string; name?: string }): Promise<{ error: string | null }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "No has iniciado sesión" };
  const section = await prisma.section.findFirst({ where: { id: sectionId, userId: session.user.id } });
  if (!section) return { error: "Libreta no encontrada" };
  const { NOTEBOOK_COVERS } = await import("@/lib/covers");
  const name = data.name?.trim().slice(0, 40);
  if (data.name !== undefined && !name) return { error: "Ponle un nombre" };
  try {
    await prisma.section.update({
      where: { id: sectionId },
      data: {
        ...(typeof data.study === "boolean" ? { study: data.study } : {}),
        ...(data.kind && ["study", "projects", "general"].includes(data.kind) ? { kind: data.kind, study: data.kind === "study" } : {}),
        ...(data.cover && (NOTEBOOK_COVERS as readonly string[]).includes(data.cover) ? { cover: data.cover } : {}),
        ...(name ? { name } : {}),
      },
    });
  } catch {
    return { error: "Ya tienes una libreta con ese nombre" };
  }
  revalidatePath("/pursuits", "layout");
  return { error: null };
}
