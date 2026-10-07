import { prisma } from "@/lib/prisma";

// Sections are free-typed and stored per user — reuse an existing one by
// name, or create it appended at the end of that user's section order
// (rather than defaulting everyone new to 0, which would fight with
// reorderSection's swapped-order values).
export async function upsertSection(userId: string, name: string) {
  const trimmed = name.trim();

  const existing = await prisma.section.findUnique({
    where: { userId_name: { userId, name: trimmed } },
  });
  if (existing) return existing;

  const { _max } = await prisma.section.aggregate({
    where: { userId },
    _max: { order: true },
  });

  return prisma.section.create({
    data: { userId, name: trimmed, order: (_max.order ?? -1) + 1 },
  });
}

// Same idea as upsertSection, but scoped to one Pursuit's own content
// (Brain Dump pages and Organized notes) rather than per-user — see
// PursuitContentSection in the schema for why this is a separate model.
export async function upsertContentSection(pursuitId: string, name: string) {
  const trimmed = name.trim();

  const existing = await prisma.pursuitContentSection.findUnique({
    where: { pursuitId_name: { pursuitId, name: trimmed } },
  });
  if (existing) return existing;

  const { _max } = await prisma.pursuitContentSection.aggregate({
    where: { pursuitId },
    _max: { order: true },
  });

  return prisma.pursuitContentSection.create({
    data: { pursuitId, name: trimmed, order: (_max.order ?? -1) + 1 },
  });
}
