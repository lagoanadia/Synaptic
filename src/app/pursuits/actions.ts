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

  if (typeof title !== "string" || title.trim() === "") {
    throw new Error("Title is required");
  }
  if (typeof type !== "string" || !(type in PursuitType)) {
    throw new Error("Invalid pursuit type");
  }
  if (type === "OTHER" && (typeof customType !== "string" || customType.trim() === "")) {
    throw new Error("Custom type name is required");
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
    },
  });

  revalidatePath("/pursuits");
}
