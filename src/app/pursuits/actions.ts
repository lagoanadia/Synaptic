"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { upsertSection } from "@/lib/sections";
import { isLocale } from "@/lib/i18n";

export async function createPursuit(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Not signed in");
  }

  const title = formData.get("title");
  const type = formData.get("type");
  const sectionName = formData.get("section");

  if (typeof title !== "string" || title.trim() === "") {
    throw new Error("Title is required");
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
    },
  });

  revalidatePath("/pursuits", "layout");
}

export async function deleteSection(sectionId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Not signed in");
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
    throw new Error("Not signed in");
  }

  const pursuit = await prisma.pursuit.findUnique({
    where: { id: pursuitId },
  });
  if (!pursuit) {
    throw new Error("Pursuit not found");
  }
  if (pursuit.ownerId !== session.user.id) {
    throw new Error("Only the owner can delete this pursuit");
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
}

// The new order of the user's sections, from dragging tiles on the home
// screen. Ids that aren't this user's are ignored.
export async function reorderSections(orderedIds: string[]) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not signed in");
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
  if (!session?.user?.id) throw new Error("Not signed in");

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
  if (!session?.user?.id) throw new Error("Not signed in");
  // deleteMany, not delete, scoped to userId so this can't be used to
  // drop another user's subscription by passing their endpoint.
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: session.user.id } });
}

// The language switch in ProfileMenu. Stored on the user so it follows
// them across devices.
export async function setLocale(locale: string) {
  const session = await auth();
  if (!session?.user?.id) return;
  if (!isLocale(locale)) return;
  await prisma.user.update({ where: { id: session.user.id }, data: { locale } });
  revalidatePath("/pursuits", "layout");
}

// The round "+" on the home screen. Returns { error } instead of throwing
// so the inline input can show a message in place.
export async function createSection(name: string): Promise<{ error: string | null; id?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Not signed in" };
  }
  const trimmed = name.trim();
  if (trimmed === "") return { error: "Give it a name" };
  if (trimmed.length > 40) return { error: "Keep it under 40 characters" };

  const section = await upsertSection(session.user.id, trimmed);
  revalidatePath("/pursuits", "layout");
  return { error: null, id: section.id };
}
