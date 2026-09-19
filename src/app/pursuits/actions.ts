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

  if (typeof title !== "string" || title.trim() === "") {
    throw new Error("Title is required");
  }
  if (typeof type !== "string" || !(type in PursuitType)) {
    throw new Error("Invalid pursuit type");
  }

  await prisma.pursuit.create({
    data: {
      title: title.trim(),
      type: type as PursuitType,
      ownerId: session.user.id,
    },
  });

  revalidatePath("/pursuits");
}
