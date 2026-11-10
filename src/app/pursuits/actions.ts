"use server";

import { getT } from "@/lib/i18n/server";

import { revalidatePath } from "next/cache";
import { blocksFromTemplate, templateBlocks } from "@/lib/blocks";
import { cleanHomeBlocks } from "@/lib/blocks";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { wipePursuit } from "@/lib/wipe";
import { upsertSection } from "@/lib/sections";

export async function createPursuit(formData: FormData) {
  const t = await getT();
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error(t("No has iniciado sesión"));
  }

  const title = formData.get("title");
  const type = formData.get("type");
  const sectionName = formData.get("section");
  const template = formData.get("template");

  if (typeof title !== "string" || title.trim() === "") {
    throw new Error(t("Falta el título"));
  }

  // Sections are free-typed and stored per user, same as PursuitTag — no
  // fixed preset list, reuse an existing one by name or create it here.
  let sectionId: string | null = null;
  if (typeof sectionName === "string" && sectionName.trim() !== "") {
    const section = await upsertSection(session.user.id, sectionName);
    sectionId = section.id;
  }

  // A template you saved: "u:<id>", only your own.
  const mine = typeof template === "string" && template.startsWith("u:")
    ? await prisma.userTemplate.findFirst({ where: { id: template.slice(2), userId: session.user.id }, select: { blocks: true } })
    : null;

  await prisma.pursuit.create({
    data: {
      title: title.trim(),
      type: typeof type === "string" && type.trim() !== "" ? type.trim() : null,
      ownerId: session.user.id,
      sectionId,
      // A folder template (En blanco / Proyecto / Planificador) sets its blocks.
      ...(template === "blank" || template === "project" || template === "plan" ? { blocks: templateBlocks(template) } : {}),
      ...(mine ? { blocks: blocksFromTemplate(mine.blocks) } : {}),
    },
  });

  revalidatePath("/pursuits", "layout");
}

export async function deleteSection(sectionId: string) {
  const t = await getT();
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error(t("No has iniciado sesión"));
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
  const t = await getT();
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error(t("No has iniciado sesión"));
  }

  const pursuit = await prisma.pursuit.findUnique({
    where: { id: pursuitId },
  });
  if (!pursuit) {
    throw new Error(t("Asignatura no encontrada"));
  }
  if (pursuit.ownerId !== session.user.id) {
    throw new Error(t("Solo la propietaria puede eliminar esta asignatura"));
  }

  await prisma.$transaction(wipePursuit(pursuitId));

  revalidatePath("/pursuits", "layout");
  // Called from the folder's own page: back to its notebook.
  redirect(pursuit.sectionId ? `/pursuits/s/${pursuit.sectionId}` : "/pursuits");
}

// The new order of the user's sections, from dragging tiles on the home
// screen. Ids that aren't this user's are ignored.
export async function reorderSections(orderedIds: string[]) {
  const t = await getT();
  const session = await auth();
  if (!session?.user?.id) throw new Error(t("No has iniciado sesión"));
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
  const t = await getT();
  const session = await auth();
  if (!session?.user?.id) throw new Error(t("No has iniciado sesión"));

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
  const t = await getT();
  const session = await auth();
  if (!session?.user?.id) throw new Error(t("No has iniciado sesión"));
  // deleteMany, not delete, scoped to userId so this can't be used to
  // drop another user's subscription by passing their endpoint.
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: session.user.id } });
}

// The round "+" on the home screen. Returns { error } instead of throwing
// so the inline input can show a message in place.
// template: "study" (subjects with flashcards, maps, review) or "projects"
// (projects with tasks and a calendar). Changeable later in ⚙.
export async function createSection(name: string, template: "study" | "projects" | "general" = "study"): Promise<{ error: string | null; id?: string }> {
  const t = await getT();
  const session = await auth();
  if (!session?.user?.id) {
    return { error: t("No has iniciado sesión") };
  }
  const trimmed = name.trim();
  if (trimmed === "") return { error: t("Ponle un nombre") };
  if (trimmed.length > 40) return { error: t("Máximo 40 caracteres") };

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
  const t = await getT();
  const session = await auth();
  if (!session?.user?.id) return { error: t("No has iniciado sesión") };
  const section = await prisma.section.findFirst({ where: { id: sectionId, userId: session.user.id } });
  if (!section) return { error: t("Libreta no encontrada") };
  const { NOTEBOOK_COVERS } = await import("@/lib/covers");
  const name = data.name?.trim().slice(0, 40);
  if (data.name !== undefined && !name) return { error: t("Ponle un nombre") };
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
    return { error: t("Ya tienes una libreta con ese nombre") };
  }
  revalidatePath("/pursuits", "layout");
  return { error: null };
}

// "Guardar como plantilla": this folder's blocks (not their content) under a
// name, to start new folders from. Same name again replaces it.
export async function saveFolderTemplate(pursuitId: string, name: string): Promise<{ error: string | null }> {
  const t = await getT();
  const session = await auth();
  if (!session?.user?.id) return { error: t("No has iniciado sesión") };
  const clean = name.trim().slice(0, 30);
  if (!clean) return { error: t("Ponle un nombre") };
  const pursuit = await prisma.pursuit.findFirst({
    where: { id: pursuitId, OR: [{ ownerId: session.user.id }, { members: { some: { userId: session.user.id } } }] },
    select: { blocks: true },
  });
  if (!pursuit) return { error: t("Carpeta no encontrada") };
  const blocks = blocksFromTemplate(pursuit.blocks);
  const existing = await prisma.userTemplate.findFirst({ where: { userId: session.user.id, name: clean }, select: { id: true } });
  if (existing) await prisma.userTemplate.update({ where: { id: existing.id }, data: { blocks } });
  else {
    if ((await prisma.userTemplate.count({ where: { userId: session.user.id } })) >= 20) return { error: t("Máximo 20 plantillas") };
    await prisma.userTemplate.create({ data: { userId: session.user.id, name: clean, blocks } });
  }
  revalidatePath("/pursuits", "layout");
  return { error: null };
}

export async function deleteFolderTemplate(id: string) {
  const session = await auth();
  if (!session?.user?.id) return;
  await prisma.userTemplate.deleteMany({ where: { id, userId: session.user.id } });
  revalidatePath("/pursuits", "layout");
}
