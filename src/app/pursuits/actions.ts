"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PursuitType } from "@/generated/prisma/client";

export async function createPursuit(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Not signed in");
  }

  const title = formData.get("title");
  const type = formData.get("type");
  const customType = formData.get("customType");
  const sectionName = formData.get("section");

  if (typeof title !== "string" || title.trim() === "") {
    throw new Error("Title is required");
  }
  if (typeof type !== "string" || !(type in PursuitType)) {
    throw new Error("Invalid pursuit type");
  }
  if (type === "OTHER" && (typeof customType !== "string" || customType.trim() === "")) {
    throw new Error("Custom type name is required");
  }

  // Sections are free-typed and stored per user, same as PursuitTag — no
  // fixed preset list, reuse an existing one by name or create it here.
  let sectionId: string | null = null;
  if (typeof sectionName === "string" && sectionName.trim() !== "") {
    const section = await prisma.section.upsert({
      where: { userId_name: { userId: session.user.id, name: sectionName.trim() } },
      create: { userId: session.user.id, name: sectionName.trim() },
      update: {},
    });
    sectionId = section.id;
  }

  await prisma.pursuit.create({
    data: {
      title: title.trim(),
      type: type as PursuitType,
      customType:
        type === "OTHER" && typeof customType === "string"
          ? customType.trim()
          : null,
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

  // Notes reference BrainDumps and Tags through join tables, so clear them
  // first — deleting the Pursuit itself would otherwise fail on the
  // straightforward one-to-many foreign keys below.
  await prisma.$transaction([
    prisma.note.deleteMany({ where: { pursuitId } }),
    prisma.brainDump.deleteMany({ where: { pursuitId } }),
    prisma.tag.deleteMany({ where: { pursuitId } }),
    prisma.attachment.deleteMany({ where: { pursuitId } }),
    prisma.pursuitMember.deleteMany({ where: { pursuitId } }),
    prisma.pursuit.delete({ where: { id: pursuitId } }),
  ]);

  revalidatePath("/pursuits");
}
