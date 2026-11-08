import { prisma } from "@/lib/prisma";

// Reuse a section by name, or append one at the end of the user's order.
export async function upsertSection(userId: string, name: string, study = true) {
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
    data: { userId, name: trimmed, study, order: (_max.order ?? -1) + 1 },
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
