"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { upsertSection } from "@/lib/sections";

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

  revalidatePath("/pursuits");
}

export async function deleteSection(sectionId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Not signed in");
  }

  // Deletes only this user's own section (deleteMany rather than delete so
  // a mismatched userId is silently a no-op instead of a Prisma error).
  // Any pursuit in it falls back to sectionId: null automatically — see
  // the ON DELETE SET NULL on Pursuit.sectionId in the schema.
  await prisma.section.deleteMany({
    where: { id: sectionId, userId: session.user.id },
  });

  revalidatePath("/pursuits");
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

  // Notes reference BrainDumps and Tags through join tables, and Flashcards
  // reference Notes, so clear them first — deleting the Pursuit itself
  // would otherwise fail on the straightforward one-to-many foreign keys
  // below (this is exactly what broke once Flashcard shipped without this
  // list being updated to match).
  await prisma.$transaction([
    prisma.flashcard.deleteMany({ where: { pursuitId } }),
    prisma.note.deleteMany({ where: { pursuitId } }),
    prisma.brainDump.deleteMany({ where: { pursuitId } }),
    prisma.tag.deleteMany({ where: { pursuitId } }),
    prisma.attachment.deleteMany({ where: { pursuitId } }),
    prisma.pursuitMember.deleteMany({ where: { pursuitId } }),
    prisma.pursuit.delete({ where: { id: pursuitId } }),
  ]);

  revalidatePath("/pursuits");
}

// Moves a section's row up or down among the user's other sections by
// swapping its `order` with whichever neighbor sits on that side.
export async function reorderSection(sectionId: string, direction: "up" | "down") {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Not signed in");
  }

  const sections = await prisma.section.findMany({
    where: { userId: session.user.id },
    orderBy: { order: "asc" },
  });
  const index = sections.findIndex((s) => s.id === sectionId);
  if (index === -1) return;

  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= sections.length) return;

  const current = sections[index];
  const neighbor = sections[swapIndex];

  await prisma.$transaction([
    prisma.section.update({ where: { id: current.id }, data: { order: neighbor.order } }),
    prisma.section.update({ where: { id: neighbor.id }, data: { order: current.order } }),
  ]);

  revalidatePath("/pursuits");
}

// Bulk-assigns a (possibly new) section to several of the user's own
// pursuits at once — for cleaning up after a deleted section scattered
// pursuits back into "No section", without re-typing the name on each one.
export async function assignSection(pursuitIds: string[], sectionName: string) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Not signed in");
  }
  if (pursuitIds.length === 0 || sectionName.trim() === "") return;

  const section = await upsertSection(session.user.id, sectionName);

  await prisma.pursuit.updateMany({
    where: { id: { in: pursuitIds }, ownerId: session.user.id },
    data: { sectionId: section.id },
  });

  revalidatePath("/pursuits");
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

// Called by the onboarding tour's last step (or its "skip" link) — once
// set, neither the list-page nor the detail-page tour renders again. See
// src/components/Tour.tsx and src/lib/onboarding.ts.
export async function completeOnboarding() {
  const session = await auth();
  if (!session?.user?.id) return;
  await prisma.user.update({
    where: { id: session.user.id },
    data: { onboardedAt: new Date() },
  });
}

export async function hasPushSubscription(endpoint: string): Promise<boolean> {
  const session = await auth();
  if (!session?.user?.id) return false;
  const sub = await prisma.pushSubscription.findFirst({
    where: { endpoint, userId: session.user.id },
    select: { id: true },
  });
  return !!sub;
}
